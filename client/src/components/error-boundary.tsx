import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorLogged = false;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (!this.errorLogged) {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
      this.errorLogged = true;
      this.props.onError?.(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.errorLogged = false;
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] items-center justify-center p-4" data-testid="error-boundary-fallback">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle data-testid="text-error-title">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              <p data-testid="text-error-message">
                An unexpected error occurred. Please try again or reload the page.
              </p>
              {this.state.error && (
                <p className="mt-2 text-xs font-mono text-destructive/70 break-all" data-testid="text-error-details">
                  {this.state.error.message}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-center gap-2">
              <Button variant="outline" onClick={this.handleRetry} data-testid="button-error-retry">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} data-testid="button-error-reload">
                Reload Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error("[App] Unhandled component error:", error.message);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center p-4" data-testid="route-error-boundary-fallback">
          <Card className="w-full max-w-sm text-center">
            <CardHeader>
              <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
              <CardTitle className="text-lg" data-testid="text-page-error-title">Page Error</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground" data-testid="text-page-error-message">
              This page encountered an error. Try navigating to a different page.
            </CardContent>
            <CardFooter className="justify-center">
              <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-page-error-reload">
                Reload
              </Button>
            </CardFooter>
          </Card>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
