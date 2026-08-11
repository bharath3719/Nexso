/**
 * GuideLauncher.jsx
 * ──────────────────
 * The "Guide" control that sits in every portal header. Owns the open/closed
 * state so each layout only has to drop in <GuideLauncher role="…" />.
 *
 * The drawer itself is loaded lazily — the guide content is sizeable and most
 * sessions never open it.
 */

import React from "react";
import "../../styles/Guide.css";

const GuideDrawer = React.lazy(() =>
  import("./GuideDrawer.jsx").then((m) => ({ default: m.GuideDrawer })),
);

export function GuideLauncher({ role }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        className="guide-launch"
        onClick={() => setOpen(true)}
        title="How this portal works"
        aria-label="Open the guide"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="guide-launch__label">Guide</span>
      </button>

      {open && (
        <React.Suspense fallback={null}>
          <GuideDrawer role={role} onClose={() => setOpen(false)} />
        </React.Suspense>
      )}
    </>
  );
}
