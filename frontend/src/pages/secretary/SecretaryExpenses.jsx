/**
 * SecretaryExpenses.jsx — Society Expense Ledger (SEC-104)
 *
 * Tabs: Overview (I&E Statement) | Expenses | Other Income | Annual Report
 *
 * Financial terminology used here follows Indian cooperative society accounting:
 *  - I&E Statement = Income & Expenditure (not P&L — societies are non-profit)
 *  - Surplus / Deficit (not Profit / Loss)
 *  - OpEx vs CapEx
 *  - Maintenance Fund / Sinking Fund / Corpus Fund
 */

import React, { useState, useEffect, useCallback } from "react";
import { Text, Spinner, PrimaryButton, DefaultButton } from "@fluentui/react";
import { api } from "../../services/api.js";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { PageHeader } from "../../components/shared/PageHeader.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  {
    key: "SALARY_WAGES", label: "Salary & Wages",
    sub: ["Security Guard", "Sweeping / Housekeeping", "Gardener", "Lift Operator", "Society Manager", "Accountant / Clerk"],
  },
  {
    key: "UTILITIES", label: "Utilities",
    sub: ["Common Area Electricity", "Water (Municipal Supply)", "Generator Fuel", "Generator Maintenance", "Internet / CCTV Bandwidth"],
  },
  {
    key: "REPAIRS_MAINTENANCE", label: "Repairs & Maintenance",
    sub: ["Lift (Ad-hoc Repair)", "Plumbing", "Electrical (Common Area)", "Civil / Masonry", "Painting / Waterproofing", "Gate / Boom Barrier", "Pump Maintenance", "Terrace / Roof"],
  },
  {
    key: "AMC_CONTRACTS", label: "AMC / Contracts",
    sub: ["Lift AMC", "Fire Fighting System AMC", "CCTV / Intercom AMC", "Generator AMC", "Pest Control Contract", "Housekeeping Contract"],
  },
  {
    key: "ADMINISTRATIVE", label: "Administrative",
    sub: ["Printing & Stationery", "Bank Charges", "Postage / Courier", "Software / Subscription", "Office Expenses"],
  },
  {
    key: "INSURANCE", label: "Insurance",
    sub: ["Building Insurance", "Lift Insurance", "Common Facility Insurance", "Workmen Compensation"],
  },
  {
    key: "LEGAL_PROFESSIONAL", label: "Legal & Professional",
    sub: ["Audit Fees (CA)", "Legal Fees", "Society Registration", "Stamp Duty / NOC"],
  },
  {
    key: "EVENTS_FESTIVALS", label: "Events & Festivals",
    sub: ["Diwali Celebration", "Independence / Republic Day", "New Year", "Ganesh Chaturthi / Pooja", "Children's Day", "General Events"],
  },
  {
    key: "SINKING_FUND", label: "Sinking Fund Transfer",
    sub: ["Sinking Fund Contribution"],
  },
  {
    key: "CAPEX", label: "Capital Expenditure",
    sub: ["Lift Replacement", "CCTV Installation", "Generator Replacement", "Common Area Renovation", "Pump Replacement", "Gate Automation"],
  },
  {
    key: "OTHERS", label: "Others / Miscellaneous",
    sub: ["Miscellaneous"],
  },
];

const INCOME_CATEGORIES = [
  { key: "PARKING_CHARGES",   label: "Parking Charges" },
  { key: "HALL_BOOKING",      label: "Hall / Amenity Booking" },
  { key: "NOC_TRANSFER_FEES", label: "NOC / Transfer Fees" },
  { key: "PENALTY_INTEREST",  label: "Penalty / Late Fees from Residents" },
  { key: "FD_INTEREST",       label: "Bank FD / Savings Interest" },
  { key: "ADVERTISEMENT",     label: "Advertisement / Tower / Hoarding Rental" },
  { key: "DONATIONS",         label: "Donations / Contributions" },
  { key: "OTHERS",            label: "Others / Miscellaneous" },
];

