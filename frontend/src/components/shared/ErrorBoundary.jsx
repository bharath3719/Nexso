import React from "react";
import { useLocation } from "react-router-dom";

/**
 * Catches render/lifecycle errors in its subtree and shows a fallback instead of
 * letting React unmount the whole app to a blank screen.
 *
 * Note: error boundaries do NOT catch errors in event handlers or async callbacks
 * (those need their own try/catch) — only errors thrown during render, in lifecycle
 * methods, and in constructors of descendants.
 *
 * Styling here is intentionally inline: the fallback must render even if a stylesheet
 * failed to load, so it cannot depend on CSS classes.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log for diagnostics; never rethrow.
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Auto-recover when the caller signals a context change (e.g. route navigation).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "#475569", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>Something went wrong</div>
          <div style={{ fontSize: 14, marginBottom: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            This section ran into an unexpected error. The rest of the app is still working — try again or reload the page.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ fontSize: 14, fontWeight: 600, padding: "8px 18px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ fontSize: 14, fontWeight: 600, padding: "8px 18px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer" }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Router-aware boundary: auto-resets on navigation so a crash on one page clears
 * when the user moves to another. Must be rendered inside a <Router>.
 */
export function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}
