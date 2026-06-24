import React, { useState, useEffect } from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";

function fmtEventDate(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function isPast(iso) {
  return new Date(iso) < new Date();
}

function RsvpBadge({ label, count, color }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 4, padding: "2px 8px", background: color + "22", color }}>
      {label} {count}
    </span>
  );
}

function EventCard({ event, onDelete, deleting }) {
  const past = isPast(event.event_date);
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10,
      opacity: past ? 0.75 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{event.title}</div>
          <div style={{ fontSize: 13, color: "#2563eb", marginTop: 2, fontWeight: 500 }}>
            {fmtEventDate(event.event_date)}
            {past && <span style={{ marginLeft: 8, fontSize: 11, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Past</span>}
          </div>
          {event.location && <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>📍 {event.location}</div>}
        </div>
        <button
          onClick={() => onDelete(event.id)}
          disabled={deleting === event.id}
          style={{
            background: "none", border: "1px solid #fecaca", borderRadius: 6,
            color: "#dc2626", fontSize: 12, fontWeight: 600, padding: "4px 10px",
            cursor: deleting === event.id ? "not-allowed" : "pointer", flexShrink: 0,
          }}
        >
          {deleting === event.id ? "…" : "Delete"}
        </button>
      </div>

      {event.description && (
        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{event.description}</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <RsvpBadge label="Going" count={event.rsvp_yes   || 0} color="#16a34a" />
        <RsvpBadge label="Not going" count={event.rsvp_no    || 0} color="#dc2626" />
        <RsvpBadge label="Maybe" count={event.rsvp_maybe || 0} color="#d97706" />
      </div>
    </div>
  );
}

const DEFAULT_FORM = { title: "", description: "", event_date: "", location: "" };

export function SecretaryEvents() {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  function load() {
    setLoading(true);
    api.secretary.events.list()
      .then((d) => setEvents(d.events || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load events.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim())      { setFormError("Title is required.");      return; }
    if (!form.event_date)        { setFormError("Event date is required."); return; }

    setSaving(true);
    try {
      await api.secretary.events.create(form);
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(getErrMsg(err, "Failed to create event."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event? RSVPs will also be removed.")) return;
    setDeleting(id);
    try {
      await api.secretary.events.delete(id);
      load();
    } catch (err) {
      setError(getErrMsg(err, "Failed to delete event."));
    } finally {
      setDeleting(null);
    }
  }

  const field = (key, label, opts = {}) => (
    <TextField
      label={label}
      value={form[key]}
      onChange={(_, v) => setForm((s) => ({ ...s, [key]: v || "" }))}
      disabled={saving}
      {...opts}
    />
  );

  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Events"
        subtitle="Create and manage society events"
        action={
          <PrimaryButton
            text={showForm ? "Cancel" : "+ New Event"}
            onClick={() => { setShowForm((v) => !v); setFormError(""); setForm(DEFAULT_FORM); }}
          />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <Text styles={{ root: { fontWeight: 600, fontSize: 14, color: "#1e293b" } }}>New Event</Text>
          </div>
          <form onSubmit={handleCreate} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <ErrorBanner message={formError} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {field("title", "Title *", { required: true })}
              {field("location", "Location")}
              {field("event_date", "Date & Time *", { type: "datetime-local", min: minDate, required: true })}
            </div>
            {field("description", "Description", { multiline: true, rows: 3 })}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <DefaultButton text="Cancel" onClick={() => { setShowForm(false); setFormError(""); }} disabled={saving} />
              <PrimaryButton type="submit" text={saving ? "Saving…" : "Create Event"} disabled={saving} />
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading events…" />
      ) : events.length === 0 && !showForm ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
          No events yet. Create one for your residents.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </div>
  );
}
