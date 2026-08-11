/**
 * SecretaryProfile.jsx
 * ─────────────────────
 * Secretary's own profile: society details, payment settings (the society's
 * collection UPI ID — set once, changed rarely), change password, sign out.
 */

import React, { useEffect, useState } from "react";
import {
  Text, TextField, PrimaryButton, DefaultButton,
  MessageBar, MessageBarType, Spinner,
} from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { UpiSetupModal } from "../../components/maintenance/UpiSetupModal.jsx";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import "../../styles/SecretaryLayout.css";
import "../../styles/Maintenance.css";

function InfoRow({ label, value }) {
  return (
    <div className="sec-info-row">
      <div className="sec-info-row__label">{label}</div>
      <div className="sec-info-row__value">{value || "—"}</div>
    </div>
  );
}

export function SecretaryProfile({ onLogout }) {
  const [account, setAccount]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState("");

  // Password change form
  const [pwForm,    setPwForm]    = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwError,   setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving,  setPwSaving]  = useState(false);

  // Payment settings (society-wide, not per-user)
  const [config,    setConfig]    = useState(null);
  const [showUpi,   setShowUpi]   = useState(false);
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiNotice, setUpiNotice] = useState(null); // { ok: boolean, text: string }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.auth.me().catch(() => null),
      api.secretary.maintenance.getConfig().catch(() => null),
    ])
      .then(([me, cfg]) => {
        if (cancelled) return;
        if (me)  setAccount(me.account);
        if (cfg) setConfig(cfg.config);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSaveUpi = async (payload) => {
    setUpiSaving(true);
    setUpiNotice(null);
    try {
      const data = await api.secretary.maintenance.updateConfig(payload);
      setConfig((c) => ({ ...c, ...data.config }));
      setShowUpi(false);
      setUpiNotice({
        ok: true,
        text: payload.maintenance_upi_id
          ? "Payment details saved. New bills and reminders will use this UPI ID."
          : "UPI ID removed. Residents can no longer pay online.",
      });
    } catch (err) {
      setUpiNotice({ ok: false, text: err?.data?.message || "Failed to save payment details." });
    } finally {
      setUpiSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }

    setPwSaving(true);
    try {
      await api.auth.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setPwError(
        err.code === "current_password_wrong"
          ? "Current password is incorrect."
          : err.code === "password_too_short"
            ? "Password must be at least 8 characters."
            : err.status === 0
              ? "Network error. Please try again."
              : "Failed to change password.",
      );
    } finally {
      setPwSaving(false);
    }
  };

  const mismatch = pwForm.confirm && pwForm.newPassword !== pwForm.confirm;

  return (
    <div className="sec-page">
      <PageHeader title="My Profile" subtitle="Society details, payment settings, and your account" />

      {loading ? (
        <Spinner label="Loading profile…" />
      ) : (
        <>
          {/* Society details */}
          <div className="sec-card">
            <div className="sec-card-header">
              <Text styles={T.sectionHeader}>
                Society Details
              </Text>
            </div>
            <div className="sec-card-body--padded">
              <InfoRow label="Society Name"   value={account?.society_name}  />
              <InfoRow label="Building ID"    value={account?.building_id}   />
              <InfoRow label="Address"        value={account?.address}       />
              <InfoRow label="Society Type"   value={account?.society_type}  />
              <InfoRow label="Your Username"  value={account?.username}      />
              <InfoRow label="Last Login"     value={
                account?.last_login
                  ? new Date(account.last_login).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                  : "—"
              } />
            </div>
          </div>

          {/* Payment settings — set once, changed rarely */}
          <div className="sec-card">
            <div className="sec-card-header">
              <Text styles={T.sectionHeader}>
                Payment Settings
              </Text>
            </div>
            <div className="sec-card-body--padded">
              {upiNotice && (
                <MessageBar
                  messageBarType={upiNotice.ok ? MessageBarType.success : MessageBarType.error}
                  onDismiss={() => setUpiNotice(null)}
                  style={{ marginBottom: 12 }}
                >
                  {upiNotice.text}
                </MessageBar>
              )}

              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
                The UPI ID residents' maintenance payments are collected into. It appears
                on every bill, WhatsApp reminder and pay link.
              </div>

              {config?.maintenance_upi_id ? (
                <>
                  <InfoRow label="Collection UPI ID" value={config.maintenance_upi_id} />
                  <InfoRow label="Payee Name" value={config.maintenance_payee_name || config.name} />
                  <div style={{ marginTop: 14 }}>
                    <DefaultButton
                      text="Change UPI ID"
                      iconProps={{ iconName: "Edit" }}
                      onClick={() => setShowUpi(true)}
                    />
                  </div>
                </>
              ) : (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
                    No UPI ID set up yet
                  </div>
                  <div style={{ fontSize: 12.5, color: "#a16207", lineHeight: 1.6, marginBottom: 12 }}>
                    Until you add one, residents can't pay maintenance online — bills and
                    reminders go out without a payment option.
                  </div>
                  <PrimaryButton
                    text="Set up UPI ID"
                    iconProps={{ iconName: "PaymentCard" }}
                    onClick={() => setShowUpi(true)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Change password */}
          <div className="sec-card">
            <div className="sec-card-header">
              <Text styles={T.sectionHeader}>
                Change Password
              </Text>
            </div>
            <div className="sec-card-body--form">
              {pwSuccess && (
                <MessageBar messageBarType={MessageBarType.success} style={{ marginBottom: 12 }}>
                  Password changed successfully.
                </MessageBar>
              )}
              {pwError && (
                <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: 12 }}>
                  {pwError}
                </MessageBar>
              )}
              <form onSubmit={handlePasswordChange}>
                <div className="sec-form-col sec-form-col--narrow">
                  <TextField
                    label="Current Password"
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={(_, v) => setPwForm((f) => ({ ...f, currentPassword: v || "" }))}
                    required
                    disabled={pwSaving}
                  />
                  <TextField
                    label="New Password"
                    type="password"
                    description="Minimum 8 characters"
                    value={pwForm.newPassword}
                    onChange={(_, v) => setPwForm((f) => ({ ...f, newPassword: v || "" }))}
                    required
                    disabled={pwSaving}
                  />
                  <TextField
                    label="Confirm New Password"
                    type="password"
                    value={pwForm.confirm}
                    onChange={(_, v) => setPwForm((f) => ({ ...f, confirm: v || "" }))}
                    errorMessage={mismatch ? "Passwords do not match" : ""}
                    required
                    disabled={pwSaving}
                  />
                  <div className="sec-form-row">
                    {pwSaving
                      ? <Spinner label="Saving…" />
                      : (
                        <>
                          <PrimaryButton type="submit" text="Update Password" disabled={mismatch} />
                          <DefaultButton
                            type="button"
                            text="Clear"
                            onClick={() => { setPwForm({ currentPassword: "", newPassword: "", confirm: "" }); setPwError(""); setPwSuccess(false); }}
                          />
                        </>
                      )
                    }
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Sign out */}
          <div>
            <DefaultButton
              text="Sign Out"
              iconProps={{ iconName: "SignOut" }}
              onClick={onLogout}
              styles={{ root: { borderColor: "#e2e8f0" } }}
            />
          </div>

          {showUpi && (
            <UpiSetupModal
              currentUpiId={config?.maintenance_upi_id || ""}
              currentPayeeName={config?.maintenance_payee_name || ""}
              societyName={config?.name || account?.society_name || ""}
              saving={upiSaving}
              onSave={handleSaveUpi}
              onClose={() => setShowUpi(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
