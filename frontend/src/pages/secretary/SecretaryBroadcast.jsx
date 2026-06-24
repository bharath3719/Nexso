import React, { useState, useEffect, useRef } from "react";
import { Text, Spinner, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatDateTime } from "../../utils/formatDate.js";
import "../../styles/SecretaryLayout.css";

// ── Emergency templates ───────────────────────────────────────────────────────

const EMERGENCY_TEMPLATES = [
  {
    key: "water_cut", icon: "💧", label: "Water Cut", title: "Water Cut Notice",
    message: "Notice: Water supply will be interrupted today for maintenance work. Please store water in advance. Supply will be restored as soon as possible.\n\n— Society Secretary",
  },
  {
    key: "power_outage", icon: "⚡", label: "Power Outage", title: "Power Outage Notice",
    message: "Notice: Power supply will be interrupted today for maintenance. Generator backup will cover common areas and lifts.\n\n— Society Secretary",
  },
  {
    key: "fire_drill", icon: "🔥", label: "Fire Drill", title: "Fire Drill Today",
    message: "Reminder: A fire drill is scheduled for today. Please cooperate with all evacuation procedures and follow security staff instructions.\n\n— Society Secretary",
  },
  {
    key: "security", icon: "🚨", label: "Security Alert", title: "Security Alert",
    message: "ALERT: Please be vigilant. Lock all doors and windows and report any suspicious activity to the security desk immediately.\n\n— Society Secretary",
  },
  {
    key: "lift", icon: "🛗", label: "Lift Down", title: "Lift Under Maintenance",
    message: "Notice: The lift is currently under maintenance and is not in service. We apologise for the inconvenience.\n\n— Society Secretary",
  },
  {
    key: "custom", icon: "📢", label: "Custom", title: "Emergency Notice", message: "",
  },
];

const TARGET_OPTIONS = [
  { key: "ALL",     label: "All Residents",  rowLabel: "All residents" },
  { key: "OVERDUE", label: "Overdue Payers", rowLabel: "Overdue payers" },
  { key: "TOWER",   label: "By Tower",       rowLabel: "By tower" },
];

const TARGET_ROW_LABELS = Object.fromEntries(TARGET_OPTIONS.map((o) => [o.key, o.rowLabel]));

// ── Broadcast history card ────────────────────────────────────────────────────

