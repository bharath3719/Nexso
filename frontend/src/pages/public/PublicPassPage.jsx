import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../services/api.js";

const STATUS_CONFIG = {
  ACTIVE:  { label: "Active",  bg: "#dcfce7", color: "#15803d" },
  USED:    { label: "Used",    bg: "#f3f4f6", color: "#6b7280" },
  EXPIRED: { label: "Expired", bg: "#fef3c7", color: "#b45309" },
  REVOKED: { label: "Revoked", bg: "#fee2e2", color: "#dc2626" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ minWidth: 100, fontSize: 12, color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 400 }}>{value}</span>
    </div>
  );
}

export function PublicPassPage() {
  const { passCode } = useParams();
  const [pass, setPass]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!passCode) return;
    api.passes.get(passCode)
      .then((data) => setPass(data.pass))
      .catch((err) => setError(err.status === 404 ? "Pass not found." : "Failed to load pass."))
      .finally(() => setLoading(false));
  }, [passCode]);

  const status = pass ? (STATUS_CONFIG[pass.status] || STATUS_CONFIG.EXPIRED) : null;
  const isValid = pass?.status === "ACTIVE" && new Date() >= new Date(pass.valid_from) && new Date() <= new Date(pass.valid_until);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>Nexso</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Visitor Pass</div>
      </div>

      {loading && (
        <div style={{ color: "#64748b", fontSize: 15 }}>Loading pass…</div>
      )}

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 12, padding: "16px 24px", fontSize: 15, maxWidth: 400, textAlign: "center" }}>
          {error}
        </div>
      )}

      {pass && (
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", maxWidth: 420, width: "100%", overflow: "hidden" }}>
          {/* Status banner */}
          <div style={{ background: isValid ? "#0ea5e9" : status.bg, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isValid ? "rgba(255,255,255,0.75)" : status.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Visitor</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isValid ? "#fff" : "#1e293b", marginTop: 2 }}>{pass.visitor_name}</div>
              </div>
              <span style={{
                background: isValid ? "rgba(255,255,255,0.2)" : status.bg,
                color: isValid ? "#fff" : status.color,
                borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600,
              }}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Pass code */}
          <div style={{ background: "#f8fafc", padding: "12px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pass Code</span>
            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "0.12em" }}>{pass.pass_code}</span>
          </div>

          {/* Details */}
          <div style={{ padding: "16px 24px" }}>
            <Row label="Society"    value={pass.society_name} />
            <Row label="Unit"       value={pass.tower_name ? `${pass.tower_name} — ${pass.unit_number}` : pass.unit_number} />
            <Row label="Valid from" value={fmt(pass.valid_from)} />
            <Row label="Valid until" value={fmt(pass.valid_until)} />
            <Row label="Purpose"   value={pass.purpose} />
            <Row label="Vehicle"   value={pass.vehicle} />
          </div>

          {/* Footer note */}
          <div style={{ padding: "12px 24px 20px", color: "#94a3b8", fontSize: 11, textAlign: "center" }}>
            Show this pass to the security guard at the gate.
          </div>
        </div>
      )}
    </div>
  );
}
