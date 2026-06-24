import React, { useState, useEffect } from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatDateShort } from "../../utils/formatDate.js";
import "../../styles/SecretaryLayout.css";

function isOpen(poll) {
  return !poll.closes_at || new Date(poll.closes_at) > new Date();
}

function ResultsSheet({ pollId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.secretary.polls.results(pollId)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [pollId]);

  const total = data?.options?.reduce((s, o) => s + o.votes, 0) || 0;

  return (
    <div className="sec-sheet-overlay" onClick={onClose}>
      <div className="sec-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sec-sheet-header">
          <Text styles={{ root: { fontWeight: 700, fontSize: 15, color: "#1e293b" } }}>Poll Results</Text>
          <button className="sec-sheet-close" onClick={onClose}>✕</button>
        </div>

        {loading ? <Spinner label="Loading…" /> : !data ? (
          <div className="sec-sheet-error">Could not load results.</div>
        ) : (
          <>
            <div className="sec-poll-results-q">{data.poll?.question}</div>
            <div className="sec-poll-results-sub">{total} total vote{total !== 1 ? "s" : ""}</div>
            <div className="sec-poll-results-list">
              {(data.options || []).map((opt) => {
                const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                return (
                  <div key={opt.index}>
                    <div className="sec-poll-result-top">
                      <span className="sec-poll-result-label">{opt.label}</span>
                      <span className="sec-poll-result-val">{opt.votes} ({pct}%)</span>
                    </div>
                    <div className="sec-poll-bar">
                      <div className="sec-poll-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PollCard({ poll, onDelete, deleting, onViewResults }) {
  const open = isOpen(poll);
  const votes = Number(poll.total_votes) || 0;
  return (
    <div className="sec-poll-card">
      <div className="sec-poll-top">
        <div className="sec-poll-top-main">
          <div className="sec-poll-titlerow">
            <span className="sec-poll-q">{poll.question}</span>
            <span className={`sec-poll-badge sec-poll-badge--${open ? "open" : "closed"}`}>
              {open ? "Open" : "Closed"}
            </span>
          </div>
          <div className="sec-poll-meta">
            {poll.closes_at ? `Closes ${formatDateShort(poll.closes_at)}` : "No closing date"}
            {" · "}{votes} vote{votes !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="sec-poll-delete" onClick={() => onDelete(poll.id)} disabled={deleting === poll.id}>
          {deleting === poll.id ? "…" : "Delete"}
        </button>
      </div>

      <div className="sec-poll-chips">
        {(poll.options || []).map((opt, i) => (
          <span key={i} className="sec-poll-chip">{opt}</span>
        ))}
      </div>

      <div>
        <DefaultButton
          text="View Results"
          iconProps={{ iconName: "BarChartVertical" }}
          onClick={() => onViewResults(poll.id)}
          styles={{ root: { fontSize: 12, height: 28, padding: "0 12px" } }}
        />
      </div>
    </div>
  );
}

const DEFAULT_FORM = { question: "", closes_at: "", options: ["", ""] };

export function SecretaryPolls() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [resultsId, setResultsId] = useState(null);

  function load() {
    setLoading(true);
    api.secretary.polls.list()
      .then((d) => setPolls(d.polls || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load polls.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function setOption(i, val) {
    setForm((s) => ({ ...s, options: s.options.map((o, idx) => idx === i ? val : o) }));
  }

  function addOption() {
    if (form.options.length >= 6) return;
    setForm((s) => ({ ...s, options: [...s.options, ""] }));
  }

  function removeOption(i) {
    if (form.options.length <= 2) return;
    setForm((s) => ({ ...s, options: s.options.filter((_, idx) => idx !== i) }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.question.trim()) { setFormError("Question is required."); return; }
    const cleanOpts = form.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) { setFormError("At least 2 non-empty options are required."); return; }

    setSaving(true);
    try {
      await api.secretary.polls.create({ question: form.question.trim(), options: cleanOpts, closes_at: form.closes_at || null });
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(getErrMsg(err, "Failed to create poll."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this poll and all its votes?")) return;
    setDeleting(id);
    try {
      await api.secretary.polls.delete(id);
      load();
    } catch (err) {
      setError(getErrMsg(err, "Failed to delete poll."));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="sec-page">
      <PageHeader
        title="Polls"
        subtitle="Create polls and collect resident opinions"
        action={
          <PrimaryButton
            text={showForm ? "Cancel" : "+ New Poll"}
            onClick={() => { setShowForm((v) => !v); setFormError(""); setForm(DEFAULT_FORM); }}
          />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {showForm && (
        <div className="sec-card">
          <div className="sec-card-header sec-card-header--tinted">
            <Text styles={{ root: { fontWeight: 600, fontSize: 14, color: "#1e293b" } }}>New Poll</Text>
          </div>
          <form onSubmit={handleCreate} className="sec-form-body">
            <ErrorBanner message={formError} />

            <TextField
              label="Question *"
              value={form.question}
              onChange={(_, v) => setForm((s) => ({ ...s, question: v || "" }))}
              placeholder="e.g. Which colour should we paint the lobby?"
              disabled={saving}
            />

            <div>
              <div className="sec-poll-field-label">Options *</div>
              <div className="sec-poll-opt-rows">
                {form.options.map((opt, i) => (
                  <div key={i} className="sec-poll-opt-row">
                    <TextField
                      value={opt}
                      onChange={(_, v) => setOption(i, v || "")}
                      placeholder={`Option ${i + 1}`}
                      disabled={saving}
                      styles={{ root: { flex: 1 } }}
                    />
                    {form.options.length > 2 && (
                      <button type="button" className="sec-poll-opt-remove" onClick={() => removeOption(i)}>×</button>
                    )}
                  </div>
                ))}
                {form.options.length < 6 && (
                  <button type="button" className="sec-poll-add-opt" onClick={addOption}>+ Add option</button>
                )}
              </div>
            </div>

            <TextField
              label="Closing Date (optional)"
              type="datetime-local"
              value={form.closes_at}
              onChange={(_, v) => setForm((s) => ({ ...s, closes_at: v || "" }))}
              disabled={saving}
            />

            <div className="sec-form-actions">
              <DefaultButton text="Cancel" onClick={() => { setShowForm(false); setFormError(""); }} disabled={saving} />
              <PrimaryButton type="submit" text={saving ? "Saving…" : "Create Poll"} disabled={saving} />
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading polls…" />
      ) : polls.length === 0 && !showForm ? (
        <div className="sec-card">
          <div className="sec-empty">No polls yet. Create one to collect resident feedback.</div>
        </div>
      ) : (
        <div className="sec-poll-list">
          {polls.map((p) => (
            <PollCard key={p.id} poll={p} onDelete={handleDelete} deleting={deleting} onViewResults={setResultsId} />
          ))}
        </div>
      )}

      {resultsId !== null && (
        <ResultsSheet pollId={resultsId} onClose={() => setResultsId(null)} />
      )}
    </div>
  );
}
