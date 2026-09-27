import { useEffect, useRef } from 'react'
import type { FileState } from '../types/editor'

interface OutputViewProps {
  state: FileState | undefined
  ready: boolean
  autorun: boolean
}

// Rendering logic carried over from the old OutputPane (same line types, same auto-scroll)
export function OutputView({ state, ready, autorun }: OutputViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [state?.lines])

  const isEmpty = !state?.lines.length && !state?.pendingInput && !state?.running

  return (
    <div ref={scrollRef} className="output">
      {!ready ? (
        <div className="rtc-empty">Loading Pyodide…</div>
      ) : isEmpty ? (
        <div className="rtc-empty">{autorun ? 'Output appears here as you type.' : 'Press Ctrl+Enter to run.'}</div>
      ) : (
        <>
          {state!.lines.map((line, i) => {
            if (line.type === 'stdout') return <div key={i} className="out-line out-stdout">{line.text}</div>
            if (line.type === 'input-echo') {
              return (
                <div key={i} className="out-line out-echo">
                  <span className="out-dim">{line.prompt}</span>{line.value}
                </div>
              )
            }
            if (line.type === 'cached-input') {
              return (
                <div key={i} className="out-line out-cached">
                  ↩ cached: {line.prompt ? `"${line.prompt}" ` : ''}→ {line.value}
                </div>
              )
            }
            return <div key={i} className="out-line out-error">{line.text}</div>
          })}
          {state?.pendingInput && <div className="out-line out-dim">Waiting for input…</div>}
        </>
      )}
    </div>
  )
}
