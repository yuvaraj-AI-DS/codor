import type { ParsedError } from '../types/runtime'

/** Parse a traceback string produced by the existing Pyodide wrapper. */
export function parseError(raw: string, fallbackFile: string): ParsedError {
  const lines = raw.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim())

  let type = 'Error'
  let message = lines[lines.length - 1]?.trim() ?? ''

  // The exception line is the last line of a traceback: "TypeError: msg" or "KeyboardInterrupt"
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^([A-Z][\w.]*)(?::\s?(.*))?$/.exec(lines[i].trim())
    if (m) {
      type = m[1].split('.').pop() ?? m[1]
      message = m[2] ?? ''
      break
    }
  }

  // Innermost frame = last "File "...", line N" occurrence
  let line: number | null = null
  let file: string | null = null
  const frameRe = /File "([^"]+)", line (\d+)/g
  let fm: RegExpExecArray | null
  while ((fm = frameRe.exec(raw)) !== null) {
    file = fm[1].split('/').pop() ?? fm[1]
    line = Number(fm[2])
  }

  return { type, message, line, file: file ?? (line !== null ? fallbackFile : null), raw }
}
