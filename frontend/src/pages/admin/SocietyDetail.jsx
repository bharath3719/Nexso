import React, { useEffect, useState, useCallback, useRef } from "react";
import { Stack, Text, Icon, Spinner, SpinnerSize, MessageBar, MessageBarType, DefaultButton, Dialog, DialogType, DialogFooter, PrimaryButton } from "@fluentui/react";
import { useParams, useNavigate } from "react-router-dom";
import { CSS_T } from "../../styles/typography.js";
import { api } from "../../services/api.js";
import { validatePhone, validateEmail } from "../../utils/validation.js";
import { BRAND as C, TOWER_GRADIENTS } from "../../styles/cssConstants.js";
import { CONTACT_OPTION_KEYS, BHK_OPTIONS } from "../../constants.js";
import { CredentialsBox } from "../../components/onboarding/CredentialsBox.jsx";
import "../../styles/SocietyDetail.css";

const SOCIETY_TYPE_META = {
  APARTMENT:       { label: "Apartment",       bg: "#eff6ff", fg: "#1d4ed8", icon: "CityNext" },
  GATED_COMMUNITY: { label: "Gated Community", bg: "#f0fdf4", fg: "#15803d", icon: "Home"    },
  COMMERCIAL:      { label: "Commercial",      bg: "#fef3c7", fg: "#92400e", icon: "Shop"    },
  MIXED_USE:       { label: "Mixed Use",       bg: "#fdf4ff", fg: "#7e22ce", icon: "MapPin"  },
};

const STATUS_META = {
  PENDING: { label: "Pending", bg: "#fef3c7", fg: "#92400e", dot: C.amber },
  JOINED:  { label: "Joined",  bg: "#eff6ff", fg: "#1d4ed8", dot: C.blue  },
  ACTIVE:  { label: "Active",  bg: "#f0fdf4", fg: "#15803d", dot: C.green },
};

const RESIDENT_TYPE_META = {
  OWNER:  { label: "Owner",  bg: "#eff6ff", fg: "#1d4ed8" },
  TENANT: { label: "Tenant", bg: "#fff7ed", fg: "#c2410c" },
};

const CONTACT_META = {
  WHATSAPP: { label: "WhatsApp", icon: "Chat",    color: "#25d366" },
  CALL:     { label: "Call",     icon: "Phone",   color: C.blue    },
  SMS:      { label: "SMS",      icon: "Message", color: C.indigo  },
  EMAIL:    { label: "Email",    icon: "Mail",    color: C.amber   },
};

// BHK_OPTIONS and CONTACT_OPTION_KEYS imported from constants.js

