# Python Browser Editor — Implementation Plan

## Overview

Build a browser-based, real-time Python code editor using Vite + React + TypeScript, Monaco Editor,
Pyodide (in-browser Python), and Tailwind CSS. No backend. Users can create, rename, and close tabs
at runtime; each tab is an independent Python file written into Pyodide's virtual filesystem so they
can import each other. Execution is debounced (~400 ms after the user stops typing) and gated by a
`codeop.compile_command()` completeness check. Output and errors display in a right-side panel and
are cleared on every new run.

---

## Sub-Task 1 — Project Scaffold

**Status:** `[x] done`

**Intent**
Bootstrap the Vite + React + TypeScript project, install all dependencies, and configure Tailwind CSS
so subsequent sub-tasks start from a clean, working baseline.

**Expected Outcomes**
- `npm run dev` starts without errors and renders a blank React page.
- Tailwind utility classes work in components.
- Monaco Editor and Pyodide packages are present in `node_modules`.
- TypeScript compiles without errors.

**Todo List**
1. Run `npm create vite@latest . -- --template react-ts` in the workspace root.
2. Install runtime dependencies: `@monaco-editor/react`, `pyodide`.
3. Install and configure Tailwind CSS v3: `tailwindcss`, `postcss`, `autoprefixer`;
   create `tailwind.config.js` with `content: ["./index.html","./src/**/*.{ts,tsx}"]`.
4. Add `@tailwind base/components/utilities` directives to `src/index.css`.
5. Configure `vite.config.ts` to set `optimizeDeps.exclude: ["pyodide"]` and
   `worker.format: "es"` — Pyodide must not be pre-bundled by Vite.
6. Remove Vite boilerplate from `App.tsx`; confirm blank page renders.

**Relevant Context**
- Pyodide distributes its own WASM assets; Vite must not try to bundle them.
  The `pyodide` npm package exposes `loadPyodide` which fetches assets from a CDN by default.

---

## Sub-Task 2 — Pyodide Integration (`usePyodide` hook + context)

**Status:** `[x] done`

**Intent**
Load Pyodide once as a singleton, expose it via React context, and implement the core
`runCode(filename, allFiles)` function that writes all files to the VFS, calls
`codeop.compile_command()`, and either does nothing / returns a formatted error / executes the code.

**Expected Outcomes**
- `PyodideProvider` wraps the app and exposes `{ pyodide, ready, runCode }`.
- `runCode` returns `{ output: string | null, error: string | null }`.
- Calling `runCode` with incomplete code returns `{ output: null, error: null }`.
- Calling `runCode` with invalid syntax returns `{ output: null, error: "<formatted traceback>" }`.
- Calling `runCode` with valid code returns `{ output: "<stdout>", error: null }`.
- All sibling files are written to the VFS before execution so cross-file imports resolve.

**Todo List**
1. Create `src/hooks/usePyodide.ts` — async-loads Pyodide on mount, stores instance in a ref,
   sets a `ready: boolean` state.
2. Create `src/context/PyodideContext.tsx` — provides `{ pyodide, ready, runCode }`.
3. Implement `runCode(activeFile: string, fileMap: FileMap): Promise<RunResult>`:
   a. Write every entry in `fileMap` to Pyodide's FS at `/home/pyodide/<filename>`.
   b. Run `codeop.compile_command(code)` via `pyodide.runPython(...)`:
      - Returns `None` → incomplete → return `{ output: null, error: null }`.
      - Raises `SyntaxError` → return `{ output: null, error: format_exc() }`.
      - Returns a code object → proceed to execution.
   c. Redirect `sys.stdout` to a `StringIO` buffer before `exec`.
   d. Execute the compiled code object; capture and return stdout.
   e. On any runtime exception, capture `traceback.format_exc()` as `error`.
4. Wrap the app in `<PyodideProvider>` in `main.tsx`.

**Relevant Context**
- `pyodide.FS.writeFile(path, content)` writes UTF-8 strings to the virtual FS.
- `sys.path` must include `/home/pyodide` so `import helper` resolves.
- Use `pyodide.runPython` with a multi-line Python string for the compile/exec wrapper;
  avoid `pyodide.globals` mutation for thread-safety.

---

## Sub-Task 3 — Editor State (`useEditor` hook)

**Status:** `[x] done`

**Intent**
Manage all per-tab file state (name, content, output, error) and the debounced execution trigger.
This hook is the single source of truth for the editor; components are purely presentational.

