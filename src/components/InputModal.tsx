import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { PendingInput } from '../types/editor'

interface InputModalProps {
  pending: PendingInput
  onSubmit: (value: string) => void
}

/**
 * Full-page modal overlay for Python input() calls.
 * Rendered via createPortal directly into document.body so it sits above everything.
 * The backdrop div intercepts all pointer events, making the rest of the page inert.
 * Focus is claimed once at mount via useEffect(fn, []) and returned to the editor
 * by the caller's onSubmit handler.
 */
export function InputModal({ pending, onSubmit }: InputModalProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Claim focus exactly once when the modal mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Trap Tab key inside the modal so focus can't escape to the page behind the backdrop
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit(value)
    }
    if (e.key === 'Tab') {
      e.preventDefault() // nothing else to tab to inside this modal
    }
  }

  return createPortal(
    // Backdrop — covers entire viewport, blocks all pointer events beneath it
    <div
      className="modal-backdrop"
      // Clicking the backdrop itself does nothing — user must submit or the code must finish
      onMouseDown={e => e.preventDefault()}
    >
      {/* Dialog */}
      <div className="modal" role="dialog" aria-modal="true" aria-label="Input required">
        <p className="modal-title">
          <span className="glyph" aria-hidden="true" /> input() is waiting
        </p>

        {/* Prompt text from Python's input("...") call */}
        {pending.prompt && (
          <p className="modal-prompt mono">
            {pending.prompt}
          </p>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="modal-input mono"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="modal-actions">
          <button
            onClick={() => onSubmit(value)}
            className="btn btn-primary"
          >
            Submit
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
