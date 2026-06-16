import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryLabels = {
  title: string;
  detail: string;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  labels: ErrorBoundaryLabels;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Renderer crashed.', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-view">
          <section className="fatal-error-card">
            <h1>{this.props.labels.title}</h1>
            <p>{this.props.labels.detail}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
