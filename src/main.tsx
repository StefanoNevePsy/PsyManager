import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/globals.css'

// Boot-time failures (a throwing module, a missing env var) happen before any
// React tree exists, so an ErrorBoundary can't catch them and the WebView is
// left showing a blank screen. Render the reason instead — there is no
// console to inspect on a phone.
const renderBootError = (message: string) => {
  const root = document.getElementById('root')
  if (!root || root.dataset.booted === 'true') return
  root.innerHTML = `
    <div style="position:fixed;inset:0;background:#0f172a;color:#e2e8f0;padding:24px;overflow:auto;font-family:system-ui,-apple-system,sans-serif">
      <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">Avvio non riuscito</h1>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">
        L'app non è riuscita a caricarsi. Segnala il messaggio qui sotto.
      </p>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.5;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;color:#cbd5e1">${message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre>
    </div>
  `
}

window.addEventListener('error', (event) => {
  renderBootError(
    `${event.message}\n\n${event.filename ?? ''}:${event.lineno ?? ''}:${event.colno ?? ''}\n\n${
      event.error?.stack ?? ''
    }`
  )
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  renderBootError(
    typeof reason === 'object' && reason !== null
      ? `${(reason as Error).message ?? String(reason)}\n\n${(reason as Error).stack ?? ''}`
      : String(reason)
  )
})

try {
  const container = document.getElementById('root')!
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
  container.dataset.booted = 'true'
} catch (err) {
  renderBootError(err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err))
}
