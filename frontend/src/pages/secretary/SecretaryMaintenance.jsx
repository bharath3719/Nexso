/**
 * SecretaryMaintenance.jsx
 * ─────────────────────────
 * Two tabs:
 *  1. Dues Collection — existing monthly dues table, generate, reminders
 *  2. Expense Sheet  — itemised bill builder: secretary enters total society
 *     expenses which are divided equally among enabled residents.
 *     Includes a bill preview modal matching the standard invoice format.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Spinner, Icon } from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
import { api } from "../../services/api.js";
import {
  currentMonth, fmtINR2, Toast, StatsGrid, DuesTable,
  useShowToast, ErrorBanner, MonthInput, StatusFilterSelect, MaintenanceConfigBar,
  GenerateDuesButtons, updateDue,
} from "../../components/MaintenanceShared.jsx";
import "../../styles/SecretaryLayout.css";
import "../../styles/Maintenance.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_FIXED_ITEMS = [
  { particulars: "Sinking Fund",            total_amount: "" },
  { particulars: "Structural Repair Fee",   total_amount: "" },
  { particulars: "Insurance",               total_amount: "" },
  { particulars: "Parking Fee",             total_amount: "" },
  { particulars: "Security Fee",            total_amount: "" },
  { particulars: "Housekeeping Fee",        total_amount: "" },
  { particulars: "Society Management Fee",  total_amount: "" },
  { particulars: "Lift Maintenance AMC",    total_amount: "" },
];

const DEFAULT_VARIABLE_ITEMS = [
  { particulars: "Garbage Collection Fee",  total_amount: "" },
  { particulars: "Electricity Bill",        total_amount: "" },
  { particulars: "Generator Fuel",          total_amount: "" },
  { particulars: "Water Tank Cleaning Fee", total_amount: "" },
  { particulars: "Non-Occupancy Charges",   total_amount: "" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(m) {
  if (!m) return "";
  return new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function perUnit(totalAmount, count) {
  if (!count || !Number(totalAmount)) return 0;
  return Number(totalAmount) / count;
}

function toApiItems(items) {
  return items.map((i) => ({ particulars: i.particulars, total_amount: Number(i.total_amount) || 0 }));
}

function toFormItems(raw, defaults) {
  return (raw?.length ? raw : defaults).map((i) => ({
    particulars:  i.particulars,
    total_amount: i.total_amount ? String(i.total_amount) : "",
  }));
}

function buildSheetPayload(month, fixedItems, variableItems, interestRate) {
  return {
    month,
    fixed_items:    toApiItems(fixedItems),
    variable_items: toApiItems(variableItems),
    interest_rate:  Number(interestRate) || 21,
  };
}

// ── Bill Preview Modal ────────────────────────────────────────────────────────

function BillPreviewModal({ month, residents, onClose }) {
  const [residentId,    setResidentId]    = useState("");
  const [previewData,   setPreviewData]   = useState(null);
  const [previewLoad,   setPreviewLoad]   = useState(false);
  const [previewError,  setPreviewError]  = useState("");

  const loadPreview = async (rid) => {
    if (!rid) return;
    setPreviewLoad(true);
    setPreviewError("");
    setPreviewData(null);
    try {
      const data = await api.secretary.maintenance.getBillPreview(month, rid);
      setPreviewData(data);
    } catch {
      setPreviewError("Failed to load bill preview.");
    } finally {
      setPreviewLoad(false);
    }
  };

  const handleSelect = (e) => {
    setResidentId(e.target.value);
    loadPreview(e.target.value);
  };

  const ml = monthLabel(month);

  return (
    <div className="maint-modal-overlay" onClick={onClose}>
      <div className="maint-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="maint-modal-header">
          <div>
            <div className="maint-modal-title">Maintenance Invoice Preview</div>
            <div className="maint-modal-subtitle">{ml}</div>
          </div>
          <button className="maint-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="maint-modal-body">
          {/* Resident selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
              Select Resident
            </label>
            <select value={residentId} onChange={handleSelect} className="maint-sheet-select">
              <option value="">— Choose a resident to preview their bill —</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.tower_name ? ` · ${r.tower_name}` : ""} · {r.unit_number}
                </option>
              ))}
            </select>
          </div>

          {previewLoad && (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
              <Spinner label="Loading bill…" />
            </div>
          )}
          {previewError && <div style={{ color: "#dc2626", fontSize: 13 }}>{previewError}</div>}

          {previewData && !previewLoad && (
            <div className="maint-invoice" id="maint-invoice-print">
              {/* Invoice header */}
              <div className="maint-invoice-header">
                {previewData.society?.name && (
                  <div className="maint-invoice-society">{previewData.society.name}</div>
                )}
                {previewData.society?.address && (
                  <div className="maint-invoice-address">{previewData.society.address}</div>
                )}
                <div className="maint-invoice-title" style={{ marginTop: previewData.society?.name ? 10 : 0 }}>
                  Unit Maintenance Invoice — {previewData.resident.unit_number}
                </div>
                <div className="maint-invoice-meta">
                  {ml} &nbsp;·&nbsp; {previewData.resident.name}
                </div>
              </div>

              {/* Fixed items */}
              {previewData.fixed_items?.length > 0 && (
                <div className="maint-invoice-section">
                  <div className="maint-invoice-section-title">Fixed Maintenance Fees</div>
                  <table className="maint-invoice-table">
                    <thead>
                      <tr>
                        <th>Sl No</th><th>Particulars</th><th className="maint-inv-amt">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.fixed_items.map((item, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{item.particulars}</td>
                          <td className="maint-inv-amt">₹ {fmtINR2(item.per_unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Variable items */}
              {previewData.variable_items?.length > 0 && (
                <div className="maint-invoice-section">
                  <div className="maint-invoice-section-title">Variable Maintenance Fees</div>
                  <table className="maint-invoice-table">
                    <thead>
                      <tr>
                        <th>Sl No</th><th>Particulars</th><th className="maint-inv-amt">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.variable_items.map((item, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{item.particulars}</td>
                          <td className="maint-inv-amt">₹ {fmtINR2(item.per_unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="maint-invoice-totals">
                {previewData.base_amount > 0 && (
                  <div className="maint-invoice-row">
                    <span>Basic Maintenance</span>
                    <span>₹ {fmtINR2(previewData.base_amount)}</span>
                  </div>
                )}
                {previewData.expense_share > 0 && (
                  <div className="maint-invoice-row">
                    <span>Expense Share ({previewData.unit_count} units)</span>
                    <span>₹ {fmtINR2(previewData.expense_share)}</span>
                  </div>
                )}
                <div className="maint-invoice-row maint-invoice-row--subtotal">
                  <span>Subtotal</span>
                  <span>₹ {fmtINR2(previewData.base_amount + previewData.expense_share)}</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Sub: Advance Paid</span>
                  <span style={{ color: "#94a3b8" }}>₹ —</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Add: Previously Due</span>
                  <span>₹ {fmtINR2(previewData.previously_due)}</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Add: Interest on Due @{previewData.interest_rate}%</span>
                  <span>₹ {fmtINR2(previewData.interest_amount)}</span>
                </div>
                <div className="maint-invoice-row maint-invoice-row--total">
                  <span>TOTAL</span>
                  <span>₹ {fmtINR2(previewData.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="maint-modal-footer">
          <DefaultButton text="Close" onClick={onClose} styles={{ root: { height: 32 } }} />
          {previewData && (
            <PrimaryButton
              iconProps={{ iconName: "Print" }}
              text="Print"
              onClick={() => window.print()}
              styles={{ root: { height: 32 } }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item list state helper ────────────────────────────────────────────────────

function useItemList(initialItems) {
  const [items, setItems] = useState(initialItems);
  const setItem    = (idx, field, val) => setItems((p) => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));
  const addItem    = () => setItems((p) => [...p, { particulars: "", total_amount: "" }]);
  return [items, setItems, setItem, removeItem, addItem];
}

// ── Expense Sheet Tab ─────────────────────────────────────────────────────────

function ExpenseSheetTab({ month, showToast }) {
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [unitCount,    setUnitCount]    = useState(0);
  const [interestRate, setInterestRate] = useState("21");
  const [showPreview,  setShowPreview]  = useState(false);
  const [residents,    setResidents]    = useState([]);

  const [fixedItems,    setFixedItems,    setFixed,    removeFixed,    addFixed]    = useItemList(DEFAULT_FIXED_ITEMS);
  const [variableItems, setVariableItems, setVariable, removeVariable, addVariable] = useItemList(DEFAULT_VARIABLE_ITEMS);

  // Load expense sheet + residents when month changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [sheetData, resData] = await Promise.all([
          api.secretary.maintenance.getExpenseSheet(month),
          api.secretary.residents.list(),
        ]);
        if (cancelled) return;

        setUnitCount(sheetData.count || 0);
        setResidents((resData.residents || []).filter((r) => r.maintenance_enabled));

        const s = sheetData.sheet;
        if (s) {
          setFixedItems(toFormItems(s.fixed_items, DEFAULT_FIXED_ITEMS));
          setVariableItems(toFormItems(s.variable_items, DEFAULT_VARIABLE_ITEMS));
          setInterestRate(String(s.interest_rate ?? 21));
        }
      } catch {
        // silent — server may be down, form still usable
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [month]);

  const save = async () => {
    setSaving(true);
    try {
      await api.secretary.maintenance.saveExpenseSheet(buildSheetPayload(month, fixedItems, variableItems, interestRate));
      showToast("Expense sheet saved — Generate Dues will use this breakdown.");
    } catch {
      showToast("Failed to save expense sheet.");
    } finally {
      setSaving(false);
    }
  };

  // Live summary calculations
  const totalFixed    = fixedItems.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalVariable = variableItems.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalExpense  = totalFixed + totalVariable;
  const perUnitExp    = unitCount > 0 ? totalExpense / unitCount : 0;

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spinner label="Loading expense sheet…" />
      </div>
    );
  }

  return (
    <div className="maint-sheet">
      {/* Info bar */}
      <div className="maint-sheet-info">
        <Icon iconName="Info" style={{ color: "#3b82f6", fontSize: 15, flexShrink: 0 }} />
        <span>
          <strong>{unitCount}</strong> resident{unitCount !== 1 ? "s" : ""} with maintenance enabled.{" "}
          Enter total society expenses — each unit's share is calculated automatically.
          {unitCount === 0 && " Enable maintenance for residents first."}
        </span>
      </div>

      {/* Fixed items table */}
      <ItemTable
        title="Fixed Maintenance Fees"
        items={fixedItems}
        defaultCount={DEFAULT_FIXED_ITEMS.length}
        unitCount={unitCount}
        onChange={setFixed}
        onRemove={removeFixed}
        onAdd={addFixed}
      />

      {/* Variable items table */}
      <ItemTable
        title="Variable Maintenance Fees"
        items={variableItems}
        defaultCount={DEFAULT_VARIABLE_ITEMS.length}
        unitCount={unitCount}
        onChange={setVariable}
        onRemove={removeVariable}
        onAdd={addVariable}
      />

      {/* Interest rate */}
      <div className="maint-sheet-interest">
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Interest Rate on Arrears:</span>
        <input
          className="maint-sheet-input maint-sheet-input--sm"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "#64748b" }}>% per annum</span>
      </div>

      {/* Summary */}
      <div className="maint-sheet-summary">
        <div className="maint-sheet-summary-row">
          <span>Fixed fees per unit</span>
          <span>₹ {fmtINR2(unitCount > 0 ? totalFixed / unitCount : 0)}</span>
        </div>
        <div className="maint-sheet-summary-row">
          <span>Variable fees per unit</span>
          <span>₹ {fmtINR2(unitCount > 0 ? totalVariable / unitCount : 0)}</span>
        </div>
        <div className="maint-sheet-summary-row maint-sheet-summary-row--total">
          <span>Total expense per unit</span>
          <span>₹ {fmtINR2(perUnitExp)}</span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Each resident's bill = their base maintenance + ₹{fmtINR2(perUnitExp)} expense share
        </div>
      </div>

      {/* Actions */}
      <div className="maint-sheet-actions">
        <DefaultButton
          iconProps={{ iconName: "PreviewLink" }}
          text="Preview Bill"
          onClick={async () => {
            try {
              await api.secretary.maintenance.saveExpenseSheet(buildSheetPayload(month, fixedItems, variableItems, interestRate));
            } catch { /* open preview anyway */ }
            setShowPreview(true);
          }}
          disabled={unitCount === 0}
          styles={{ root: { height: 36 } }}
          title={unitCount === 0 ? "Enable maintenance for residents first" : "Preview the invoice for a specific resident"}
        />
        <PrimaryButton
          iconProps={{ iconName: "Save" }}
          text={saving ? "Saving…" : "Save Expense Sheet"}
          onClick={save}
          disabled={saving}
          styles={{ root: { height: 36 } }}
        />
      </div>

      {showPreview && (
        <BillPreviewModal
          month={month}
          residents={residents}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// ── Reusable item table ───────────────────────────────────────────────────────

function ItemTable({ title, items, defaultCount, unitCount, onChange, onRemove, onAdd }) {
  return (
    <div className="maint-sheet-section">
      <div className="maint-sheet-section-title">{title}</div>
      <table className="maint-sheet-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Particulars</th>
            <th style={{ width: 180 }}>Total Society Amount (₹)</th>
            <th style={{ width: 130 }}>Per Unit (₹)</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="maint-sheet-sl">{idx + 1}</td>
              <td>
                <input
                  className="maint-sheet-input maint-sheet-input--name"
                  value={item.particulars}
                  onChange={(e) => onChange(idx, "particulars", e.target.value)}
                  placeholder="Item name"
                />
              </td>
              <td>
                <input
                  className="maint-sheet-input maint-sheet-input--amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.total_amount}
                  onChange={(e) => onChange(idx, "total_amount", e.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td className="maint-sheet-per-unit">
                {unitCount > 0
                  ? `₹ ${fmtINR2(perUnit(item.total_amount, unitCount))}`
                  : <span style={{ color: "#cbd5e1" }}>—</span>}
              </td>
              <td>
                {idx >= defaultCount && (
                  <button className="maint-sheet-del" onClick={() => onRemove(idx)} title="Remove row">
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="maint-sheet-add-row" onClick={onAdd}>+ Add Item</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SecretaryMaintenance() {
  const [activeTab,    setActiveTab]    = useState("dues");
  const [month,        setMonth]        = useState(currentMonth());
  const [dues,         setDues]         = useState([]);
  const [stats,        setStats]        = useState(null);
  const [config,       setConfig]       = useState({ maintenance_enabled: true, maintenance_upi_id: "" });
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [upiEdit,      setUpiEdit]      = useState("");
  const [savingCfg,    setSavingCfg]    = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [reminding,    setReminding]    = useState(false);

  const [toast, showToast] = useShowToast();

  // ── Load dues data ──────────────────────────────────────────────────────────

  const load = useCallback(async (m = month, sf = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const params = { month: m };
      if (sf !== "ALL") params.status = sf;
      const data = await api.secretary.maintenance.list(params);
      setDues(data.dues   || []);
      setStats(data.stats || null);
      if (data.config) {
        setConfig(data.config);
        setUpiEdit(data.config.maintenance_upi_id || "");
      }
    } catch {
      setError("Failed to load maintenance data.");
    } finally {
      setLoading(false);
    }
  }, [month, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleMonthChange = (e) => {
    setMonth(e.target.value);
    load(e.target.value, statusFilter);
  };

  const handleFilterChange = (e) => {
    setStatusFilter(e.target.value);
    load(month, e.target.value);
  };

  // ── Feature config ──────────────────────────────────────────────────────────

  const toggleFeature = async (_, checked) => {
    setSavingCfg(true);
    try {
      const data = await api.secretary.maintenance.updateConfig({ maintenance_enabled: checked });
      setConfig((c) => ({ ...c, maintenance_enabled: data.config.maintenance_enabled }));
      showToast(checked ? "Maintenance collection enabled." : "Maintenance collection disabled.");
    } catch {
      showToast("Failed to update setting.");
    } finally {
      setSavingCfg(false);
    }
  };

  const saveUpi = async () => {
    setSavingCfg(true);
    try {
      const data = await api.secretary.maintenance.updateConfig({ maintenance_upi_id: upiEdit.trim() || null });
      setConfig((c) => ({ ...c, maintenance_upi_id: data.config.maintenance_upi_id }));
      showToast("UPI ID saved.");
    } catch {
      showToast("Failed to save UPI ID.");
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Generate dues ───────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await api.secretary.maintenance.generate(month);
      showToast(
        `Generated ${data.created} dues for ${month}` +
        (data.skipped ? ` (${data.skipped} already existed)` : "") +
        (data.razorpay ? "" : ""),
      );
      await load(month, statusFilter);
    } catch {
      showToast("Failed to generate dues.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Send reminders ──────────────────────────────────────────────────────────

  const handleRemind = async () => {
    setReminding(true);
    try {
      const data = await api.secretary.maintenance.sendReminders(month);
      if (data.total === 0) {
        showToast("No reminders due yet (dues must be within 7 days of due date).");
      } else {
        showToast(`Sent ${data.sent} reminders${data.failed ? ` (${data.failed} failed)` : ""}.`);
      }
      await load(month, statusFilter);
    } catch {
      showToast("Failed to send reminders.");
    } finally {
      setReminding(false);
    }
  };

  // ── Update a single due ─────────────────────────────────────────────────────

  const handleUpdate = useCallback(
    (id, payload) => updateDue({ updateFn: api.secretary.maintenance.updateDue, id, payload, setDues, setStats, showToast }),
    [showToast],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const isOff = !config.maintenance_enabled;

  return (
    <div className="sec-page">
      <PageHeader
        title="Maintenance"
        subtitle="Build monthly invoices, generate dues, and track collections"
      />

      <ErrorBanner error={error} />

      {/* ── Feature config bar ────────────────────────────────────────── */}
      <MaintenanceConfigBar
        enabled={config.maintenance_enabled}
        isOff={isOff}
        offText="Currently OFF — residents will not receive reminders."
        onText="Currently ON — dues will be generated and reminders sent automatically."
        savingCfg={savingCfg}
        upiEdit={upiEdit}
        onToggle={toggleFeature}
        onUpiChange={setUpiEdit}
        onSaveUpi={saveUpi}
      />

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="maint-tabs">
        <button
          className={`maint-tab${activeTab === "dues" ? " maint-tab--active" : ""}`}
          onClick={() => setActiveTab("dues")}
        >
          <Icon iconName="PaymentCard" style={{ fontSize: 13, marginRight: 6 }} />
          Dues Collection
        </button>
        <button
          className={`maint-tab${activeTab === "expense-sheet" ? " maint-tab--active" : ""}`}
          onClick={() => setActiveTab("expense-sheet")}
        >
          <Icon iconName="Documentation" style={{ fontSize: 13, marginRight: 6 }} />
          Expense Sheet
        </button>
      </div>

      {/* Month selector — shared between both tabs */}
      <div className="maint-controls">
        <MonthInput value={month} onChange={handleMonthChange} />

        {activeTab === "dues" && (
          <>
            <StatusFilterSelect value={statusFilter} onChange={handleFilterChange} />
            <GenerateDuesButtons
              generating={generating}
              reminding={reminding}
              isOff={isOff}
              dues={dues}
              onGenerate={handleGenerate}
              onRemind={handleRemind}
              generateTitle={isOff ? "Enable maintenance collection first" : "Create dues for all residents (includes expense sheet breakdown if saved)"}
            />
          </>
        )}
      </div>

      {/* ── Dues tab content ──────────────────────────────────────────── */}
      {activeTab === "dues" && (
        <>
          <StatsGrid stats={stats} />
          <DuesTable
            loading={loading}
            dues={dues}
            emptyMsg={isOff
              ? "Maintenance collection is currently disabled."
              : `No dues for ${month}. Build an expense sheet, then click "Generate Dues".`}
            onUpdate={handleUpdate}
          />
        </>
      )}

      {/* ── Expense Sheet tab content ─────────────────────────────────── */}
      {activeTab === "expense-sheet" && (
        <ExpenseSheetTab month={month} showToast={showToast} />
      )}

      <Toast msg={toast} />
    </div>
  );
}
