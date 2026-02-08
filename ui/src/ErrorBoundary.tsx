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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white rounded-lg border border-red-200 p-6 max-w-lg">
            <h1 className="text-lg font-semibold text-red-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-700 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded px-4 py-2"
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
