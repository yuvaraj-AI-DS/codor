/** A single line rendered in the output panel */
export type OutputLine =
  | { type: 'stdout'; text: string }
  | { type: 'input-echo'; prompt: string; value: string }
  | { type: 'cached-input'; prompt: string; value: string }
  | { type: 'error'; text: string }

/** State for one pending input() call — shown as an inline field in OutputPane */
export type PendingInput = {
  prompt: string
}

export type FileState = {
  content: string
  /** Accumulated output lines from the last run */
  lines: OutputLine[]
  /** Set while Python is blocked waiting for input() */
  pendingInput: PendingInput | null
  /** True while a run is in-flight */
  running: boolean
}

export type FileMap = Record<string, FileState>

export type RunResult = {
  lines: OutputLine[]
}
