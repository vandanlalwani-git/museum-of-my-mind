import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[museum]', error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ padding: 'var(--space-10)', maxWidth: 'var(--measure)' }}>
        <span className="plaque">A wing has closed</span>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-3)' }}>Something in the museum broke.</h1>
        <p style={{ color: 'var(--parchment-dim)', marginTop: 'var(--space-4)' }}>
          Your collection is safe in this browser. Reload to try again.
        </p>
        <pre style={{ color: 'var(--parchment-faint)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-6)', whiteSpace: 'pre-wrap' }}>
          {this.state.error.message}
        </pre>
      </main>
    );
  }
}
