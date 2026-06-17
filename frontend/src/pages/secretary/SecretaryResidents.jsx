/**
 * SecretaryResidents.jsx
 * Secretary view: add, edit, and delete residents for their society.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  TextField, PrimaryButton, DefaultButton, Spinner, IconButton,
  Dropdown, DropdownMenuItemType, Dialog, DialogType, DialogFooter, Toggle,
} from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import { validatePhone, validateEmail } from "../../utils/validation.js";
import { StructurePreviewModal } from "../../components/onboarding/StructurePreviewModal.jsx";
import { CSS_T } from "../../styles/typography.js";
import { BRAND, cardTones } from "../../styles/cssConstants.js";
import {
  RESIDENT_TYPE_OPTIONS, CONTACT_PREFERENCE_OPTIONS, MAINTENANCE_DUE_DAY_OPTIONS,
  BILL_RECIPIENT_OPTIONS,
} from "../../constants.js";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import "../../styles/SecretaryLayout.css";

// Fluent UI styles prop — not expressible as a plain CSS class
const dangerButtonStyles = {
  root: { background: cardTones.OPEN.accent, borderColor: cardTones.OPEN.accent },
};

// ── Resident Form (used in both Add and Edit modals) ──────────────────────────

function ResidentForm({ form, onChange, units, isEdit }) {
  const unitOptions = useMemo(() => {
    const groups = {};
    units.forEach((u) => {
      const group = u.tower_name || "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(u);
    });

    const opts = [];
    Object.keys(groups).sort().forEach((tower, i) => {
      if (i > 0) opts.push({ key: `div_${tower}`, text: "-", itemType: DropdownMenuItemType.Divider });
      opts.push({ key: `hdr_${tower}`, text: tower, itemType: DropdownMenuItemType.Header });
      groups[tower].forEach((u) => opts.push({ key: u.id, text: u.unit_number }));
    });
    return opts;
  }, [units]);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === form.unit_id),
    [units, form.unit_id],
  );

  const selectedLabel = selectedUnit
    ? (selectedUnit.tower_name ? `${selectedUnit.tower_name} · ${selectedUnit.unit_number}` : selectedUnit.unit_number)
    : undefined;

  return (
    <div className="sec-form-col">
      <TextField
        label="Full Name"
        value={form.name}
        onChange={(_, v) => onChange("name", v || "")}
        required
        placeholder="e.g. Rajesh Kumar"
      />
      {!isEdit && (
        <Dropdown
          label="Unit"
          selectedKey={form.unit_id ?? null}
          options={unitOptions}
          onChange={(_, opt) => onChange("unit_id", opt.key)}
          required
          placeholder="Select unit…"
          // When a unit is chosen, render "Tower B · 201" not just "201"
          onRenderTitle={() =>
            selectedLabel ? <span style={{ fontSize: 14 }}>{selectedLabel}</span> : null
          }
        />
      )}
      <div className="sec-form-grid-2">
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(_, v) => onChange("phone", v || "")}
          placeholder="+91 9876543210"
        />
        <TextField
          label="Email"
          value={form.email}
          onChange={(_, v) => onChange("email", v || "")}
          placeholder="resident@email.com"
        />
      </div>
      <div className="sec-form-grid-2">
        <Dropdown
          label="Resident Type"
          selectedKey={form.resident_type}
          options={RESIDENT_TYPE_OPTIONS}
          onChange={(_, opt) => onChange("resident_type", opt.key)}
        />
        <Dropdown
          label="Preferred Contact"
          selectedKey={form.preferred_contact}
          options={CONTACT_PREFERENCE_OPTIONS}
          onChange={(_, opt) => onChange("preferred_contact", opt.key)}
        />
      </div>
      <div className="sec-form-grid-2">
        <TextField
          label="BHK / Unit Size"
          value={form.bhk}
          onChange={(_, v) => onChange("bhk", v || "")}
          placeholder="2 BHK"
        />
        <TextField
          label="Family Members"
          type="number"
          value={String(form.family_members)}
          onChange={(_, v) => onChange("family_members", Number(v) || 0)}
          min={0}
        />
      </div>
      <TextField
        label="Aadhaar (optional)"
        value={form.aadhar_number}
        onChange={(_, v) => onChange("aadhar_number", v || "")}
        placeholder="XXXX XXXX XXXX"
      />

      {/* ── Monthly Maintenance Section ─────────────────────────────────── */}
      <div className="sec-maint-section">
        <div className="sec-maint-header" style={{ marginBottom: form.maintenance_enabled ? 12 : 0 }}>
          <div>
            <div style={CSS_T.subSection}>Monthly Maintenance</div>
            <div style={{ ...CSS_T.caption, marginTop: 2 }}>
              Enable to auto-remind this resident and track their payments.
            </div>
          </div>
          <Toggle
            checked={!!form.maintenance_enabled}
            onChange={(_, v) => onChange("maintenance_enabled", v)}
            styles={{ root: { margin: 0 }, label: { display: "none" } }}
          />
        </div>

        {form.maintenance_enabled && (
          <>
            <div className="sec-form-grid-2">
              <TextField
                label="Monthly Amount (₹)"
                type="number"
                min={1}
                value={form.maintenance_amount !== "" ? String(form.maintenance_amount) : ""}
                onChange={(_, v) => onChange("maintenance_amount", v === "" ? "" : Number(v) || "")}
                prefix="₹"
                placeholder="e.g. 2500"
              />
              <Dropdown
                label="Due Day of Month"
                selectedKey={form.maintenance_due_day ?? null}
                options={MAINTENANCE_DUE_DAY_OPTIONS}
                onChange={(_, opt) => onChange("maintenance_due_day", opt.key)}
                placeholder="Select day…"
              />
            </div>
            <Dropdown
              label="Send Bill / Reminder To"
              selectedKey={form.maintenance_bill_recipient ?? "OWNER"}
              options={BILL_RECIPIENT_OPTIONS}
              onChange={(_, opt) => onChange("maintenance_bill_recipient", opt.key)}
            />
          </>
        )}
      </div>
    </div>
  );
}