const PAYMENT_MODES = [
  { key: "BANK_TRANSFER", label: "Bank Transfer / NEFT / RTGS" },
  { key: "UPI",           label: "UPI" },
  { key: "CHEQUE",        label: "Cheque" },
  { key: "CASH",          label: "Cash" },
  { key: "OTHER",         label: "Other" },
];

const FUND_SOURCES = [
  { key: "MAINTENANCE_FUND", label: "Maintenance Fund (Day-to-day)" },
  { key: "SINKING_FUND",     label: "Sinking Fund (Major repairs)" },
  { key: "CORPUS_FUND",      label: "Corpus Fund (Reserve)" },
  { key: "OTHER",            label: "Other" },
];

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Utility helpers ───────────────────────────────────────────────────────────

function fmt(amount) {
  const n = Number(amount) || 0;
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function monthLabel(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-");
  return `${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currentYear() {
  return new Date().getFullYear().toString();
}

function catLabel(key, list = EXPENSE_CATEGORIES) {
  return list.find((c) => c.key === key)?.label || key;
}

function incCatLabel(key) {
  return INCOME_CATEGORIES.find((c) => c.key === key)?.label || key;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", background: "transparent",
            color:        active === t.key ? "#2563eb" : "#64748b",
            borderBottom: active === t.key ? "2px solid #2563eb" : "2px solid transparent",
            marginBottom: -2,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MonthPicker({ value, onChange }) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` });
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit" }}
    >
      {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  );
}

function SummaryCard({ label, value, sub, color = "#1e293b", bg = "#f8fafc", highlight }) {
  return (
    <div style={{
      background: highlight ? color : bg,
      border: `1px solid ${highlight ? color : "#e2e8f0"}`,
      borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: highlight ? "rgba(255,255,255,0.8)" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? "#fff" : color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: highlight ? "rgba(255,255,255,0.7)" : "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CategoryBar({ label, amount, total }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#334155" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(amount)} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#3b82f6", borderRadius: 4, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o.key || o} value={o.key || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function InputField({ label, type = "text", value, onChange, required, placeholder, min }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
      />
    </div>
  );
}

// ── EXPENSE FORM (add / edit) ─────────────────────────────────────────────────

const EMPTY_EXPENSE = {
  date: new Date().toISOString().slice(0, 10),
  category: "", subcategory: "", description: "", amount: "",
  payment_mode: "BANK_TRANSFER", fund_source: "MAINTENANCE_FUND",
  expense_type: "OPEX", payee_name: "", reference_no: "", notes: "",
};

function ExpenseForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY_EXPENSE);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedCat = EXPENSE_CATEGORIES.find((c) => c.key === form.category);
  const subOptions  = selectedCat ? selectedCat.sub.map((s) => ({ key: s, label: s })) : [];

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <InputField  label="Date"        type="date" value={form.date}        onChange={set("date")}        required />
        <InputField  label="Amount (₹)"  type="number" value={form.amount}    onChange={set("amount")}      required min="1" placeholder="0.00" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SelectField label="Category"    value={form.category}    onChange={(v) => setForm((f) => ({ ...f, category: v, subcategory: "" }))}
                     options={EXPENSE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} required />
        <SelectField label="Sub-category" value={form.subcategory} onChange={set("subcategory")}
                     options={subOptions} />
      </div>

      <InputField label="Description / Purpose" value={form.description} onChange={set("description")} required placeholder="e.g. April salary for security guard" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <SelectField label="Expense Type"  value={form.expense_type}  onChange={set("expense_type")}
                     options={[{ key: "OPEX", label: "OpEx (Recurring / Operating)" }, { key: "CAPEX", label: "CapEx (One-time / Capital)" }]} />
        <SelectField label="Fund / Account" value={form.fund_source} onChange={set("fund_source")}
                     options={FUND_SOURCES} />
        <SelectField label="Payment Mode"  value={form.payment_mode} onChange={set("payment_mode")}
                     options={PAYMENT_MODES} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <InputField label="Payee Name"         value={form.payee_name}   onChange={set("payee_name")}   placeholder="Name of vendor / contractor" />
        <InputField label="Ref No. / Cheque / UTR" value={form.reference_no} onChange={set("reference_no")} placeholder="Bill no., cheque no., UTR…" />
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Notes (optional)</label>
        <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={2}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      </div>

      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <DefaultButton text="Cancel" onClick={onCancel} disabled={saving} />
        <PrimaryButton type="submit" text={saving ? "Saving…" : "Save Expense"} disabled={saving} />
      </div>
    </form>
  );
}

