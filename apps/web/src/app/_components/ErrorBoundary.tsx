"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * AnimationErrorBoundary
 *
 * Prevents animation-related errors from crashing the entire page.
 * If an error occurs during animation rendering, gracefully falls back
 * to showing the content without animation.
 *
 * @example
 * ```tsx
 * <AnimationErrorBoundary>
 *   <AnimatedView delay={200}>
 *     <BuySellToggle activeMode={activeMode} onModeChange={setActiveMode} />
 *   </AnimatedView>
 * </AnimationErrorBoundary>
 * ```
 */
export class AnimationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // Log the error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Animation error caught by boundary:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }

    // In production, you could send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // If a fallback was provided, use it. Otherwise, just render children without animation wrapper
      return this.props.fallback ?? this.props.children;
    }

    return this.props.children;
  }
}