// ─── Tiny helpers ──────────────────────────────────────────────────────────────
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}
function nameHue(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
// size and hsl colours are dynamic — kept inline; layout is in .sd-avatar
function Avatar({ name, size = 36 }) {
  const hue = nameHue(name);
  return (
    <div
      className="sd-avatar"
      style={{
        width:      size,
        height:     size,
        background: `hsl(${hue},60%,88%)`,
        color:      `hsl(${hue},60%,28%)`,
        fontSize:   size * 0.38,
        border:     `2px solid hsl(${hue},60%,76%)`,
      }}
    >
      {initials(name) || "?"}
    </div>
  );
}

// ─── Pill ──────────────────────────────────────────────────────────────────────
// bg / fg are passed as props — kept inline; shape is in .sd-pill
function Pill({ label, bg, fg }) {
  return (
    <span className="sd-pill" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, wide, children }) {
  return (
    <div className={wide ? "sd-field--wide" : "sd-field"}>
      <label className={`sd-field-label ${CSS_T.subSection ? "" : ""}`} style={CSS_T.subSection}>
        {label}
        {required && <span className="sd-field-required">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Add / Edit resident form (shared by both modes) ──────────────────────────
function ResidentForm({ mode = "add", unitId, unitNumber, resident, societyId, onSuccess, onCancel }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState(isEdit ? {
    name:              resident.name              || "",
    phone:             resident.phone             || "",
    email:             resident.email             || "",
    aadhar_number:     resident.aadhar_number     || "",
    preferred_contact: resident.preferred_contact || "WHATSAPP",
    bhk:               resident.bhk               || "",
    resident_type:     resident.resident_type     || "OWNER",
    family_members:    resident.family_members    || 0,
    maintenance_enabled: !!resident.maintenance_enabled,
    maintenance_amount:  resident.maintenance_amount  ?? "",
    maintenance_due_day: resident.maintenance_due_day ?? "",
  } : {
    name: "", phone: "", email: "", aadhar_number: "",
    preferred_contact: "WHATSAPP", bhk: "", resident_type: "OWNER", family_members: 0,
    maintenance_enabled: false, maintenance_amount: "", maintenance_due_day: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())  { setErr("Name is required.");  return; }
    if (!form.phone.trim()) { setErr("Phone number is required."); return; }
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { setErr(phoneErr); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr) { setErr(emailErr); return; }
    setSaving(true); setErr(null);
    try {
      const data = isEdit
        ? await api.onboarding.updateResident(societyId, resident.id, form)
        : await api.onboarding.addUnitResident(societyId, unitId, form);
      onSuccess(data.resident);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`sd-add-form${isEdit ? " sd-edit-form" : ""}`} onSubmit={submit}>
      <div className="sd-add-form-title" style={CSS_T.subSection}>
        <Icon iconName={isEdit ? "Edit" : "AddFriend"} styles={{ root: { fontSize: 14 } }} />
        {isEdit ? `Editing: ${resident.name}` : `Add Resident to Unit ${unitNumber}`}
      </div>

      {/* Row 1: Name · Phone · Type */}
      <div className="sd-form-row">
        <Field label="Full Name" required wide>
          <input className="sd-input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={up("name")} autoFocus />
        </Field>
        <Field label="Phone" required>
          <input className="sd-input" placeholder="9876543210" value={form.phone} onChange={up("phone")} />
        </Field>
        <Field label="Resident Type">
          <select className="sd-input" value={form.resident_type} onChange={up("resident_type")}>
            <option value="OWNER">Owner</option>
            <option value="TENANT">Tenant</option>
          </select>
        </Field>
      </div>

      {/* Row 2: Email · Aadhar · Preferred contact */}
      <div className="sd-form-row">
        <Field label="Email" wide>
          <input className="sd-input" placeholder="email@example.com" type="email" value={form.email} onChange={up("email")} />
        </Field>
        <Field label="Aadhar Number">
          <input className="sd-input" placeholder="XXXX XXXX XXXX" value={form.aadhar_number} onChange={up("aadhar_number")} />
        </Field>
        <Field label="Preferred Contact">
          <select className="sd-input" value={form.preferred_contact} onChange={up("preferred_contact")}>
            {CONTACT_OPTION_KEYS.map((c) => (
              <option key={c} value={c}>{CONTACT_META[c].label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Row 3: BHK · Family members */}
      <div className="sd-form-row sd-form-row--last">
        <Field label="House Size / BHK">
          <select className="sd-input" value={form.bhk} onChange={up("bhk")}>
            <option value="">— Select BHK —</option>
            {BHK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Family Members">
          <input
            className="sd-input"
            type="number" min={0} max={20}
            value={form.family_members}
            onChange={(e) => setForm((f) => ({ ...f, family_members: Number(e.target.value) }))}
          />
        </Field>
        <div className="sd-field--spacer" />
      </div>

      {/* Row 4: Maintenance */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: form.maintenance_enabled ? 12 : 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={!!form.maintenance_enabled}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_enabled: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "#3b82f6", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Collect Monthly Maintenance</span>
          </label>
          {!form.maintenance_enabled && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>— toggle to set amount &amp; due date</span>
          )}
        </div>
        {form.maintenance_enabled && (
          <div className="sd-form-row">
            <Field label="Monthly Amount (₹)" required>
              <input
                className="sd-input"
                type="number" min={1}
                placeholder="e.g. 2500"
                value={form.maintenance_amount}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_amount: e.target.value }))}
              />
            </Field>
            <Field label="Due Day of Month" required>
              <select
                className="sd-input"
                value={form.maintenance_due_day}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_due_day: e.target.value }))}
              >
                <option value="">— Select day —</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <div className="sd-field--spacer" />
          </div>
        )}
      </div>

      {err && <div className="sd-form-error">{err}</div>}

      <div className="sd-form-actions">
        <button type="submit" className="sd-btn-primary" disabled={saving}>
          {saving
            ? <><Spinner size={SpinnerSize.xSmall} styles={{ root: { marginRight: 4 } }} />Saving…</>
            : isEdit
              ? <><Icon iconName="Save" styles={{ root: { fontSize: 12 } }} /> Save Changes</>
              : "Add Resident"}
        </button>
        <button type="button" className="sd-btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Resident card ─────────────────────────────────────────────────────────────
function ResidentCard({ resident, onEdit, onDelete }) {
  const statusMeta  = STATUS_META[resident.invitation_status]    || STATUS_META.PENDING;
  const typeMeta    = RESIDENT_TYPE_META[resident.resident_type] || RESIDENT_TYPE_META.OWNER;
  const contactMeta = CONTACT_META[resident.preferred_contact]   || CONTACT_META.WHATSAPP;

  return (
    <div className="sd-resident-card">
      <Avatar name={resident.name} />

      <div className="sd-resident-name-col">
        <div className="sd-resident-name" style={CSS_T.subSection}>{resident.name}</div>
        <div className="sd-resident-pills">
          <Pill label={typeMeta.label} bg={typeMeta.bg} fg={typeMeta.fg} />
          {resident.bhk && <Pill label={resident.bhk} bg="#f1f5f9" fg="#475569" />}
        </div>
      </div>

      <div className="sd-resident-contact">
        {resident.phone && (
          <div className="sd-resident-contact-row">
            <Icon iconName="Phone" styles={{ root: { fontSize: 11 } }} />
            {resident.phone}
          </div>
        )}
        {resident.email && (
          <div className="sd-resident-contact-row">
            <Icon iconName="Mail" styles={{ root: { fontSize: 11 } }} />
            <span className="sd-resident-email">{resident.email}</span>
          </div>
        )}
      </div>

      <div className="sd-resident-preferred">
        <Icon iconName={contactMeta.icon} styles={{ root: { fontSize: 13, color: contactMeta.color } }} />
        {contactMeta.label}
      </div>

      {resident.family_members > 0 && (
        <div className="sd-resident-family">
          <Icon iconName="Family" styles={{ root: { fontSize: 13 } }} />
          {resident.family_members}
        </div>
      )}

      <div className="sd-resident-status">
        <div className="sd-resident-status-dot" style={{ background: statusMeta.dot }} />
        <Pill label={statusMeta.label} bg={statusMeta.bg} fg={statusMeta.fg} />
      </div>

      <div className="sd-resident-actions">
        <button
          className="sd-resident-action-btn sd-resident-action-btn--edit"
          onClick={onEdit}
          title="Edit resident"
        >
          <Icon iconName="Edit" styles={{ root: { fontSize: 11 } }} />
        </button>
        <button
          className="sd-resident-action-btn sd-resident-action-btn--delete"
          onClick={onDelete}
          title="Remove resident"
        >
          <Icon iconName="Delete" styles={{ root: { fontSize: 11 } }} />
        </button>
      </div>
    </div>
  );
}

// ─── Unit block ────────────────────────────────────────────────────────────────
function UnitBlock({ unit, residentMap, societyId, onResidentAdded, onResidentUpdated, onResidentDeleted }) {
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const formRef = useRef(null);
  const residents = residentMap[unit.id] || [];

  const toggleForm = (open) => {
    setShowForm(open);
    if (open) setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const handleAdded = (newResident) => {
    onResidentAdded(unit.id, newResident);
    toggleForm(false);
  };

  const handleEditClick = (residentId) => {
    setEditingId((prev) => (prev === residentId ? null : residentId));
    setDeleteId(null);
  };

  const handleDeleteClick = (residentId) => {
    setDeleteId((prev) => (prev === residentId ? null : residentId));
    setEditingId(null);
  };

  const handleConfirmDelete = async (residentId) => {
    setDeleting(true);
    try {
      await api.onboarding.deleteResident(societyId, residentId);
      onResidentDeleted(unit.id, residentId);
      setDeleteId(null);
    } catch (e) {
      console.error("Delete resident error:", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sd-unit-block">
      {/* Unit label row */}
      <div className="sd-unit-label-row">
        <div className="sd-unit-badge">{unit.unit_number}</div>
        <div className="sd-unit-divider" />
        <span className="sd-unit-count">
          {residents.length === 0 ? "Vacant" : `${residents.length} resident${residents.length !== 1 ? "s" : ""}`}
        </span>
        {residents.length > 0 && (
          <button
            onClick={() => { toggleForm(!showForm); setEditingId(null); setDeleteId(null); }}
            className={`sd-unit-add-btn ${showForm ? "sd-unit-add-btn--cancel" : "sd-unit-add-btn--add"}`}
          >
            <Icon iconName={showForm ? "Cancel" : "Add"} styles={{ root: { fontSize: 9 } }} />
            {showForm ? "Cancel" : "Add Resident"}
          </button>
        )}
      </div>

      {/* Existing residents */}
      {residents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {residents.map((r) => (
            <div key={r.id}>
              <ResidentCard
                resident={r}
                onEdit={() => handleEditClick(r.id)}
                onDelete={() => handleDeleteClick(r.id)}
              />

              {/* Delete confirmation strip */}
              {deleteId === r.id && (
                <div className="sd-delete-confirm">
                  <Icon iconName="Warning" styles={{ root: { fontSize: 14, color: "#f43f5e" } }} />
                  <span>Remove <strong>{r.name}</strong> from this unit?</span>
                  <button
                    className="sd-btn-danger"
                    onClick={() => handleConfirmDelete(r.id)}
                    disabled={deleting}
                  >
                    {deleting ? "Removing…" : "Yes, Remove"}
                  </button>
                  <button className="sd-btn-cancel" onClick={() => setDeleteId(null)}>
                    Cancel
                  </button>
                </div>
              )}

              {/* Inline edit form */}
              {editingId === r.id && (
                <ResidentForm
                  mode="edit"
                  resident={r}
                  societyId={societyId}
                  onSuccess={(updated) => {
                    onResidentUpdated(unit.id, updated);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vacant placeholder */}
      {residents.length === 0 && !showForm && (
        <div className="sd-unit-vacant">
          <span className="sd-unit-vacant-label">
            <Icon iconName="Contact" styles={{ root: { color: "#cbd5e1", fontSize: 14 } }} />
            No residents assigned yet
          </span>
          <button className="sd-unit-assign-btn" onClick={() => toggleForm(true)}>
            <Icon iconName="Add" styles={{ root: { fontSize: 9, color: "#fff" } }} />
            Assign Resident
          </button>
        </div>
      )}

      {/* Animated slide-down add form */}
      <div
        ref={formRef}
        className="sd-unit-form-animate"
        style={{ maxHeight: showForm ? "520px" : "0px", opacity: showForm ? 1 : 0 }}
      >
        {showForm && (
          <ResidentForm
            mode="add"
            unitId={unit.id}
            societyId={societyId}
            unitNumber={unit.unit_number}
            onSuccess={handleAdded}
            onCancel={() => toggleForm(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Floor accordion ───────────────────────────────────────────────────────────
function FloorRow({ floor, residentMap, societyId, onResidentAdded, onResidentUpdated, onResidentDeleted, defaultOpen = false }) {
  const [open, setOpen]   = useState(defaultOpen);
  const contentRef        = useRef(null);

  const totalResidents = (floor.units || []).reduce(
    (s, u) => s + (residentMap[u.id]?.length || 0), 0,
  );

  const toggle = () => {
    const el = contentRef.current;
    if (!el) { setOpen((o) => !o); return; }
    if (!open) {
      el.style.height = el.scrollHeight + "px";
      setTimeout(() => { if (el) el.style.height = "auto"; }, 320);
      setOpen(true);
    } else {
      el.style.height = el.scrollHeight + "px";
      el.getBoundingClientRect(); // force reflow
      el.style.height = "0px";
      setOpen(false);
    }
  };

  return (
    <div className={`sd-floor-row${open ? " sd-floor-row--open" : ""}`}>
      <button
        onClick={toggle}
        className={`sd-floor-toggle${open ? " sd-floor-toggle--open" : ""}`}
      >
        <span className={`sd-floor-chevron-wrap${open ? " sd-floor-chevron-wrap--open" : ""}`}>
          <Icon iconName="ChevronRight" styles={{ root: {
            fontSize: 10,
            color: open ? "#fff" : C.slate,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.25s",
            display: "block",
          }}} />
        </span>

        <div className={`sd-floor-number-box${open ? " sd-floor-number-box--open" : ""}`}>
          <span className={`sd-floor-number${open ? " sd-floor-number--open" : ""}`}>
            {floor.floor_number}
          </span>
        </div>

        <div className="sd-floor-info">
          <div style={CSS_T.subSection}>Floor {floor.floor_number}</div>
          <div style={{ ...CSS_T.caption, marginTop: 1 }}>
            {(floor.units || []).length} unit{(floor.units || []).length !== 1 ? "s" : ""}
            {totalResidents > 0 && ` · ${totalResidents} resident${totalResidents !== 1 ? "s" : ""}`}
          </div>
        </div>

        {totalResidents > 0 && (
          <div className={`sd-floor-resident-badge${open ? " sd-floor-resident-badge--open" : ""}`}>
            {totalResidents} resident{totalResidents !== 1 ? "s" : ""}
          </div>
        )}
      </button>

      <div ref={contentRef} className="sd-floor-content" style={{ height: open ? "auto" : "0px" }}>
        <div className="sd-floor-inner">
          {(floor.units || []).length === 0 ? (
            <div className="sd-floor-empty">No units on this floor.</div>
          ) : (
            (floor.units || []).map((unit) => (
              <UnitBlock
                key={unit.id}
                unit={unit}
                residentMap={residentMap}
                societyId={societyId}
                onResidentAdded={onResidentAdded}
                onResidentUpdated={onResidentUpdated}
                onResidentDeleted={onResidentDeleted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tower card ────────────────────────────────────────────────────────────────
// Gradient colours are index-based and selected-state is dynamic → kept inline
function TowerCard({ tower, index, selected, onClick, residentMap }) {
  const [a, b]       = TOWER_GRADIENTS[index % TOWER_GRADIENTS.length];
  const totalUnits   = (tower.floors || []).reduce((s, f) => s + (f.units || []).length, 0);
  const totalResidents = (tower.floors || []).reduce(
    (s, f) => s + (f.units || []).reduce((us, u) => us + (residentMap[u.id]?.length || 0), 0), 0,
  );

  return (
    <button
      onClick={onClick}
      className="sd-tower-card"
      style={{
        background:    selected ? `linear-gradient(135deg,${a}22 0%,${b}22 100%)` : "#fff",
        borderTop:     `4px solid ${a}`,
        borderRight:   `1px solid ${selected ? `${a}55` : "#e2e8f0"}`,
        borderBottom:  `1px solid ${selected ? `${a}55` : "#e2e8f0"}`,
        borderLeft:    `1px solid ${selected ? `${a}55` : "#e2e8f0"}`,
        boxShadow:     selected ? `0 12px 36px ${a}55` : "0 2px 8px rgba(15,23,42,0.06)",
      }}
    >
      <div className="sd-tower-icon" style={{ background: selected ? `linear-gradient(145deg,${a}28,${b}28)` : "#f1f5f9" }}>
        <span>🏢</span>
      </div>

      <div className="sd-tower-info">
        <div className="sd-tower-name" style={CSS_T.sectionHeader}>{tower.name}</div>
        <div style={CSS_T.caption}>{(tower.floors || []).length} floor{(tower.floors || []).length !== 1 ? "s" : ""}</div>
        <div style={{ ...CSS_T.caption, marginTop: 8 }}>{totalUnits} units · {totalResidents} residents</div>
      </div>

      <div className="sd-tower-actions">
        Details
        {selected && <Icon iconName="CheckMark" styles={{ root: { fontSize: 14, color: a, marginTop: 6, display: "block" } }} />}
      </div>
    </button>
  );
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────
// Icon colour and tint background are dynamic → kept inline
function StatTile({ icon, value, label, color }) {
  return (
    <div className="sd-stat-tile">
      <div className="sd-stat-icon" style={{ background: color + "18" }}>
        <Icon iconName={icon} styles={{ root: { fontSize: 20, color } }} />
      </div>
      <div>
        <div className="sd-stat-value">{value}</div>
        <div style={{ ...CSS_T.caption, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function SocietyDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [society,       setSociety]       = useState(null);
  const [towers,        setTowers]        = useState([]);
  const [residentMap,   setResidentMap]   = useState({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedTower, setSelectedTower] = useState(null);

  // Secretary password reset
  const [resetCredsLoading, setResetCredsLoading] = useState(false);
  const [resetCreds,        setResetCreds]        = useState(null);
  const [credsModalOpen,    setCredsModalOpen]    = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [detail, residentsData] = await Promise.all([
        api.onboarding.getSociety(id),
        api.onboarding.getResidents(id).catch(() => ({ residents: [] })),
      ]);

      const map = {};
      for (const r of residentsData.residents || []) {
        if (!map[r.unit_id]) map[r.unit_id] = [];
        map[r.unit_id].push(r);
      }
      setSociety(detail.society);
      setTowers(detail.towers || []);
      setResidentMap(map);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleResetSecretaryPassword = async () => {
    if (!id) return;
    setResetCredsLoading(true);
    try {
      const data = await api.onboarding.resetSecretaryPassword(id);
      if (data.secretaryCredentials) {
        setResetCreds(data.secretaryCredentials);
        setCredsModalOpen(true);
      }
    } catch { /* ignore */ } finally {
      setResetCredsLoading(false);
    }
  };

  const handleResidentAdded = useCallback((unitId, newResident) => {
    setResidentMap((prev) => ({ ...prev, [unitId]: [...(prev[unitId] || []), newResident] }));
  }, []);

  const handleResidentUpdated = useCallback((unitId, updatedResident) => {
    setResidentMap((prev) => ({
      ...prev,
      [unitId]: (prev[unitId] || []).map((r) => r.id === updatedResident.id ? updatedResident : r),
    }));
  }, []);

  const handleResidentDeleted = useCallback((unitId, residentId) => {
    setResidentMap((prev) => ({
      ...prev,
      [unitId]: (prev[unitId] || []).filter((r) => r.id !== residentId),
    }));
  }, []);

  if (loading) {
    return (
      <Stack horizontalAlign="center" styles={{ root: { paddingTop: 80 } }}>
        <Spinner size={SpinnerSize.large} label="Loading society…" />
      </Stack>
    );
  }
  if (error || !society) {
    return (
      <Stack tokens={{ childrenGap: 16 }} styles={{ root: { paddingTop: 32 } }}>
        <MessageBar messageBarType={MessageBarType.error}>{error || "Society not found"}</MessageBar>
        <DefaultButton text="Back" iconProps={{ iconName: "Back" }} onClick={() => navigate("/onboarding")} />
      </Stack>
    );
  }

  const typeMeta       = SOCIETY_TYPE_META[society.society_type] || SOCIETY_TYPE_META.APARTMENT;
  const totalUnits     = towers.reduce((s, t) => s + t.floors.reduce((fs, f) => fs + (f.units || []).length, 0), 0);
  const totalResidents = Object.values(residentMap).reduce((s, arr) => s + arr.length, 0);
  const activeTower    = selectedTower !== null ? towers[selectedTower] : null;
  const stepLabel      = society.onboarding_step >= 3 ? "Complete" : society.onboarding_step === 2 ? "Structure Ready" : "Basic Info Only";
  const stepColor      = society.onboarding_step >= 3 ? C.green : society.onboarding_step === 2 ? C.blue : C.amber;
  const stepTextColor  = stepColor === C.green ? "#6ee7b7" : stepColor === C.blue ? "#93c5fd" : "#fcd34d";

  const towerGrad = TOWER_GRADIENTS[(selectedTower ?? 0) % TOWER_GRADIENTS.length];

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="sd-hero">
        <div className="sd-hero-orb sd-hero-orb--1" />
        <div className="sd-hero-orb sd-hero-orb--2" />

        <div className="sd-hero-body">
          <div className="sd-hero-header-row">
            <div className="sd-hero-chips">
              <button
                className="sd-hero-back-btn"
                onClick={() => navigate("/onboarding")}
                title="Back to Onboarding"
              >
                <Icon iconName="Back" styles={{ root: { fontSize: 13, color: "rgba(255,255,255,0.85)" } }} />
              </button>

              <div className="sd-hero-building-id">{society.building_id}</div>

              <button
                className="sd-hero-action-btn"
                onClick={handleResetSecretaryPassword}
                disabled={resetCredsLoading}
                title="Generate a new secretary login password"
              >
                <Icon iconName="Permissions" styles={{ root: { fontSize: 12, color: "inherit" } }} />
                {resetCredsLoading ? "Generating…" : "Reset Secretary Password"}
              </button>

              <div className="sd-hero-type-badge">
                <Icon iconName={typeMeta.icon} styles={{ root: { fontSize: 12 } }} />
                {typeMeta.label}
              </div>

              <div
                className="sd-hero-step-badge"
                style={{
                  background:  stepColor + "33",
                  border:      `1px solid ${stepColor}66`,
                  color:       stepTextColor,
                }}
              >
                <div className="sd-hero-step-dot" />
                {stepLabel}
              </div>
            </div>
          </div>

          <div className="sd-hero-name">{society.name}</div>

          <div className="sd-hero-meta">
            {society.address && (
              <div className="sd-hero-meta-item">
                <Icon iconName="Location" styles={{ root: { fontSize: 14, color: "#93c5fd" } }} />
                {society.address}
              </div>
            )}
            {society.contact_person && (
              <div className="sd-hero-meta-item">
                <Icon iconName="Contact" styles={{ root: { fontSize: 14, color: "#93c5fd" } }} />
                {society.contact_person}
              </div>
            )}
            {society.contact_phone && (
              <div className="sd-hero-meta-item">
                <Icon iconName="Phone" styles={{ root: { fontSize: 14, color: "#93c5fd" } }} />
                {society.contact_phone}
              </div>
            )}
            {society.contact_email && (
              <div className="sd-hero-meta-item">
                <Icon iconName="Mail" styles={{ root: { fontSize: 14, color: "#93c5fd" } }} />
                {society.contact_email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="sd-stats-row">
        <StatTile icon="CityNext"  value={towers.length}   label="Towers"    color={C.blue}   />
        <StatTile icon="MapLayers" value={towers.reduce((s, t) => s + (t.floors || []).length, 0)} label="Floors" color={C.indigo} />
        <StatTile icon="Tiles"     value={totalUnits}       label="Units"     color="#8b5cf6"  />
        <StatTile icon="People"    value={totalResidents}   label="Residents" color={C.green}  />
      </div>

      {/* ── Towers + floors ──────────────────────────────────────────────────── */}
      {towers.length === 0 ? (
        <div className="sd-empty-towers">
          <Icon iconName="CityNext" styles={{ root: { fontSize: 36, color: "#e2e8f0", display: "block", margin: "0 auto 12px" } }} />
          No tower structure configured yet.
          <button className="sd-empty-towers-link" onClick={() => navigate(`/onboarding/new?societyId=${id}&step=2`)}>
            Set up unit structure →
          </button>
        </div>
      ) : (
        <div className="sd-towers-wrap">
          {/* Section header */}
          <div className="sd-towers-header">
            <Icon iconName="CityNext" styles={{ root: { color: C.blue, fontSize: 16 } }} />
            <span style={CSS_T.sectionHeader}>Towers</span>
            <span style={{ ...CSS_T.caption, marginLeft: 4 }}>— select a tower to explore floors &amp; residents</span>
          </div>

          {/* Tower cards */}
          <div className={`sd-towers-cards${activeTower ? " sd-towers-cards--bordered" : ""}`}>
            {towers.map((tower, idx) => (
              <TowerCard
                key={tower.id}
                tower={tower}
                index={idx}
                selected={selectedTower === idx}
                onClick={() => setSelectedTower(idx)}
                residentMap={residentMap}
              />
            ))}
          </div>

          {/* Floor accordion */}
          {activeTower && (
            <div className="sd-floors-panel">
              <div className="sd-floors-panel-header">
                <div
                  className="sd-floors-tower-icon"
                  style={{ background: `linear-gradient(135deg,${towerGrad[0]},${towerGrad[1]})` }}
                >
                  🏢
                </div>
                <div>
                  <div style={CSS_T.sectionHeader}>{activeTower.name}</div>
                  <div style={CSS_T.caption}>
                    {(activeTower.floors || []).length} floor{(activeTower.floors || []).length !== 1 ? "s" : ""} ·{" "}
                    {(activeTower.floors || []).reduce((s, f) => s + (f.units || []).length, 0)} units
                  </div>
                </div>
              </div>

              {(activeTower.floors || []).length === 0 ? (
                <div className="sd-floors-empty">No floors configured.</div>
              ) : (
                (activeTower.floors || []).map((floor, fi) => (
                  <FloorRow
                    key={floor.id}
                    floor={floor}
                    residentMap={residentMap}
                    societyId={id}
                    onResidentAdded={handleResidentAdded}
                    onResidentUpdated={handleResidentUpdated}
                    onResidentDeleted={handleResidentDeleted}
                    defaultOpen={fi === 0}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Reset Secretary Password Modal ─────────────────────────────── */}
      <Dialog
        hidden={!credsModalOpen}
        onDismiss={() => setCredsModalOpen(false)}
        dialogContentProps={{
          type:  DialogType.normal,
          title: "🔑  New Secretary Credentials",
        }}
        modalProps={{ isBlocking: true }}
        minWidth={460}
      >
        <div style={{ marginBottom: 12, fontSize: 14, color: "#475569" }}>
          A new temporary password has been generated. Share these with the society secretary — the password cannot be retrieved again.
        </div>
        <CredentialsBox username={resetCreds?.username} password={resetCreds?.tempPassword} />
        <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a" }}>
          ⚠️  The secretary will be prompted to change this password on first login.
        </div>
        <DialogFooter>
          <PrimaryButton
            text="Done"
            iconProps={{ iconName: "CheckMark" }}
            onClick={() => setCredsModalOpen(false)}
          />
          <DefaultButton
            text="Copy"
            iconProps={{ iconName: "Copy" }}
            onClick={() => {
              const text = `Nexso Secretary Login\nUsername: ${resetCreds?.username}\nPassword: ${resetCreds?.tempPassword}`;
              navigator.clipboard?.writeText(text);
            }}
          />
        </DialogFooter>
      </Dialog>
    </Stack>
  );
}
