import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message ?? "Unknown error";
    const stack = this.state.error?.stack ?? "";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl" aria-hidden="true">🎸</div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl text-primary">The band's off-key.</h1>
            <p className="font-body text-base text-muted-foreground">
              Something crashed on our side. The rest of the site still works — take a breath and try again.
            </p>
          </div>

          <details className="text-left bg-card border border-border rounded-lg p-4">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-muted-foreground">
              What broke
            </summary>
            <pre className="mt-3 font-mono text-xs whitespace-pre-wrap text-destructive break-words">
              {message}
            </pre>
            {stack && (
              <pre className="mt-3 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground/70 break-words max-h-40 overflow-auto">
                {stack}
              </pre>
            )}
          </details>

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.reset}
              className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-body text-sm hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign("/")}
              className="h-11 px-5 rounded-md border border-border bg-transparent text-foreground font-body text-sm hover:bg-muted transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
