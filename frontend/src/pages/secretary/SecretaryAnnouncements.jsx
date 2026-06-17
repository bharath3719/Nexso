import React, { useState, useCallback, useEffect } from "react";
import {
  Text, Spinner, TextField, PrimaryButton, DefaultButton, Checkbox, Dropdown,
  Dialog, DialogType, DialogFooter,
} from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import { cardTones, ANNOUNCEMENT_PRIORITY_COLORS } from "../../styles/cssConstants.js";
import { ANNOUNCEMENT_CATEGORY_OPTIONS, ANNOUNCEMENT_PRIORITY_OPTIONS } from "../../constants.js";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import "../../styles/SecretaryLayout.css";

const makeEmptyForm = () => ({ title: "", body: "", category: "GENERAL", priority: "NORMAL", pinned: false });

// Fluent UI styles props — not expressible as plain CSS classes
const deleteButtonStyles = {
  root: { fontSize: 12, height: 28, padding: "0 10px", borderColor: "#fca5a5", color: cardTones.OPEN.accent },
};
const dangerButtonStyles = {
  root: { background: cardTones.OPEN.accent, borderColor: cardTones.OPEN.accent },
};

function AnnouncementRow({ ann, onDelete }) {
  const pc = ANNOUNCEMENT_PRIORITY_COLORS[ann.priority] ?? ANNOUNCEMENT_PRIORITY_COLORS.NORMAL;
  return (
    <tr>
      <td>
        <div className="sec-td--primary">
          {ann.pinned && <span style={{ marginRight: 6 }}>📌</span>}
          {ann.title}
        </div>
        <div className="sec-ann-date sec-td--caption">
          {new Date(ann.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </td>
      <td>
        <p className="sec-ann-body">{ann.body}</p>
      </td>
      <td>
        <span className="sec-badge" style={{ background: pc.bg, color: pc.color }}>{ann.priority}</span>
      </td>
      <td className="sec-td--caption">{ann.category}</td>
      <td>
        <DefaultButton text="Delete" onClick={() => onDelete(ann)} styles={deleteButtonStyles} />
      </td>
    </tr>
  );
}

export function SecretaryAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState(makeEmptyForm);
  const [formError,     setFormError]     = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null); // full announcement obj

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api.announcements.list();
      setAnnouncements(d.announcements || []);
    } catch (e) {
      setError(getErrMsg(e, "Failed to load announcements."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    setForm(makeEmptyForm());
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(makeEmptyForm());
    setFormError("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.body.trim())  { setFormError("Message body is required."); return; }

    setSubmitting(true);
    try {
      const data = await api.announcements.create(form);
      setAnnouncements((prev) => [data.announcement, ...prev]);
      closeForm();
    } catch (err) {
      setFormError(err.message || "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.announcements.delete(deleteTarget.id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrMsg(err, "Failed to delete announcement."));
    }
  };

  return (
    <div className="sec-page">
      <PageHeader
        title="Announcements"
        subtitle="Publish notices and updates to all residents"
        action={
          showForm
            ? <DefaultButton text="Cancel" onClick={closeForm} />
            : <PrimaryButton text="+ New Announcement" onClick={openForm} />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {showForm && (
        <div className="sec-card">
          <div className="sec-card-header">
            <Text styles={T.sectionHeader}>New Announcement</Text>
          </div>
          <form onSubmit={handleCreate} className="sec-form-body">
            {formError && <div className="sec-form-error-banner">{formError}</div>}

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
            <div className="sec-form-grid-2">
              <Dropdown
                label="Category"
                options={ANNOUNCEMENT_CATEGORY_OPTIONS}
                selectedKey={form.category}
                onChange={(_, opt) => setForm((s) => ({ ...s, category: opt.key }))}
                disabled={submitting}
              />
              <Dropdown
                label="Priority"
                options={ANNOUNCEMENT_PRIORITY_OPTIONS}
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
            <div className="sec-form-actions">
              <DefaultButton text="Cancel" onClick={closeForm} disabled={submitting} />
              <PrimaryButton type="submit" text="Publish" disabled={submitting} />
            </div>
          </form>
        </div>
      )}

      <div className="sec-card">
        <div className="sec-card-header">
          <Text styles={T.sectionHeader}>Published Announcements</Text>
          <span className="sec-td--caption">{announcements.length} total</span>
        </div>

        {loading ? (
          <div className="sec-spinner-center"><Spinner label="Loading…" /></div>
        ) : announcements.length === 0 ? (
          <div className="sec-empty">No announcements yet. Publish one above.</div>
        ) : (
          <div className="sec-table-scroll">
            <table className="sec-table sec-table--loose">
              <thead>
                <tr>
                  {["Title", "Message", "Priority", "Category", ""].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <AnnouncementRow key={a.id} ann={a} onDelete={setDeleteTarget} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <Dialog
        hidden={!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        dialogContentProps={{
          type:    DialogType.normal,
          title:   "Delete Announcement",
          subText: `Delete "${deleteTarget?.title || "this announcement"}"? Residents will no longer see it.`,
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton text="Delete" onClick={handleDelete} styles={dangerButtonStyles} />
          <DefaultButton text="Cancel" onClick={() => setDeleteTarget(null)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
}
