import React, { useCallback, useRef, useState } from "react";
import { DefaultButton, Icon, PrimaryButton, Spinner, TextField, Toggle } from "@fluentui/react";

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

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
        <Icon iconName={icon} style={{ color: "#fff", fontSize: 18 }} />
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
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="maint-pay-link-row">
      <a href={url} target="_blank" rel="noopener noreferrer" className="maint-btn-link" title="Open Razorpay payment link in new tab">
        🔗 Pay Link
      </a>
      <button className={`maint-copy-btn${copied ? " copied" : ""}`} onClick={copy} title={copied ? "Copied!" : "Copy payment link"}>
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}

function DueRow({ due, onUpdate }) {
  const [ref,    setRef]    = useState(due.payment_reference || "");
  const [saving, setSaving] = useState(false);

  const markPaid = async () => {
    setSaving(true);
    try { await onUpdate(due.id, { status: "PAID", payment_reference: ref || null }); }
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
      <td style={{ padding: "10px 14px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{due.resident_name}</div>
        {due.resident_phone && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{due.resident_phone}</div>
        )}
      </td>
      <td style={{ padding: "10px 14px", fontSize: 13, color: "#475569" }}>
        {due.tower_name ? `${due.tower_name} · ` : ""}{due.unit_number || "—"}
      </td>
      <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
        ₹{fmtINR(due.amount)}
      </td>
      <td style={{ padding: "10px 14px", fontSize: 13, color: "#475569" }}>
        {fmtDate(due.due_date)}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <StatusBadge status={due.status} />
        {due.reminder_sent_at && (
          <div className="maint-reminder-sent" style={{ marginTop: 4 }}>
            <Icon iconName="SkypeCheck" style={{ fontSize: 10 }} />
            Reminded {fmtDate(due.reminder_sent_at)}
          </div>
        )}
        {due.status === "PAID" && due.payment_date && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
            Paid {fmtDate(due.payment_date)}
            {due.payment_reference ? ` · ${due.payment_reference}` : ""}
          </div>
        )}
      </td>
      <td style={{ padding: "10px 14px" }}>
        {isPending && due.payment_link && <PayLinkBtn url={due.payment_link} />}
        {isPending && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="maint-ref-input"
              placeholder="Ref / UTR (opt.)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
            <button className="maint-btn-paid" onClick={markPaid} disabled={saving}>
              {saving ? "…" : "✓ Mark Paid"}
            </button>
            <button className="maint-btn-waive" onClick={waive} disabled={saving}>
              Waive
            </button>
          </div>
        )}
        {isDone && (
          <button className="maint-btn-undo" onClick={undo} disabled={saving}>
            {saving ? "…" : "↩ Undo"}
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

export function DuesTable({ loading, dues, emptyMsg, onUpdate }) {
  return (
    <div className="maint-card">
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
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
              <DueRow key={due.id} due={due} onUpdate={onUpdate} />
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
  return (
    <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
      {error}
    </div>
  );
}

export function MonthInput({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Month:</span>
      <input type="month" className="maint-month-input" value={value} onChange={onChange} />
    </div>
  );
}

export function StatusFilterSelect({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Filter:</span>
      <select
        value={value}
        onChange={onChange}
        style={{
          height: 32, border: "1px solid #d0d7de", borderRadius: 6,
          padding: "0 10px", fontSize: 13, color: "#1e293b", background: "#fff", outline: "none",
        }}
      >
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

export async function updateDue({ updateFn, id, payload, dues, setDues, setStats, showToast }) {
  try {
    const data = await updateFn(id, payload);
    setDues((prev) => prev.map((d) => d.id === id ? { ...d, ...data.due } : d));
    const updated = dues.map((d) => d.id === id ? { ...d, ...data.due } : d);
    setStats(computeUpdatedStats(updated));
    showToast(payload.status === "PAID" ? "Marked as paid ✓" : payload.status === "WAIVED" ? "Waived." : "Updated.");
  } catch {
    showToast("Failed to update.");
  }
}

export function MaintenanceConfigBar({ enabled, isOff, offText, onText, savingCfg, upiEdit, onToggle, onUpiChange, onSaveUpi }) {
  return (
    <div className="maint-config-bar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Maintenance Collection</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
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
