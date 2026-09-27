import { createContext, useCallback, useContext, type ReactNode } from 'react'
import type { PyodideInterface } from 'pyodide'
import { usePyodide } from '../hooks/usePyodide'
import type { FileMap, OutputLine, RunResult } from '../types/editor'

interface PyodideContextValue {
  pyodide: PyodideInterface | null
  ready: boolean
  runCode: (
    activeFile: string,
    fileMap: FileMap,
    onLine: (line: OutputLine) => void,
    onAwaitInput: (prompt: string) => Promise<string>
  ) => Promise<RunResult>
}

const PyodideContext = createContext<PyodideContextValue | null>(null)

// Install streaming stdout and async input() override, then compile+exec the code.
// onOutput is called for each chunk written to stdout.
// onInput is called when input() is hit — must return a Promise<string>.
// Strategy: rewrite user code at the AST level so every input(...) call becomes
// await input(...), then compile and run the result as an async coroutine.
// This is the only correct approach in Pyodide — synchronous exec() cannot
// suspend mid-execution to await a JS Promise. The AST transform is transparent
// to the user: they write `name = input("x")` and it just works.
const EXEC_WRAPPER = `
import sys, io, codeop, traceback, builtins, ast, asyncio

class _AwaitInputTransformer(ast.NodeTransformer):
    """Replace bare input(...) calls with await input(...) calls."""
    def visit_Call(self, node):
        self.generic_visit(node)
        func = node.func
        is_input = (
            (isinstance(func, ast.Name) and func.id == 'input') or
            (isinstance(func, ast.Attribute) and func.attr == 'input')
        )
        if is_input:
            return ast.Await(value=node)
        return node

async def _run(code_str, filename, on_output, on_input):
    # Completeness check: codeop returns None for incomplete, raises for syntax errors
    try:
        probe = codeop.compile_command(code_str, filename, 'exec')
    except SyntaxError:
        return ('syntax_error', traceback.format_exc())
    if probe is None:
        return ('incomplete', None)

    # Full parse for AST transform (syntax already validated above)
    tree = ast.parse(code_str, filename=filename, mode='exec')

    if not tree.body:
        return ('incomplete', None)

    # Rewrite input() -> await input() throughout the AST
    tree = _AwaitInputTransformer().visit(tree)
    ast.fix_missing_locations(tree)

    # Wrap the module body in an async function so await is valid
    wrapper = ast.AsyncFunctionDef(
        name='_user_coro',
        args=ast.arguments(posonlyargs=[], args=[], vararg=None,
                           kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]),
        body=tree.body,
        decorator_list=[],
        returns=None,
    )
    ast.fix_missing_locations(wrapper)
    module = ast.Module(body=[wrapper], type_ignores=[])
    ast.fix_missing_locations(module)

    try:
        code_obj = compile(module, filename, 'exec')
    except Exception:
        return ('syntax_error', traceback.format_exc())

    # Streaming stdout
    class _StreamingIO:
        def write(self, s):
            if s:
                on_output(s)
        def flush(self):
            pass

    old_stdout = sys.stdout
    sys.stdout = _StreamingIO()

    # Async input() override — on_input is a JS Promise; await it for real
    old_input = builtins.input
    async def _async_input(prompt=''):
        return await on_input(str(prompt) if prompt else '')
    builtins.input = _async_input

    try:
        globs = {'__name__': '__main__', '__file__': filename}
        exec(code_obj, globs)           # defines _user_coro in globs
        await globs['_user_coro']()     # runs it; await suspends at each input()
        return ('ok', None)
    except Exception:
        raw = traceback.format_exc()
        lines = raw.splitlines(keepends=True)
        # Internal names produced by the wrapper — strip any frame that mentions them
        _INTERNAL = ('_user_coro', '_exec_coro', '_async_input', '_StreamingIO',
                     '_run', '_AwaitInputTransformer', '<exec>', 'exec(code_obj')
        filtered = []
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if stripped.startswith('File '):
                # Keep only frames inside user files (/home/pyodide/)
                if '/home/pyodide/' not in line or any(name in line for name in _INTERNAL):
                    # Skip this frame line and its code-snippet line
                    i += 2
                    continue
            else:
                # Non-frame lines: strip if they reference an internal name
                if any(name in line for name in _INTERNAL):
                    i += 1
                    continue
            filtered.append(line)
            i += 1
        return ('runtime_error', ''.join(filtered).rstrip())
    finally:
        sys.stdout = old_stdout
        builtins.input = old_input
`

