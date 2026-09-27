import { useEffect, useRef, useState } from 'react'
import type { Checkpoint } from '../hooks/useCheckpoints'
import { formatClock } from '../lib/runtime'

interface SidebarProps {
  file: string
  collapsed: boolean
  onToggle: () => void
  checkpoints: Checkpoint[]
  storageError: string | null
  onCreateCheckpoint: () => void
  onRestore: (id: string) => void
  onRenameCheckpoint: (id: string, label: string) => void
  onDeleteCheckpoint: (id: string) => void
}

const chevron = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </svg>
)
const checkpointIcon = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v4M8 10.5v4" />
  </svg>
)

/** Versions of the active file. New versions save instantly as "Version N"; rename is optional. */
export function Sidebar(p: SidebarProps) {
  if (p.collapsed) {
    return (
      <aside className="side is-collapsed" aria-label="Versions">
        <button className="rail-btn" onClick={p.onToggle} aria-label="Expand versions" title="Expand">
          <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>{chevron}</span>
        </button>
        <button className="rail-btn" onClick={p.onCreateCheckpoint} title={`New version of ${p.file}`} aria-label="New version">
          {checkpointIcon}
        </button>
      </aside>
    )
  }

  return (
    <aside className="side" aria-label="Versions">
      <div className="panel-head">
        <span className="panel-title side-title">Versions <span className="panel-meta">{p.file}</span></span>
        <button className="icon-btn side-collapse" onClick={p.onToggle} aria-label="Collapse versions" title="Collapse">
          {chevron}
        </button>
      </div>

      <div className="side-body">
        <button className="side-new" onClick={p.onCreateCheckpoint}>+ Version</button>
        {p.storageError && <p className="side-notice" data-tone="err">{p.storageError}</p>}

        {p.checkpoints.length === 0 ? (
          <p className="side-where">No versions of {p.file} yet. Each file keeps its own — they survive a refresh.</p>
        ) : (
          <ul className="cp-list">
            {p.checkpoints.map(cp => (
              <CheckpointRow key={cp.id} cp={cp} onRestore={p.onRestore} onRename={p.onRenameCheckpoint} onDelete={p.onDeleteCheckpoint} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function CheckpointRow({ cp, onRestore, onRename, onDelete }: {
  cp: Checkpoint
  onRestore: (id: string) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(cp.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editing])

  const startEdit = () => { setValue(cp.label); setEditing(true) }
  const commit = () => { onRename(cp.id, value); setEditing(false) }
  const showNumber = cp.label !== `Version ${cp.n}`

  return (
    <li className="cp" data-status={cp.status === 'ok' ? 'verified' : cp.status === 'error' ? 'error' : 'idle'}>
      <div className="cp-top">
        {showNumber && <span className="cp-n mono">v{cp.n}</span>}
        {editing ? (
          <input
            ref={inputRef}
            className="side-input"
            value={value}
            aria-label="Rename version"
            spellCheck={false}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit() }
              if (e.key === 'Escape') { e.preventDefault(); setValue(cp.label); setEditing(false) }
            }}
          />
        ) : (
          <span className="cp-label" onDoubleClick={startEdit} title={`${cp.label} — double-click to rename`}>{cp.label}</span>
        )}
        <span className="cp-status" aria-label={cp.status === 'ok' ? 'Passing when saved' : cp.status === 'error' ? 'Failing when saved' : 'Not run when saved'}>
          {cp.status === 'ok' ? '✓' : cp.status === 'error' ? '✕' : '–'}
        </span>
      </div>
      <div className="cp-meta">
        <span title={new Date(cp.createdAt).toLocaleString()}>{stamp(cp.createdAt)}</span>
        {cp.auto && <span className="cp-auto">auto</span>}
      </div>
      <div className="cp-actions">
        <button className="btn btn-ghost" onClick={() => onRestore(cp.id)}>Restore</button>
        <button className="btn btn-ghost" onClick={startEdit}>Rename</button>
        <button
          className={`btn btn-ghost${confirmDelete ? ' is-danger' : ''}`}
          onClick={() => (confirmDelete ? onDelete(cp.id) : setConfirmDelete(true))}
        >
          {confirmDelete ? 'Sure?' : 'Delete'}
        </button>
      </div>
    </li>
  )
}

function stamp(t: number): string {
  const d = new Date(t)
  const time = formatClock(t).slice(0, 5)
  if (d.toDateString() === new Date().toDateString()) return time
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`
}
