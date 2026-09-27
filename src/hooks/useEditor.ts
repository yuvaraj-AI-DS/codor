import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileMap, FileState, OutputLine } from '../types/editor'
import type { RunOutcome } from './useEfficiencyScore'
import { usePyodideContext } from '../context/PyodideContext'

const STARTER_CONTENT = '# Write your Python code here\n'

const initialFileMap: FileMap = {
  'main.py': { content: STARTER_CONTENT, lines: [], pendingInput: null, running: false },
}

export function useEditor(onRunComplete?: (outcome: RunOutcome) => void) {
  const [fileMap, setFileMap] = useState<FileMap>(initialFileMap)
  const [activeFile, setActiveFile] = useState<string>('main.py')
  const [autorun, setAutorun] = useState(true)
  const { runCode, ready } = usePyodideContext()

  // Ref always holds the latest fileMap so debounce closures see current state
  const fileMapRef = useRef<FileMap>(fileMap)
  fileMapRef.current = fileMap

  // One debounce timer per filename
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Always-current ref to executeFile — lets the debounce setTimeout closure call the
  // latest version without needing executeFile in updateContent's dependency array.
  const executeFileRef = useRef<(filename: string) => void>(() => {})

  // Stash for the pending input() Promise resolver — keyed by filename
  const inputResolvers = useRef<Record<string, (value: string) => void>>({})

  // Monotonically increasing run-id per filename.
  const runIds = useRef<Record<string, number>>({})

  // Input cache: Record<filename, Record<promptKey, resolvedValue>>
  // Keyed by prompt string. Populated after each modal submission.
  // Cleared on Reset. Never triggers React renders — purely imperative.
  const inputCache = useRef<Record<string, Record<string, string>>>({})

  // ── Tab operations ────────────────────────────────────────────────────────

  const addTab = useCallback(() => {
    setFileMap(prev => {
      let counter = 1
      while (prev[`script${counter}.py`]) counter++
      const name = `script${counter}.py`
      const next = {
        ...prev,
        [name]: { content: '', lines: [], pendingInput: null, running: false } satisfies FileState,
      }
      setTimeout(() => setActiveFile(name), 0)
      return next
    })
  }, [])

  const renameTab = useCallback((oldName: string, newName: string) => {
    if (!newName || !newName.endsWith('.py')) return
    setFileMap(prev => {
      if (newName === oldName) return prev
      if (prev[newName]) return prev
      const next: FileMap = {}
      for (const key of Object.keys(prev)) {
        next[key === oldName ? newName : key] = prev[key]
      }
      return next
    })
    setActiveFile(current => (current === oldName ? newName : current))
  }, [])

  const closeTab = useCallback((filename: string) => {
    setFileMap(prev => {
      const keys = Object.keys(prev)
      if (keys.length === 1) return prev

      const idx = keys.indexOf(filename)
      const next: FileMap = {}
      for (const key of keys) {
        if (key !== filename) next[key] = prev[key]
      }

      setActiveFile(current => {
        if (current !== filename) return current
        const remainingKeys = keys.filter(k => k !== filename)
        return remainingKeys[Math.max(0, idx - 1)] ?? remainingKeys[0]
      })

      return next
    })
  }, [])

  // ── Abort any in-flight run for a file ───────────────────────────────────

  const abortRun = useCallback((filename: string) => {
    runIds.current[filename] = (runIds.current[filename] ?? 0) + 1
    const staleResolver = inputResolvers.current[filename]
    if (staleResolver) {
      delete inputResolvers.current[filename]
      staleResolver('')
    }
  }, [])

  // ── Core execution ────────────────────────────────────────────────────────

  const executeFile = useCallback(
    async (filename: string) => {
      abortRun(filename)
      const myRunId = (runIds.current[filename] ?? 0)
      const snapshot = fileMapRef.current
      const isCurrent = () => runIds.current[filename] === myRunId
      const startMs = Date.now()

      setFileMap(prev => {
        if (!isCurrent()) return prev
        return { ...prev, [filename]: { ...prev[filename], lines: [], pendingInput: null, running: true } }
      })

      const onLine = (line: OutputLine) => {
        if (!isCurrent()) return
        setFileMap(prev => {
          const cur = prev[filename]
          if (!cur || !isCurrent()) return prev
          return { ...prev, [filename]: { ...cur, lines: [...cur.lines, line] } }
        })
      }

      const onAwaitInput = (prompt: string): Promise<string> => {
        if (!isCurrent()) return Promise.resolve('')

        // Cache hit: reuse the stored value, emit a cached-input indicator line
        const fileCache = inputCache.current[filename] ?? {}
        if (prompt in fileCache) {
          const cached = fileCache[prompt]
          const cacheLine: OutputLine = { type: 'cached-input', prompt, value: cached }
          // Emit synchronously via onLine, then resolve immediately
          onLine(cacheLine)
          return Promise.resolve(cached)
        }

        // Cache miss: show modal, store result on resolution
        return new Promise<string>(resolve => {
          inputResolvers.current[filename] = (value: string) => {
            // Store in cache keyed by prompt
            if (!inputCache.current[filename]) inputCache.current[filename] = {}
            inputCache.current[filename][prompt] = value
            resolve(value)
          }
          setFileMap(prev => {
            const cur = prev[filename]
            if (!cur || !isCurrent()) return prev
            return { ...prev, [filename]: { ...cur, pendingInput: { prompt } } }
          })
        })
      }

      const result = await runCode(filename, snapshot, onLine, onAwaitInput)

      if (isCurrent()) {
        // Determine outcome for efficiency score.
        // Read the error from runCode's return value: fileMapRef only updates on
        // re-render, which may not have happened yet when this line runs.
        const errorLine = result.lines.find(
          (l): l is Extract<OutputLine, { type: 'error' }> => l.type === 'error'
        )
        const lineCount = (fileMapRef.current[filename]?.content ?? '').split('\n').filter(l => l.trim()).length
        // Skip recording when Pyodide wasn't loaded — runCode returned without executing
        if (ready) {
          onRunComplete?.({
            success: !errorLine,
            durationMs: Date.now() - startMs,
            lineCount,
            filename,
            errorText: errorLine?.text,
          })
        }

        setFileMap(prev => ({
          ...prev,
          [filename]: { ...prev[filename], running: false, pendingInput: null },
        }))
      }
    },
    [runCode, ready, abortRun, onRunComplete]
  )

  // Keep executeFileRef pointing at the latest executeFile after every render
  executeFileRef.current = executeFile

  // ── Content update + debounced execution ─────────────────────────────────

  const updateContent = useCallback(
    (filename: string, content: string) => {
      // If waiting for modal input, only update content — do not disturb the run
      if (inputResolvers.current[filename]) {
        setFileMap(prev => ({ ...prev, [filename]: { ...prev[filename], content } }))
        return
      }

      abortRun(filename)
      setFileMap(prev => ({
        ...prev,
        [filename]: { ...prev[filename], content, lines: [], pendingInput: null, running: false },
      }))

      if (!autorun) return  // autorun OFF — no debounce, wait for manual Run

      // Use a longer debounce when the code contains input() so the modal doesn't
      // interrupt the user before they've finished writing the rest of their program.
      const delay = /\binput\s*\(/.test(content) ? 1800 : 400

      if (debounceTimers.current[filename]) clearTimeout(debounceTimers.current[filename])
      debounceTimers.current[filename] = setTimeout(() => {
        void executeFileRef.current(filename)
      }, delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autorun, abortRun]
  )

  // ── Workspace-level operations (import / checkpoint restore) ────────────

  // File to run once the fileMap containing it has rendered (so fileMapRef is current)
  const pendingRun = useRef<string | null>(null)

  useEffect(() => {
    const f = pendingRun.current
    if (!f || !fileMap[f]) return
    pendingRun.current = null
    if (autorun) void executeFileRef.current(f)
  }, [fileMap, autorun])

  /** Add files as new tabs. Name clashes become name_1.py, name_2.py (still importable). */
  const addFiles = useCallback((files: Array<{ name: string; content: string }>): string[] => {
    if (!files.length) return []
    const taken = new Set(Object.keys(fileMapRef.current))
    const added: Array<[string, string]> = []
    for (const f of files) {
      let name = f.name
      if (taken.has(name)) {
        const base = name.replace(/\.py$/i, '')
        let i = 1
        while (taken.has(`${base}_${i}.py`)) i++
        name = `${base}_${i}.py`
      }
      taken.add(name)
      added.push([name, f.content])
    }
    setFileMap(prev => {
      const next = { ...prev }
      for (const [name, content] of added) {
        next[name] = { content, lines: [], pendingInput: null, running: false }
      }
      return next
    })
    const last = added[added.length - 1][0]
    setActiveFile(last)
    pendingRun.current = last
    return added.map(([n]) => n)
  }, [])

  /** Replace every tab with the given files (checkpoint restore). */
  const replaceWorkspace = useCallback((files: Record<string, string>, preferredActive: string) => {
    const names = Object.keys(files)
    if (!names.length) return
    for (const f of Object.keys(fileMapRef.current)) {
      abortRun(f)
      if (debounceTimers.current[f]) clearTimeout(debounceTimers.current[f])
    }
    const next: FileMap = {}
    for (const name of names) next[name] = { content: files[name], lines: [], pendingInput: null, running: false }
    const active = files[preferredActive] !== undefined ? preferredActive : names[0]
    setFileMap(next)
    setActiveFile(active)
    pendingRun.current = active
  }, [abortRun])

  // Manual run — used when autorun is OFF or by any explicit trigger
  const manualRun = useCallback(
    (filename: string) => {
      void executeFile(filename)
    },
    [executeFile]
  )

  // Submit value from the modal — also caches it
  const submitInput = useCallback((filename: string, value: string) => {
    const resolve = inputResolvers.current[filename]
    if (!resolve) return

    delete inputResolvers.current[filename]

    setFileMap(prev => {
      const cur = prev[filename]
      if (!cur) return prev
      const echoLine: OutputLine = {
        type: 'input-echo',
        prompt: cur.pendingInput?.prompt ?? '',
        value,
      }
      return { ...prev, [filename]: { ...cur, pendingInput: null, lines: [...cur.lines, echoLine] } }
    })

    resolve(value) // triggers the cache-store path inside onAwaitInput's resolver wrapper
  }, [])

  // Reset: clear state, score session, then immediately re-run the current code
  const resetOutput = useCallback((filename: string, onReset?: () => void) => {
    abortRun(filename)
    delete inputCache.current[filename]
    onReset?.()
    setFileMap(prev => ({
      ...prev,
      [filename]: { ...prev[filename], lines: [], pendingInput: null, running: false },
    }))
    // Re-run immediately — user clicked Reset to get a fresh execution, not a blank panel
    void executeFileRef.current(filename)
  }, [abortRun])

  return {
    fileMap,
    activeFile,
    setActiveFile,
    autorun,
    setAutorun,
    addTab,
    renameTab,
    closeTab,
    updateContent,
    manualRun,
    submitInput,
    resetOutput,
    addFiles,
    replaceWorkspace,
  }
}