export function PyodideProvider({ children }: { children: ReactNode }) {
  const { pyodide, ready } = usePyodide()

  const runCode = useCallback(
    async (
      activeFile: string,
      fileMap: FileMap,
      onLine: (line: OutputLine) => void,
      onAwaitInput: (prompt: string) => Promise<string>
    ): Promise<RunResult> => {
      if (!ready || !pyodide) {
        return { lines: [] }
      }

      // Write all files into the virtual filesystem
      const enc = new TextEncoder()
      for (const [filename, state] of Object.entries(fileMap)) {
        pyodide.FS.writeFile(`/home/pyodide/${filename}`, enc.encode(state.content))
      }

      // Ensure /home/pyodide is on sys.path (idempotent)
      await pyodide.runPythonAsync(`
import sys
if '/home/pyodide' not in sys.path:
    sys.path.insert(0, '/home/pyodide')
`)

      // Install the exec wrapper (idempotent re-exec)
      await pyodide.runPythonAsync(EXEC_WRAPPER)

      // Stdout chunks are accumulated here in JS and also pushed live to React via onLine.
      // We buffer partial lines and only emit a complete OutputLine when we see a newline.
      const lines: OutputLine[] = []
      let stdoutBuffer = ''

      // Called by Python's _StreamingIO.write() for every stdout chunk
      const handleOutput = (chunk: string) => {
        stdoutBuffer += chunk
        // Flush all complete lines from the buffer
        let nl: number
        while ((nl = stdoutBuffer.indexOf('\n')) !== -1) {
          const text = stdoutBuffer.slice(0, nl)
          stdoutBuffer = stdoutBuffer.slice(nl + 1)
          const line: OutputLine = { type: 'stdout', text }
          lines.push(line)
          onLine(line)
        }
      }

      // Called by Python's builtins.input() override — returns a JS Promise that
      // resolves when the user submits the inline input field in OutputPane.
      const handleInput = (prompt: string): Promise<string> => {
        // Flush any buffered partial stdout before showing the input prompt
        if (stdoutBuffer) {
          const line: OutputLine = { type: 'stdout', text: stdoutBuffer }
          stdoutBuffer = ''
          lines.push(line)
          onLine(line)
        }
        // Delegate to the React-side resolver (set up in useEditor)
        return onAwaitInput(prompt)
      }

      // Expose callbacks to Python via pyodide.globals
      pyodide.globals.set('_js_on_output', handleOutput)
      pyodide.globals.set('_js_on_input', handleInput)

      const code = fileMap[activeFile]?.content ?? ''
      const result = await pyodide.runPythonAsync(
        `_run(${JSON.stringify(code)}, ${JSON.stringify(activeFile)}, _js_on_output, _js_on_input)`
      )

      // Flush any remaining partial stdout (no trailing newline)
      if (stdoutBuffer) {
        const line: OutputLine = { type: 'stdout', text: stdoutBuffer }
        stdoutBuffer = ''
        lines.push(line)
        onLine(line)
      }

      // Clean up globals
      pyodide.globals.delete('_js_on_output')
      pyodide.globals.delete('_js_on_input')

      const [status, value] = result.toJs()

      if (status === 'syntax_error' || status === 'runtime_error') {
        const errLine: OutputLine = { type: 'error', text: value as string }
        lines.push(errLine)
        onLine(errLine)
      }

      return { lines }
    },
    [pyodide, ready]
  )

  return (
    <PyodideContext.Provider value={{ pyodide, ready, runCode }}>
      {children}
    </PyodideContext.Provider>
  )
}

export function usePyodideContext(): PyodideContextValue {
  const ctx = useContext(PyodideContext)
  if (!ctx) {
    throw new Error('usePyodideContext must be used within a PyodideProvider')
  }
  return ctx
}
