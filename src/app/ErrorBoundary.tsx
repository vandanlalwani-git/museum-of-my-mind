import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadForUpdate } from './updates';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // A room file that vanished in a deploy is not a bug: fetch the new version.
    if (isChunkLoadError(error) && reloadForUpdate()) return;
    console.error('[museum]', error, info.componentStack);
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (isChunkLoadError(error)) {
      return (
        <main style={{ padding: 'var(--space-10)', maxWidth: 'var(--measure)' }}>
          <span className="plaque">A newer version is ready</span>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-3)' }}>The museum was updated while it was open.</h1>
          <p style={{ color: 'var(--parchment-dim)', marginTop: 'var(--space-4)' }}>Nothing is lost. Reload to open the new version.</p>
          <button type="button" className="instrument instrument--primary" style={{ marginTop: 'var(--space-6)' }} onClick={() => window.location.reload()}>Reload</button>
        </main>
      );
    }
    return (
      <main style={{ padding: 'var(--space-10)', maxWidth: 'var(--measure)' }}>
        <span className="plaque">A wing has closed</span>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-3)' }}>Something in the museum broke.</h1>
        <p style={{ color: 'var(--parchment-dim)', marginTop: 'var(--space-4)' }}>
          Your collection is safe in this browser. Reload to try again.
        </p>
        <button type="button" className="instrument instrument--primary" style={{ marginTop: 'var(--space-6)' }} onClick={() => window.location.reload()}>Reload</button>
        <pre style={{ color: 'var(--parchment-faint)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-6)', whiteSpace: 'pre-wrap' }}>
          {error.message}
        </pre>
      </main>
    );
  }
}
