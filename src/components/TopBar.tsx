import { useEffect, useRef, useState, type ReactNode } from 'react'
import { scoreTone } from '../lib/runtime'
import crMark from '../assets/cr-mark.png'

interface TopBarProps {
  fileActions: ReactNode
  ready: boolean
  autorun: boolean
  score: number
  hasRuns: boolean
  canRun: boolean
  onToggleAutorun: () => void
  onRun: () => void
  onResetSession: () => void
}

export function TopBar({ fileActions, ready, autorun, score, hasRuns, canRun, onToggleAutorun, onRun, onResetSession }: TopBarProps) {
  const live = !ready ? 'boot' : autorun ? 'live' : 'paused'
  const liveLabel = live === 'boot' ? 'Booting' : live === 'live' ? 'Live' : 'Paused'

  return (
    <header className="topbar">
      <a className="brand" href="#/" title="Back to home">
        <img className="brand-mark" src={crMark} alt="" />
        <span className="brand-short">CODOR<span className="brand-untime">untime</span></span>
      </a>

      {fileActions}

      <div className="topbar-right">
        <span className="live" data-state={live} title={
          live === 'boot' ? 'Python runtime is loading' :
          live === 'live' ? 'Code runs automatically as you type' :
          'Auto-run is off — run with Ctrl+Enter'
        }>
          <span className="live-dot" aria-hidden="true" />
          {liveLabel}
        </span>

        <span
          className="score-chip"
          data-tone={scoreTone(score, hasRuns)}
          title="Efficiency: success rate × 0.5 + speed × 0.3 + error recovery × 0.2"
        >
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
            <path d="M6 0L0 7h4l-1 5 6-7H5l1-5z" fill="currentColor" />
          </svg>
          <span className="mono">{hasRuns ? score : '—'}</span>
        </span>

        <button
          className="toggle"
          role="switch"
          aria-checked={autorun}
          onClick={onToggleAutorun}
          title={autorun ? 'Auto-run on — click to pause' : 'Auto-run off — click to resume'}
        >
          <span className="toggle-track"><span className="toggle-thumb" /></span>
          Auto
        </button>

        {!autorun && (
          <button className="btn btn-primary" onClick={onRun} disabled={!canRun} title="Run active file (Ctrl+Enter)">
            Run <kbd>Ctrl ↵</kbd>
          </button>
        )}

        <SettingsMenu onResetSession={onResetSession} />
      </div>
    </header>
  )
}

function SettingsMenu({ onResetSession }: { onResetSession: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" aria-label="Settings" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="menu" role="menu">
          <button className="menu-item" role="menuitem" onClick={() => { onResetSession(); setOpen(false) }}>
            Reset session
            <span className="menu-sub">Clears output, cached inputs, score and history, then re-runs</span>
          </button>
          <div className="menu-sep" />
          <div className="menu-keys">
            <span>Run now</span><kbd>Ctrl ↵</kbd>
            <span>New file</span><kbd>Ctrl N</kbd>
            <span>Rename file</span><kbd>Double-click tab</kbd>
          </div>
        </div>
      )}
    </div>
  )
}
