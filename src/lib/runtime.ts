import type { FileMap } from '../types/editor'
import type { ExecutionRecord, ParsedError, RunStatus } from '../types/runtime'

export function lastRecordFor(records: ExecutionRecord[], file: string): ExecutionRecord | null {
  for (let i = records.length - 1; i >= 0; i--) if (records[i].file === file) return records[i]
  return null
}

export function statusFor(file: string, fileMap: FileMap, records: ExecutionRecord[], ready: boolean): RunStatus {
  if (!ready) return 'loading'
  const st = fileMap[file]
  if (st?.pendingInput) return 'input'
  if (st?.running) return 'running'
  const last = lastRecordFor(records, file)
  if (!last) return 'idle'
  if (!last.ok) return 'error'
  return last.resolved ? 'fixed' : 'verified'
}

/** If the latest run of `file` resolved an error streak: which error, and how long it took. */
export function recoveryFor(records: ExecutionRecord[], file: string): { error: ParsedError; seconds: number } | null {
  const own = records.filter(r => r.file === file)
  const last = own[own.length - 1]
  if (!last?.resolved) return null
  let i = own.length - 2
  let lastError: ParsedError | null = null
  let streakStart = last.at
  while (i >= 0 && !own[i].ok) {
    lastError ??= own[i].error
    streakStart = own[i].at - own[i].durationMs
    i--
  }
  if (!lastError) return null
  return { error: lastError, seconds: Math.max(0, (last.at - streakStart) / 1000) }
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

export function formatClock(t: number): string {
  const d = new Date(t)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

export function formatAgo(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ago` : formatClock(t)
}

export function scoreTone(score: number, hasRuns: boolean): 'none' | 'ok' | 'warn' | 'err' {
  if (!hasRuns) return 'none'
  return score >= 70 ? 'ok' : score >= 40 ? 'warn' : 'err'
}
