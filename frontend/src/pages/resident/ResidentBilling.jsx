import React, { useState, useEffect } from "react";
import { Text, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import "../../styles/ResidentLayout.css";

function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMonth(m) {
  if (!m) return "—";
  return new Date(m + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_META = {
  PENDING:  { label: "Pending",  bg: "#fef9c3", color: "#854d0e" },
  OVERDUE:  { label: "Overdue",  bg: "#fee2e2", color: "#991b1b" },
  PAID:     { label: "Paid",     bg: "#dcfce7", color: "#166534" },
  WAIVED:   { label: "Waived",   bg: "#f1f5f9", color: "#475569" },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: meta.bg, color: meta.color, letterSpacing: "0.03em",
    }}>
      {meta.label}
    </span>
  );
}

function DueRow({ due, onDownload, downloading }) {
  const isOverdue = due.status === "OVERDUE";
  const isPaid    = due.status === "PAID" || due.status === "WAIVED";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 120px 120px 90px 110px",
      alignItems: "center",
      gap: 8,
      padding: "14px 20px",
      borderBottom: "1px solid #f1f5f9",
      background: isOverdue ? "#fff8f8" : "#fff",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{fmtMonth(due.due_month)}</div>
        {isOverdue && (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2, fontWeight: 500 }}>
            Due {fmtDate(due.due_date)}
          </div>
        )}
        {!isOverdue && due.due_date && due.status === "PENDING" && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            Due {fmtDate(due.due_date)}
          </div>
        )}
        {isPaid && due.payment_date && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            Paid {fmtDate(due.payment_date)}
            {due.payment_reference && ` · Ref: ${due.payment_reference}`}
          </div>
        )}
      </div>

      <div style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: isOverdue ? "#dc2626" : "#1e293b" }}>
        {fmtINR(due.amount)}
      </div>

      <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
        {due.invoice_number ? `#${due.invoice_number}` : "—"}
      </div>

      <div style={{ textAlign: "center" }}>
        <StatusPill status={due.status} />
      </div>

      <div style={{ textAlign: "right" }}>
        {(isPaid || due.invoice_number) && (
          <button
            onClick={() => onDownload(due)}
            disabled={downloading === due.id}
            style={{
              fontSize: 12, fontWeight: 500, padding: "5px 12px",
              borderRadius: 6, border: "1px solid #e2e8f0",
              background: "#fff", color: "#2563eb", cursor: "pointer",
              opacity: downloading === due.id ? 0.6 : 1,
            }}
          >
            {downloading === due.id ? "…" : "Receipt"}
          </button>
        )}
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 120px 120px 90px 110px",
      gap: 8,
      padding: "10px 20px",
      borderBottom: "2px solid #e2e8f0",
      background: "#f8fafc",
    }}>
      {["Month", "Amount", "Invoice", "Status", ""].map((h) => (
        <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Amount" || h === "Invoice" ? "right" : h === "Status" ? "center" : "left" }}>
          {h}
        </div>
      ))}
    </div>
  );
}

export function ResidentBilling() {
  const [dues,       setDues]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [tab,        setTab]        = useState("pending"); // "pending" | "history"
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.resident.maintenance.dues()
      .then((d) => { if (!cancelled) { setDues(d.dues || []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Could not load dues. Please try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const pendingDues  = dues.filter((d) => d.status === "PENDING" || d.status === "OVERDUE");
  const historyDues  = dues.filter((d) => d.status === "PAID"    || d.status === "WAIVED");

  const overdueTotal = pendingDues
    .filter((d) => d.status === "OVERDUE")
    .reduce((s, d) => s + Number(d.amount || 0), 0);

  const pendingTotal = pendingDues
    .filter((d) => d.status === "PENDING")
    .reduce((s, d) => s + Number(d.amount || 0), 0);

  async function handleDownload(due) {
    setDownloading(due.id);
    try {
      const label = due.invoice_number
        ? due.invoice_number.replace(/\//g, "-")
        : due.due_month;
      await api.resident.maintenance.downloadInvoicePdf(due.id, label);
    } catch {
      // silently ignore — browser download errors don't need a toast
    } finally {
      setDownloading(null);
    }
  }

  const shownDues = tab === "pending" ? pendingDues : historyDues;

  return (
    <div className="res-page">
      <PageHeader title="My Payments" subtitle="Dues, invoices, and receipts for your unit" />

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading dues…" />
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pending</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>{fmtINR(pendingTotal)}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{pendingDues.filter((d) => d.status === "PENDING").length} due</div>
            </div>
            <div style={{ background: overdueTotal > 0 ? "#fff8f8" : "#fff", borderRadius: 10, border: `1px solid ${overdueTotal > 0 ? "#fecaca" : "#e2e8f0"}`, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: overdueTotal > 0 ? "#dc2626" : "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Overdue</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: overdueTotal > 0 ? "#dc2626" : "#1e293b" }}>{fmtINR(overdueTotal)}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{pendingDues.filter((d) => d.status === "OVERDUE").length} overdue</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Receipts</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>{historyDues.filter((d) => d.status === "PAID").length}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>paid months</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="res-card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
              {[
                { key: "pending", label: `Pending Dues (${pendingDues.length})` },
                { key: "history", label: `Payment History (${historyDues.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    padding: "14px 20px", fontSize: 14, fontWeight: tab === key ? 600 : 400,
                    color: tab === key ? "#2563eb" : "#64748b",
                    background: "transparent", border: "none", cursor: "pointer",
                    borderBottom: tab === key ? "2px solid #2563eb" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {shownDues.length === 0 ? (
              <div className="res-empty" style={{ padding: "48px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {tab === "pending" ? "✅" : "📋"}
                </div>
                <Text styles={{ root: { fontSize: 14, color: "#64748b" } }}>
                  {tab === "pending" ? "No pending dues." : "No payment history yet."}
                </Text>
              </div>
            ) : (
              <>
                <TableHeader />
                {shownDues.map((due) => (
                  <DueRow
                    key={due.id}
                    due={due}
                    onDownload={handleDownload}
                    downloading={downloading}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
