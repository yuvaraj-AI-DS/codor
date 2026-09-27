import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { usePyodideContext } from './context/PyodideContext'
import { useEditor } from './hooks/useEditor'
import { useEfficiencyScore, type RunOutcome } from './hooks/useEfficiencyScore'
import { useExecutionHistory } from './hooks/useExecutionHistory'
import { useCheckpoints, type Checkpoint } from './hooks/useCheckpoints'
import type { RunStatus } from './types/runtime'
import { canPickSaveLocation, downloadBlob, downloadText, ensurePy, makeZip, pickSaveHandle, readPyFiles, writeToHandle } from './lib/fileIO'
import { formatClock, lastRecordFor, recoveryFor, statusFor } from './lib/runtime'
import { TopBar } from './components/TopBar'
import { FileTabs } from './components/FileTabs'
import { EditorWorkspace } from './components/EditorWorkspace'
import { RuntimePanel } from './components/RuntimePanel'
import { BottomDock } from './components/BottomDock'
import { OutputView } from './components/OutputView'
import { ExecutionStream } from './components/ExecutionStream'
import { BobPanel } from './components/BobPanel'
import { InputModal } from './components/InputModal'
import { Sidebar } from './components/Sidebar'
import { FileToolbar } from './components/FileToolbar'

type Notice = { text: string; tone: 'ok' | 'err' | 'info' }

const toCpStatus = (s: RunStatus): Checkpoint['status'] =>
  s === 'verified' || s === 'fixed' ? 'ok' : s === 'error' ? 'error' : 'unknown'

