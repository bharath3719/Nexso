/**
 * VendorProfile.jsx
 * ──────────────────
 * Vendor portal profile page — shows their vendor info and allows changing password.
 */

import React, { useEffect, useState } from "react";
import { Text, PrimaryButton, Spinner, MessageBar, MessageBarType } from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
import { PasswordChangeFields } from "../../components/PasswordChangeFields.jsx";
import { api } from "../../services/api.js";
import "../../styles/VendorLayout.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Change password form ──────────────────────────────────────────────────────

function ChangePasswordForm({ onLogout }) {
  const [form,    setForm]    = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const mismatch = form.confirm && form.newPassword !== form.confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await api.auth.changePassword(form.currentPassword, form.newPassword);
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setError(
        err.code === "current_password_wrong"
          ? "Current password is incorrect."
          : err.code === "password_too_short"
            ? "New password must be at least 8 characters."
            : "Failed to change password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {success && (
          <MessageBar messageBarType={MessageBarType.success}>
            Password changed successfully.
          </MessageBar>
        )}
        {error && (
          <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>
        )}

        <PasswordChangeFields
          form={form}
          onFieldChange={(field, v) => setForm((s) => ({ ...s, [field]: v }))}
          mismatch={mismatch}
          loading={loading}
        />

        <div style={{ display: "flex", gap: 10 }}>
          {loading
            ? <Spinner label="Saving…" />
            : <PrimaryButton type="submit" text="Change Password" disabled={Boolean(mismatch)} />
          }
        </div>
      </div>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VendorProfile({ onLogout }) {
  const [vendor,  setVendor]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.vendorPortal.profile();
        if (!cancelled) setVendor(data);
      } catch {
        if (!cancelled) setError("Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const v = vendor?.vendor;

  return (
    <div className="vnd-page">
      <PageHeader
        title="My Profile"
        subtitle="Your vendor account details"
      />

      {error && (
        <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading profile…" />
      ) : v ? (
        <>
          {/* Vendor info card */}
          <div className="vnd-card">
            <div className="vnd-card-header">
              <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
                Vendor Information
              </Text>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#16a34a",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 4, padding: "2px 8px",
              }}>
                {v.verification_status}
              </span>
            </div>

            <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
              <InfoRow label="Business Name" value={v.business_name || v.name} />
              <InfoRow label="Owner / Contact" value={v.owner_name} />
              <InfoRow label="Login Username" value={vendor.username} />
              <InfoRow label="Email" value={v.email} />
              <InfoRow label="Phone" value={v.phone} />
              <InfoRow label="WhatsApp" value={v.whatsapp_number} />
              <InfoRow label="GST Number" value={v.gst} />
              <InfoRow label="Team Size" value={v.team_size ? `${v.team_size} people` : null} />
              <InfoRow label="Emergency Available" value={v.emergency_availability ? "Yes" : "No"} />
              {v.categories?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Service Categories
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {v.categories.map((cat) => (
                      <span key={cat} style={{
                        background: "#eff6ff", color: "#3b82f6",
                        borderRadius: 4, padding: "3px 10px",
                        fontSize: 12, fontWeight: 500,
                      }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Change password card */}
          <div className="vnd-card">
            <div className="vnd-card-header">
              <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
                Change Password
              </Text>
            </div>
            <div style={{ padding: 24, maxWidth: 400 }}>
              <ChangePasswordForm onLogout={onLogout} />
            </div>
          </div>

          {/* Sign out */}
          <div>
            <button
              onClick={onLogout}
              className="vnd-btn vnd-btn--ghost"
              style={{ color: "#dc2626", borderColor: "#fecaca" }}
            >
              Sign Out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
