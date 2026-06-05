import React from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton, Checkbox, Dropdown } from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
import { api } from "../../services/api.js";
import "../../styles/SecretaryLayout.css";

const CATEGORY_OPTIONS = [
  { key: "GENERAL",     text: "General"     },
  { key: "MAINTENANCE", text: "Maintenance" },
  { key: "NOTICE",      text: "Notice"      },
  { key: "EVENT",       text: "Event"       },
  { key: "EMERGENCY",   text: "Emergency"   },
];

const PRIORITY_OPTIONS = [
  { key: "NORMAL", text: "Normal" },
  { key: "URGENT", text: "Urgent" },
];

const STATUS_COLORS = {
  URGENT:  { bg: "#fee2e2", color: "#991b1b" },
  NORMAL:  { bg: "#f1f5f9", color: "#475569" },
};

const DEFAULT_FORM = { title: "", body: "", category: "GENERAL", priority: "NORMAL", pinned: false };

function AnnouncementRow({ ann, onDelete }) {
  const pc = STATUS_COLORS[ann.priority] || STATUS_COLORS.NORMAL;
  return (
    <tr>
      <td style={{ padding: "12px 16px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
          {ann.pinned && <span style={{ marginRight: 6 }}>📌</span>}
          {ann.title}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
          {new Date(ann.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#475569", maxWidth: 360, whiteSpace: "pre-wrap" }}>{ann.body}</p>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 4, padding: "2px 8px", background: pc.bg, color: pc.color }}>
          {ann.priority}
        </span>
      </td>
      <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>{ann.category}</td>
      <td style={{ padding: "12px 16px" }}>
        <DefaultButton
          text="Delete"
          onClick={() => onDelete(ann.id)}
          styles={{ root: { fontSize: 12, height: 28, padding: "0 10px", borderColor: "#fca5a5", color: "#dc2626" } }}
        />
      </td>
    </tr>
  );
}

export function SecretaryAnnouncements() {
  const [announcements, setAnnouncements] = React.useState([]);
  const [loading,       setLoading]       = React.useState(true);
  const [error,         setError]         = React.useState("");
  const [showForm,      setShowForm]      = React.useState(false);
  const [form,          setForm]          = React.useState(DEFAULT_FORM);
  const [formError,     setFormError]     = React.useState("");
  const [submitting,    setSubmitting]    = React.useState(false);

  function load() {
    setLoading(true);
    api.announcements.list()
      .then((d) => setAnnouncements(d.announcements || []))
      .catch((e) => setError(e.message || "Failed to load announcements."))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.body.trim())  { setFormError("Message body is required."); return; }

    setSubmitting(true);
    try {
      await api.announcements.create(form);
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.message || "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this announcement? Residents will no longer see it.")) return;
    try {
      await api.announcements.delete(id);
      load();
    } catch (err) {
      setError(err.message || "Failed to delete announcement.");
    }
  }

  return (
    <div className="sec-page">
      <PageHeader
        title="Announcements"
        subtitle="Publish notices and updates to all residents"
        action={
          <PrimaryButton
            text={showForm ? "Cancel" : "+ New Announcement"}
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          />
        }
      />

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="sec-card">
          <div className="sec-card-header">
            <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
              New Announcement
            </Text>
          </div>
          <form onSubmit={handleCreate} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {formError && (
              <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <TextField
              label="Title *"
              value={form.title}
              onChange={(_, v) => setForm((s) => ({ ...s, title: v || "" }))}
              disabled={submitting}
              required
            />
            <TextField
              label="Message *"
              value={form.body}
              onChange={(_, v) => setForm((s) => ({ ...s, body: v || "" }))}
              multiline
              rows={4}
              disabled={submitting}
              required
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Dropdown
                label="Category"
                options={CATEGORY_OPTIONS}
                selectedKey={form.category}
                onChange={(_, opt) => setForm((s) => ({ ...s, category: opt.key }))}
                disabled={submitting}
              />
              <Dropdown
                label="Priority"
                options={PRIORITY_OPTIONS}
                selectedKey={form.priority}
                onChange={(_, opt) => setForm((s) => ({ ...s, priority: opt.key }))}
                disabled={submitting}
              />
            </div>

            <Checkbox
              label="Pin this announcement (shows at top for residents)"
              checked={form.pinned}
              onChange={(_, v) => setForm((s) => ({ ...s, pinned: !!v }))}
              disabled={submitting}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <DefaultButton text="Cancel" onClick={() => { setShowForm(false); setFormError(""); }} disabled={submitting} />
              <PrimaryButton type="submit" text="Publish" disabled={submitting} />
            </div>
          </form>
        </div>
      )}

      <div className="sec-card">
        <div className="sec-card-header">
          <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
            Published Announcements
          </Text>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{announcements.length} total</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}><Spinner label="Loading…" /></div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No announcements yet. Publish one above.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Title", "Message", "Priority", "Category", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {announcements.map((a, i) => (
                <AnnouncementRow
                  key={a.id}
                  ann={a}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
