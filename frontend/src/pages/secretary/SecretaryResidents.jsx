/**
 * SecretaryResidents.jsx
 * ───────────────────────
 * Secretary view: add, edit, and delete residents for their society.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Text, TextField, PrimaryButton, DefaultButton, Spinner, IconButton,
  Dropdown, DropdownMenuItemType, Dialog, DialogType, DialogFooter,
  Checkbox, Toggle,
} from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
import { api } from "../../services/api.js";
import { validatePhone, validateEmail } from "../../utils/validation.js";
import { StructurePreviewModal } from "../../components/onboarding/StructurePreviewModal.jsx";
import "../../styles/SecretaryLayout.css";

const RESIDENT_TYPES  = [
  { key: "OWNER",  text: "Owner"  },
  { key: "TENANT", text: "Tenant" },
];

// Day-of-month options for maintenance due day (1–28 only, avoids month-end issues)
const DUE_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  const sfx = n >= 11 && n <= 13 ? "th" : ["th","st","nd","rd"][(n % 10) < 4 ? n % 10 : 0];
  return { key: n, text: `${n}${sfx} of every month` };
});
const CONTACT_OPTIONS = [
  { key: "WHATSAPP", text: "WhatsApp" },
  { key: "CALL",     text: "Call"     },
  { key: "SMS",      text: "SMS"      },
  { key: "EMAIL",    text: "Email"    },
];

// ── Resident Form (used in both Add and Edit modals) ──────────────────────────

function ResidentForm({ form, onChange, units, isEdit }) {
  // Group units under a tower header so the display is unambiguous even when
  // multiple towers share the same unit number (e.g. both have "101").
  const unitOptions = (() => {
    const groups = {};
    units.forEach((u) => {
      const group = u.tower_name || "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(u);
    });

    const opts = [];
    const towerNames = Object.keys(groups).sort();
    towerNames.forEach((tower, i) => {
      if (i > 0) opts.push({ key: `div_${tower}`, text: "-", itemType: DropdownMenuItemType.Divider });
      opts.push({ key: `hdr_${tower}`, text: tower, itemType: DropdownMenuItemType.Header });
      groups[tower].forEach((u) => opts.push({ key: u.id, text: u.unit_number }));
    });
    return opts;
  })();

  // Derive the full label ("Tower B · 201") for the selected-value display.
  const selectedUnit = units.find((u) => u.id === form.unit_id);
  const selectedLabel = selectedUnit
    ? (selectedUnit.tower_name ? `${selectedUnit.tower_name} · ${selectedUnit.unit_number}` : selectedUnit.unit_number)
    : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            selectedLabel
              ? <span style={{ fontSize: 14 }}>{selectedLabel}</span>
              : null
          }
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Dropdown
          label="Resident Type"
          selectedKey={form.resident_type}
          options={RESIDENT_TYPES}
          onChange={(_, opt) => onChange("resident_type", opt.key)}
        />
        <Dropdown
          label="Preferred Contact"
          selectedKey={form.preferred_contact}
          options={CONTACT_OPTIONS}
          onChange={(_, opt) => onChange("preferred_contact", opt.key)}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
      <div style={{
        borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 4,
        borderRadius: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: form.maintenance_enabled ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Monthly Maintenance</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
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
              options={DUE_DAY_OPTIONS}
              onChange={(_, opt) => onChange("maintenance_due_day", opt.key)}
              placeholder="Select day…"
            />
          </div>
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
  maintenance_enabled: false,
  maintenance_amount:  "",
  maintenance_due_day: null,
});

// ── Main component ────────────────────────────────────────────────────────────

export function SecretaryResidents() {
  const [residents, setResidents] = useState([]);
  const [units,     setUnits]     = useState([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Modal state
  const [addOpen,    setAddOpen]    = useState(false);
  const [editTarget, setEditTarget] = useState(null);    // resident obj
  const [deleteTarget, setDeleteTarget] = useState(null); // resident obj
  const [formData,   setFormData]   = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");

  // Structure preview
  const [structureOpen,    setStructureOpen]    = useState(false);
  const [structureData,    setStructureData]    = useState(null);   // { towers, residents }
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
    } catch {
      setError("Failed to load residents.");
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

  // Debounced search
  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadResidents(val), 350);
  };

  // ── Form helpers ─────────────────────────────────────────────────────────

  const updateField = (key, val) => setFormData((f) => ({ ...f, [key]: val }));

  const openAdd = () => {
    setFormData(emptyForm());
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (r) => {
    setFormData({
      name:              r.name        || "",
      unit_id:           r.unit_id,
      phone:             r.phone       || "",
      email:             r.email       || "",
      resident_type:     r.resident_type     || "OWNER",
      preferred_contact: r.preferred_contact || "WHATSAPP",
      bhk:               r.bhk         || "",
      family_members:    r.family_members ?? 0,
      aadhar_number:     r.aadhar_number || "",
      // Maintenance (comes from LEFT JOIN in the GET /residents response)
      maintenance_enabled: !!r.maintenance_enabled,
      maintenance_amount:  r.maintenance_amount  ?? "",
      maintenance_due_day: r.maintenance_due_day ?? null,
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
    } catch {
      setError("Could not load building structure. Please try again.");
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
    } catch { /* ignore */ } finally {
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
          <div style={{ display: "flex", gap: 8 }}>
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
      <div style={{ maxWidth: 360 }}>
        <TextField
          placeholder="Search by name, unit or phone…"
          value={search}
          onChange={(_, v) => handleSearch(v || "")}
          iconProps={{ iconName: "Search" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Residents table */}
      <div className="sec-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spinner label="Loading residents…" />
          </div>
        ) : residents.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
            {search ? "No residents match your search." : "No residents yet — add the first one!"}
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 2 }}>
                  {["Name", "Unit", "Type", "Phone", "Email", "Preferred Contact", "BHK", "Maintenance", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", background: "#f8fafc" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {residents.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                  >
                    <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 14, color: "#1e293b", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>
                      {r.tower_name ? `${r.tower_name} · ` : ""}{r.unit_number || "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                        background: r.resident_type === "OWNER" ? "#eff6ff" : "#faf5ff",
                        color:      r.resident_type === "OWNER" ? "#2563eb" : "#7c3aed",
                      }}>
                        {r.resident_type}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>{r.phone || "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>{r.email || "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{r.preferred_contact || "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{r.bhk || "—"}</td>
                    <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                      {r.maintenance_enabled ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 4,
                            fontSize: 11, fontWeight: 600,
                            background: "#f0fdf4", color: "#15803d",
                          }}>
                            ✓ Enabled
                          </span>
                          {r.maintenance_amount && (
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              ₹{Number(r.maintenance_amount).toLocaleString("en-IN")} / mo
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 4,
                          fontSize: 11, fontWeight: 600,
                          background: "#f8fafc", color: "#94a3b8",
                        }}>
                          Off
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <IconButton
                          iconProps={{ iconName: "Edit" }}
                          title="Edit"
                          styles={{ root: { color: "#3b82f6" } }}
                          onClick={() => openEdit(r)}
                        />
                        <IconButton
                          iconProps={{ iconName: "Delete" }}
                          title="Delete"
                          styles={{ root: { color: "#dc2626" } }}
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
        {formError && <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13 }}>{formError}</div>}
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
        {formError && <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13 }}>{formError}</div>}
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
            styles={{ root: { background: "#dc2626", borderColor: "#dc2626" } }}
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
