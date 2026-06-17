import React, { useState } from "react";
import { Icon } from "@fluentui/react";
import { BHK_OPTIONS, CONTACT_OPTIONS } from "../../utils/onboardingUtils.js";
import { validatePhone, validateEmail } from "../../utils/validation.js";
import "../../styles/onboardingModals.css";

// Defined outside the modal so its identity is stable across re-renders.
// Defining it inside would cause React to unmount/remount the <input> on every
// keystroke (new function reference → new component type → focus lost).
function Field({ value, onChange, placeholder, type = "text", error }) {
  return (
    <div className="ob-field-wrap">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`ob-field-input${error ? " ob-field-input--error" : ""}`}
      />
      {error && <span className="ob-field-error">{error}</span>}
    </div>
  );
}

// ─── AddResidentModal ─────────────────────────────────────────────────────────
// Add mode  : select unit → fill details → onAdd(resident)
// Edit mode : pass editResident prop → form pre-filled, unit locked → onSave(updated)

export function AddResidentModal({
  towers,
  residents,
  onAdd,
  onSave,       // edit mode callback: (updatedResident) => void
  onClose,
  initialTowerIdx = 0,
  initialFloorIdx = null,
  initialUnit     = "",
  editResident    = null,   // resident object to edit; null = add mode
}) {
  const editMode = !!editResident;

  const [selTowerIdx, setSelTowerIdx] = useState(initialTowerIdx);
  const [selFloorIdx, setSelFloorIdx] = useState(initialFloorIdx);
  const [selUnit,     setSelUnit    ] = useState(initialUnit);
  const [form, setForm] = useState(
    editMode
      ? {
          name:              editResident.name              ?? "",
          phone:             editResident.phone             ?? "",
          email:             editResident.email             ?? "",
          aadhar_number:     editResident.aadhar_number     ?? "",
          preferred_contact: editResident.preferred_contact ?? "WHATSAPP",
          bhk:               editResident.bhk               ?? "",
          resident_type:     editResident.resident_type     ?? "OWNER",
          family_members:    editResident.family_members    ?? 0,
        }
      : {
          name: "", phone: "", email: "", aadhar_number: "",
          preferred_contact: "WHATSAPP", bhk: "", resident_type: "OWNER", family_members: 0,
        }
  );
  const [err,         setErr        ] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const tower       = towers[selTowerIdx] || null;
  const floors      = tower?.floors || [];
  const selFloorObj = selFloorIdx !== null ? floors[selFloorIdx] : null;
  const units       = selFloorObj?.units || [];

  // Track occupied slots by type so a unit can hold one OWNER and one TENANT.
  // In edit mode, exclude the current resident so their own slot isn't blocked.
  const assignedSlots = new Set(
    residents
      .filter((r) => !editMode || r.id !== editResident.id)
      .map((r) => `${r.tower_idx}:${r.unit_number}:${r.resident_type}`)
  );

  const isUnitFull    = (tIdx, unit) =>
    assignedSlots.has(`${tIdx}:${unit}:OWNER`) &&
    assignedSlots.has(`${tIdx}:${unit}:TENANT`);

  const isUnitPartial = (tIdx, unit) =>
    !isUnitFull(tIdx, unit) && (
      assignedSlots.has(`${tIdx}:${unit}:OWNER`) ||
      assignedSlots.has(`${tIdx}:${unit}:TENANT`)
    );

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleTowerChange = (idx) => { setSelTowerIdx(idx); setSelFloorIdx(null); setSelUnit(""); setErr(""); };
  const handleFloorChange = (idx) => { setSelFloorIdx(idx); setSelUnit(""); setErr(""); };

  const handleUnitSelect = (unit) => {
    setSelUnit(unit);
    setErr("");
    // Auto-set resident_type to the vacant slot if one is already taken
    const hasOwner  = assignedSlots.has(`${selTowerIdx}:${unit}:OWNER`);
    const hasTenant = assignedSlots.has(`${selTowerIdx}:${unit}:TENANT`);
    if (hasOwner && !hasTenant) set("resident_type", "TENANT");
    else if (!hasOwner && hasTenant) set("resident_type", "OWNER");
  };

  const handleSubmit = () => {
    if (!editMode && !selUnit) return setErr("Please select a unit number.");
    if (!form.name.trim())     return setErr("Resident name is required.");
    if (!form.phone.trim())    return setErr("Phone number is required.");

    // Prevent duplicate owner/tenant for the same unit
    if (!editMode && assignedSlots.has(`${selTowerIdx}:${selUnit}:${form.resident_type}`)) {
      return setErr(`An ${form.resident_type === "OWNER" ? "Owner" : "Tenant"} is already assigned to this unit.`);
    }

    // Format validation — only when a value is present
    const errs = {};
    const phoneErr = validatePhone(form.phone);
    const emailErr = validateEmail(form.email);
    if (phoneErr) errs.phone = phoneErr;
    if (emailErr) errs.email = emailErr;
    if (Object.keys(errs).length) { setFieldErrors(errs); setErr(""); return; }
    setFieldErrors({});

    if (editMode) {
      onSave({ ...editResident, ...form });
    } else {
      onAdd({ id: Date.now(), tower_idx: selTowerIdx, unit_number: selUnit, ...form });
    }
    onClose();
  };

  const canSubmit    = editMode ? (!!form.name && !!form.phone) : (!!selUnit && !!form.name && !!form.phone);
  const unitSelected = editMode || !!selUnit;

  return (
    <div className="ob-overlay">
      <div className="arm-container">

        {/* Header */}
        <div className="arm-header">
          <div className="arm-header-inner">
            <div className={`arm-icon-wrap${editMode ? " arm-icon-wrap--edit" : ""}`}>
              <Icon
                iconName={editMode ? "Edit" : "ContactCard"}
                styles={{ root: { color: "#fff", fontSize: 18 } }}
              />
            </div>
            <div>
              <div className="arm-title">{editMode ? "Edit Resident" : "Add Resident"}</div>
              <div className="arm-subtitle">
                {editMode
                  ? `Editing Unit ${editResident.unit_number}`
                  : "Select a unit, then fill in details"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="ob-close-btn">×</button>
        </div>

        {/* Body */}
        <div className="ob-modal-body">

          {/* ── Unit Picker — add mode only ── */}
          {!editMode && (
            <div className="arm-unit-picker">
              <div className="ob-section-label">① Select Unit</div>

              {/* Tower tabs */}
              <div className="arm-tower-tabs">
                {towers.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => handleTowerChange(i)}
                    className={`arm-tower-tab${selTowerIdx === i ? " arm-tower-tab--selected" : ""}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Floor row */}
              {tower && (
                <div className="arm-floor-row">
                  <div className="arm-picker-sublabel">Floor</div>
                  <div className="arm-chips-row">
                    {floors.map((f, fi) => (
                      <button
                        key={fi}
                        onClick={() => handleFloorChange(fi)}
                        className={`arm-floor-tab${selFloorIdx === fi ? " arm-floor-tab--selected" : ""}`}
                      >
                        Floor {f.floor_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Unit chips */}
              {selFloorObj && (
                <div>
                  <div className="arm-picker-sublabel">Unit</div>
                  {units.length === 0 ? (
                    <div className="arm-no-items">No units defined for this floor.</div>
                  ) : (
                    <div className="arm-chips-row">
                      {units.map((u, ui) => {
                        const full     = isUnitFull(selTowerIdx, u);
                        const partial  = isUnitPartial(selTowerIdx, u);
                        const selected = selUnit === u;
                        const takenType = assignedSlots.has(`${selTowerIdx}:${u}:OWNER`) ? "Owner" : "Tenant";
                        return (
                          <button
                            key={ui}
                            onClick={() => !full && handleUnitSelect(u)}
                            title={
                              full    ? "Both Owner and Tenant already assigned" :
                              partial ? `${takenType} assigned — click to add the other type` :
                                        `Select unit ${u}`
                            }
                            className={`arm-unit-chip${selected ? " arm-unit-chip--selected" : ""}${full ? " arm-unit-chip--filled" : ""}${partial ? " arm-unit-chip--partial" : ""}`}
                          >
                            {full    && <span className="arm-unit-check">✓</span>}
                            {partial && <span className="arm-unit-check">½</span>}
                            {u}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {!tower && (
                <div className="arm-no-items">
                  No towers defined. Go back to Step 2 to add towers.
                </div>
              )}
            </div>
          )}

          {/* ── Resident Details ── */}
          <div className={`arm-details-section${!unitSelected ? " arm-details-section--locked" : ""}`}>
            <div className="arm-section-label-row ob-section-label">
              {editMode ? "Resident Details" : "② Resident Details"}
              {(selUnit || editMode) && (
                <span className="arm-unit-badge">
                  Unit {editMode ? editResident.unit_number : selUnit}
                </span>
              )}
            </div>

            <div className="arm-form-grid">
              <div className="arm-form-grid__full">
                <label className="ob-form-label">
                  Full Name <span className="ob-required">*</span>
                </label>
                <Field
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>
              <div>
                <label className="ob-form-label">
                  Phone <span className="ob-required">*</span>
                </label>
                <Field
                  value={form.phone}
                  onChange={(e) => { set("phone", e.target.value); setFieldErrors((p) => ({ ...p, phone: undefined })); }}
                  placeholder="+91 98765 43210"
                  error={fieldErrors.phone}
                />
              </div>
              <div>
                <label className="ob-form-label">Email</label>
                <Field
                  value={form.email}
                  onChange={(e) => { set("email", e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="email@example.com"
                  error={fieldErrors.email}
                />
              </div>
              <div>
                <label className="ob-form-label">Aadhar</label>
                <Field
                  value={form.aadhar_number}
                  onChange={(e) => set("aadhar_number", e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                />
              </div>
              <div>
                <label className="ob-form-label">Resident Type</label>
                <select
                  value={form.resident_type}
                  onChange={(e) => set("resident_type", e.target.value)}
                  className="ob-field-input ob-field-input--select"
                >
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>
              <div>
                <label className="ob-form-label">BHK</label>
                <select
                  value={form.bhk}
                  onChange={(e) => set("bhk", e.target.value)}
                  className="ob-field-input ob-field-input--select"
                >
                  <option value="">— Select —</option>
                  {BHK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="ob-form-label">Preferred Contact</label>
                <select
                  value={form.preferred_contact}
                  onChange={(e) => set("preferred_contact", e.target.value)}
                  className="ob-field-input ob-field-input--select"
                >
                  {CONTACT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ob-form-label">Family Members</label>
                <input
                  type="number"
                  min={0}
                  value={form.family_members}
                  onChange={(e) => set("family_members", Number(e.target.value))}
                  className="ob-field-input"
                />
              </div>
            </div>
          </div>

          {err && (
            <div className="arm-error-box">
              <Icon iconName="ErrorBadge" styles={{ root: { fontSize: 14 } }} />
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ob-modal-footer">
          <button onClick={onClose} className="arm-cancel-btn">Cancel</button>
          <button
            onClick={handleSubmit}
            className={`arm-submit-btn${canSubmit ? " arm-submit-btn--enabled" : ""}`}
          >
            {editMode ? "Save Changes →" : "Add Resident →"}
          </button>
        </div>
      </div>
    </div>
  );
}
