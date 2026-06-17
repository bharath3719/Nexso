/**
 * Maintenance.jsx (Admin portal)
 * ────────────────────────────────
 * Admin view: cross-society maintenance overview.
 *
 * Features:
 *  • Society selector
 *  • Feature toggle + UPI ID per society
 *  • Month selector
 *  • Stats: Total Due | Collected | Pending | Overdue | Waived
 *  • Generate Dues button
 *  • Send Reminders button
 *  • Table: Resident | Unit | Amount | Due Date | Status | Mark as Paid / Waive
 */

import React, { useEffect, useState, useCallback } from "react";
import { Spinner, Dropdown } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import {
  currentMonth, Toast, StatsGrid, DuesTable,
  useShowToast, ErrorBanner, MonthInput, StatusFilterSelect, MaintenanceConfigBar,
  GenerateDuesButtons, updateDue,
} from "../../components/maintenance/MaintenanceShared.jsx";
import "../../styles/Maintenance.css";

// ── Main component ────────────────────────────────────────────────────────────

export function MaintenancePage() {
  const [societies, setSocieties]   = useState([]);
  const [societyId, setSocietyId]   = useState(null);
  const [month,     setMonth]       = useState(currentMonth());
  const [dues,      setDues]        = useState([]);
  const [stats,     setStats]       = useState(null);
  const [socConfig, setSocConfig]   = useState({ maintenance_enabled: true, maintenance_upi_id: "" });
  const [loading,   setLoading]     = useState(false);
  const [loadingSoc, setLoadingSoc] = useState(true);
  const [error,     setError]       = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [upiEdit,   setUpiEdit]     = useState("");
  const [savingCfg, setSavingCfg]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reminding,  setReminding]  = useState(false);

  const [toast, showToast] = useShowToast();

  // ── Load society list ───────────────────────────────────────────────────────

  useEffect(() => {
    async function loadSocs() {
      setLoadingSoc(true);
      try {
        const data = await api.onboarding.list();
        const socs = data.societies || [];
        setSocieties(socs);
        if (socs.length) setSocietyId(socs[0].id);
      } catch { /* ignore */ }
      finally { setLoadingSoc(false); }
    }
    loadSocs();
  }, []);

  // ── Load dues whenever society or month changes ────────────────────────────

  const loadDues = useCallback(async (sid = societyId, m = month, sf = statusFilter) => {
    if (!sid) return;
    setLoading(true);
    setError("");
    try {
      const params = { societyId: sid, month: m };
      if (sf !== "ALL") params.status = sf;
      const data = await api.maintenance.list(params);
      setDues(data.dues   || []);
      setStats(data.stats || null);
    } catch {
      setError("Failed to load maintenance data.");
    } finally {
      setLoading(false);
    }
  }, [societyId, month, statusFilter]);

  // ── Load society config ────────────────────────────────────────────────────

  const loadConfig = useCallback(async (sid = societyId) => {
    if (!sid) return;
    try {
      const data = await api.maintenance.getSociety(sid);
      if (data.society) {
        setSocConfig(data.society);
        setUpiEdit(data.society.maintenance_upi_id || "");
      }
    } catch { /* ignore */ }
  }, [societyId]);

  useEffect(() => {
    if (societyId) {
      loadDues();
      loadConfig();
    }
  }, [societyId, loadDues, loadConfig]);

  // ── Society selector ───────────────────────────────────────────────────────

  const societyOptions = societies.map((s) => ({ key: s.id, text: s.name }));

  const handleSocietyChange = (_, opt) => {
    setSocietyId(opt.key);
    setDues([]);
    setStats(null);
  };

  const handleMonthChange = (e) => {
    setMonth(e.target.value);
    loadDues(societyId, e.target.value, statusFilter);
  };

  const handleFilterChange = (e) => {
    setStatusFilter(e.target.value);
    loadDues(societyId, month, e.target.value);
  };

  // ── Feature toggle ─────────────────────────────────────────────────────────

  const toggleFeature = async (_, checked) => {
    if (!societyId) return;
    setSavingCfg(true);
    try {
      const data = await api.maintenance.patchSociety(societyId, { maintenance_enabled: checked });
      setSocConfig((c) => ({ ...c, maintenance_enabled: data.society.maintenance_enabled }));
      showToast(checked ? "Maintenance enabled." : "Maintenance disabled.");
    } catch {
      showToast("Failed to update.");
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Save UPI ID ────────────────────────────────────────────────────────────

  const saveUpi = async () => {
    if (!societyId) return;
    setSavingCfg(true);
    try {
      const data = await api.maintenance.patchSociety(societyId, { maintenance_upi_id: upiEdit.trim() || null });
      setSocConfig((c) => ({ ...c, maintenance_upi_id: data.society.maintenance_upi_id }));
      showToast("UPI ID saved.");
    } catch {
      showToast("Failed to save UPI ID.");
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Generate dues ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!societyId) return;
    setGenerating(true);
    try {
      const data = await api.maintenance.generate(societyId, month);
      showToast(`Generated ${data.created} dues for ${month}${data.skipped ? ` (${data.skipped} already existed)` : ""}.`);
      await loadDues();
    } catch {
      showToast("Failed to generate dues.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Send reminders ─────────────────────────────────────────────────────────

  const handleRemind = async () => {
    if (!societyId) return;
    setReminding(true);
    try {
      const data = await api.maintenance.sendReminders(societyId, month);
      if (data.total === 0) {
        showToast("No reminders due yet (dues must be within 7 days of due date).");
      } else {
        showToast(`Sent ${data.sent} WhatsApp reminders${data.failed ? ` (${data.failed} failed)` : ""}.`);
      }
      await loadDues();
    } catch {
      showToast("Failed to send reminders.");
    } finally {
      setReminding(false);
    }
  };

  // ── Update a due ───────────────────────────────────────────────────────────

  const handleUpdate = useCallback(
    (id, payload) => updateDue({ updateFn: api.maintenance.updateDue, id, payload, setDues, setStats, showToast }),
    [showToast],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const isOff = !socConfig.maintenance_enabled;

  if (loadingSoc) {
    return <div style={{ padding: 40 }}><Spinner label="Loading societies…" /></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 0 32px" }}>
      <PageHeader
        title="Maintenance"
        subtitle="Collect and track monthly maintenance across societies"
      />

      <ErrorBanner error={error} />

      {/* ── Society selector ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Dropdown
          label="Society"
          selectedKey={societyId}
          options={societyOptions}
          onChange={handleSocietyChange}
          styles={{ root: { minWidth: 280 } }}
          placeholder="Select a society…"
        />
      </div>

      {societyId && (
        <>
          {/* ── Config bar ─────────────────────────────────────────────── */}
          <MaintenanceConfigBar
            enabled={socConfig.maintenance_enabled}
            isOff={isOff}
            offText="Currently OFF for this society."
            onText="Currently ON — residents will be reminded and dues tracked."
            savingCfg={savingCfg}
            upiEdit={upiEdit}
            onToggle={toggleFeature}
            onUpiChange={setUpiEdit}
            onSaveUpi={saveUpi}
          />

          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="maint-controls">
            <MonthInput value={month} onChange={handleMonthChange} />
            <StatusFilterSelect value={statusFilter} onChange={handleFilterChange} />
            <GenerateDuesButtons
              generating={generating}
              reminding={reminding}
              isOff={isOff}
              dues={dues}
              onGenerate={handleGenerate}
              onRemind={handleRemind}
            />
          </div>

          {/* ── Stats ──────────────────────────────────────────────────── */}
          <StatsGrid stats={stats} />

          {/* ── Table ──────────────────────────────────────────────────── */}
          <DuesTable
            loading={loading}
            dues={dues}
            emptyMsg={isOff
              ? "Maintenance collection is disabled for this society."
              : `No dues found for ${month}. Click "Generate Dues" to create records for this month.`}
            onUpdate={handleUpdate}
          />
        </>
      )}

      <Toast msg={toast} />
    </div>
  );
}
