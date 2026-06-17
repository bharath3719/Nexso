import React, { useEffect, useState, useCallback } from "react";
import { DefaultButton, Spinner, Icon } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import {
  currentMonth, Toast, StatsGrid, DuesTable,
  useShowToast, ErrorBanner, MonthInput, StatusFilterSelect, MaintenanceConfigBar,
  GenerateDuesButtons, updateDue,
} from "../../components/maintenance/MaintenanceShared.jsx";
import { ExpenseSheetTab } from "../../components/maintenance/ExpenseSheetTab.jsx";
import { AccountTallyTab } from "../../components/maintenance/AccountTallyTab.jsx";
import { formatMonth } from "../../utils/formatDate.js";
import "../../styles/SecretaryLayout.css";
import "../../styles/Maintenance.css";

// ── Close Month Modal ─────────────────────────────────────────────────────────

function CloseMonthModal({ month, stats, onClose, onConfirm, closing }) {
  const [notes, setNotes] = useState("");
  const ml = formatMonth(month);

  return (
    <div className="maint-modal-overlay" onClick={onClose}>
      <div className="maint-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="maint-modal-header">
          <div>
            <div className="maint-modal-title">Close Month Accounts</div>
            <div className="maint-modal-subtitle">{ml}</div>
          </div>
          <button className="maint-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="maint-modal-body">
          <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
            <strong>What happens when you close:</strong>
            <ul style={{ margin: "8px 0 0 16px", padding: 0, lineHeight: 1.8 }}>
              <li>All <strong>{stats?.pending || 0} Pending</strong> dues will be marked <strong>Overdue</strong></li>
              <li>The month will be <strong>locked</strong> — no more edits to dues</li>
              <li>A closure summary PDF will be available for download</li>
              <li>Arrears carry forward automatically to next month's bills</li>
            </ul>
          </div>
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 13 }}>
              <div style={{ background: "#f0fdf4", padding: "8px 12px", borderRadius: 6 }}>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>₹{Number(stats.collectedAmount || 0).toLocaleString("en-IN")}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Collected ({stats.paid} dues)</div>
              </div>
              <div style={{ background: "#fff7ed", padding: "8px 12px", borderRadius: 6 }}>
                <div style={{ color: "#ea580c", fontWeight: 700 }}>₹{Number(stats.totalAmount - stats.collectedAmount).toLocaleString("en-IN")}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Pending / Overdue ({stats.pending + stats.overdue} dues)</div>
              </div>
            </div>
          )}
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
            Notes (optional)
          </label>
          <textarea
            className="maint-sheet-input"
            style={{ width: "100%", minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
            placeholder="e.g. 'Water pump repair deferred to next month'"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="maint-modal-footer">
          <DefaultButton text="Cancel" onClick={onClose} styles={{ root: { height: 32 } }} />
          <DefaultButton
            text={closing ? "Closing…" : "Close Month"}
            onClick={() => onConfirm(notes)}
            disabled={closing}
            styles={{ root: { height: 32, background: "#dc2626", borderColor: "#dc2626", color: "#fff" } }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Reopen Month Modal ────────────────────────────────────────────────────────

function ReopenMonthModal({ month, onClose, onConfirm, reopening }) {
  const [reason, setReason] = useState("");
  const ml = formatMonth(month);

  return (
    <div className="maint-modal-overlay" onClick={onClose}>
      <div className="maint-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="maint-modal-header">
          <div className="maint-modal-title">Reopen {ml}</div>
          <button className="maint-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="maint-modal-body">
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            Reopening will allow editing dues again. This action is logged for audit purposes.
          </p>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
            Reason for reopening <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <textarea
            className="maint-sheet-input"
            style={{ width: "100%", minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
            placeholder="e.g. 'Payment reference was entered incorrectly'"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="maint-modal-footer">
          <DefaultButton text="Cancel" onClick={onClose} styles={{ root: { height: 32 } }} />
          <DefaultButton
            text={reopening ? "Reopening…" : "Reopen Month"}
            onClick={() => onConfirm(reason)}
            disabled={reopening || !reason.trim()}
            styles={{ root: { height: 32 } }}
          />
        </div>
      </div>
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

  const [closure,     setClosure]     = useState(null);
  const [showClose,   setShowClose]   = useState(false);
  const [showReopen,  setShowReopen]  = useState(false);
  const [closing,     setClosing]     = useState(false);
  const [reopening,   setReopening]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [toast, showToast] = useShowToast();

  const load = useCallback(async (m = month, sf = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const params = { month: m };
      if (sf !== "ALL") params.status = sf;
      const [data, closureData] = await Promise.all([
        api.secretary.maintenance.list(params),
        api.secretary.maintenance.getClosure(m).catch(() => ({ status: "OPEN" })),
      ]);
      setDues(data.dues   || []);
      setStats(data.stats || null);
      setClosure(closureData);
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

  const handleMonthChange  = (e) => { setMonth(e.target.value);       load(e.target.value, statusFilter); };
  const handleFilterChange = (e) => { setStatusFilter(e.target.value); load(month, e.target.value); };

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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await api.secretary.maintenance.generate(month);
      showToast(
        `Generated ${data.created} dues for ${month}` +
        (data.skipped ? ` (${data.skipped} already existed)` : ""),
      );
      await load(month, statusFilter);
    } catch {
      showToast("Failed to generate dues.");
    } finally {
      setGenerating(false);
    }
  };

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

  const handleCloseMonth = async (notes) => {
    setClosing(true);
    try {
      const data = await api.secretary.maintenance.closeMonth(month, notes);
      setClosure(data.closure);
      setShowClose(false);
      showToast(`${month} accounts closed successfully.`);
      await load(month, statusFilter);
    } catch (err) {
      showToast(err?.data?.message || "Failed to close month.");
    } finally {
      setClosing(false);
    }
  };

  const handleReopenMonth = async (reason) => {
    setReopening(true);
    try {
      const data = await api.secretary.maintenance.reopenMonth(month, reason);
      setClosure(data.closure);
      setShowReopen(false);
      showToast(`${month} reopened.`);
    } catch {
      showToast("Failed to reopen month.");
    } finally {
      setReopening(false);
    }
  };

  const handleDownloadRegister = async () => {
    setDownloading(true);
    try {
      await api.secretary.maintenance.downloadCollectionRegister(month);
    } catch {
      showToast("Failed to download collection register.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadInvoicePdf = useCallback(async (due) => {
    try {
      await api.secretary.maintenance.downloadInvoicePdf(due.id, `${due.unit_number || due.id}-${month}`);
    } catch {
      showToast("Failed to download invoice PDF.");
    }
  }, [month, showToast]);

  const handleUpdate = useCallback(
    (id, payload) => updateDue({ updateFn: api.secretary.maintenance.updateDue, id, payload, setDues, setStats, showToast }),
    [showToast],
  );

  const isOff    = !config.maintenance_enabled;
  const isClosed = closure?.status === "CLOSED";

  return (
    <div className="sec-page">
      <PageHeader title="Maintenance" subtitle="Build monthly invoices, generate dues, and track collections" />

      <ErrorBanner error={error} />

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

      <div className="maint-tabs">
        {[
          { key: "dues",          label: "Dues Collection", icon: "PaymentCard"   },
          { key: "expense-sheet", label: "Expense Sheet",   icon: "Documentation" },
          { key: "tally",         label: "Account Tally",   icon: "BarChart4"     },
        ].map(({ key, label, icon }) => (
          <button key={key} className={`maint-tab${activeTab === key ? " maint-tab--active" : ""}`} onClick={() => setActiveTab(key)}>
            <Icon iconName={icon} style={{ fontSize: 13, marginRight: 6 }} />
            {label}
          </button>
        ))}
      </div>

      {activeTab !== "tally" && (
        <div className="maint-controls">
          <MonthInput value={month} onChange={handleMonthChange} />

          {closure && (
            <span className={`maint-closure-pill ${isClosed ? "maint-closure-pill--closed" : "maint-closure-pill--open"}`}>
              <Icon iconName={isClosed ? "Lock" : "Unlock"} style={{ fontSize: 11, marginRight: 4 }} />
              {isClosed ? "Closed" : "Open"}
            </span>
          )}

          {activeTab === "dues" && (
            <>
              <StatusFilterSelect value={statusFilter} onChange={handleFilterChange} />
              <GenerateDuesButtons
                generating={generating} reminding={reminding} isOff={isOff || isClosed} dues={dues}
                onGenerate={handleGenerate} onRemind={handleRemind}
                generateTitle={
                  isClosed ? "Month is closed — reopen to generate more dues" :
                  isOff    ? "Enable maintenance collection first" :
                  "Create dues for all residents (includes expense sheet breakdown if saved)"
                }
              />
              <DefaultButton
                iconProps={{ iconName: "ExcelDocument" }}
                text={downloading ? "Downloading…" : "Register PDF"}
                onClick={handleDownloadRegister}
                disabled={downloading || dues.length === 0}
                title="Download collection register as PDF"
                styles={{ root: { height: 32, fontSize: 12 } }}
              />
              {isClosed ? (
                <DefaultButton iconProps={{ iconName: "Unlock" }} text="Reopen Month"
                  onClick={() => setShowReopen(true)} styles={{ root: { height: 32, fontSize: 12 } }} />
              ) : (
                <DefaultButton iconProps={{ iconName: "Lock" }} text="Close Month"
                  onClick={() => setShowClose(true)} disabled={dues.length === 0}
                  title={dues.length === 0 ? "Generate dues before closing the month" : "Formally close the accounts for this month"}
                  styles={{ root: { height: 32, fontSize: 12, borderColor: "#dc2626", color: "#dc2626" } }}
                />
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "dues" && isClosed && (
        <div className="maint-closed-banner">
          <Icon iconName="Lock" style={{ fontSize: 14, marginRight: 8 }} />
          Accounts for <strong>{formatMonth(month)}</strong> are closed. Dues cannot be edited.{" "}
          <button className="maint-closed-banner__reopen" onClick={() => setShowReopen(true)}>
            Reopen to make changes
          </button>
          {closure?.status === "CLOSED" && (
            <button className="maint-closed-banner__pdf"
              onClick={() => api.secretary.maintenance.downloadClosurePdf(month).catch(() => showToast("Failed to download."))}>
              <Icon iconName="PDF" style={{ fontSize: 11, marginRight: 4 }} />
              Download Closure PDF
            </button>
          )}
        </div>
      )}

      {activeTab === "dues" && (
        <>
          <StatsGrid stats={stats} />
          <DuesTable
            loading={loading} dues={dues}
            emptyMsg={isOff
              ? "Maintenance collection is currently disabled."
              : `No dues for ${month}. Build an expense sheet, then click "Generate Dues".`}
            onUpdate={handleUpdate}
            onDownloadPdf={handleDownloadInvoicePdf}
          />
        </>
      )}

      {activeTab === "expense-sheet" && <ExpenseSheetTab month={month} showToast={showToast} />}
      {activeTab === "tally"         && <AccountTallyTab showToast={showToast} />}

      {showClose && (
        <CloseMonthModal month={month} stats={stats} onClose={() => setShowClose(false)}
          onConfirm={handleCloseMonth} closing={closing} />
      )}
      {showReopen && (
        <ReopenMonthModal month={month} onClose={() => setShowReopen(false)}
          onConfirm={handleReopenMonth} reopening={reopening} />
      )}

      <Toast msg={toast} />
    </div>
  );
}
