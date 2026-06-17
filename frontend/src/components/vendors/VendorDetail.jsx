import React, { useEffect, useState } from "react";
import {
  Stack, Text, DefaultButton, PrimaryButton, IconButton,
  TextField, Modal, MessageBar, MessageBarType,
  Pivot, PivotItem, Dropdown, Checkbox,
} from "@fluentui/react";
import VendorDocuments from "./VendorDocuments.jsx";
import { T } from "../../styles/typography.js";
import { StatusBadge } from "../../utils/helperFunctions.tsx";
import { VENDOR_CATEGORY_OPTIONS } from "../../constants.js";
import { api } from "../../services/api.js";
import "../../styles/Vendor.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic hue from vendor name → avatar background colour. */
function nameToHsl(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 50%, 40%)`;
}

/** Two-letter initials from a name string. */
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Small presentational components ─────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className="vd2-section-label">{children}</div>;
}

function Field({ label, children }) {
  return (
    <div className="vd2-field">
      <div className="vd2-field-label">{label}</div>
      <div className="vd2-field-value">{children ?? <span className="vd2-field-empty">—</span>}</div>
    </div>
  );
}

function BoolBadge({ yes }) {
  return yes
    ? <span className="vd2-badge vd2-badge--yes">✓ Yes</span>
    : <span className="vd2-badge vd2-badge--no">No</span>;
}

// ─── Pure helpers (no hooks) ──────────────────────────────────────────────────

const str     = (v) => v ?? "";
const orNull  = (v) => v  || null;

function formFromVendor(v) {
  return {
    name:                   str(v.name),
    business_name:          str(v.business_name),
    owner_name:             str(v.owner_name),
    phone:                  str(v.phone),
    email:                  str(v.email),
    gst:                    str(v.gst),
    whatsapp_number:        str(v.whatsapp_number),
    team_size:              v.team_size != null ? String(v.team_size) : "",
    categories:             Array.isArray(v.categories) ? [...v.categories] : [],
    emergency_availability: !!v.emergency_availability,
    active:                 v.active !== false,
  };
}

function buildVendorPayload(form, local) {
  return {
    name:                   form.name.trim(),
    business_name:          orNull(form.business_name),
    owner_name:             orNull(form.owner_name),
    phone:                  orNull(form.phone),
    email:                  orNull(form.email),
    gst:                    orNull(form.gst),
    whatsapp_number:        orNull(form.whatsapp_number),
    categories:             form.categories,
    team_size:              form.team_size ? Number(form.team_size) : null,
    emergency_availability: !!form.emergency_availability,
    active:                 !!form.active,
    verification_status:    orNull(local.verification_status),
  };
}

// ─── VendorDetail ─────────────────────────────────────────────────────────────

const PIVOT_STYLES = {
  root: { borderBottom: "1px solid #e2e8f0", paddingLeft: 24, background: "#fff" },
  link: { height: 44, fontSize: 14 },
};

export default function VendorDetail({ vendor, isOpen, onClose, onChanged }) {
  const [local,       setLocal]       = useState(null);
  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [processing,  setProcessing]  = useState(false);
  const [reason,      setReason]      = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setLocal(vendor ? { ...vendor } : null);
    setEditing(false);
    setForm({});
    setSaveError("");
    setReason("");
    setActionError("");
  }, [vendor]);

  if (!isOpen || !local) return null;

  const status = local.verification_status || (local.active ? "APPROVED" : "INACTIVE");

  // ── Edit ────────────────────────────────────────────────────────────────────

  function startEdit() {
    setForm(formFromVendor(local));
    setSaveError("");
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setSaveError(""); }

  const setField = (key) => (_, v) => setForm((s) => ({ ...s, [key]: v ?? "" }));

  function onCategoryChange(_, option) {
    if (!option) return;
    setForm((s) => {
      const cats = Array.isArray(s.categories) ? s.categories : [];
      return {
        ...s,
        categories: option.selected
          ? [...new Set([...cats, option.key])]
          : cats.filter((c) => c !== option.key),
      };
    });
  }

  async function saveEdit() {
    if (!form.name?.trim()) { setSaveError("Name is required"); return; }
    setSaving(true); setSaveError("");
    try {
      const data = await api.vendors.update(local.id, buildVendorPayload(form, local));
      setLocal(data.vendor);
      setEditing(false);
      onChanged?.();
    } catch (e) {
      setSaveError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Verification ────────────────────────────────────────────────────────────

  async function doVendorAction(apiCall, { requiresReason = false, errorMsg = "" } = {}) {
    if (requiresReason && !reason.trim()) { setActionError(errorMsg); return; }
    setProcessing(true); setActionError("");
    try {
      const d = await apiCall();
      setLocal(d.vendor);
      if (requiresReason) setReason("");
      onChanged?.();
    } catch (e) { setActionError(e.message); }
    finally { setProcessing(false); }
  }

  const doApprove = () => doVendorAction(() => api.vendors.approve(local.id));
  const doReject  = () => doVendorAction(() => api.vendors.reject(local.id, reason),  { requiresReason: true, errorMsg: "Please provide a rejection reason" });
  const doSuspend = () => doVendorAction(() => api.vendors.suspend(local.id, reason), { requiresReason: true, errorMsg: "Please provide a suspension reason" });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      isBlocking={false}
      styles={{
        main: {
          borderRadius:  12,
          minWidth:      660,
          maxWidth:      700,
          padding:       0,
          overflow:      "hidden",
        },
      }}
    >
      <div className="vd2-root">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="vd2-header">
          <div className="vd2-avatar" style={{ background: nameToHsl(local.name) }}>
            {initials(local.name)}
          </div>

          <div className="vd2-header-info">
            <div className="vd2-header-name">{local.name}</div>
            {local.business_name && (
              <div className="vd2-header-sub">{local.business_name}</div>
            )}
          </div>

          <div className="vd2-header-actions">
            <StatusBadge status={status} />
            <IconButton
              iconProps={{ iconName: "Cancel" }}
              title="Close"
              onClick={onClose}
              styles={{ root: { color: "#64748b" } }}
            />
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <Pivot styles={PIVOT_STYLES}>

          {/* ════ Overview ════ */}
          <PivotItem headerText="Overview" itemIcon="ContactInfo">
            <div className="vd2-tab-body">

              {editing ? (
                /* ── Edit form ── */
                <div className="vd2-edit-form">
                  <SectionLabel>Contact Information</SectionLabel>
                  <div className="vd2-form-row">
                    <TextField label="Name *"        value={form.name}           onChange={setField("name")}           />
                    <TextField label="Business Name" value={form.business_name}  onChange={setField("business_name")}  />
                  </div>
                  <div className="vd2-form-row">
                    <TextField label="Owner Name"    value={form.owner_name}     onChange={setField("owner_name")}     />
                    <TextField label="Phone"         value={form.phone}          onChange={setField("phone")}          />
                  </div>
                  <div className="vd2-form-row">
                    <TextField label="Email"         value={form.email}          onChange={setField("email")}          />
                    <TextField label="WhatsApp"      value={form.whatsapp_number} onChange={setField("whatsapp_number")} />
                  </div>

                  <div className="vd2-form-divider" />
                  <SectionLabel>Business Details</SectionLabel>
                  <div className="vd2-form-row">
                    <TextField label="GST"       value={form.gst}       onChange={setField("gst")}       />
                    <TextField label="Team Size" type="number" value={form.team_size} onChange={setField("team_size")} />
                  </div>

                  <Dropdown
                    multiSelect
                    label="Categories"
                    selectedKeys={form.categories}
                    placeholder="Select categories"
                    options={VENDOR_CATEGORY_OPTIONS}
                    onChange={onCategoryChange}
                    styles={{ root: { marginTop: 4 } }}
                  />

                  <div className="vd2-form-divider" />
                  <SectionLabel>Settings</SectionLabel>
                  <div className="vd2-checkboxes">
                    <Checkbox
                      label="Emergency availability"
                      checked={!!form.emergency_availability}
                      onChange={(_, c) => setForm((s) => ({ ...s, emergency_availability: !!c }))}
                    />
                    <Checkbox
                      label="Active"
                      checked={!!form.active}
                      onChange={(_, c) => setForm((s) => ({ ...s, active: !!c }))}
                    />
                  </div>

                  {saveError && (
                    <MessageBar
                      messageBarType={MessageBarType.error}
                      onDismiss={() => setSaveError("")}
                      styles={{ root: { marginTop: 12 } }}
                    >
                      {saveError}
                    </MessageBar>
                  )}
                </div>
              ) : (
                /* ── View mode ── */
                <div className="vd2-view">
                  {/* Edit button */}
                  <div className="vd2-view-toolbar">
                    <DefaultButton
                      text="Edit"
                      iconProps={{ iconName: "Edit" }}
                      onClick={startEdit}
                      styles={{ root: { borderRadius: 6, height: 32 } }}
                    />
                  </div>

                  <SectionLabel>Contact Information</SectionLabel>
                  <div className="vd2-field-grid">
                    <Field label="Owner"    >{local.owner_name     || null}</Field>
                    <Field label="Phone"    >{local.phone          || null}</Field>
                    <Field label="Email"    >{local.email          || null}</Field>
                    <Field label="WhatsApp" >{local.whatsapp_number || null}</Field>
                  </div>

                  <div className="vd2-divider" />

                  <SectionLabel>Business Details</SectionLabel>
                  <div className="vd2-field-grid">
                    <Field label="GST"      >{local.gst || null}</Field>
                    <Field label="Team Size">{local.team_size ? `${local.team_size} members` : null}</Field>
                    <Field label="Emergency"><BoolBadge yes={!!local.emergency_availability} /></Field>
                    <Field label="Active"   ><BoolBadge yes={local.active !== false} /></Field>
                  </div>

                  <div className="vd2-divider" />

                  <SectionLabel>Categories</SectionLabel>
                  <div className="vd2-chips">
                    {(local.categories || []).length === 0
                      ? <span className="vd2-field-empty">No categories assigned</span>
                      : (local.categories || []).map((cat) => (
                          <span key={cat} className="vd2-chip">{cat}</span>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Edit footer — outside scroll area so it's always visible */}
            {editing && (
              <div className="vd2-footer">
                <DefaultButton
                  text="Cancel"
                  onClick={cancelEdit}
                  styles={{ root: { borderRadius: 6 } }}
                />
                <PrimaryButton
                  text={saving ? "Saving…" : "Save changes"}
                  disabled={saving}
                  onClick={saveEdit}
                  styles={{ root: { borderRadius: 6 }, label: { fontWeight: 600 } }}
                />
              </div>
            )}
          </PivotItem>

          {/* ════ Documents ════ */}
          <PivotItem headerText="Documents" itemIcon="Attach">
            <div className="vd2-tab-body">
              <VendorDocuments vendorId={local.id} />
            </div>
          </PivotItem>

          {/* ════ Verification ════ */}
          <PivotItem headerText="Verification" itemIcon="Shield">
            <div className="vd2-tab-body">

              {/* Current status card */}
              <div className="vd2-status-card">
                <SectionLabel>Current Status</SectionLabel>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge status={status} />
                </div>
                {local.rejection_reason && (
                  <div className="vd2-status-reason">
                    <div className="vd2-field-label" style={{ marginBottom: 4 }}>Reason on file</div>
                    <div className="vd2-field-value">{local.rejection_reason}</div>
                  </div>
                )}
              </div>

              <div className="vd2-divider" />

              <SectionLabel>Change Status</SectionLabel>
              <TextField
                label="Reason  (required for Reject / Suspend)"
                value={reason}
                onChange={(_, v) => { setReason(v || ""); setActionError(""); }}
                multiline
                rows={3}
                styles={{ root: { marginTop: 8 } }}
              />

              {actionError && (
                <MessageBar
                  messageBarType={MessageBarType.error}
                  onDismiss={() => setActionError("")}
                  styles={{ root: { marginTop: 10 } }}
                >
                  {actionError}
                </MessageBar>
              )}

              <div className="vd2-verif-actions">
                <DefaultButton
                  text="Reject"
                  disabled={processing || status === "REJECTED"}
                  onClick={doReject}
                  styles={{ root: { borderRadius: 6, minWidth: 88 } }}
                />
                <DefaultButton
                  text="Suspend"
                  disabled={processing || status === "SUSPENDED"}
                  onClick={doSuspend}
                  styles={{ root: { borderRadius: 6, minWidth: 88 } }}
                />
                <PrimaryButton
                  text={processing ? "…" : "Approve"}
                  disabled={processing || status === "APPROVED"}
                  onClick={doApprove}
                  styles={{ root: { borderRadius: 6, minWidth: 96 }, label: { fontWeight: 600 } }}
                />
              </div>
            </div>
          </PivotItem>

        </Pivot>
      </div>
    </Modal>
  );
}
