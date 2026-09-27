import { useEffect, useMemo, useRef } from 'react'
import type { ExecutionRecord } from '../types/runtime'
import { formatClock, formatMs } from '../lib/runtime'

interface ExecutionStreamProps {
  records: ExecutionRecord[]
  activeFile: string
  onSelectFile: (file: string) => void
}

interface Row { rec: ExecutionRecord; count: number }

/** Collapse consecutive identical runs (same file + same outcome) into one row with ×n */
function group(records: ExecutionRecord[]): Row[] {
  const rows: Row[] = []
  for (const rec of records) {
    const prev = rows[rows.length - 1]
    const same = prev && !rec.resolved && !prev.rec.resolved &&
      prev.rec.file === rec.file && prev.rec.ok === rec.ok &&
      prev.rec.error?.type === rec.error?.type && prev.rec.error?.message === rec.error?.message
    if (same) { prev.rec = rec; prev.count++ } else rows.push({ rec, count: 1 })
  }
  return rows
}

export function ExecutionStream({ records, activeFile, onSelectFile }: ExecutionStreamProps) {
  const rows = useMemo(() => group(records), [records])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [rows.length, records])

  if (rows.length === 0) return <div className="rtc-empty">Each run is logged here as you type.</div>

  return (
    <div ref={scrollRef} className="stream" role="log" aria-label="Execution stream">
      {rows.map(({ rec, count }) => {
        const kind = !rec.ok ? 'error' : rec.resolved ? 'fixed' : 'verified'
        return (
          <button
            key={rec.id}
            className={`stream-row${rec.file === activeFile ? ' is-current' : ''}`}
            data-status={kind}
            onClick={() => onSelectFile(rec.file)}
            title={rec.error ? `${rec.error.type}: ${rec.error.message}` : `Open ${rec.file}`}
          >
            <span className="stream-icon" aria-hidden="true">{kind === 'error' ? '✕' : '✓'}</span>
            <span className="stream-time mono">{formatClock(rec.at)}</span>
            <span className="stream-file mono">{rec.file}</span>
            <span className="stream-label">
              {kind === 'error'
                ? <>{rec.error?.type ?? 'Error'}{rec.error?.line != null && <span className="out-dim"> · line {rec.error.line}</span>}</>
                : kind === 'fixed' ? 'resolved' : 'passed'}
              {count > 1 && <span className="stream-count">×{count}</span>}
            </span>
            <span className="stream-ms mono">{formatMs(rec.durationMs)}</span>
          </button>
        )
      })}
    </div>
  )
}
