import type { ReactNode } from 'react'

interface BottomDockProps {
  open: boolean
  tab: 'output' | 'stream'
  streamCount: number
  activeFile: string
  hasOutput: boolean
  onTab: (t: 'output' | 'stream') => void
  onToggle: () => void
  onReset: () => void
  left: ReactNode
  right: ReactNode
}

export function BottomDock({ open, tab, streamCount, activeFile, hasOutput, onTab, onToggle, onReset, left, right }: BottomDockProps) {
  return (
    <section className={`dock${open ? '' : ' is-collapsed'}`} aria-label="Output and diagnostics">
      <div className="dock-left">
        <div className="panel-head">
          <div className="dock-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'output'} className="dock-tab" onClick={() => { onTab('output'); if (!open) onToggle() }}>
              Output <span className="panel-meta">{activeFile}</span>
            </button>
            <button role="tab" aria-selected={tab === 'stream'} className="dock-tab" onClick={() => { onTab('stream'); if (!open) onToggle() }}>
              Execution stream {streamCount > 0 && <span className="count mono">{streamCount}</span>}
            </button>
          </div>
          <div className="dock-actions">
            {tab === 'output' && hasOutput && (
              <button className="btn btn-ghost" onClick={onReset} title="Clear output, cached inputs and score, then re-run">
                Reset
              </button>
            )}
            <button className="icon-btn" onClick={onToggle} aria-label={open ? 'Collapse panel' : 'Expand panel'} aria-expanded={open}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(180deg)' }}>
                <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        {open && <div className="dock-body">{left}</div>}
      </div>
      {right}
    </section>
  )
}
