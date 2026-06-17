/**
 * SecretaryProfile.jsx
 * ─────────────────────
 * Secretary's own profile: view society details + change password + sign out.
 */

import React, { useEffect, useState } from "react";
import {
  Text, TextField, PrimaryButton, DefaultButton,
  MessageBar, MessageBarType, Spinner,
} from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import "../../styles/SecretaryLayout.css";

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

  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then((data) => { if (!cancelled) setAccount(data.account); })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
      <PageHeader title="My Profile" subtitle="Society details and account settings" />

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
        </>
      )}
    </div>
  );
}
