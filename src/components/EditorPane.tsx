import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import type { FileMap } from '../types/editor'

type MonacoApi = typeof Monaco

interface EditorPaneProps {
  activeFile: string
  fileMap: FileMap
  onChange: (filename: string, content: string) => void
  onEditorMount?: (editor: Monaco.editor.IStandaloneCodeEditor, monaco: MonacoApi) => void
}

const defineTheme: BeforeMount = monaco => {
  monaco.editor.defineTheme('rtc-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'd6e0df' },
      { token: 'identifier', foreground: 'd6e0df' },
      { token: 'comment', foreground: '66858a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '5fa8b5' },
      { token: 'string', foreground: 'd7a85b' },
      { token: 'string.escape', foreground: 'e0c35a' },
      { token: 'number', foreground: 'c28f6c' },
      { token: 'type', foreground: 'd0b86a' },
      { token: 'type.identifier', foreground: 'd0b86a' },
      { token: 'tag', foreground: 'd0b86a' },          // decorators
      { token: 'delimiter', foreground: '8ea6aa' },
      { token: 'operator', foreground: '8ea6aa' },
    ],
    colors: {
      'editor.background': '#06232a',
      'editor.foreground': '#d6e0df',
      'editor.lineHighlightBackground': '#0b3038',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#55747a',
      'editorLineNumber.activeForeground': '#8ea6aa',
      'editorGutter.background': '#06232a',
      'editorCursor.foreground': '#e0c35a',
      'editor.selectionBackground': '#1d4a54',
      'editor.inactiveSelectionBackground': '#143b44',
      'editor.wordHighlightBackground': '#17414a80',
      'editorBracketMatch.background': '#17414a',
      'editorBracketMatch.border': '#5fa8b5',
      'editorIndentGuide.background1': '#12343c',
      'editorIndentGuide.activeBackground1': '#17414a',
      'editorError.foreground': '#c96b62',
      'editorWarning.foreground': '#d6a94c',
      'editorOverviewRuler.border': '#00000000',
      'scrollbarSlider.background': '#8ea6aa1f',
      'scrollbarSlider.hoverBackground': '#8ea6aa33',
      'scrollbarSlider.activeBackground': '#8ea6aa47',
      'editorWidget.background': '#0a2b33',
      'editorWidget.border': '#17414a',
      'editorHoverWidget.background': '#0a2b33',
      'editorHoverWidget.border': '#17414a',
      'editorSuggestWidget.background': '#0a2b33',
      'editorSuggestWidget.border': '#17414a',
      'editorSuggestWidget.selectedBackground': '#0b3038',
      'editorSuggestWidget.highlightForeground': '#e0c35a',
      'editorBracketHighlight.foreground1': '#d0b86a',
      'editorBracketHighlight.foreground2': '#5fa8b5',
      'editorBracketHighlight.foreground3': '#8ea6aa',
    },
  })
}

export function EditorPane({ activeFile, fileMap, onChange, onEditorMount }: EditorPaneProps) {
  const handleMount: OnMount = (editor, monaco) => {
    // Monaco measures glyphs at mount; re-measure once the web font has loaded
    document.fonts?.ready.then(() => monaco.editor.remeasureFonts())
    onEditorMount?.(editor, monaco)
  }

  return (
    <div className="h-full w-full" style={{ backgroundColor: '#06232a' }}>
      <Editor
        height="100%"
        language="python"
        theme="rtc-dark"
        path={activeFile}
        value={fileMap[activeFile]?.content ?? ''}
        onChange={value => onChange(activeFile, value ?? '')}
        beforeMount={defineTheme}
        onMount={handleMount}
        loading={<div className="rtc-empty">Loading editor…</div>}
        options={{
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          guides: { indentation: true },
          dropIntoEditor: { enabled: false },   // file drops are handled as imports
        }}
      />
    </div>
  )
}
