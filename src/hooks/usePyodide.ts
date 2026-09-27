import { useEffect, useRef, useState } from 'react'
import type { PyodideInterface } from 'pyodide'
import { loadPyodide } from 'pyodide'

export function usePyodide(): { pyodide: PyodideInterface | null; ready: boolean } {
  const pyodideRef = useRef<PyodideInterface | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadPyodide().then((instance) => {
      if (cancelled) return
      pyodideRef.current = instance
      setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { pyodide: pyodideRef.current, ready }
}
