import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { PyodideProvider } from './context/PyodideContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Provider wraps both pages: Python starts loading on the home page, so the editor opens ready */}
    <PyodideProvider>
      <Root />
    </PyodideProvider>
  </StrictMode>,
)
