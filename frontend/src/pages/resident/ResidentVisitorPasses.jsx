import React, { useCallback, useEffect, useState } from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatDateTime, formatDayMonth } from "../../utils/formatDate.js";
import "../../styles/ResidentLayout.css";

const STATUS_LABELS = {
  ACTIVE: "Active", USED: "Used", EXPIRED: "Expired", REVOKED: "Revoked",
};

function StatusPill({ status }) {
  return (
    <span className={`res-tag res-tag--${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const SHARE_TARGETS = [
  { key: "whatsapp", emoji: "💬", label: "WhatsApp" },
  { key: "gmail",    emoji: "✉️", label: "Gmail" },
  { key: "email",    emoji: "📧", label: "Email app" },
];

function ShareMenu({ pass, onClose }) {
  const passUrl = `${window.location.origin}/pass/${pass.pass_code}`;
  const validFrom = formatDateTime(pass.valid_from);
  const validUntil = formatDateTime(pass.valid_until);
  const [copied, setCopied] = useState(false);

  const message =
    `Hi ${pass.visitor_name}, your visitor pass is ready!\n\n` +
    `🔐 Pass Code: ${pass.pass_code}\n` +
    `📅 Valid: ${validFrom} → ${validUntil}\n` +
    (pass.purpose ? `📝 Purpose: ${pass.purpose}\n` : "") +
    `\nView your pass here:\n${passUrl}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(passUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = (key) => {
    const subject = encodeURIComponent("Your Visitor Pass");
    const body = encodeURIComponent(message);
    if (key === "whatsapp") window.open(`https://wa.me/?text=${body}`, "_blank");
    else if (key === "gmail") window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, "_blank");
    else if (key === "email") window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    else if (key === "more" && navigator.share) navigator.share({ title: "Visitor Pass", text: message, url: passUrl }).catch(() => {});
  };

  return (
    <div className="res-sheet-overlay" onClick={onClose}>
      <div className="res-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="res-sheet-header">
          <Text styles={{ root: { fontWeight: 700, fontSize: 15, color: "#1e293b" } }}>Share Visitor Pass</Text>
          <button className="res-sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="res-share-url">
          <span className="res-share-url-text">{passUrl}</span>
          <button className={`res-share-copy${copied ? " is-copied" : ""}`} onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="res-share-grid">
          {SHARE_TARGETS.map((t) => (
            <button key={t.key} className={`res-share-btn res-share-btn--${t.key}`} onClick={() => share(t.key)}>
              <span className="res-share-btn-emoji">{t.emoji}</span> {t.label}
            </button>
          ))}
          {navigator.share && (
            <button className="res-share-btn res-share-btn--more" onClick={() => share("more")}>
              <span className="res-share-btn-emoji">↗</span> More options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PassCard({ pass, onRevoke }) {
  const [showShare, setShowShare] = useState(false);
  const isActive = pass.status === "ACTIVE";
  return (
    <>
      <div className="res-pass-card">
        <div className="res-pass-head">
          <div className="res-pass-name">{pass.visitor_name}</div>
          <StatusPill status={pass.status} />
        </div>

        <div className="res-pass-meta">
          {pass.visitor_phone && <span>📱 {pass.visitor_phone}</span>}
          {pass.purpose && <span>📝 {pass.purpose}</span>}
          {pass.vehicle && <span>🚗 {pass.vehicle}</span>}
          <span>📅 {formatDayMonth(pass.valid_from)} – {formatDayMonth(pass.valid_until)}</span>
        </div>

        <div className="res-pass-foot">
          <div className="res-pass-code">{pass.pass_code}</div>
          {isActive && (
            <div className="res-pass-actions">
              <DefaultButton
                text="Share Pass"
                iconProps={{ iconName: "Share" }}
                onClick={() => setShowShare(true)}
                styles={{ root: { fontSize: 12, height: 28, padding: "0 12px" } }}
              />
              <DefaultButton
                text="Revoke"
                onClick={() => onRevoke(pass.id)}
                styles={{ root: { borderColor: "#fca5a5", color: "#dc2626", fontSize: 12, height: 28, padding: "0 12px" } }}
              />
            </div>
          )}
        </div>
      </div>
      {showShare && <ShareMenu pass={pass} onClose={() => setShowShare(false)} />}
    </>
  );
}

const DEFAULT_FORM = {
  visitor_name: "", visitor_phone: "", purpose: "", vehicle: "",
  valid_from: "", valid_until: "",
};

export function ResidentVisitorPasses() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.resident.visitorPasses.list()
      .then((d) => setPasses(d.passes || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load passes.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.visitor_name.trim()) { setFormError("Visitor name is required."); return; }
    if (!form.valid_from || !form.valid_until) { setFormError("Validity dates are required."); return; }
    if (new Date(form.valid_until) <= new Date(form.valid_from)) {
      setFormError("End date must be after start date."); return;
    }

    setSubmitting(true);
    try {
      await api.resident.visitorPasses.create({
        ...form,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: new Date(form.valid_until).toISOString(),
      });
      setForm(DEFAULT_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(getErrMsg(err, "Failed to create pass."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id) {
    if (!window.confirm("Revoke this visitor pass?")) return;
    try {
      await api.resident.visitorPasses.revoke(id);
      load();
    } catch (err) {
      setError(getErrMsg(err, "Failed to revoke pass."));
    }
  }

  const field = (key, label, opts = {}) => (
    <TextField
      label={label}
      value={form[key]}
      onChange={(_, v) => setForm((s) => ({ ...s, [key]: v || "" }))}
      disabled={submitting}
      {...opts}
    />
  );

  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="res-page">
      <PageHeader
        title="Visitor Passes"
        subtitle="Create digital passes for your guests"
        action={
          <PrimaryButton
            text={showForm ? "Cancel" : "+ New Pass"}
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          />
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {showForm && (
        <div className="res-card">
          <div className="res-card-header">
            <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
              New Visitor Pass
            </Text>
          </div>
          <form onSubmit={handleCreate} className="res-form">
            <ErrorBanner message={formError} />

            <div className="res-form-grid-2">
              {field("visitor_name", "Visitor Name *", { required: true })}
              {field("visitor_phone", "Visitor Phone")}
              {field("purpose", "Purpose of Visit")}
              {field("vehicle", "Vehicle Number")}
              {field("valid_from", "Valid From *", { type: "datetime-local", min: today, required: true })}
              {field("valid_until", "Valid Until *", { type: "datetime-local", min: form.valid_from || today, required: true })}
            </div>

            <div className="res-form-actions-end">
              <DefaultButton text="Cancel" onClick={() => { setShowForm(false); setFormError(""); }} disabled={submitting} />
              <PrimaryButton type="submit" text="Create Pass" disabled={submitting} />
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading passes…" />
      ) : passes.length === 0 ? (
        <div className="res-card">
          <div className="res-empty">No visitor passes yet. Create one for your next guest.</div>
        </div>
      ) : (
        <div className="res-group">
          {passes.map((p) => (
            <PassCard key={p.id} pass={p} onRevoke={handleRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}
