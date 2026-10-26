import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import '@/shared/styles/globals.css'
import { App } from './App'

// After a new deployment an open tab may ask for files that no longer exist:
// reload once (at most every 15 s); otherwise the error boundary offers a button.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'shi:reloaded-at'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(key) || 0)
  } catch {
    /* ignore */
  }
  if (Date.now() - last > 15_000) {
    event.preventDefault()
    try {
      sessionStorage.setItem(key, String(Date.now()))
    } catch {
      /* ignore */
    }
    location.reload()
  }
})

// installable phone app; pages and data still come from the network first (public/sw.js)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
