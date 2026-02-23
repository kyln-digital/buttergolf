/**
 * Error Boundary Component
 *
 * Cross-platform error boundary that catches React errors and provides fallback UI.
 * Integrates with error reporting services when configured.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

"use client";

import { Component, type ReactNode, type ErrorInfo, useCallback, useEffect, useState } from "react";
import { Column, Row } from "./Layout";
import { Text, Heading } from "./Text";
import { Button } from "./Button";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development

    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Store error info in state
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service (Sentry, etc.)
    // Add your error reporting service here
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Column
          flex={1}
          width="100%"
          minHeight="100vh"
          alignItems="center"
          justifyContent="center"
          padding="$xl"
          backgroundColor="$background"
          gap="$lg"
        >
          <Column alignItems="center" gap="$md" maxWidth={400}>
            <Heading level={2} align="center" color="$error">
              Something went wrong
            </Heading>

            <Text align="center" color="$textSecondary">
              We&apos;re sorry for the inconvenience. The error has been logged and we&apos;ll look
              into it.
            </Text>

            {}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <Column
                backgroundColor="$errorLight"
                padding="$md"
                borderRadius="$md"
                width="100%"
                gap="$sm"
              >
                <Text weight="semibold" color="$error" size="$3">
                  Error: {this.state.error.message}
                </Text>
                {this.state.errorInfo && (
                  <Text color="$error" size="$2">
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </Column>
            )}

            <Row gap="$md" width="100%">
              <Button flex={1} butterVariant="primary" size="$5" onPress={this.handleReset}>
                Try Again
              </Button>

              <Button
                flex={1}
                size="$5"
                backgroundColor="transparent"
                borderWidth={2}
                borderColor="$border"
                color="$text"
                onPress={() => {
                  // Navigate to home or reload page
                  if (globalThis.window !== undefined) {
                    globalThis.window.location.href = "/";
                  }
                }}
              >
                Go Home
              </Button>
            </Row>
          </Column>
        </Column>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 * Note: This doesn't catch errors in event handlers or async code
 */
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    showError: setError,
    reset,
  };
}
