import React, { useCallback, useEffect, useRef, useState } from "react";
import { DefaultButton, Icon, PrimaryButton, Spinner, TextField, Toggle } from "@fluentui/react";
import { formatDateShort as fmtDate } from "../../utils/formatDate.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmtINR(val) {
  return Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

export function fmtINR2(val) {
  return Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function computeUpdatedStats(dues) {
  return {
    total:           dues.length,
    paid:            dues.filter((d) => d.status === "PAID").length,
    pending:         dues.filter((d) => d.status === "PENDING").length,
    overdue:         dues.filter((d) => d.status === "OVERDUE").length,
    waived:          dues.filter((d) => d.status === "WAIVED").length,
    totalAmount:     dues.reduce((s, d) => s + Number(d.amount || 0), 0),
    collectedAmount: dues.filter((d) => d.status === "PAID").reduce((s, d) => s + Number(d.amount || 0), 0),
  };
}

// ── Expense sheet helpers ─────────────────────────────────────────────────────

export function perUnit(totalAmount, count) {
  if (!count || !Number(totalAmount)) return 0;
  return Number(totalAmount) / count;
}

export function toApiItems(items) {
  return items.map((i) => ({ particulars: i.particulars, total_amount: Number(i.total_amount) || 0 }));
}

export function toFormItems(raw, defaults) {
  return (raw?.length ? raw : defaults).map((i) => ({
    particulars:  i.particulars,
    total_amount: i.total_amount ? String(i.total_amount) : "",
  }));
}

export function buildSheetPayload(month, fixedItems, variableItems, interestRate) {
  return {
    month,
    fixed_items:    toApiItems(fixedItems),
    variable_items: toApiItems(variableItems),
    interest_rate:  Number(interestRate) || 21,
  };
}

// ── useItemList — manages an editable list of expense rows ────────────────────

export function useItemList(initialItems) {
  const [items, setItems] = useState(initialItems);
  const setItem    = (idx, field, val) => setItems((p) => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));
  const addItem    = () => setItems((p) => [...p, { particulars: "", total_amount: "" }]);
  return [items, setItems, setItem, removeItem, addItem];
}

// ── Primitive components ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const labels = { PENDING: "Pending", PAID: "Paid", OVERDUE: "Overdue", WAIVED: "Waived" };
  return (
    <span className={`maint-badge maint-badge--${status}`}>
      {labels[status] || status}
    </span>
  );
}

function StatCard({ icon, iconBg, value, label }) {
  return (
    <div className="maint-stat">
      <div className="maint-stat-icon" style={{ background: iconBg }}>
        <Icon iconName={icon} />
      </div>
      <div className="maint-stat-body">
        <div className="maint-stat-value">{value ?? "—"}</div>
        <div className="maint-stat-label">{label}</div>
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return <div className="maint-toast">{msg}</div>;
}

function PayLinkBtn({ url }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="maint-pay-link-row">
      <a href={url} target="_blank" rel="noopener noreferrer" className="maint-btn-link" title="Open Razorpay payment link in new tab">
        Pay Link
      </a>
      <button className={`maint-copy-btn${copied ? " copied" : ""}`} onClick={copy} title={copied ? "Copied!" : "Copy payment link"}>
        {copied ? <Icon iconName="CheckMark" /> : <Icon iconName="Copy" />}
      </button>
    </div>
  );
}

