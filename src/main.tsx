import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { captureAuthRedirectError } from './services/auth/redirectError'
import { registerServiceWorker } from './services/pwa'
import './index.css'

captureAuthRedirectError()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD) registerServiceWorker()
