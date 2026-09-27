import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FileToolbarProps {
  activeFile: string
  canPickLocation: boolean
  linkedFile: string | null
  notice: { text: string; tone: 'ok' | 'err' | 'info' } | null
  onSave: () => void
  onSaveAs: (name?: string) => void    // name only used by the download fallback
  onImport: (files: FileList) => void
  onExportAll: () => void
}

const ICONS: Record<string, ReactNode> = {
  save: <path d="M3 2.5h8l2.5 2.5v8.5h-10.5zM5.5 2.5v3h5v-3M5 13.5v-4h6v4" />,
  saveAs: <><path d="M3 2.5h6l2 2v3M3 2.5v11h5M5.5 2.5v3h4" /><path d="M10 13.5l3.5-3.5-1.5-1.5-3.5 3.5v1.5z" /></>,
  import: <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 11v2.5h11V11" />,
  export: <path d="M8 10V2M4.5 5.5L8 2l3.5 3.5M2.5 11v2.5h11V11" />,
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  )
}

export function FileToolbar(p: FileToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const [saveAsName, setSaveAsName] = useState<string | null>(null)   // Brave/Firefox rename-then-download

  useEffect(() => {
    if (saveAsName !== null) { nameInput.current?.focus(); nameInput.current?.select() }
  }, [saveAsName !== null])   // eslint-disable-line react-hooks/exhaustive-deps

  const saveAs = () => (p.canPickLocation ? p.onSaveAs() : setSaveAsName(p.activeFile))

  return (
    <div className="ribbon-actions" role="toolbar" aria-label="File actions">
      <button
        className="filebar-btn"
        onClick={p.onSave}
        title={p.linkedFile
          ? `Save (Ctrl+S) — writes to ${p.linkedFile}`
          : p.canPickLocation ? 'Save (Ctrl+S) — first save asks where to put the file' : 'Save (Ctrl+S) — goes to your Downloads folder'}
      >
        <Icon name="save" /> Save <kbd>Ctrl S</kbd>
      </button>

      {saveAsName === null ? (
        <button className="filebar-btn" onClick={saveAs}><Icon name="saveAs" /> Save as…</button>
      ) : (
        <form
          className="filebar-inline"
          onSubmit={e => { e.preventDefault(); p.onSaveAs(saveAsName); setSaveAsName(null) }}
        >
          <input
            ref={nameInput}
            className="filebar-input mono"
            value={saveAsName}
            aria-label="File name"
            spellCheck={false}
            onChange={e => setSaveAsName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setSaveAsName(null) } }}
          />
          <button type="submit" className="btn btn-primary">Download</button>
          <button type="button" className="btn btn-ghost" onClick={() => setSaveAsName(null)}>Cancel</button>
        </form>
      )}

      <button className="filebar-btn" onClick={() => fileInput.current?.click()}><Icon name="import" /> Import</button>
      <button className="filebar-btn" onClick={p.onExportAll} title="Download every tab as one .zip">
        <Icon name="export" /> Export all
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".py,text/x-python"
        multiple
        hidden
        onChange={e => {
          if (e.target.files?.length) p.onImport(e.target.files)
          e.target.value = ''   // allow re-importing the same file
        }}
      />

      {p.notice && (
        <span className="filebar-notice" data-tone={p.notice.tone} role="status">{p.notice.text}</span>
      )}
    </div>
  )
}