function App() {
  const { score, breakdown, totals, recordRun, resetStats } = useEfficiencyScore()
  const { records, push: pushRecord, clear: clearHistory } = useExecutionHistory()

  // One completion callback feeds both the score (unchanged) and the UI history
  const onRunComplete = useCallback((outcome: RunOutcome) => {
    recordRun(outcome)
    pushRecord(outcome)
  }, [recordRun, pushRecord])

  const {
    fileMap,
    activeFile,
    setActiveFile,
    autorun,
    setAutorun,
    addTab,
    renameTab,
    closeTab,
    updateContent,
    manualRun,
    submitInput,
    resetOutput,
    addFiles,
  } = useEditor(onRunComplete)

  const { ready } = usePyodideContext()

  const monacoEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const [dockOpen, setDockOpen] = useState(true)
  const [dockTab, setDockTab] = useState<'output' | 'stream'>('output')

  const activeState = fileMap[activeFile]
  const pendingInput = activeState?.pendingInput ?? null
  const statusOf = useCallback(
    (name: string) => statusFor(name, fileMap, records, ready),
    [fileMap, records, ready]
  )
  const status = statusOf(activeFile)
  const lastRecord = useMemo(() => lastRecordFor(records, activeFile), [records, activeFile])
  const recovery = useMemo(() => recoveryFor(records, activeFile), [records, activeFile])
  const openFiles = useMemo(() => Object.keys(fileMap), [fileMap])

  // ── Files: save / save as / import / export ──────────────────────────────
  const fileMapRef = useRef(fileMap)
  fileMapRef.current = fileMap
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 900)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const notify = useCallback((text: string, tone: Notice['tone'] = 'ok') => {
    setNotice({ text, tone })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  const canPick = useMemo(() => canPickSaveLocation(), [])
  // Disk file linked to each tab after a picker save (Chrome/Edge only; kept for this session)
  const handles = useRef<Record<string, FileSystemFileHandle>>({})
  const [linked, setLinked] = useState<Record<string, string>>({})

  const contentOf = (name: string) => fileMapRef.current[name]?.content ?? ''

  const saveToPicker = async (tab: string, suggested: string) => {
    const handle = await pickSaveHandle(suggested)
    if (!handle) return
    await writeToHandle(handle, contentOf(tab))
    handles.current[tab] = handle
    setLinked(prev => ({ ...prev, [tab]: handle.name }))
    notify(`Saved ${handle.name} · ${formatClock(Date.now())}`)
  }

  const save = async () => {
    const tab = activeFile
    try {
      const h = handles.current[tab]
      if (h) {
        await writeToHandle(h, contentOf(tab))
        notify(`Saved ${h.name} · ${formatClock(Date.now())}`)
      } else if (canPick) {
        await saveToPicker(tab, tab)
      } else {
        downloadText(contentOf(tab), tab)
        notify(`Downloaded ${tab}`)
      }
    } catch (e) {
      notify(`Couldn’t save: ${(e as Error).message}`, 'err')
    }
  }
  const saveRef = useRef(save)
  saveRef.current = save

  const saveAs = async (name?: string) => {
    const tab = activeFile
    try {
      if (canPick) await saveToPicker(tab, tab)
      else {
        const file = ensurePy(name ?? tab)
        downloadText(contentOf(tab), file)
        notify(`Downloaded ${file}`)
      }
    } catch (e) {
      notify(`Couldn’t save: ${(e as Error).message}`, 'err')
    }
  }

  // Ctrl/Cmd+S saves the active file instead of the browser's "save page"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const importFiles = async (list: FileList) => {
    const { files, skipped } = await readPyFiles(list)
    const names = addFiles(files)
    if (names.length && skipped.length) notify(`Opened ${names.join(', ')} · skipped ${skipped.length} non-.py file(s)`, 'info')
    else if (names.length) notify(`Opened ${names.join(', ')}`)
    else if (skipped.length) notify('Only .py files can be imported.', 'err')
  }

  const exportAll = () => {
    const files = Object.entries(fileMapRef.current).map(([name, st]) => ({ name, content: st.content }))
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const zipName = `rtc-workspace-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`
    downloadBlob(makeZip(files), zipName)
    notify(`Downloaded ${zipName} · ${files.length} file${files.length === 1 ? '' : 's'}`)
  }

  // ── Versions (per file) ──────────────────────────────────────────────────
  const { all: allVersions, create: createCp, rename: renameCp, remove: removeCp, moveFile, error: cpError } = useCheckpoints()
  const versions = useMemo(() => allVersions.filter(v => v.file === activeFile), [allVersions, activeFile])

  const createVersion = () => {
    const file = activeFile
    void createCp({ file, content: contentOf(file), status: toCpStatus(status), auto: false })
      .then(cp => notify(`${cp.label} of ${file} saved`))
  }

  const restoreVersion = async (id: string) => {
    const v = allVersions.find(c => c.id === id)
    if (!v || !fileMapRef.current[v.file]) return
    const current = contentOf(v.file)
    // Keep the current code restorable, unless it's already identical
    if (current !== v.content) {
      await createCp({ file: v.file, content: current, status: toCpStatus(statusOf(v.file)), auto: true, label: `Before restoring ${v.label}` })
    }
    updateContent(v.file, v.content)   // same path as typing: aborts the old run, re-runs if Auto is on
    notify(`Restored ${v.label} of ${v.file}`)
  }

  // Rename a tab → its versions follow (same validity rules as useEditor.renameTab)
  const handleRenameTab = (oldName: string, newName: string) => {
    const ok = newName && newName.endsWith('.py') && newName !== oldName && !fileMapRef.current[newName]
    renameTab(oldName, newName)
    if (ok) void moveFile(oldName, newName)
  }

  // Automatic version each time a run turns an error into a pass (that file only)
  const lastAutoId = useRef(0)
  useEffect(() => {
    const r = records[records.length - 1]
    if (!r || !r.resolved || r.id === lastAutoId.current || !fileMapRef.current[r.file]) return
    lastAutoId.current = r.id
    const rec = recoveryFor(records, r.file)
    void createCp({ file: r.file, content: contentOf(r.file), status: 'ok', auto: true, label: `Fixed ${rec?.error.type ?? 'error'}` })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, createCp])

  const handleModalSubmit = (value: string) => {
    submitInput(activeFile, value)
    setTimeout(() => monacoEditorRef.current?.focus(), 0)
  }

  // Same reset as before (output + input cache + score, then re-run), plus the UI history
  const handleReset = (filename: string) => {
    resetOutput(filename, () => {
      resetStats()
      clearHistory()
    })
  }

  const run = () => {
    if (ready && !activeState?.running) manualRun(activeFile)
  }

  const hasOutput = !!(activeState?.lines.length || activeState?.pendingInput || activeState?.running)

  return (
    <div className="app">
      <TopBar
        fileActions={
          <FileToolbar
            activeFile={activeFile}
            canPickLocation={canPick}
            linkedFile={linked[activeFile] ?? null}
            notice={notice}
            onSave={() => void save()}
            onSaveAs={name => void saveAs(name)}
            onImport={list => void importFiles(list)}
            onExportAll={exportAll}
          />
        }
        ready={ready}
        autorun={autorun}
        score={score}
        hasRuns={totals.runs > 0}
        canRun={ready && !activeState?.running}
        onToggleAutorun={() => setAutorun(v => !v)}
        onRun={run}
        onResetSession={() => handleReset(activeFile)}
      />

      <div className="tabstrip">
        <FileTabs
          fileMap={fileMap}
          activeFile={activeFile}
          statusOf={statusOf}
          onSelect={setActiveFile}
          onAdd={addTab}
          onRename={handleRenameTab}
          onClose={closeTab}
        />
      </div>

      <main className={`main${dockOpen ? '' : ' dock-collapsed'}${sidebarCollapsed ? ' side-collapsed' : ''}`}>
        <Sidebar
          file={activeFile}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
          checkpoints={versions}
          storageError={cpError}
          onCreateCheckpoint={createVersion}
          onRestore={id => void restoreVersion(id)}
          onRenameCheckpoint={(id, label) => void renameCp(id, label)}
          onDeleteCheckpoint={id => void removeCp(id)}
        />

        <EditorWorkspace
          activeFile={activeFile}
          fileMap={fileMap}
          status={status}
          autorun={autorun}
          lastRecord={lastRecord}
          onChange={updateContent}
          onRun={run}
          onDropFiles={list => void importFiles(list)}
          onEditorMount={editor => { monacoEditorRef.current = editor }}
        />

        <RuntimePanel
          status={status}
          activeFile={activeFile}
          lastRecord={lastRecord}
          totals={totals}
          score={score}
          breakdown={breakdown}
          openFiles={openFiles}
        />

        <BottomDock
          open={dockOpen}
          tab={dockTab}
          streamCount={records.length}
          activeFile={activeFile}
          hasOutput={hasOutput}
          onTab={setDockTab}
          onToggle={() => setDockOpen(v => !v)}
          onReset={() => handleReset(activeFile)}
          left={
            dockTab === 'output'
              ? <OutputView state={activeState} ready={ready} autorun={autorun} />
              : <ExecutionStream records={records} activeFile={activeFile} onSelectFile={setActiveFile} />
          }
          right={
            <BobPanel
              status={status}
              activeFile={activeFile}
              openFiles={openFiles}
              lastRecord={lastRecord}
              recovery={recovery}
            />
          }
        />
      </main>

      {pendingInput !== null && (
        <InputModal pending={pendingInput} onSubmit={handleModalSubmit} />
      )}
    </div>
  )
}

export default App
