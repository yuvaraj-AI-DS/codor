import { useEffect, useRef, useState, type DragEvent } from 'react'
import type * as Monaco from 'monaco-editor'
import type { FileMap } from '../types/editor'
import type { ExecutionRecord, RunStatus } from '../types/runtime'
import { EditorPane } from './EditorPane'
import { formatMs } from '../lib/runtime'

interface EditorWorkspaceProps {
  activeFile: string
  fileMap: FileMap
  status: RunStatus
  autorun: boolean
  lastRecord: ExecutionRecord | null
  onChange: (filename: string, content: string) => void
  onRun: () => void
  onDropFiles: (files: FileList) => void
  onEditorMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void
}

export function statusText(status: RunStatus, last: ExecutionRecord | null, autorun: boolean): string {
  switch (status) {
    case 'loading': return 'Starting Python'
    case 'idle': return autorun ? 'Waiting for code' : 'Not run · Ctrl+Enter'
    case 'running': return 'Analyzing'
    case 'input': return 'Waiting for input'
    case 'verified': return `Verified · ${last ? formatMs(last.durationMs) : ''}`
    case 'fixed': return `Fixed · ${last ? formatMs(last.durationMs) : ''}`
    case 'error': {
      const e = last?.error
      if (!e) return 'Error'
      return e.line !== null ? `${e.type} · line ${e.line}` : e.type
    }
  }
}

export function StatusGlyph() {
  return <span className="glyph" aria-hidden="true" />
}

export function EditorWorkspace({ activeFile, fileMap, status, autorun, lastRecord, onChange, onRun, onDropFiles, onEditorMount }: EditorWorkspaceProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const runRef = useRef(onRun)
  runRef.current = onRun
  const [mounted, setMounted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  // Mark the failing line in Monaco with a real diagnostic marker
  useEffect(() => {
    const monaco = monacoRef.current
    const model = editorRef.current?.getModel()
    if (!monaco || !model) return
    const err = status === 'error' ? lastRecord?.error : null
    const onThisFile = err && err.line !== null && (!err.file || err.file === activeFile)
    if (err && onThisFile && err.line! <= model.getLineCount()) {
      const ln = err.line!
      monaco.editor.setModelMarkers(model, 'rtc', [{
        severity: monaco.MarkerSeverity.Error,
        message: `${err.type}${err.message ? `: ${err.message}` : ''}`,
        startLineNumber: ln,
        startColumn: model.getLineFirstNonWhitespaceColumn(ln) || 1,
        endLineNumber: ln,
        endColumn: model.getLineMaxColumn(ln),
      }])
    } else {
      monaco.editor.setModelMarkers(model, 'rtc', [])
    }
  }, [status, lastRecord, activeFile, mounted])

  const busy = status === 'running'

  return (
    <section
      className="workspace"
      aria-label="Editor"
      onDragEnterCapture={e => { if (hasFiles(e)) { dragDepth.current++; setDragging(true) } }}
      onDragOverCapture={e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
      onDragLeaveCapture={e => { if (hasFiles(e) && --dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) } }}
      onDropCapture={e => {
        if (!hasFiles(e)) return
        e.preventDefault(); e.stopPropagation()
        dragDepth.current = 0; setDragging(false)
        if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files)
      }}
    >
      <div className="workspace-head" data-status={status}>
        <span className="crumb">
          <span className="crumb-dim">workspace /</span> {activeFile}
          {fileMap[activeFile]?.content.split('\n').length ? (
            <span className="crumb-dim"> · {fileMap[activeFile].content.split('\n').length} lines</span>
          ) : null}
        </span>
        <span className="run-state" aria-live="polite">
          <StatusGlyph />
          {statusText(status, lastRecord, autorun)}
        </span>
        <span className={`scanline${busy ? ' is-on' : ''}`} aria-hidden="true" />
      </div>
      <div className="workspace-editor">
        {dragging && <div className="drop-hint" aria-hidden="true">Drop .py files to open them as tabs</div>}
        <EditorPane
          activeFile={activeFile}
          fileMap={fileMap}
          onChange={onChange}
          onEditorMount={(editor, monaco) => {
            editorRef.current = editor
            monacoRef.current = monaco
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current())
            setMounted(true)
            onEditorMount?.(editor)
          }}
        />
      </div>
    </section>
  )
}
