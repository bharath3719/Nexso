import React from "react";

/**
 * Formats an API error into a user-friendly string.
 * @param {any} err  - thrown error (ideally an ApiError from api.js)
 * @param {string} fallback - message to use when err has no useful message
 */
export function getErrMsg(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (err.status === 0) return "Could not reach the server. Check your connection.";
  return err.message || fallback;
}

/**
 * Unified error banner used across all portals.
 *
 * @param {string}   message   - error text to display; renders nothing if falsy
 * @param {Function} [onRetry] - if provided, shows a "Retry" button
 */
export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="nexso-error-banner" role="alert">
      <span className="nexso-error-banner__msg">{message}</span>
      {onRetry && (
        <button className="nexso-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
