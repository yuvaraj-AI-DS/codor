import { useEffect, useState } from 'react'
import App from './App'
import { HomePage } from './home/HomePage'

/** Hash routing: "#/editor" → IDE, anything else → home. Works on any static host. */
const isEditor = () => window.location.hash.startsWith('#/editor')

export default function Root() {
  const [editor, setEditor] = useState(isEditor)

  useEffect(() => {
    const onHash = () => setEditor(isEditor())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Each page starts at the top when you switch between them
  useEffect(() => { window.scrollTo(0, 0) }, [editor])

  useEffect(() => {
    document.title = editor ? 'Python Editor · CODORuntime' : 'CODORuntime'
  }, [editor])

  return editor ? <App /> : <HomePage />
}
