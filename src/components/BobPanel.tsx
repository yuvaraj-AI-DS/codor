import { useMemo } from 'react'
import type { ExecutionRecord, RunStatus } from '../types/runtime'
import { explainError } from '../lib/explainError'

interface BobPanelProps {
  status: RunStatus
  activeFile: string
  openFiles: string[]
  lastRecord: ExecutionRecord | null
  recovery: { error: { type: string; line: number | null }; seconds: number } | null
}

export function BobPanel({ status, activeFile, openFiles, lastRecord, recovery }: BobPanelProps) {
  const err = status === 'error' ? lastRecord?.error ?? null : null
  const diagnosis = useMemo(() => (err ? explainError(err, openFiles) : null), [err, openFiles])

  return (
    <aside className="bob" data-status={status} aria-label="Bob">
      <div className="panel-head">
        <span className="panel-title"><span className="bob-mark" aria-hidden="true">✦</span> Bob</span>
      </div>

      <div className="bob-body" aria-live="polite">
        {status === 'loading' && <p className="bob-quiet">Waiting for the Python runtime.</p>}

        {(status === 'running' || status === 'input') && (
          <p className="bob-quiet"><span className="spinner" aria-hidden="true" /> Watching this run…</p>
        )}

        {status === 'idle' && <p className="bob-quiet">Nothing has run in {activeFile} yet.</p>}

        {status === 'verified' && (
          <div className="bob-ok">
            <p className="bob-lead">Runtime is healthy.</p>
            <p className="bob-quiet">No issues in {activeFile}.</p>
          </div>
        )}

        {status === 'fixed' && (
          <div className="bob-ok">
            <p className="bob-lead">✓ Resolved{recovery ? ` ${recovery.error.type}` : ''}</p>
            <p className="bob-quiet">
              {recovery
                ? `${recovery.error.line !== null ? `Line ${recovery.error.line} is fixed` : 'Fixed'} after ${recovery.seconds < 1 ? '<1' : Math.round(recovery.seconds)}s. Re-verified clean.`
                : 'Re-verified clean.'}
            </p>
          </div>
        )}

        {err && diagnosis && (
          <div className="bob-err">
            <div className="bob-err-head">
              <span className="bob-err-type mono">{err.type}</span>
              <span className="bob-err-loc mono">
                {err.line !== null ? `line ${err.line}` : 'line not reported'}
                {err.file && err.file !== activeFile ? ` · ${err.file}` : ''}
              </span>
            </div>
            <h4 className="bob-h">What happened</h4>
            <p className="bob-text">{renderTicks(diagnosis.summary)}</p>
            {diagnosis.hint && (
              <>
                <h4 className="bob-h">Suggested fix</h4>
                <p className="bob-text">{renderTicks(diagnosis.hint)}</p>
                {diagnosis.snippet && <pre className="bob-code mono">{diagnosis.snippet}</pre>}
              </>
            )}
            <p className="bob-source">Read from the Python traceback</p>
          </div>
        )}

      </div>
    </aside>
  )
}

/** Render `backtick` spans as inline code */
function renderTicks(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="mono">{part.slice(1, -1)}</code>
      : <span key={i}>{part}</span>
  )
}
