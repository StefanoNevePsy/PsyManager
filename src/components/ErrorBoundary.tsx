import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * Last-resort boundary around the whole app.
 *
 * Without it a render-time exception unmounts everything and leaves a blank
 * (black, in dark theme) screen — which is undebuggable on a phone, where
 * there is no console. Showing the actual message turns "the app doesn't
 * open" into something reportable.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    console.error('[PsyManager] Unhandled error:', error, info)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    // Most boot failures come from stale persisted state after an update
    try {
      localStorage.removeItem('psymanager-query-cache-v2')
    } catch {
      // ignore
    }
    window.location.reload()
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const details = [
      error.message,
      error.stack,
      info?.componentStack,
    ]
      .filter(Boolean)
      .join('\n\n')

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647,
          background: '#0f172a',
          color: '#e2e8f0',
          padding: '24px',
          overflow: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Si è verificato un errore
        </h1>
        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>
          L'app non è riuscita ad avviarsi. Riprova; se il problema persiste,
          usa "Svuota cache e riavvia".
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Riprova
          </button>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: 'transparent',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Svuota cache e riavvia
          </button>
        </div>

        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 11,
            lineHeight: 1.5,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 12,
            color: '#cbd5e1',
          }}
        >
          {details}
        </pre>
      </div>
    )
  }
}
