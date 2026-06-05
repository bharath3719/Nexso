import React from "react";

export function TicketTableHeader({ columns }) {
  return (
    <thead>
      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        {columns.map((h) => (
          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}


export const STATUS_COLORS = {
  OPEN:        { bg: "#fef2f2", color: "#dc2626" },
  ASSIGNED:    { bg: "#fffbeb", color: "#d97706" },
  IN_PROGRESS: { bg: "#eff6ff", color: "#2563eb" },
  RESOLVED:    { bg: "#f0fdf4", color: "#16a34a" },
  CLOSED:      { bg: "#f8fafc", color: "#64748b" },
};

export const PRIORITY_COLORS = {
  HIGH:   "#dc2626",
  NORMAL: "#64748b",
  LOW:    "#10b981",
};

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.CLOSED;
  return (
    <span style={{
      background: c.bg, color: c.color,
      borderRadius: 4, padding: "2px 8px",
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
