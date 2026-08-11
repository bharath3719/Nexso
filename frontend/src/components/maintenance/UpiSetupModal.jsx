/**
 * UpiSetupModal.jsx
 * ──────────────────
 * One-time (rarely-changed) setup of the society's collection UPI ID.
 *
 * This is the account every resident's maintenance payment lands in, so the
 * modal deliberately makes it hard to save something wrong by accident:
 *
 *   1. the ID is validated live against the same VPA shape the backend enforces
 *      (`services/upiService.js` → isValidVpa), so blank / malformed input can
 *      never reach Save;
 *   2. Save is disabled until the value actually changed;
 *   3. a review step echoes the ID back — exactly as the resident's UPI app will
 *      show it — and needs a second, separate click to commit.
 *
 * Clearing the ID is a separate, explicitly-confirmed action rather than
 * "save an empty box", because an empty box is almost always a slip.
 */

import React, { useMemo, useState } from "react";
import { DefaultButton, PrimaryButton, TextField, Icon } from "@fluentui/react";

/** Mirrors isValidVpa() in backend/src/services/upiService.js. */
const VPA_RE = /^[\w.\-]{2,64}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(value) {
  return VPA_RE.test(String(value || "").trim());
}

function upiError(raw) {
  const value = String(raw || "").trim();
  if (!value)             return "Enter the society's UPI ID.";
  if (!value.includes("@")) return "A UPI ID looks like name@bank — the @ is missing.";
  if (/\s/.test(value))   return "A UPI ID cannot contain spaces.";
  if (!VPA_RE.test(value)) return "That doesn't look like a valid UPI ID. Example: greenwood.soc@okicici";
  return "";
}

export function UpiSetupModal({
  currentUpiId     = "",
  currentPayeeName = "",
  societyName      = "",
  /** The admin society endpoint has no payee-name column — hide the field there
   *  rather than collect a value that would be silently dropped. */
  allowPayeeName   = true,
  saving           = false,
  onSave,
  onClose,
}) {
  const [step,  setStep]  = useState("edit"); // 'edit' | 'review' | 'remove'
  const [upi,   setUpi]   = useState(currentUpiId || "");
  const [payee, setPayee] = useState(currentPayeeName || "");
  const [touched, setTouched] = useState(false);

  const trimmedUpi   = upi.trim();
  const trimmedPayee = payee.trim();
  const error        = upiError(trimmedUpi);
  const changed      = trimmedUpi !== (currentUpiId || "").trim()
                    || (allowPayeeName && trimmedPayee !== (currentPayeeName || "").trim());
  const canContinue  = !error && changed && !saving;

  const displayPayee = useMemo(
    () => trimmedPayee || societyName || "Society",
    [trimmedPayee, societyName],
  );

  const commit = (payload) => { if (!saving) onSave(payload); };

  return (
    <div className="maint-modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="maint-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="maint-modal-header">
          <div>
            <div className="maint-modal-title">
              {step === "remove"
                ? "Remove UPI ID"
                : currentUpiId ? "Change collection UPI ID" : "Set up collection UPI ID"}
            </div>
            <div className="maint-modal-subtitle">
              {step === "review"
                ? "Check this carefully before saving"
                : "Where residents' maintenance payments are sent"}
            </div>
          </div>
          <button className="maint-modal-close" onClick={onClose} disabled={saving}>✕</button>
        </div>

        {/* ── Step 1: edit ─────────────────────────────────────────────────── */}
        {step === "edit" && (
          <>
            <div className="maint-modal-body">
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 16px", lineHeight: 1.6 }}>
                Set this once. It appears on every bill, reminder and pay link, and it's
                the account residents' money actually goes to — so double-check it against
                your society's bank passbook or UPI app.
              </p>

              <TextField
                label="Society UPI ID"
                required
                placeholder="greenwood.soc@okicici"
                value={upi}
                onChange={(_, v) => { setUpi(v || ""); setTouched(true); }}
                onBlur={() => setTouched(true)}
                errorMessage={touched ? error : ""}
                disabled={saving}
                autoFocus
              />

              {allowPayeeName && (
                <div style={{ marginTop: 14 }}>
                  <TextField
                    label="Payee name (optional)"
                    placeholder={societyName || "Shown in the resident's UPI app"}
                    description="What residents see as the payee. Defaults to your society name."
                    value={payee}
                    onChange={(_, v) => setPayee(v || "")}
                    disabled={saving}
                    maxLength={50}
                  />
                </div>
              )}

              {currentUpiId && (
                <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
                  Currently collecting to <strong style={{ color: "#334155" }}>{currentUpiId}</strong>.{" "}
                  <button
                    type="button"
                    onClick={() => setStep("remove")}
                    disabled={saving}
                    style={{ background: "none", border: "none", padding: 0, color: "#dc2626", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Remove it
                  </button>
                </div>
              )}
            </div>
            <div className="maint-modal-footer">
              <DefaultButton text="Cancel" onClick={onClose} disabled={saving} styles={{ root: { height: 32 } }} />
              <PrimaryButton
                text="Review"
                onClick={() => { setTouched(true); if (canContinue) setStep("review"); }}
                disabled={!canContinue}
                styles={{ root: { height: 32 } }}
              />
            </div>
          </>
        )}

        {/* ── Step 2: review ───────────────────────────────────────────────── */}
        {step === "review" && (
          <>
            <div className="maint-modal-body">
              <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#92400e", lineHeight: 1.6 }}>
                <Icon iconName="Warning" style={{ marginRight: 6 }} />
                Every maintenance payment from now on goes to this ID. Nexso cannot recover
                money sent to a wrong UPI ID.
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3, textTransform: "uppercase" }}>
                  What the resident will see
                </div>
                <div style={{ padding: "14px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Paying to</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{displayPayee}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>UPI ID</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 16, fontWeight: 700, color: "#1d4ed8", wordBreak: "break-all" }}>
                    {trimmedUpi}
                  </div>
                </div>
              </div>

              {currentUpiId && currentUpiId.trim() !== trimmedUpi && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
                  Replaces <span style={{ textDecoration: "line-through" }}>{currentUpiId}</span>
                </div>
              )}
            </div>
            <div className="maint-modal-footer">
              <DefaultButton text="Back" onClick={() => setStep("edit")} disabled={saving} styles={{ root: { height: 32 } }} />
              <PrimaryButton
                text={saving ? "Saving…" : "Yes, this is correct"}
                onClick={() => commit(allowPayeeName
                  ? { maintenance_upi_id: trimmedUpi, maintenance_payee_name: trimmedPayee }
                  : { maintenance_upi_id: trimmedUpi })}
                disabled={saving}
                styles={{ root: { height: 32 } }}
              />
            </div>
          </>
        )}

        {/* ── Remove ───────────────────────────────────────────────────────── */}
        {step === "remove" && (
          <>
            <div className="maint-modal-body">
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                Remove <strong>{currentUpiId}</strong>?
              </p>
              <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, marginBottom: 0 }}>
                Bills and reminders will go out without a payment option, and residents
                won't be able to pay online until you set a new UPI ID.
              </p>
            </div>
            <div className="maint-modal-footer">
              <DefaultButton text="Back" onClick={() => setStep("edit")} disabled={saving} styles={{ root: { height: 32 } }} />
              <DefaultButton
                text={saving ? "Removing…" : "Remove UPI ID"}
                onClick={() => commit({ maintenance_upi_id: "" })}
                disabled={saving}
                styles={{ root: { height: 32, background: "#dc2626", borderColor: "#dc2626", color: "#fff" } }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
