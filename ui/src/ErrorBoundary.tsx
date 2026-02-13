import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-page">
          <div className="bg-surface rounded-lg border border-negative/30 p-6 max-w-lg">
            <h1 className="text-lg font-semibold text-negative mb-2">Something went wrong</h1>
            <p className="text-sm text-label mb-4">{this.state.error.message}</p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="text-sm font-medium text-white bg-accent hover:bg-blue-500 rounded px-4 py-2"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
