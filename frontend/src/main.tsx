import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.module.css'
import { App } from './app.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