// ── INCOME FORM ───────────────────────────────────────────────────────────────

const EMPTY_INCOME = {
  date: new Date().toISOString().slice(0, 10),
  category: "", description: "", amount: "",
  payer_name: "", reference_no: "", payment_mode: "BANK_TRANSFER", notes: "",
};

function IncomeForm({ onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(EMPTY_INCOME);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <InputField label="Date"       type="date"   value={form.date}     onChange={set("date")}     required />
        <InputField label="Amount (₹)" type="number" value={form.amount}   onChange={set("amount")}   required min="1" placeholder="0.00" />
      </div>

      <SelectField label="Income Category" value={form.category} onChange={set("category")}
                   options={INCOME_CATEGORIES} required />

      <InputField label="Description" value={form.description} onChange={set("description")} required
                  placeholder="e.g. Hall booking by Flat 204 for birthday party" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <InputField label="Received From"  value={form.payer_name}   onChange={set("payer_name")}   placeholder="Name / Flat no." />
        <InputField label="Reference No."  value={form.reference_no} onChange={set("reference_no")} placeholder="UTR / Cheque no." />
        <SelectField label="Payment Mode"  value={form.payment_mode} onChange={set("payment_mode")} options={PAYMENT_MODES} />
      </div>

      <ErrorBanner message={error} />

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <DefaultButton text="Cancel" onClick={onCancel} disabled={saving} />
        <PrimaryButton type="submit" text={saving ? "Saving…" : "Save Income Entry"} disabled={saving} />
      </div>
    </form>
  );
}

// ── TAB: Overview (I&E Statement) ─────────────────────────────────────────────

