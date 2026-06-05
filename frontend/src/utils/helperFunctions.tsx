/**
 * helperFunctions.tsx — Shared UI helper components
 * ───────────────────────────────────────────────────
 * Small, reusable components used across the vendor feature.
 * Import only what you need:
 *
 *   import { StatusBadge } from "../utils/helperFunctions";
 *
 * Note: the consuming component (VendorDetail, Vendors) must import Vendor.css
 * so that the `.vendor-status-badge` class is available in scope.
 */

import { VENDOR_STATUS_META } from "../styles/cssConstants.js";
import type { StatusBadgeProps } from "../types/index.ts";

// Narrow the dynamic status string to the keys that VENDOR_STATUS_META knows about.
type VendorStatusKey = keyof typeof VENDOR_STATUS_META;

// ─── StatusBadge ─────────────────────────────────────────────────────────────
// Coloured pill showing a vendor's verification status.
// bg and color come from VENDOR_STATUS_META → kept inline (dynamic values).
// Shape and typography → .vendor-status-badge in Vendor.css.
export function StatusBadge({ status }: StatusBadgeProps) {
  const key = (status in VENDOR_STATUS_META ? status : "INACTIVE") as VendorStatusKey;
  const s   = VENDOR_STATUS_META[key];
  return (
    <span
      className="vendor-status-badge"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
