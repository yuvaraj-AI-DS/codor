/** Derived UI state for one file, computed from fileMap + execution history */
export type RunStatus =
  | 'loading'   // Pyodide still booting
  | 'idle'      // no run recorded for this file yet
  | 'running'   // run in flight
  | 'input'     // run blocked on input()
  | 'verified'  // last run succeeded
  | 'fixed'     // last run succeeded right after a failing run
  | 'error'     // last run raised

/** Structured view of a Python traceback string */
export interface ParsedError {
  type: string            // e.g. "TypeError"
  message: string         // text after "TypeError: "
  line: number | null     // last reported line number, if any
  file: string | null     // file of that frame, if any
  raw: string
}

/** One completed run, recorded in the UI layer (no engine changes) */
export interface ExecutionRecord {
  id: number
  file: string
  at: number              // Date.now() when the run finished
  durationMs: number
  ok: boolean
  error: ParsedError | null
  resolved: boolean       // ok run that directly follows a failing run of the same file
}

/** Rule-based reading of a ParsedError — derived from the real traceback, never invented */
export interface Diagnosis {
  summary: string
  hint: string | null
  snippet: string | null
}
