import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatINR, formatMonth, formatDateShort } from "../../utils/formatDate.js";
import "../../styles/ResidentLayout.css";

const STATUS_LABELS = {
  PENDING: "Pending", OVERDUE: "Overdue", PAID: "Paid", WAIVED: "Waived",
  PENDING_VERIFICATION: "Confirming",
};

function StatusPill({ status }) {
  return (
    <span className={`res-badge res-badge--${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function DueRow({ due, onDownload, downloading }) {
  const isOverdue = due.status === "OVERDUE";
  const isPaid = due.status === "PAID" || due.status === "WAIVED";
  // Resident has reported a UPI payment; the society is matching the UTR.
  const isConfirming = due.status === "PENDING_VERIFICATION";

  return (
    <div className={`res-bill-row res-bill-due${isOverdue ? " res-bill-due--overdue" : ""}`}>
      <div>
        <div className="res-bill-month">{formatMonth(due.due_month)}</div>
        {isOverdue && (
          <div className="res-bill-submeta res-bill-submeta--overdue">Due {formatDateShort(due.due_date)}</div>
        )}
        {!isOverdue && due.due_date && due.status === "PENDING" && (
          <div className="res-bill-submeta">Due {formatDateShort(due.due_date)}</div>
        )}
        {isPaid && due.payment_date && (
          <div className="res-bill-submeta">
            Paid {formatDateShort(due.payment_date)}
            {due.payment_reference && ` · Ref: ${due.payment_reference}`}
          </div>
        )}
        {isConfirming && (
          <div className="res-bill-submeta">
            Awaiting confirmation{due.claimed_utr && ` · UTR: ${due.claimed_utr}`}
          </div>
        )}
      </div>

      <div className={`res-bill-amount${isOverdue ? " res-bill-amount--overdue" : ""}`}>
        {formatINR(due.amount)}
      </div>

      <div className="res-bill-invoice">{due.invoice_number ? `#${due.invoice_number}` : "—"}</div>

      <div className="res-bill-status">
        <StatusPill status={due.status} />
      </div>

      <div className="res-bill-actions">
        {due.payment_link && !isPaid && !isConfirming && (
          <a href={due.payment_link} target="_blank" rel="noreferrer" className="res-bill-pay">
            Pay Now
          </a>
        )}
        {(isPaid || due.invoice_number) && (
          <button className="res-bill-receipt" onClick={() => onDownload(due)} disabled={downloading === due.id}>
            {downloading === due.id ? "…" : "Receipt"}
          </button>
        )}
      </div>
    </div>
  );
}

const COLUMNS = [
  { label: "Month" },
  { label: "Amount", align: "right" },
  { label: "Invoice", align: "right" },
  { label: "Status", align: "center" },
  { label: "", key: "actions" },
];

function TableHeader() {
  return (
    <div className="res-bill-row res-bill-thead">
      {COLUMNS.map((c) => (
        <div key={c.label || c.key} className={`res-bill-th${c.align ? ` res-bill-th--${c.align}` : ""}`}>
          {c.label}
        </div>
      ))}
    </div>
  );
}

export function ResidentBilling() {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending"); // "pending" | "history"
  const [downloading, setDownloading] = useState(null);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.resident.maintenance.dues()
      .then((d) => { if (!cancelled) { setDues(d.dues || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(getErrMsg(err, "Could not load dues. Please try again.")); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  // Single pass: split into tabs and accumulate the totals/counts the UI needs.
  const summary = useMemo(() => {
    const s = {
      pending: [], history: [],
      pendingTotal: 0, pendingCount: 0,
      overdueTotal: 0, overdueCount: 0,
      confirmingTotal: 0, confirmingCount: 0,
      paidCount: 0,
    };
    for (const d of dues) {
      const amount = Number(d.amount || 0);
      if (d.status === "PENDING") { s.pending.push(d); s.pendingTotal += amount; s.pendingCount += 1; }
      else if (d.status === "OVERDUE") { s.pending.push(d); s.overdueTotal += amount; s.overdueCount += 1; }
      // Already paid by the resident, so it stays out of the "you owe" totals —
      // but it belongs in the pending tab until the society confirms it.
      else if (d.status === "PENDING_VERIFICATION") { s.pending.push(d); s.confirmingTotal += amount; s.confirmingCount += 1; }
      else if (d.status === "PAID") { s.history.push(d); s.paidCount += 1; }
      else if (d.status === "WAIVED") { s.history.push(d); }
    }
    return s;
  }, [dues]);

  const handleDownload = useCallback(async (due) => {
    setDownloading(due.id);
    try {
      const label = due.invoice_number ? due.invoice_number.replace(/\//g, "-") : due.due_month;
      await api.resident.maintenance.downloadInvoicePdf(due.id, label);
    } catch (err) {
      setToast(getErrMsg(err, "Couldn't download the receipt. Please try again."));
      setTimeout(() => setToast(""), 3200);
    } finally {
      setDownloading(null);
    }
  }, []);

  const shownDues = tab === "pending" ? summary.pending : summary.history;

  return (
    <div className="res-page">
      <PageHeader title="My Payments" subtitle="Dues, invoices, and receipts for your unit" />

      <ErrorBanner message={error} onRetry={load} />
      {toast && <div className="res-toast">{toast}</div>}

      {loading ? (
        <Spinner label="Loading dues…" />
      ) : (
        <>
          <div className="res-bill-cards">
            <div className="res-bill-card">
              <div className="res-bill-card-label">Pending</div>
              <div className="res-bill-card-value">{formatINR(summary.pendingTotal)}</div>
              <div className="res-bill-card-sub">{summary.pendingCount} due</div>
            </div>
            <div className={`res-bill-card${summary.overdueTotal > 0 ? " res-bill-card--alert" : ""}`}>
              <div className={`res-bill-card-label${summary.overdueTotal > 0 ? " res-bill-card-label--alert" : ""}`}>Overdue</div>
              <div className={`res-bill-card-value${summary.overdueTotal > 0 ? " res-bill-card-value--alert" : ""}`}>{formatINR(summary.overdueTotal)}</div>
              <div className="res-bill-card-sub">{summary.overdueCount} overdue</div>
            </div>
            {summary.confirmingCount > 0 && (
              <div className="res-bill-card">
                <div className="res-bill-card-label">Confirming</div>
                <div className="res-bill-card-value">{formatINR(summary.confirmingTotal)}</div>
                <div className="res-bill-card-sub">{summary.confirmingCount} awaiting</div>
              </div>
            )}
            <div className="res-bill-card">
              <div className="res-bill-card-label">Receipts</div>
              <div className="res-bill-card-value">{summary.paidCount}</div>
              <div className="res-bill-card-sub">paid months</div>
            </div>
          </div>

          <div className="res-card">
            <div className="res-bill-tabs">
              {[
                { key: "pending", label: `Pending Dues (${summary.pending.length})` },
                { key: "history", label: `Payment History (${summary.history.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`res-bill-tab${tab === key ? " res-bill-tab--active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {shownDues.length === 0 ? (
              <div className="res-empty" style={{ padding: "48px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{tab === "pending" ? "✅" : "📋"}</div>
                <Text styles={{ root: { fontSize: 14, color: "#64748b" } }}>
                  {tab === "pending" ? "No pending dues." : "No payment history yet."}
                </Text>
              </div>
            ) : (
              <>
                <TableHeader />
                {shownDues.map((due) => (
                  <DueRow key={due.id} due={due} onDownload={handleDownload} downloading={downloading} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