const emptyForm = () => ({
  name: "", unit_id: null, phone: "", email: "",
  resident_type: "OWNER", preferred_contact: "WHATSAPP",
  bhk: "", family_members: 0, aadhar_number: "",
  // Maintenance
  maintenance_enabled:        false,
  maintenance_amount:         "",
  maintenance_due_day:        null,
  maintenance_bill_recipient: "OWNER",
});

// ── Main component ────────────────────────────────────────────────────────────

export function SecretaryResidents() {
  const [residents, setResidents] = useState([]);
  const [units,     setUnits]     = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Modal state
  const [addOpen,      setAddOpen]      = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);    // resident obj
  const [deleteTarget, setDeleteTarget] = useState(null);    // resident obj
  const [formData,     setFormData]     = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");

  // Structure preview
  const [structureOpen,    setStructureOpen]    = useState(false);
  const [structureData,    setStructureData]    = useState(null);
  const [structureLoading, setStructureLoading] = useState(false);

  const searchTimer = useRef(null);

  // ── Load residents ──────────────────────────────────────────────────────

  const loadResidents = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const path = `/api/secretary/residents${q ? `?search=${encodeURIComponent(q)}` : ""}`;
      const data = await api.get(path);
      setResidents(data.residents || []);
    } catch (err) {
      setError(getErrMsg(err, "Failed to load residents."));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load units (for add form dropdown) ──────────────────────────────────

  const loadUnits = useCallback(async () => {
    try {
      const data = await api.secretary.units();
      setUnits(data.units || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadResidents(); loadUnits(); }, [loadResidents, loadUnits]);

  // Flush pending debounce on unmount
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadResidents(val), 350);
  }, [loadResidents]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  const updateField = (key, val) => setFormData((f) => ({ ...f, [key]: val }));

  const openAdd = () => {
    setFormData(emptyForm());
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (r) => {
    setFormData({
      name:              r.name              || "",
      unit_id:           r.unit_id,
      phone:             r.phone             || "",
      email:             r.email             || "",
      resident_type:     r.resident_type     || "OWNER",
      preferred_contact: r.preferred_contact || "WHATSAPP",
      bhk:               r.bhk              || "",
      family_members:    r.family_members    ?? 0,
      aadhar_number:     r.aadhar_number     || "",
      // Maintenance (comes from LEFT JOIN in the GET /residents response)
      maintenance_enabled:        !!r.maintenance_enabled,
      maintenance_amount:         r.maintenance_amount          ?? "",
      maintenance_due_day:        r.maintenance_due_day         ?? null,
      maintenance_bill_recipient: r.maintenance_bill_recipient  ?? "OWNER",
    });
    setFormError("");
    setEditTarget(r);
  };

  // ── Structure preview ─────────────────────────────────────────────────────

  const openStructure = async () => {
    setStructureLoading(true);
    try {
      const data = await api.secretary.structure();
      setStructureData(data);
      setStructureOpen(true);
    } catch (err) {
      setError(getErrMsg(err, "Could not load building structure."));
    } finally {
      setStructureLoading(false);
    }
  };

  // Called when the user clicks an empty unit chip in the structure preview.
  // Uses the unitMap returned by the structure endpoint for an exact O(1) lookup
  // — avoids any fuzzy string matching against the units list.
  const handleUnitClick = (towerIdx, _floorIdx, unitNum) => {
    const towerName = structureData?.towers?.[towerIdx]?.name;
    const unitId    = structureData?.unitMap?.[`${towerName}:${unitNum}`] ?? null;
    setFormData({ ...emptyForm(), unit_id: unitId });
    setFormError("");
    setStructureOpen(false);
    setAddOpen(true);
  };

  // ── Add resident ─────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!formData.name.trim()) { setFormError("Name is required."); return; }
    if (!formData.unit_id)     { setFormError("Please select a unit."); return; }
    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) { setFormError(phoneErr); return; }
    const emailErr = validateEmail(formData.email);
    if (emailErr) { setFormError(emailErr); return; }

    setSaving(true);
    setFormError("");
    try {
      const data = await api.secretary.residents.add(formData);
      setResidents((prev) => [data.resident, ...prev]);
      setAddOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to add resident.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit resident ─────────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!formData.name.trim()) { setFormError("Name is required."); return; }
    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) { setFormError(phoneErr); return; }
    const emailErr = validateEmail(formData.email);
    if (emailErr) { setFormError(emailErr); return; }

    setSaving(true);
    setFormError("");
    try {
      const data = await api.secretary.residents.update(editTarget.id, formData);
      setResidents((prev) => prev.map((r) => r.id === editTarget.id ? data.resident : r));
      setEditTarget(null);
    } catch (err) {
      setFormError(err.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete resident ───────────────────────────────────────────────────────

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.secretary.residents.delete(deleteTarget.id);
      setResidents((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrMsg(err, "Failed to remove resident."));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="sec-page">
      <PageHeader
        title="Residents"
        subtitle={`${residents.length} resident${residents.length !== 1 ? "s" : ""}`}
        action={
          <div className="sec-action-row">
            <DefaultButton
              iconProps={{ iconName: structureLoading ? "ProgressRingDots" : "CityNext" }}
              text={structureLoading ? "Loading…" : "Preview Structure"}
              onClick={openStructure}
              disabled={structureLoading}
            />
            <PrimaryButton
              iconProps={{ iconName: "Add" }}
              text="Add Resident"
              onClick={openAdd}
            />
          </div>
        }
      />

      {/* Search */}
      <div className="sec-filter-md">
        <TextField
          placeholder="Search by name, unit or phone…"
          value={search}
          onChange={(_, v) => handleSearch(v || "")}
          iconProps={{ iconName: "Search" }}
        />
      </div>

      <ErrorBanner message={error} onRetry={() => { setError(""); loadResidents(search); }} />

      {/* Residents table */}
      <div className="sec-card">
        {loading ? (
          <div className="sec-spinner-center">
            <Spinner label="Loading residents…" />
          </div>
        ) : residents.length === 0 ? (
          <div className="sec-empty">
            {search ? "No residents match your search." : "No residents yet — add the first one!"}
          </div>
        ) : (
          <div className="sec-table-scroll">
            <table className="sec-table">
              <thead>
                <tr>
                  {["Name", "Unit", "Type", "Phone", "Email", "Preferred Contact", "BHK", "Maintenance", ""].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr key={r.id}>
                    <td className="sec-td--primary">{r.name}</td>
                    <td className="sec-td--secondary">
                      {r.tower_name ? `${r.tower_name} · ` : ""}{r.unit_number || "—"}
                    </td>
                    <td>
                      <span className={`sec-badge sec-badge--${r.resident_type === "OWNER" ? "owner" : "tenant"}`}>
                        {r.resident_type}
                      </span>
                    </td>
                    <td className="sec-td--secondary">{r.phone || "—"}</td>
                    <td className="sec-td--secondary">{r.email || "—"}</td>
                    <td className="sec-td--caption">{r.preferred_contact || "—"}</td>
                    <td className="sec-td--caption">{r.bhk || "—"}</td>
                    <td className="sec-td--nowrap">
                      {r.maintenance_enabled ? (
                        <div className="sec-maint-cell">
                          <span className="sec-badge sec-badge--maint-on">✓ Enabled</span>
                          {r.maintenance_amount && (
                            <span className="sec-maint-amount">
                              ₹{Number(r.maintenance_amount).toLocaleString("en-IN")} / mo
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="sec-badge sec-badge--maint-off">Off</span>
                      )}
                    </td>
                    <td>
                      <div className="sec-row-actions">
                        <IconButton
                          iconProps={{ iconName: "Edit" }}
                          title="Edit"
                          styles={{ root: { color: BRAND.blue } }}
                          onClick={() => openEdit(r)}
                        />
                        <IconButton
                          iconProps={{ iconName: "Delete" }}
                          title="Delete"
                          styles={{ root: { color: cardTones.OPEN.accent } }}
                          onClick={() => setDeleteTarget(r)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Modal ──────────────────────────────────────────────────────── */}
      <Dialog
        hidden={!addOpen}
        onDismiss={() => setAddOpen(false)}
        dialogContentProps={{
          type:    DialogType.normal,
          title:   "Add Resident",
          subText: "Fill in the details below to add a new resident.",
        }}
        modalProps={{ isBlocking: true }}
        minWidth={520}
      >
        <ResidentForm form={formData} onChange={updateField} units={units} isEdit={false} />
        {formError && <div className="sec-form-error">{formError}</div>}
        <DialogFooter>
          <PrimaryButton
            text={saving ? "Adding…" : "Add Resident"}
            onClick={handleAdd}
            disabled={saving}
          />
          <DefaultButton text="Cancel" onClick={() => setAddOpen(false)} disabled={saving} />
        </DialogFooter>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Dialog
        hidden={!editTarget}
        onDismiss={() => setEditTarget(null)}
        dialogContentProps={{
          type:  DialogType.normal,
          title: `Edit — ${editTarget?.name || ""}`,
        }}
        modalProps={{ isBlocking: true }}
        minWidth={520}
      >
        <ResidentForm form={formData} onChange={updateField} units={units} isEdit />
        {formError && <div className="sec-form-error">{formError}</div>}
        <DialogFooter>
          <PrimaryButton
            text={saving ? "Saving…" : "Save Changes"}
            onClick={handleEdit}
            disabled={saving}
          />
          <DefaultButton text="Cancel" onClick={() => setEditTarget(null)} disabled={saving} />
        </DialogFooter>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <Dialog
        hidden={!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        dialogContentProps={{
          type:    DialogType.normal,
          title:   "Remove Resident",
          subText: `Are you sure you want to remove ${deleteTarget?.name || "this resident"}? This cannot be undone.`,
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton
            text={saving ? "Removing…" : "Remove"}
            onClick={handleDelete}
            disabled={saving}
            styles={dangerButtonStyles}
          />
          <DefaultButton text="Cancel" onClick={() => setDeleteTarget(null)} disabled={saving} />
        </DialogFooter>
      </Dialog>

      {/* ── Structure Preview Modal ────────────────────────────────────────── */}
      {structureOpen && structureData && (
        <StructurePreviewModal
          towers={structureData.towers}
          residents={structureData.residents}
          onClose={() => setStructureOpen(false)}
          onUnitClick={handleUnitClick}
        />
      )}
    </div>
  );
}