function DueRow({ due, onUpdate, onDownloadPdf }) {
  const [paymentRef,    setPaymentRef]    = useState(due.payment_reference || "");
  const [saving,        setSaving]        = useState(false);
  const [downloading,   setDownloading]   = useState(false);

  useEffect(() => {
    setPaymentRef(due.payment_reference || "");
  }, [due.id, due.payment_reference]);

  const downloadPdf = async () => {
    if (!onDownloadPdf) return;
    setDownloading(true);
    try { await onDownloadPdf(due); }
    finally { setDownloading(false); }
  };

  const markPaid = async () => {
    setSaving(true);
    try { await onUpdate(due.id, { status: "PAID", payment_reference: paymentRef || null }); }
    finally { setSaving(false); }
  };
  const waive = async () => {
    setSaving(true);
    try { await onUpdate(due.id, { status: "WAIVED" }); }
    finally { setSaving(false); }
  };
  const undo = async () => {
    setSaving(true);
    try { await onUpdate(due.id, { status: "PENDING" }); }
    finally { setSaving(false); }
  };

  const isPending = due.status === "PENDING" || due.status === "OVERDUE";
  const isDone    = due.status === "PAID"    || due.status === "WAIVED";

  return (
    <tr>
      <td>
        <div className="maint-due-row-name">{due.resident_name}</div>
        {due.resident_phone && (
          <div className="maint-due-row-phone">{due.resident_phone}</div>
        )}
      </td>
      <td className="maint-due-row-meta">
        {due.tower_name ? `${due.tower_name} · ` : ""}{due.unit_number || "—"}
      </td>
      <td className="maint-due-row-amount">
        ₹{fmtINR(due.amount)}
      </td>
      <td className="maint-due-row-meta">
        {fmtDate(due.due_date)}
      </td>
      <td>
        <StatusBadge status={due.status} />
        {due.reminder_sent_at && (
          <div className="maint-reminder-sent" style={{ marginTop: 4 }}>
            <Icon iconName="SkypeCheck" style={{ fontSize: 10 }} />
            Reminded {fmtDate(due.reminder_sent_at)}
          </div>
        )}
        {due.status === "PAID" && due.payment_date && (
          <div className="maint-due-row-paid-on">
            Paid {fmtDate(due.payment_date)}
            {due.payment_reference ? ` · ${due.payment_reference}` : ""}
          </div>
        )}
      </td>
      <td>
        {isPending && due.payment_link && <PayLinkBtn url={due.payment_link} />}
        {isPending && (
          <div className="maint-due-row-actions">
            <input
              className="maint-ref-input"
              placeholder="Ref / UTR (opt.)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
            <button className="maint-btn-paid" onClick={markPaid} disabled={saving}>
              {saving ? "…" : "Mark Paid"}
            </button>
            <button className="maint-btn-waive" onClick={waive} disabled={saving}>
              Waive
            </button>
          </div>
        )}
        {isDone && (
          <button className="maint-btn-undo" onClick={undo} disabled={saving}>
            {saving ? "…" : "Undo"}
          </button>
        )}
        {onDownloadPdf && (
          <button
            className="maint-btn-pdf"
            onClick={downloadPdf}
            disabled={downloading}
            title="Download PDF invoice"
          >
            {downloading ? "…" : <Icon iconName="PDF" />}
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Composite components ──────────────────────────────────────────────────────

export function StatsGrid({ stats }) {
  if (!stats) return null;
  return (
    <div className="maint-stats">
      <StatCard icon="PaymentCard" iconBg="#3b82f6" value={`₹${fmtINR(stats.totalAmount)}`}      label="Total Due" />
      <StatCard icon="CheckMark"   iconBg="#10b981" value={`₹${fmtINR(stats.collectedAmount)}`}  label="Collected" />
      <StatCard icon="Clock"       iconBg="#f59e0b" value={stats.pending}                         label="Pending" />
      <StatCard icon="Warning"     iconBg="#ef4444" value={stats.overdue}                         label="Overdue" />
      <StatCard icon="Cancel"      iconBg="#94a3b8" value={stats.waived}                          label="Waived" />
    </div>
  );
}

export function DuesTable({ loading, dues, emptyMsg, onUpdate, onDownloadPdf }) {
  return (
    <div className="maint-card">
      {loading ? (
        <div className="maint-spinner-wrap">
          <Spinner label="Loading maintenance data…" />
        </div>
      ) : dues.length === 0 ? (
        <div className="maint-empty">{emptyMsg}</div>
      ) : (
        <table className="maint-table">
          <thead>
            <tr>
              {["Resident", "Unit", "Amount", "Due Date", "Status", "Action"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dues.map((due) => (
              <DueRow key={due.id} due={due} onUpdate={onUpdate} onDownloadPdf={onDownloadPdf} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Shared page-level primitives ──────────────────────────────────────────────

export function useShowToast() {
  const [toast, setToast] = useState("");
  const timerRef = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(""), 3200);
  }, []);
  return [toast, showToast];
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="maint-error-banner">{error}</div>;
}

export function MonthInput({ value, onChange }) {
  return (
    <div className="maint-filter-row">
      <span className="maint-filter-label">Month:</span>
      <input type="month" className="maint-month-input" value={value} onChange={onChange} />
    </div>
  );
}

export function StatusFilterSelect({ value, onChange }) {
  return (
    <div className="maint-filter-row">
      <span className="maint-filter-label">Filter:</span>
      <select className="maint-filter-select" value={value} onChange={onChange}>
        <option value="ALL">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="PAID">Paid</option>
        <option value="OVERDUE">Overdue</option>
        <option value="WAIVED">Waived</option>
      </select>
    </div>
  );
}

export function GenerateDuesButtons({ generating, reminding, isOff, dues, onGenerate, onRemind, generateTitle }) {
  return (
    <>
      <PrimaryButton
        iconProps={{ iconName: "Refresh" }}
        text={generating ? "Generating…" : "Generate Dues"}
        onClick={onGenerate}
        disabled={generating || isOff}
        title={generateTitle}
        styles={{ root: { height: 32, fontSize: 12 } }}
      />
      <DefaultButton
        iconProps={{ iconName: "Send" }}
        text={reminding ? "Sending…" : "Send Reminders"}
        onClick={onRemind}
        disabled={reminding || isOff || !dues.some((d) => d.status === "PENDING" || d.status === "OVERDUE")}
        styles={{ root: { height: 32, fontSize: 12 } }}
      />
    </>
  );
}

export async function updateDue({ updateFn, id, payload, setDues, setStats, showToast }) {
  try {
    const data = await updateFn(id, payload);
    setDues((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, ...data.due } : d);
      setStats(computeUpdatedStats(next));
      return next;
    });
    showToast(payload.status === "PAID" ? "Marked as paid ✓" : payload.status === "WAIVED" ? "Waived." : "Updated.");
  } catch {
    showToast("Failed to update.");
  }
}

export function MaintenanceConfigBar({ enabled, isOff, offText, onText, savingCfg, upiEdit, onToggle, onUpiChange, onSaveUpi }) {
  return (
    <div className="maint-config-bar">
      <div className="maint-config-bar__inner">
        <div>
          <div className="maint-config-bar__label">Maintenance Collection</div>
          <div className="maint-config-bar__subtitle">
            {isOff ? offText : onText}
          </div>
        </div>
        <Toggle
          checked={!!enabled}
          onChange={onToggle}
          disabled={savingCfg}
          styles={{ root: { margin: 0 }, label: { display: "none" } }}
        />
      </div>
      <div className="maint-config-bar__upi">
        <TextField
          placeholder="UPI ID (e.g. society@upi)"
          value={upiEdit}
          onChange={(_, v) => onUpiChange(v || "")}
          styles={{ root: { width: 220 }, fieldGroup: { height: 32 } }}
        />
        <DefaultButton
          text="Save UPI"
          onClick={onSaveUpi}
          disabled={savingCfg}
          styles={{ root: { height: 32, fontSize: 12 } }}
        />
      </div>
    </div>
  );
}
