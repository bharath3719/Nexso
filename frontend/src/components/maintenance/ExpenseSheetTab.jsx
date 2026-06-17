import React, { useEffect, useState } from "react";
import { DefaultButton, PrimaryButton, Spinner } from "@fluentui/react";
import { api } from "../../services/api.js";
import { fmtINR2, useItemList, toFormItems, buildSheetPayload, perUnit } from "./MaintenanceShared.jsx";
import { DEFAULT_FIXED_EXPENSE_ITEMS, DEFAULT_VARIABLE_EXPENSE_ITEMS } from "../../constants.js";
import { formatMonth } from "../../utils/formatDate.js";

// ── Bill Preview Modal ────────────────────────────────────────────────────────

function BillPreviewModal({ month, residents, onClose }) {
  const [residentId,   setResidentId]   = useState("");
  const [previewData,  setPreviewData]  = useState(null);
  const [previewLoad,  setPreviewLoad]  = useState(false);
  const [previewError, setPreviewError] = useState("");

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

  const ml = formatMonth(month);

  return (
    <div className="maint-modal-overlay" onClick={onClose}>
      <div className="maint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maint-modal-header">
          <div>
            <div className="maint-modal-title">Maintenance Invoice Preview</div>
            <div className="maint-modal-subtitle">{ml}</div>
          </div>
          <button className="maint-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="maint-modal-body">
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
              Select Resident
            </label>
            <select value={residentId} onChange={(e) => { setResidentId(e.target.value); loadPreview(e.target.value); }} className="maint-sheet-select">
              <option value="">— Choose a resident to preview their bill —</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.tower_name ? ` · ${r.tower_name}` : ""} · {r.unit_number}
                </option>
              ))}
            </select>
          </div>

          {previewLoad && <div style={{ textAlign: "center", padding: 32 }}><Spinner label="Loading bill…" /></div>}
          {previewError && <div style={{ color: "#dc2626", fontSize: 13 }}>{previewError}</div>}

          {previewData && !previewLoad && (
            <div className="maint-invoice" id="maint-invoice-print">
              <div className="maint-invoice-header">
                {previewData.society?.name && <div className="maint-invoice-society">{previewData.society.name}</div>}
                {previewData.society?.address && <div className="maint-invoice-address">{previewData.society.address}</div>}
                <div className="maint-invoice-title" style={{ marginTop: previewData.society?.name ? 10 : 0 }}>
                  Unit Maintenance Invoice — {previewData.resident.unit_number}
                </div>
                <div className="maint-invoice-meta">{ml} &nbsp;·&nbsp; {previewData.resident.name}</div>
              </div>

              {previewData.fixed_items?.length > 0 && (
                <div className="maint-invoice-section">
                  <div className="maint-invoice-section-title">Fixed Maintenance Fees</div>
                  <table className="maint-invoice-table">
                    <thead><tr><th>Sl No</th><th>Particulars</th><th className="maint-inv-amt">Amount</th></tr></thead>
                    <tbody>
                      {previewData.fixed_items.map((item, i) => (
                        <tr key={i}><td>{i + 1}</td><td>{item.particulars}</td><td className="maint-inv-amt">₹ {fmtINR2(item.per_unit)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewData.variable_items?.length > 0 && (
                <div className="maint-invoice-section">
                  <div className="maint-invoice-section-title">Variable Maintenance Fees</div>
                  <table className="maint-invoice-table">
                    <thead><tr><th>Sl No</th><th>Particulars</th><th className="maint-inv-amt">Amount</th></tr></thead>
                    <tbody>
                      {previewData.variable_items.map((item, i) => (
                        <tr key={i}><td>{i + 1}</td><td>{item.particulars}</td><td className="maint-inv-amt">₹ {fmtINR2(item.per_unit)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="maint-invoice-totals">
                {previewData.base_amount > 0 && (
                  <div className="maint-invoice-row">
                    <span>Basic Maintenance</span><span>₹ {fmtINR2(previewData.base_amount)}</span>
                  </div>
                )}
                {previewData.expense_share > 0 && (
                  <div className="maint-invoice-row">
                    <span>Expense Share ({previewData.unit_count} units)</span><span>₹ {fmtINR2(previewData.expense_share)}</span>
                  </div>
                )}
                <div className="maint-invoice-row maint-invoice-row--subtotal">
                  <span>Subtotal</span><span>₹ {fmtINR2(previewData.base_amount + previewData.expense_share)}</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Sub: Advance Paid</span><span style={{ color: "#94a3b8" }}>₹ —</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Add: Previously Due</span><span>₹ {fmtINR2(previewData.previously_due)}</span>
                </div>
                <div className="maint-invoice-row">
                  <span>Add: Interest on Due @{previewData.interest_rate}%</span><span>₹ {fmtINR2(previewData.interest_amount)}</span>
                </div>
                <div className="maint-invoice-row maint-invoice-row--total">
                  <span>TOTAL</span><span>₹ {fmtINR2(previewData.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="maint-modal-footer">
          <DefaultButton text="Close" onClick={onClose} styles={{ root: { height: 32 } }} />
          {previewData && (
            <PrimaryButton iconProps={{ iconName: "Print" }} text="Print" onClick={() => window.print()} styles={{ root: { height: 32 } }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item table ────────────────────────────────────────────────────────────────

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
                <input className="maint-sheet-input maint-sheet-input--name" value={item.particulars}
                  onChange={(e) => onChange(idx, "particulars", e.target.value)} placeholder="Item name" />
              </td>
              <td>
                <input className="maint-sheet-input maint-sheet-input--amount" type="number" min="0" step="0.01"
                  value={item.total_amount} onChange={(e) => onChange(idx, "total_amount", e.target.value)} placeholder="0.00" />
              </td>
              <td className="maint-sheet-per-unit">
                {unitCount > 0 ? `₹ ${fmtINR2(perUnit(item.total_amount, unitCount))}` : <span style={{ color: "#cbd5e1" }}>—</span>}
              </td>
              <td>
                {idx >= defaultCount && (
                  <button className="maint-sheet-del" onClick={() => onRemove(idx)} title="Remove row">✕</button>
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

// ── Expense Sheet Tab ─────────────────────────────────────────────────────────

export function ExpenseSheetTab({ month, showToast }) {
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [unitCount,    setUnitCount]    = useState(0);
  const [interestRate, setInterestRate] = useState("21");
  const [showPreview,  setShowPreview]  = useState(false);
  const [residents,    setResidents]    = useState([]);

  const [fixedItems,    setFixedItems,    setFixed,    removeFixed,    addFixed]    = useItemList(DEFAULT_FIXED_EXPENSE_ITEMS);
  const [variableItems, setVariableItems, setVariable, removeVariable, addVariable] = useItemList(DEFAULT_VARIABLE_EXPENSE_ITEMS);

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
          setFixedItems(toFormItems(s.fixed_items, DEFAULT_FIXED_EXPENSE_ITEMS));
          setVariableItems(toFormItems(s.variable_items, DEFAULT_VARIABLE_EXPENSE_ITEMS));
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

  const totalFixed    = fixedItems.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalVariable = variableItems.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalExpense  = totalFixed + totalVariable;
  const perUnitExp    = unitCount > 0 ? totalExpense / unitCount : 0;

  if (loading) {
    return <div className="sec-spinner-center"><Spinner label="Loading expense sheet…" /></div>;
  }

  return (
    <div className="maint-sheet">
      <div className="maint-sheet-info">
        <span style={{ color: "#3b82f6", fontSize: 15, flexShrink: 0 }}>ℹ</span>
        <span>
          <strong>{unitCount}</strong> resident{unitCount !== 1 ? "s" : ""} with maintenance enabled.{" "}
          Enter total society expenses — each unit's share is calculated automatically.
          {unitCount === 0 && " Enable maintenance for residents first."}
        </span>
      </div>

      <ItemTable title="Fixed Maintenance Fees" items={fixedItems} defaultCount={DEFAULT_FIXED_EXPENSE_ITEMS.length}
        unitCount={unitCount} onChange={setFixed} onRemove={removeFixed} onAdd={addFixed} />

      <ItemTable title="Variable Maintenance Fees" items={variableItems} defaultCount={DEFAULT_VARIABLE_EXPENSE_ITEMS.length}
        unitCount={unitCount} onChange={setVariable} onRemove={removeVariable} onAdd={addVariable} />

      <div className="maint-sheet-interest">
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Interest Rate on Arrears:</span>
        <input className="maint-sheet-input maint-sheet-input--sm" type="number" min="0" max="100" step="0.1"
          value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
        <span style={{ fontSize: 13, color: "#64748b" }}>% per annum</span>
      </div>

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

      <div className="maint-sheet-actions">
        <DefaultButton
          iconProps={{ iconName: "PreviewLink" }}
          text="Preview Bill"
          onClick={async () => {
            try { await api.secretary.maintenance.saveExpenseSheet(buildSheetPayload(month, fixedItems, variableItems, interestRate)); }
            catch { /* open preview anyway */ }
            setShowPreview(true);
          }}
          disabled={unitCount === 0}
          styles={{ root: { height: 36 } }}
          title={unitCount === 0 ? "Enable maintenance for residents first" : "Preview the invoice for a specific resident"}
        />
        <PrimaryButton iconProps={{ iconName: "Save" }} text={saving ? "Saving…" : "Save Expense Sheet"}
          onClick={save} disabled={saving} styles={{ root: { height: 36 } }} />
      </div>

      {showPreview && (
        <BillPreviewModal month={month} residents={residents} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