function HistoryRow({ b }) {
  const targetLabel = TARGET_ROW_LABELS[b.target_type] || b.target_type;

  return (
    <div className="sec-bc-row">
      <div className={`sec-bc-row-icon${b.is_emergency ? " sec-bc-row-icon--emergency" : ""}`}>
        {b.is_emergency ? "🚨" : "📢"}
      </div>
      <div className="sec-bc-row-main">
        <div className="sec-bc-row-meta">
          {b.is_emergency && <span className="sec-bc-tag-emergency">EMERGENCY</span>}
          <span className="sec-bc-row-target">{targetLabel}</span>
          <span className="sec-bc-row-date">·</span>
          <span className="sec-bc-row-date">{formatDateTime(b.created_at)}</span>
        </div>
        <p className="sec-bc-row-msg">{b.message}</p>
      </div>
      <div className="sec-bc-row-stats">
        <div className="sec-bc-row-count">{b.sent_count}</div>
        <div className="sec-bc-row-sub">sent / {b.recipient_count}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SecretaryBroadcast() {
  // Emergency state
  const [emergencyTemplate, setEmergencyTemplate] = useState(null);
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const [emergencySending, setEmergencySending] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);
  const [emergencyError, setEmergencyError] = useState("");

  // Broadcast state
  const [broadcastTarget, setBroadcastTarget] = useState("ALL");
  const [towers, setTowers] = useState([]);
  const [selectedTower, setSelectedTower] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastError, setBroadcastError] = useState("");

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const previewTimer = useRef(null);

  // Load towers + history on mount
  useEffect(() => {
    api.secretary.towers()
      .then((d) => setTowers(d.towers || []))
      .catch(() => {});

    loadHistory();
  }, []);

  function loadHistory() {
    setHistoryLoading(true);
    api.secretary.broadcasts()
      .then((d) => setHistory(d.broadcasts || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }

  // Debounced preview fetch whenever target or tower changes
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (broadcastTarget === "TOWER" && !selectedTower) {
      setPreviewCount(null);
      return;
    }
    setPreviewCount(null);
    setPreviewLoading(true);
    previewTimer.current = setTimeout(() => {
      api.secretary.broadcastPreview(broadcastTarget, selectedTower || undefined)
        .then((d) => setPreviewCount(d.count))
        .catch(() => setPreviewCount(null))
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(previewTimer.current);
  }, [broadcastTarget, selectedTower]);

  // ── Emergency handlers ──────────────────────────────────────────────────────

  function handlePickTemplate(tpl) {
    setEmergencyTemplate(tpl.key);
    setEmergencyMsg(tpl.message);
    setEmergencyResult(null);
    setEmergencyError("");
  }

  async function handleEmergencySend() {
    if (!emergencyMsg.trim()) { setEmergencyError("Message cannot be empty."); return; }
    const tpl = EMERGENCY_TEMPLATES.find((t) => t.key === emergencyTemplate);
    const title = tpl?.title || "Emergency Notice";
    if (!window.confirm("Send emergency alert to all residents?\n\nThis will send a WhatsApp message AND pin an urgent notice in the resident portal.")) return;

    setEmergencySending(true);
    setEmergencyError("");
    setEmergencyResult(null);
    try {
      const d = await api.secretary.emergencyAlert({ message: emergencyMsg.trim(), title });
      setEmergencyResult(d);
      setEmergencyTemplate(null);
      setEmergencyMsg("");
      loadHistory();
    } catch (err) {
      setEmergencyError(getErrMsg(err, "Failed to send emergency alert."));
    } finally {
      setEmergencySending(false);
    }
  }

  // ── Broadcast handlers ──────────────────────────────────────────────────────

  async function handleBroadcastSend() {
    if (!broadcastMsg.trim()) { setBroadcastError("Message cannot be empty."); return; }
    if (broadcastTarget === "TOWER" && !selectedTower) { setBroadcastError("Please select a tower."); return; }
    const recipientLabel = previewCount !== null ? `${previewCount} residents` : "residents";
    if (!window.confirm(`Send this message to ${recipientLabel}?`)) return;

    setBroadcastSending(true);
    setBroadcastError("");
    setBroadcastResult(null);
    try {
      const d = await api.secretary.broadcast({
        message: broadcastMsg.trim(),
        target: broadcastTarget,
        tower_id: broadcastTarget === "TOWER" ? selectedTower : undefined,
      });
      setBroadcastResult(d);
      setBroadcastMsg("");
      loadHistory();
    } catch (err) {
      setBroadcastError(getErrMsg(err, "Failed to send broadcast."));
    } finally {
      setBroadcastSending(false);
    }
  }

  return (
    <div className="sec-page sec-page--narrow">
      <PageHeader title="Broadcast & Alerts" subtitle="Send WhatsApp messages to residents" />

      {/* ── Emergency Alert ─────────────────────────────────────────────────── */}
      <div className="sec-bc-emergency">
        <div className="sec-bc-head sec-bc-head--emergency">
          <span className="sec-bc-head-icon">🚨</span>
          <div>
            <div className="sec-bc-head-title sec-bc-head-title--inverse">Emergency Alert</div>
            <div className="sec-bc-head-sub sec-bc-head-sub--inverse">
              Sends WhatsApp to all residents immediately + pins an urgent notice in the portal
            </div>
          </div>
        </div>

        <div className="sec-bc-body">
          {/* Template picker */}
          <div>
            <div className="sec-bc-label">Select template</div>
            <div className="sec-bc-pills">
              {EMERGENCY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  className={`sec-bc-pill${emergencyTemplate === tpl.key ? " sec-bc-pill--active-danger" : ""}`}
                  onClick={() => handlePickTemplate(tpl)}
                >
                  {tpl.icon} {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message editor — only shows after template pick */}
          {emergencyTemplate !== null && (
            <>
              <div>
                <label className="sec-bc-field-label">Message (edit before sending)</label>
                <textarea
                  className="sec-bc-textarea sec-bc-textarea--danger"
                  value={emergencyMsg}
                  onChange={(e) => setEmergencyMsg(e.target.value)}
                  rows={5}
                  disabled={emergencySending}
                />
              </div>

              <ErrorBanner message={emergencyError} />

              {emergencyResult && (
                <div className="sec-bc-result">
                  ✓ Alert sent to {emergencyResult.sent} of {emergencyResult.total} residents. Pinned announcement created.
                </div>
              )}

              <div className="sec-bc-actions">
                <button
                  className="sec-bc-send-emergency"
                  onClick={handleEmergencySend}
                  disabled={emergencySending || !emergencyMsg.trim()}
                >
                  {emergencySending ? "Sending…" : "🚨 Send Emergency Alert"}
                </button>
                <DefaultButton
                  text="Cancel"
                  onClick={() => { setEmergencyTemplate(null); setEmergencyMsg(""); setEmergencyError(""); }}
                  disabled={emergencySending}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Broadcast Message ───────────────────────────────────────────────── */}
      <div className="sec-card">
        <div className="sec-bc-head sec-bc-head--plain">
          <span className="sec-bc-head-icon">📢</span>
          <div>
            <div className="sec-bc-head-title">Broadcast Message</div>
            <div className="sec-bc-head-sub">Send a WhatsApp message to a group of residents</div>
          </div>
        </div>

        <div className="sec-bc-body">
          {/* Target selector */}
          <div>
            <div className="sec-bc-label">Send to</div>
            <div className="sec-bc-pills">
              {TARGET_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`sec-bc-pill${broadcastTarget === opt.key ? " sec-bc-pill--active-primary" : ""}`}
                  onClick={() => { setBroadcastTarget(opt.key); setBroadcastResult(null); setBroadcastError(""); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {broadcastTarget === "TOWER" && (
              <div className="sec-bc-select-wrap">
                <select className="sec-bc-select" value={selectedTower} onChange={(e) => setSelectedTower(e.target.value)}>
                  <option value="">Select a tower…</option>
                  {towers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview count */}
            <div className="sec-bc-preview">
              {previewLoading ? (
                <span className="sec-bc-preview-loading">Counting recipients…</span>
              ) : previewCount !== null ? (
                <span className="sec-bc-preview-count">
                  {previewCount} resident{previewCount !== 1 ? "s" : ""} will receive this message
                </span>
              ) : null}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="sec-bc-field-label">Message</label>
            <textarea
              className="sec-bc-textarea"
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              rows={5}
              placeholder="Type your message here…"
              disabled={broadcastSending}
            />
            <div className="sec-bc-charcount">{broadcastMsg.length} chars</div>
          </div>

          <ErrorBanner message={broadcastError} />

          {broadcastResult && (
            <div className="sec-bc-result">
              ✓ Message sent to {broadcastResult.sent} of {broadcastResult.total} residents.
            </div>
          )}

          <div>
            <PrimaryButton
              text={broadcastSending ? "Sending…" : `Send to ${previewCount !== null ? previewCount : "…"} Residents`}
              iconProps={{ iconName: "Send" }}
              disabled={broadcastSending || !broadcastMsg.trim() || (broadcastTarget === "TOWER" && !selectedTower)}
              onClick={handleBroadcastSend}
            />
          </div>
        </div>
      </div>

      {/* ── Broadcast History ───────────────────────────────────────────────── */}
      <div className="sec-card">
        <div className="sec-card-header">
          <Text styles={{ root: { fontWeight: 600, fontSize: 14, color: "#1e293b" } }}>Broadcast History</Text>
        </div>

        {historyLoading ? (
          <div className="sec-spinner-center"><Spinner label="Loading history…" /></div>
        ) : history.length === 0 ? (
          <div className="sec-empty">No broadcasts sent yet.</div>
        ) : (
          <div>
            {history.map((b) => <HistoryRow key={b.id} b={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}
