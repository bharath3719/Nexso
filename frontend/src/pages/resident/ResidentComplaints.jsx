import React, { useCallback, useEffect, useState } from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatDateShort, formatDateTime } from "../../utils/formatDate.js";
import "../../styles/ResidentLayout.css";

const CATEGORIES = [
  "Plumbing", "Electrical", "Lift / Elevator", "Housekeeping",
  "Security", "Carpentry", "Common Area", "Other",
];

const STATUS_LABELS = {
  OPEN: "Open", ASSIGNED: "Assigned", IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved", CLOSED: "Closed",
};

const STATUS_STEPS = [
  { key: "OPEN",        label: "Raised"      },
  { key: "ASSIGNED",    label: "Assigned"    },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED",    label: "Resolved"    },
  { key: "CLOSED",      label: "Closed"      },
];

function StatusPill({ status }) {
  return (
    <span className={`res-tag res-tag--${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function actorLabel(role) {
  if (role === "NEXSO_ADMIN")   return "Admin";
  if (role === "SOCIETY_ADMIN") return "Secretary";
  if (role === "VENDOR")        return "Vendor";
  return "System";
}

// ── Status step progress bar ──────────────────────────────────────────────────

function StatusStepper({ currentStatus }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <div className="res-stepper">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const current = idx === currentIdx;
        const mod = (cls) => `${cls}${done ? ` ${cls}--done` : ""}${current ? ` ${cls}--current` : ""}`;
        return (
          <React.Fragment key={step.key}>
            <div className="res-step">
              <div className={mod("res-step-dot")}>{done && !current ? "✓" : idx + 1}</div>
              <div className={mod("res-step-label")}>{step.label}</div>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`res-step-bar${idx < currentIdx ? " res-step-bar--done" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Status tracking bottom sheet ──────────────────────────────────────────────

function StatusTracker({ complaint, activity, loading, onClose }) {
  const events = complaint ? [
    { label: "Complaint raised", date: complaint.created_at, sub: null },
    ...(activity || []).map((a) => ({
      label: `Moved to ${STATUS_LABELS[a.to_status] || a.to_status}`,
      date:  a.created_at,
      sub:   [actorLabel(a.actor_role), a.note].filter(Boolean).join(" · "),
    })),
  ] : [];

  return (
    <div className="res-sheet-overlay" onClick={onClose}>
      <div className="res-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="res-sheet-header">
          <Text styles={{ root: { fontWeight: 700, fontSize: 15, color: "#1e293b" } }}>Track Status</Text>
          <button className="res-sheet-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <Spinner label="Loading…" />
        ) : complaint ? (
          <>
            <div className="res-sheet-category">{complaint.category}</div>
            <div className="res-sheet-ticket">{complaint.ticket_id}</div>

            <StatusStepper currentStatus={complaint.status} />

            {complaint.vendor_name && (
              <div className="res-sheet-vendor">
                Assigned to: <strong>{complaint.vendor_name}</strong>
              </div>
            )}

            <div className="res-timeline">
              <div className="res-timeline-heading">Activity</div>
              {events.map((ev, i) => {
                const isLast = i === events.length - 1;
                return (
                  <div className="res-timeline-row" key={i}>
                    <div className="res-timeline-rail">
                      <div className={`res-timeline-dot${isLast ? " res-timeline-dot--latest" : ""}`} />
                      {!isLast && <div className="res-timeline-line" />}
                    </div>
                    <div className="res-timeline-body">
                      <div className="res-timeline-label">{ev.label}</div>
                      {ev.sub && <div className="res-timeline-sub">{ev.sub}</div>}
                      <div className="res-timeline-date">{formatDateTime(ev.date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="res-sheet-error">Could not load complaint details.</div>
        )}
      </div>
    </div>
  );
}

// ── Complaint card ────────────────────────────────────────────────────────────

function ComplaintCard({ complaint, onTrack }) {
  const isUrgent = complaint.priority === "URGENT";
  return (
    <div className="res-complaint-card">
      <div className="res-complaint-top">
        <div className="res-complaint-titlerow">
          <span className="res-complaint-title">{complaint.category}</span>
          {isUrgent && <span className="res-tag res-tag--urgent">Urgent</span>}
        </div>
        <StatusPill status={complaint.status} />
      </div>

      <p className="res-complaint-desc">{complaint.description}</p>

      <div className="res-complaint-meta">
        <span className="res-complaint-ticket">{complaint.ticket_id}</span>
        <span className="res-complaint-date">{formatDateShort(complaint.created_at)}</span>
      </div>

      {complaint.vendor_name && (
        <div className="res-complaint-vendor">
          Assigned to: <strong>{complaint.vendor_name}</strong>
        </div>
      )}

      <div className="res-complaint-footer">
        <DefaultButton
          text="Track Status"
          iconProps={{ iconName: "Timeline" }}
          onClick={() => onTrack(complaint.id)}
          styles={{ root: { fontSize: 12, height: 28, padding: "0 12px" } }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULT_FORM = { category: CATEGORIES[0], description: "", priority: "NORMAL" };

export function ResidentComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [tracking, setTracking] = useState(null); // { complaint, activity } | null
  const [trackLoading, setTrackLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.resident.complaints.list()
      .then((d) => setComplaints(d.complaints || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load complaints.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleTrack(id) {
    setTracking({ complaint: null, activity: [] });
    setTrackLoading(true);
    try {
      const d = await api.resident.complaints.get(id);
      setTracking({ complaint: d.complaint, activity: d.activity || [] });
    } catch {
      setTracking({ complaint: null, activity: [] });
    } finally {
      setTrackLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.description.trim()) { setFormError("Please describe the issue."); return; }

    setSubmitting(true);
    try {
      await api.resident.complaints.create(form);
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(getErrMsg(err, "Failed to raise complaint."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="res-page">
      <PageHeader
        title="My Complaints"
        subtitle="Track and raise maintenance complaints"
        action={
          <PrimaryButton
            text={showForm ? "Cancel" : "+ Raise Complaint"}
            onClick={() => { setShowForm((v) => !v); setFormError(""); setForm(DEFAULT_FORM); }}
          />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {showForm && (
        <div className="res-card">
          <div className="res-card-header">
            <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
              Raise a Complaint
            </Text>
          </div>
          <form onSubmit={handleSubmit} className="res-form">
            <ErrorBanner message={formError} />

            <div>
              <label className="res-field-label">Category *</label>
              <select
                className="res-select"
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                disabled={submitting}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <TextField
              label="Description *"
              multiline
              rows={4}
              value={form.description}
              onChange={(_, v) => setForm((s) => ({ ...s, description: v || "" }))}
              placeholder="Describe the issue in detail…"
              disabled={submitting}
            />

            <div>
              <label className="res-field-label">Priority</label>
              <div className="res-priority-row">
                {["NORMAL", "URGENT"].map((p) => {
                  const active = form.priority === p;
                  const activeMod = active ? (p === "URGENT" ? " res-priority-btn--urgent" : " res-priority-btn--normal") : "";
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`res-priority-btn${activeMod}`}
                      onClick={() => setForm((s) => ({ ...s, priority: p }))}
                      disabled={submitting}
                    >
                      {p === "URGENT" ? "Urgent" : "Normal"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="res-form-actions-end">
              <DefaultButton
                text="Cancel"
                onClick={() => { setShowForm(false); setFormError(""); }}
                disabled={submitting}
              />
              <PrimaryButton
                type="submit"
                text={submitting ? "Submitting…" : "Submit Complaint"}
                disabled={submitting}
              />
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading complaints…" />
      ) : complaints.length === 0 && !showForm ? (
        <div className="res-card">
          <div className="res-empty">No complaints yet. Use the button above to raise one.</div>
        </div>
      ) : (
        <div className="res-complaint-list">
          {complaints.map((c) => (
            <ComplaintCard key={c.id} complaint={c} onTrack={handleTrack} />
          ))}
        </div>
      )}

      {tracking !== null && (
        <StatusTracker
          complaint={tracking.complaint}
          activity={tracking.activity}
          loading={trackLoading}
          onClose={() => setTracking(null)}
        />
      )}
    </div>
  );
}
