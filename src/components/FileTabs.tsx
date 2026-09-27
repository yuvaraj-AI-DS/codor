import { useEffect, useRef, useState } from 'react'
import type { FileMap } from '../types/editor'
import type { RunStatus } from '../types/runtime'

interface FileTabsProps {
  fileMap: FileMap
  activeFile: string
  statusOf: (name: string) => RunStatus
  onSelect: (name: string) => void
  onAdd: () => void
  onRename: (oldName: string, newName: string) => void
  onClose: (name: string) => void
}

const STATUS_LABEL: Record<RunStatus, string> = {
  loading: 'Runtime loading',
  idle: 'Not run yet',
  running: 'Running',
  input: 'Waiting for input',
  verified: 'Last run passed',
  fixed: 'Fixed on last run',
  error: 'Last run failed',
}

// Behaviour (rename on double-click, Ctrl+N, close) carried over from the old TabBar
export function FileTabs({ fileMap, activeFile, statusOf, onSelect, onAdd, onRename, onClose }: FileTabsProps) {
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fileNames = Object.keys(fileMap)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        onAdd()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAdd])

  useEffect(() => {
    if (editingTab !== null) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingTab])

  function commitEdit(oldName: string) {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== oldName) onRename(oldName, trimmed)
    setEditingTab(null)
  }

  return (
    <div className="tabs" role="tablist" aria-label="Python files">
      {fileNames.map(name => {
        const isActive = name === activeFile
        const status = statusOf(name)
        return (
          <div
            key={name}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => onSelect(name)}
            onKeyDown={e => { if (e.key === 'Enter' && editingTab !== name) onSelect(name) }}
            className={`tab${isActive ? ' is-active' : ''}`}
            data-status={status}
          >
            <span className="status-dot" title={STATUS_LABEL[status]} aria-label={STATUS_LABEL[status]} />
            {editingTab === name ? (
              <input
                ref={inputRef}
                className="tab-rename"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(name)
                  else if (e.key === 'Escape') setEditingTab(null)
                }}
                onBlur={() => commitEdit(name)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="tab-name"
                onDoubleClick={() => { setEditingTab(name); setEditValue(name) }}
                title="Double-click to rename"
              >
                {name}
              </span>
            )}
            {fileNames.length > 1 && (
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); onClose(name) }}
                aria-label={`Close ${name}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
      <button className="tab-add" onClick={onAdd} title="New file (Ctrl+N)" aria-label="New file">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
