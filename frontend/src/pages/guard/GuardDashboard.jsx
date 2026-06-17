import React, { useState, useRef } from "react";
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

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ minWidth: 110, fontSize: 12, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#f1f5f9" }}>{value}</span>
    </div>
  );
}

export function GuardDashboard({ societyName, onLogout }) {
  const [input, setInput]       = useState("");
  const [result, setResult]     = useState(null);   // { pass, usable }
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [marking, setMarking]   = useState(false);
  const [markedUsed, setMarkedUsed] = useState(false);
  const inputRef = useRef(null);

  const reset = () => {
    setInput(""); setResult(null); setError(null); setMarkedUsed(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError(null); setResult(null); setMarkedUsed(false);
    try {
      const data = await api.guard.verify(code);
      setResult(data);
    } catch (err) {
      setError(
        err.status === 404
          ? "Pass not found. Check the code and try again."
          : "Failed to verify pass. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUsed = async () => {
    if (!result?.pass?.id) return;
    setMarking(true);
    try {
      await api.guard.usePass(result.pass.id);
      setMarkedUsed(true);
      setResult((r) => ({ ...r, pass: { ...r.pass, status: "USED" }, usable: false }));
    } catch {
      setError("Could not mark pass as used. It may have already been used or expired.");
    } finally {
      setMarking(false);
    }
  };

  const pass   = result?.pass;
  const usable = result?.usable && !markedUsed;
  const status = pass ? (STATUS_CONFIG[pass.status] || STATUS_CONFIG.EXPIRED) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Guard Portal</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{societyName}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          Sign out
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Search */}
          <form onSubmit={handleVerify} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Enter Pass Code
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4E5F6"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1, background: "#1e293b", border: "2px solid #334155",
                  borderRadius: 10, padding: "12px 16px", color: "#f1f5f9",
                  fontSize: 18, fontFamily: "monospace", fontWeight: 600,
                  outline: "none", letterSpacing: "0.1em",
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  padding: "12px 20px", borderRadius: 10, border: "none",
                  background: loading || !input.trim() ? "#334155" : "#0ea5e9",
                  color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}
              >
                {loading ? "…" : "Verify"}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 14, marginBottom: 16 }}>
              {error}
              <button onClick={reset} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", textDecoration: "underline", marginLeft: 8, fontSize: 13 }}>
                Try again
              </button>
            </div>
          )}

          {/* Result card */}
          {pass && (
            <div style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden", border: "1px solid #334155" }}>
              {/* Header */}
              <div style={{ padding: "18px 20px", background: usable ? "#0369a1" : "#1e293b", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: usable ? "rgba(255,255,255,0.65)" : "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visitor</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: usable ? "#fff" : "#f1f5f9", marginTop: 2 }}>{pass.visitor_name}</div>
                </div>
                <span style={{ background: status.bg, color: status.color, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                  {status.label}
                </span>
              </div>

              {/* Pass code */}
              <div style={{ padding: "10px 20px", background: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b" }}>
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pass Code</span>
                <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#7dd3fc", letterSpacing: "0.1em" }}>{pass.pass_code}</span>
              </div>

              {/* Details */}
              <div style={{ padding: "10px 20px" }}>
                <DetailRow label="Unit"       value={pass.tower_name ? `${pass.tower_name} — ${pass.unit_number}` : pass.unit_number} />
                <DetailRow label="Resident"   value={pass.resident_name} />
                <DetailRow label="Phone"      value={pass.visitor_phone} />
                <DetailRow label="Purpose"    value={pass.purpose} />
                <DetailRow label="Vehicle"    value={pass.vehicle} />
                <DetailRow label="Valid from" value={fmt(pass.valid_from)} />
                <DetailRow label="Valid until" value={fmt(pass.valid_until)} />
              </div>

              {/* Action */}
              <div style={{ padding: "14px 20px", borderTop: "1px solid #1e293b", display: "flex", gap: 8 }}>
                {markedUsed ? (
                  <div style={{ flex: 1, textAlign: "center", background: "#052e16", borderRadius: 8, padding: "12px", color: "#4ade80", fontWeight: 700, fontSize: 15 }}>
                    ✓ Entry Recorded
                  </div>
                ) : usable ? (
                  <button
                    onClick={handleMarkUsed}
                    disabled={marking}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 8, border: "none",
                      background: marking ? "#334155" : "#16a34a", color: "#fff",
                      fontWeight: 700, fontSize: 15, cursor: "pointer",
                    }}
                  >
                    {marking ? "Recording…" : "Allow Entry & Mark Used"}
                  </button>
                ) : (
                  <div style={{ flex: 1, textAlign: "center", background: "#1e293b", borderRadius: 8, padding: "12px", color: "#94a3b8", fontSize: 14 }}>
                    {pass.status === "USED" ? "Pass already used" :
                     pass.status === "EXPIRED" ? "Pass has expired" :
                     pass.status === "REVOKED" ? "Pass was revoked" :
                     "Pass is not currently valid"}
                  </div>
                )}
                <button
                  onClick={reset}
                  style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #334155", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {!pass && !error && !loading && (
            <div style={{ textAlign: "center", color: "#334155", fontSize: 14, marginTop: 20 }}>
              Enter a pass code above to verify a visitor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
