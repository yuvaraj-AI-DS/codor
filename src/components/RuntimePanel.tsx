import type { ExecutionRecord, RunStatus } from '../types/runtime'
import type { ScoreBreakdown, SessionTotals } from '../hooks/useEfficiencyScore'
import { formatAgo, formatMs, scoreTone } from '../lib/runtime'
import { explainError } from '../lib/explainError'
import { useNow } from '../hooks/useNow'
import { StatusGlyph } from './EditorWorkspace'

interface RuntimePanelProps {
  status: RunStatus
  activeFile: string
  lastRecord: ExecutionRecord | null
  totals: SessionTotals
  score: number
  breakdown: ScoreBreakdown
  openFiles: string[]
}

const HEADLINE: Record<RunStatus, string> = {
  loading: 'Starting Python',
  idle: 'Waiting',
  running: 'Analyzing',
  input: 'Waiting for input',
  verified: 'Verified',
  fixed: 'Verified',
  error: 'Error detected',
}

export function RuntimePanel({ status, activeFile, lastRecord, totals, score, breakdown, openFiles }: RuntimePanelProps) {
  const now = useNow(1000)
  const hasRuns = totals.runs > 0
  const err = status === 'error' ? lastRecord?.error ?? null : null
  const readable = err ? explainError(err, openFiles).summary : null

  return (
    <aside className="runtime" aria-label="Live runtime">
      <div className="panel-head">
        <span className="panel-title">Live runtime</span>
        <span className="panel-meta">{activeFile}</span>
      </div>

      <div className="runtime-body">
        <div className="rt-status" data-status={status}>
          <div className="rt-status-line">
            <StatusGlyph />
            <span className="rt-headline">{HEADLINE[status]}</span>
            {status === 'fixed' && <span className="rt-tag">resolved</span>}
          </div>
          <p className="rt-sub">
            {status === 'loading' && 'Loading Pyodide in the browser.'}
            {status === 'idle' && 'Start typing — runs trigger automatically.'}
            {status === 'running' && 'Executing the latest edit.'}
            {status === 'input' && 'Program is paused on input().'}
            {(status === 'verified' || status === 'fixed') && lastRecord &&
              `Ran clean in ${formatMs(lastRecord.durationMs)} · ${formatAgo(lastRecord.at, now)}`}
            {status === 'error' && readable && renderTicks(readable)}
          </p>

          {err && (
            <dl className="rt-errgrid">
              <dt>Type</dt><dd className="mono">{err.type}</dd>
              <dt>Line</dt><dd className="mono">{err.line ?? 'not reported'}{err.file && err.file !== activeFile ? ` · ${err.file}` : ''}</dd>
              {err.message && <><dt>Python</dt><dd className="mono rt-raw">{err.message}</dd></>}
            </dl>
          )}
        </div>

        <EfficiencyCard score={score} breakdown={breakdown} hasRuns={hasRuns} />
      </div>
    </aside>
  )
}

function EfficiencyCard({ score, breakdown, hasRuns }: { score: number; breakdown: ScoreBreakdown; hasRuns: boolean }) {
  const rows: Array<[string, number, string]> = [
    ['Execution', breakdown.execution, '50%'],
    ['Speed', breakdown.speed, '30%'],
    ['Recovery', breakdown.recovery, '20%'],
  ]
  return (
    <div className="eff" data-tone={scoreTone(score, hasRuns)}>
      <div className="eff-head">
        <span className="eff-label">Efficiency</span>
        <span className="eff-score mono">
          {hasRuns ? score : '—'}<span className="eff-of">/100</span>
        </span>
      </div>
      {hasRuns ? (
        <ul className="eff-rows">
          {rows.map(([label, value, weight]) => (
            <li key={label} data-tone={scoreTone(value, true)}>
              <span className="eff-row-label">{label}<span className="eff-weight">{weight}</span></span>
              <span className="bar"><span className="bar-fill" style={{ width: `${value}%` }} /></span>
              <span className="eff-row-val mono">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rt-note">Score appears after the first run.</p>
      )}
    </div>
  )
}

function renderTicks(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="mono">{part.slice(1, -1)}</code>
      : <span key={i}>{part}</span>
  )
}