**Expected Outcomes**
- `fileMap` holds `Record<string, FileState>` where `FileState = { content, output, error }`.
- `activeFile` is the currently selected filename.
- Tab add / rename / close operations update `fileMap` correctly (close guards against deleting last tab).
- Every content change schedules a debounced `runCode` call (~400 ms); the timer resets on each keystroke.
- `runCode` results are written back into `fileMap[filename].output / .error` (overwriting, not appending).
- Switching tabs does not cancel an in-flight debounce for another tab.

**Todo List**
1. Define `FileState` and `FileMap` types in `src/types/editor.ts`.
2. Create `src/hooks/useEditor.ts`:
   - Initialize with a single tab `main.py` containing a starter comment.
   - Expose `{ fileMap, activeFile, setActiveFile, addTab, renameTab, closeTab, updateContent }`.
3. Inside `updateContent`, use `useRef` to hold the debounce timer per filename
   (a `Record<string, ReturnType<typeof setTimeout>>`).
4. Debounce fires `runCode(filename, fileMap)` from `PyodideContext`; on resolution write result
   back via a functional `setFileMap` update to avoid stale closure issues.
5. `closeTab`: if closing the active tab, activate the nearest remaining tab.
6. `renameTab`: validate no duplicate names, update the key in `fileMap`.

**Relevant Context**
- Per-file debounce timers (not a single shared timer) ensure tab switching does not inadvertently
  cancel execution of a file the user edited before switching.

---

## Sub-Task 4 — UI Components

**Status:** `[x] done`

**Intent**
Build the three visible UI regions — `TabBar`, `EditorPane`, and `OutputPane` — wired to the state
from `useEditor` and `PyodideContext`. All styling via Tailwind CSS.

**Expected Outcomes**
- Layout: full-viewport height, tab bar across the top, editor on the left (~60% width),
  output panel on the right (~40% width).
- `TabBar`: shows all filenames; active tab is visually distinct; each tab has an inline rename
  (double-click to edit) and a close button (hidden on last tab); an "+" button adds a new tab.
- `EditorPane`: Monaco Editor fills its container; language is always `python`; switching tabs
  swaps the model (preserves cursor/scroll per tab via Monaco's `ITextModel`).
- `OutputPane`: shows stdout in a `<pre>` block (green tint); shows error in a `<pre>` block
  (red tint); shows a "Pyodide loading…" message while `ready === false`.
- A thin status bar at the bottom shows which file is active and whether Pyodide is ready.

**Todo List**
1. Create `src/components/TabBar.tsx` — renders tabs from `fileMap` keys; handles add/rename/close.
2. Create `src/components/EditorPane.tsx` — wraps `<Editor>` from `@monaco-editor/react`;
   uses `onMount` to cache the Monaco instance; switches models on `activeFile` change.
3. Create `src/components/OutputPane.tsx` — reads `fileMap[activeFile].output` and `.error`;
   displays appropriate panel or idle state.
4. Assemble layout in `src/App.tsx` using Tailwind flex/grid utilities.
5. Add a `LoadingOverlay` shown while `ready === false` that does not block the editor.

**Relevant Context**
- Monaco's `@monaco-editor/react` wrapper accepts a `path` prop that automatically manages
  separate undo/redo stacks and cursor positions per file — use this instead of manual model
  switching.
- Tailwind JIT must be running (Vite's dev server handles this automatically).

---

## Sub-Task 5 — Integration & Polish

**Status:** `[x] done`

**Intent**
Wire all sub-tasks together, verify the full user flow end-to-end, and add final polish:
cross-file imports, error formatting, and edge-case handling.

**Expected Outcomes**
- User can type in `main.py`, import from `helper.py`, and see combined output.
- Incomplete code (e.g. `def foo():` with no body) produces no output and no error.
- Syntax errors show a clean Python traceback in the error panel.
- Runtime exceptions (e.g. `1/0`) show a clean traceback.
- Adding, renaming, and closing tabs works without page reload or console errors.
- Output clears immediately when the user starts typing (before debounce fires).

**Todo List**
1. Confirm `sys.path` includes `/home/pyodide` in the Pyodide init sequence.
2. Clear `output` and `error` for the active file immediately on first keystroke (before debounce).
3. Test cross-file import: `helper.py` defines a function, `main.py` imports and calls it.
4. Verify the `codeop` path: multi-line incomplete constructs wait silently; only completed
   blocks execute.
5. Format Python tracebacks: strip the internal `exec`/`runPython` frames so users see only their
   own code's traceback lines.
6. Keyboard shortcut `Ctrl+N` / `Cmd+N` to add a new tab.
7. Final Tailwind pass — ensure editor and output panel are responsive down to ~900 px wide.
