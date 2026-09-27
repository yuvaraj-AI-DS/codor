import { useCallback, useRef, useState } from 'react'
import type { RunOutcome } from './useEfficiencyScore'
import type { ExecutionRecord } from '../types/runtime'
import { parseError } from '../lib/parseError'

/** Records completed runs in UI state. Fed by the same onRunComplete callback as the score. */
export function useExecutionHistory(limit = 60) {
  const [records, setRecords] = useState<ExecutionRecord[]>([])
  const nextId = useRef(1)

  const push = useCallback((o: RunOutcome) => {
    const file = o.filename ?? 'unknown'
    const id = nextId.current++
    setRecords(prev => {
      let prevForFile: ExecutionRecord | undefined
      for (let i = prev.length - 1; i >= 0; i--) if (prev[i].file === file) { prevForFile = prev[i]; break }
      const rec: ExecutionRecord = {
        id,
        file,
        at: Date.now(),
        durationMs: o.durationMs,
        ok: o.success,
        error: !o.success && o.errorText ? parseError(o.errorText, file) : null,
        resolved: o.success && !!prevForFile && !prevForFile.ok,
      }
      const next = [...prev, rec]
      return next.length > limit ? next.slice(next.length - limit) : next
    })
  }, [limit])

  const clear = useCallback(() => setRecords([]), [])

  return { records, push, clear }
}
