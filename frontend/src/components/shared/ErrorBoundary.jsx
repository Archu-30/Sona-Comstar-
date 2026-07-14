import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center max-w-md">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
            <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
