import React from "react";

export function CredentialsBox({ username, password }) {
  return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontFamily: "monospace", fontSize: 15, lineHeight: "2", userSelect: "all" }}>
        <div>
          <span style={{ color: "#64748b", fontSize: 12 }}>Username  </span>
          <strong style={{ color: "#15803d" }}>{username}</strong>
        </div>
        <div>
          <span style={{ color: "#64748b", fontSize: 12 }}>Password  </span>
          <strong style={{ color: "#15803d" }}>{password}</strong>
        </div>
      </div>
    </div>
  );
}