function OverviewTab() {
  const [month,   setMonth]   = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.secretary.expenses.summary(month)
      .then((d) => setSummary(d))
      .catch((err) => setError(getErrMsg(err)))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const surplusColor = summary
    ? (summary.surplus_deficit >= 0 ? "#16a34a" : "#dc2626")
    : "#1e293b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: 14, color: "#475569" } }}>I&amp;E Statement for</Text>
        <MonthPicker value={month} onChange={setMonth} />
        <Text styles={{ root: { fontSize: 12, color: "#94a3b8" } }}>
          (Income &amp; Expenditure — cooperative society format)
        </Text>
      </div>

      {loading && <Spinner label="Loading…" />}
      <ErrorBanner message={error} onRetry={load} />

      {summary && !loading && (
        <>
          {/* Summary stat cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <SummaryCard
              label="Total Income"
              value={fmt(summary.income.total)}
              sub={`Dues: ${fmt(summary.income.maintenance_collected)} + Other: ${fmt(summary.income.other_income)}`}
              color="#16a34a"
            />
            <SummaryCard
              label="Total Expenditure"
              value={fmt(summary.expenses.total)}
              sub={`${summary.expenses.by_category.length} categor${summary.expenses.by_category.length !== 1 ? "ies" : "y"}`}
              color="#dc2626"
            />
            <SummaryCard
              label={summary.surplus_deficit >= 0 ? "Net Surplus" : "Net Deficit"}
              value={fmt(Math.abs(summary.surplus_deficit))}
              sub={monthLabel(summary.month)}
              color={surplusColor}
              highlight
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Expenditure breakdown */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 16 }}>
                Expenditure by Category
              </div>
              {summary.expenses.by_category.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>No expenses recorded this month.</p>
              ) : (
                summary.expenses.by_category.map((row) => (
                  <CategoryBar
                    key={row.category}
                    label={catLabel(row.category)}
                    amount={Number(row.total)}
                    total={summary.expenses.total}
                  />
                ))
              )}
              {summary.expenses.by_category.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>Total Expenditure</span>
                  <span style={{ fontSize: 14, color: "#dc2626" }}>{fmt(summary.expenses.total)}</span>
                </div>
              )}
            </div>

            {/* Income breakdown */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 16 }}>
                Income Breakdown
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#334155" }}>Maintenance Dues Collected</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(summary.income.maintenance_collected)}</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
                  <div style={{ height: "100%", width: summary.income.total > 0 ? `${(summary.income.maintenance_collected / summary.income.total) * 100}%` : "0%", background: "#22c55e", borderRadius: 4 }} />
                </div>
              </div>
              {summary.other_income_by_category.map((row) => (
                <div key={row.category} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#334155" }}>{incCatLabel(row.category)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(row.total)}</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: summary.income.total > 0 ? `${(Number(row.total) / summary.income.total) * 100}%` : "0%", background: "#a3e635", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>Total Income</span>
                <span style={{ fontSize: 14, color: "#16a34a" }}>{fmt(summary.income.total)}</span>
              </div>

              {/* Surplus / Deficit */}
              <div style={{
                marginTop: 12, padding: "12px 14px", borderRadius: 8,
                background: summary.surplus_deficit >= 0 ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${summary.surplus_deficit >= 0 ? "#86efac" : "#fca5a5"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: surplusColor }}>
                    {summary.surplus_deficit >= 0 ? "Net Surplus" : "Net Deficit"}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: surplusColor }}>
                    {fmt(Math.abs(summary.surplus_deficit))}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {summary.surplus_deficit >= 0
                    ? "Society is in surplus this month. Consider transferring excess to Sinking Fund."
                    : "Society is in deficit this month. Review high-spend categories."}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB: Expenses (ledger) ────────────────────────────────────────────────────

function ExpensesTab() {
  const [month,      setMonth]      = useState(currentMonth());
  const [catFilter,  setCatFilter]  = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expenses,   setExpenses]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = { month };
    if (catFilter)  params.category     = catFilter;
    if (typeFilter) params.expense_type = typeFilter;
    api.secretary.expenses.list(params)
      .then((d) => setExpenses(d.expenses || []))
      .catch((err) => setError(getErrMsg(err)))
      .finally(() => setLoading(false));
  }, [month, catFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  async function handleSave(form) {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.secretary.expenses.update(editing.id, form);
      } else {
        await api.secretary.expenses.create(form);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(getErrMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exp) {
    if (!window.confirm(`Delete expense "${exp.description}" (${fmt(exp.amount)})?`)) return;
    try {
      await api.secretary.expenses.delete(exp.id);
      load();
    } catch (err) {
      setError(getErrMsg(err));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <MonthPicker value={month} onChange={setMonth} />

        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit" }}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit" }}>
          <option value="">All Types</option>
          <option value="OPEX">OpEx Only</option>
          <option value="CAPEX">CapEx Only</option>
        </select>

        <div style={{ marginLeft: "auto" }}>
          <PrimaryButton
            text="+ Add Expense"
            onClick={() => { setShowForm(true); setEditing(null); setFormError(""); }}
          />
        </div>
      </div>

      {/* Add / Edit form */}
      {(showForm || editing) && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 16 }}>
            {editing ? "Edit Expense" : "Add Expense"}
          </div>
          <ExpenseForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={saving}
            error={formError}
          />
        </div>
      )}

      <ErrorBanner message={error} onRetry={load} />

      {/* Expense list */}
      {loading ? (
        <Spinner label="Loading expenses…" />
      ) : expenses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 14 }}>
          No expenses recorded for {monthLabel(month)}.
          <br />
          <button onClick={() => setShowForm(true)}
            style={{ marginTop: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Add First Expense
          </button>
        </div>
      ) : (
        <>
          {/* Total banner */}
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} — {monthLabel(month)}
            </span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#92400e" }}>{fmt(total)}</span>
          </div>

          {/* Table */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Date", "Category", "Description", "Payee", "Mode", "Fund", "Amount", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#475569" }}>{fmtDate(exp.date)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{catLabel(exp.category)}</span>
                      {exp.subcategory && <div style={{ fontSize: 11, color: "#94a3b8" }}>{exp.subcategory}</div>}
                      {exp.expense_type === "CAPEX" && (
                        <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>CapEx</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                      <div style={{ color: "#334155" }}>{exp.description}</div>
                      {exp.reference_no && <div style={{ fontSize: 11, color: "#94a3b8" }}>Ref: {exp.reference_no}</div>}
                      {exp.notes && <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>{exp.notes}</div>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>{exp.payee_name || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {PAYMENT_MODES.find((m) => m.key === exp.payment_mode)?.label?.split(" ")[0] || exp.payment_mode}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px",
                        background: exp.fund_source === "SINKING_FUND" ? "#fef3c7" : exp.fund_source === "CORPUS_FUND" ? "#ede9fe" : "#f0fdf4",
                        color:      exp.fund_source === "SINKING_FUND" ? "#92400e" : exp.fund_source === "CORPUS_FUND" ? "#6d28d9"  : "#166534",
                      }}>
                        {exp.fund_source === "MAINTENANCE_FUND" ? "Maint." : exp.fund_source === "SINKING_FUND" ? "Sinking" : exp.fund_source === "CORPUS_FUND" ? "Corpus" : "Other"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>{fmt(exp.amount)}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <button onClick={() => { setEditing({ ...exp, date: exp.date?.slice(0, 10) }); setFormError(""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 12, fontWeight: 600, marginRight: 8 }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(exp)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB: Other Income ─────────────────────────────────────────────────────────

function OtherIncomeTab() {
  const [month,     setMonth]     = useState(currentMonth());
  const [incomeList, setIncomeList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.secretary.otherIncome.list({ month })
      .then((d) => setIncomeList(d.income || []))
      .catch((err) => setError(getErrMsg(err)))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const total = incomeList.reduce((s, i) => s + Number(i.amount), 0);

  async function handleSave(form) {
    setSaving(true);
    setFormError("");
    try {
      await api.secretary.otherIncome.create(form);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(getErrMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.description}" (${fmt(item.amount)})?`)) return;
    try {
      await api.secretary.otherIncome.delete(item.id);
      load();
    } catch (err) {
      setError(getErrMsg(err));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#166534" }}>
        <strong>What goes here:</strong> Income beyond monthly maintenance dues — parking fees, hall bookings, NOC/transfer charges, penalty interest, FD interest, advertisement income etc.
        Maintenance dues collected are auto-pulled from the dues system and appear in the I&amp;E summary.
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <MonthPicker value={month} onChange={setMonth} />
        <div style={{ marginLeft: "auto" }}>
          <PrimaryButton text="+ Add Income Entry" onClick={() => { setShowForm(true); setFormError(""); }} />
        </div>
      </div>

      {showForm && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 16 }}>Add Other Income</div>
          <IncomeForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} error={formError} />
        </div>
      )}

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading…" />
      ) : incomeList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 14 }}>
          No other income recorded for {monthLabel(month)}.
        </div>
      ) : (
        <>
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 18px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>{incomeList.length} entr{incomeList.length !== 1 ? "ies" : "y"} — {monthLabel(month)}</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#16a34a" }}>{fmt(total)}</span>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Date", "Category", "Description", "From", "Mode", "Ref No.", "Amount", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomeList.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(item.date)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{incCatLabel(item.category)}</td>
                    <td style={{ padding: "10px 14px", color: "#334155" }}>{item.description}</td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>{item.payer_name || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{PAYMENT_MODES.find((m) => m.key === item.payment_mode)?.label?.split(" ")[0] || item.payment_mode}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{item.reference_no || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>{fmt(item.amount)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => handleDelete(item)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── TAB: Annual Report ────────────────────────────────────────────────────────

function AnnualReportTab() {
  const [year,    setYear]    = useState(currentYear());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.secretary.expenses.annual(year)
      .then((d) => setData(d))
      .catch((err) => setError(getErrMsg(err)))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const years = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 4; y--) years.push(String(y));

  function downloadCSV() {
    if (!data) return;
    const header = ["Month","Maintenance Collected","Other Income","Total Income","Total Expenses","Net Surplus/Deficit"];
    const rows   = data.months.map((m) => [
      monthLabel(m.month),
      m.maintenance, m.other_income,
      m.maintenance + m.other_income,
      m.expenses,
      m.surplus,
    ]);
    const totals = rows.reduce(
      (acc, r) => [acc[0], acc[1]+Number(r[1]), acc[2]+Number(r[2]), acc[3]+Number(r[3]), acc[4]+Number(r[4]), acc[5]+Number(r[5])],
      ["TOTAL", 0, 0, 0, 0, 0],
    );

    const csv = [header, ...rows, totals]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `nexso-ie-statement-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = data?.months.reduce(
    (acc, m) => ({
      maintenance: acc.maintenance + m.maintenance,
      other_income: acc.other_income + m.other_income,
      expenses:     acc.expenses + m.expenses,
      surplus:      acc.surplus + m.surplus,
    }),
    { maintenance: 0, other_income: 0, expenses: 0, surplus: 0 },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: 14, color: "#475569" } }}>Annual I&amp;E Statement —</Text>
        <select value={year} onChange={(e) => setYear(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit" }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {data && (
          <button onClick={downloadCSV}
            style={{ marginLeft: "auto", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ⬇ Download CSV
          </button>
        )}
      </div>

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading annual report…" />
      ) : data && (
        <>
          {/* Annual totals */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <SummaryCard label="Total Income"       value={fmt(totals.maintenance + totals.other_income)} color="#16a34a" />
            <SummaryCard label="Maintenance Dues"   value={fmt(totals.maintenance)} color="#2563eb" sub="Collected (status=PAID)" />
            <SummaryCard label="Other Income"       value={fmt(totals.other_income)} color="#0891b2" />
            <SummaryCard label="Total Expenditure"  value={fmt(totals.expenses)} color="#dc2626" />
            <SummaryCard
              label={totals.surplus >= 0 ? "Net Surplus" : "Net Deficit"}
              value={fmt(Math.abs(totals.surplus))}
              color={totals.surplus >= 0 ? "#16a34a" : "#dc2626"}
              highlight
            />
          </div>

          {/* Month-by-month table */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Month","Maint. Dues","Other Income","Total Income","Expenditure","Surplus / (Deficit)"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Month" ? "left" : "right", fontWeight: 700, color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const income  = m.maintenance + m.other_income;
                  const surplus = m.surplus;
                  const hasActivity = income > 0 || m.expenses > 0;
                  return (
                    <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9", opacity: hasActivity ? 1 : 0.45 }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "#1e293b" }}>{monthLabel(m.month)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>{m.maintenance > 0 ? fmt(m.maintenance) : "—"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#0891b2" }}>{m.other_income > 0 ? fmt(m.other_income) : "—"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{income > 0 ? fmt(income) : "—"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#dc2626" }}>{m.expenses > 0 ? fmt(m.expenses) : "—"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: surplus >= 0 ? "#16a34a" : "#dc2626" }}>
                        {hasActivity ? (surplus >= 0 ? fmt(surplus) : `(${fmt(Math.abs(surplus))})`) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 13, color: "#1e293b" }}>TOTAL {year}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#1e293b" }}>{fmt(totals.maintenance)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0891b2" }}>{fmt(totals.other_income)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>{fmt(totals.maintenance + totals.other_income)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>{fmt(totals.expenses)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: totals.surplus >= 0 ? "#16a34a" : "#dc2626" }}>
                    {totals.surplus >= 0 ? fmt(totals.surplus) : `(${fmt(Math.abs(totals.surplus))})`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            * Figures in brackets indicate deficit. This I&amp;E statement is for internal management purposes.
            For statutory audit, please share this along with supporting vouchers and bank statements with your chartered accountant.
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "overview",  label: "📊 I&E Overview" },
  { key: "expenses",  label: "📋 Expense Ledger" },
  { key: "income",    label: "💰 Other Income" },
  { key: "annual",    label: "📅 Annual Report" },
];

export function SecretaryExpenses() {
  const [tab, setTab] = useState("overview");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>
      <PageHeader
        title="Society Finance"
        subtitle="Expense ledger, other income, and I&E statement"
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "income"   && <OtherIncomeTab />}
      {tab === "annual"   && <AnnualReportTab />}
    </div>
  );
}
