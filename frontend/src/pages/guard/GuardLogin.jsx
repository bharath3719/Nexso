import React, { useState } from "react";

export function GuardLogin({ onLogin, error, loading }) {
  const [form, setForm] = useState({ username: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(form);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "36px 32px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#0ea5e9", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Guard Portal</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Nexso Security</div>
        </div>

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
              required
              disabled={loading}
              autoComplete="username"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
                padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              required
              disabled={loading}
              autoComplete="current-password"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
                padding: "10px 14px", color: "#f1f5f9", fontSize: 15, outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "11px", borderRadius: 8, border: "none",
              background: loading ? "#334155" : "#0ea5e9", color: "#fff",
              fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
