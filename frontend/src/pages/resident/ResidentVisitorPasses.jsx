import React, { useState } from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import "../../styles/ResidentLayout.css";

const STATUS_STYLES = {
  ACTIVE:  { bg: "#dcfce7", color: "#166534", label: "Active" },
  USED:    { bg: "#f1f5f9", color: "#475569", label: "Used"   },
  EXPIRED: { bg: "#f1f5f9", color: "#94a3b8", label: "Expired"},
  REVOKED: { bg: "#fee2e2", color: "#991b1b", label: "Revoked"},
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.EXPIRED;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 8px", background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function ShareMenu({ pass, onClose }) {
  const passUrl   = `${window.location.origin}/pass/${pass.pass_code}`;
  const validFrom = new Date(pass.valid_from).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  const validUntil = new Date(pass.valid_until).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
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

  const shareNative = () => {
    if (!navigator.share) return;
    navigator.share({ title: "Visitor Pass", text: message, url: passUrl }).catch(() => {});
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const shareGmail = () => {
    const subject = encodeURIComponent("Your Visitor Pass");
    const body    = encodeURIComponent(message);
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, "_blank");
  };

  const shareMail = () => {
    const subject = encodeURIComponent("Your Visitor Pass");
    const body    = encodeURIComponent(message);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: "20px 20px 32px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text styles={{ root: { fontWeight: 700, fontSize: 15, color: "#1e293b" } }}>Share Visitor Pass</Text>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
        </div>

        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "monospace", fontSize: 13, color: "#334155", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{passUrl}</span>
          <button
            onClick={copyLink}
            style={{ background: copied ? "#dcfce7" : "#e2e8f0", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: copied ? "#15803d" : "#334155", whiteSpace: "nowrap" }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <button onClick={shareWhatsApp} style={shareBtn("#25D366", "#fff")}>
            <span style={{ fontSize: 20 }}>💬</span> WhatsApp
          </button>
          <button onClick={shareGmail} style={shareBtn("#EA4335", "#fff")}>
            <span style={{ fontSize: 20 }}>✉️</span> Gmail
          </button>
          <button onClick={shareMail} style={shareBtn("#f1f5f9", "#1e293b")}>
            <span style={{ fontSize: 20 }}>📧</span> Email app
          </button>
          {navigator.share && (
            <button onClick={shareNative} style={shareBtn("#0ea5e9", "#fff")}>
              <span style={{ fontSize: 20 }}>↗</span> More options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function shareBtn(bg, color) {
  return {
    display: "flex", alignItems: "center", gap: 8,
    background: bg, color, border: "none", borderRadius: 10,
    padding: "12px 16px", cursor: "pointer", fontWeight: 600, fontSize: 14,
  };
}

function PassCard({ pass, onRevoke }) {
  const [showShare, setShowShare] = useState(false);
  const isActive = pass.status === "ACTIVE";
  return (
    <>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
        padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{pass.visitor_name}</div>
          <StatusPill status={pass.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, fontSize: 13, color: "#475569" }}>
          {pass.visitor_phone && <span>📱 {pass.visitor_phone}</span>}
          {pass.purpose       && <span>📝 {pass.purpose}</span>}
          {pass.vehicle       && <span>🚗 {pass.vehicle}</span>}
          <span>📅 {fmtDate(pass.valid_from)} – {fmtDate(pass.valid_until)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 12px", color: "#334155", fontWeight: 600 }}>
            {pass.pass_code}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isActive && (
              <DefaultButton
                text="Share Pass"
                iconProps={{ iconName: "Share" }}
                onClick={() => setShowShare(true)}
                styles={{ root: { fontSize: 12, height: 28, padding: "0 12px" } }}
              />
            )}
            {isActive && (
              <DefaultButton
                text="Revoke"
                onClick={() => onRevoke(pass.id)}
                styles={{ root: { borderColor: "#fca5a5", color: "#dc2626", fontSize: 12, height: 28, padding: "0 12px" } }}
              />
            )}
          </div>
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
  const [passes,      setPasses]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(DEFAULT_FORM);
  const [formError,   setFormError]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  function load() {
    setLoading(true);
    api.resident.visitorPasses.list()
      .then((d) => setPasses(d.passes || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load passes.")))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => { load(); }, []);

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
        valid_from:  new Date(form.valid_from).toISOString(),
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

  const now   = new Date();
  const today = now.toISOString().slice(0, 16);

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
          <form onSubmit={handleCreate} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <ErrorBanner message={formError} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {field("visitor_name",  "Visitor Name *", { required: true })}
              {field("visitor_phone", "Visitor Phone")}
              {field("purpose",       "Purpose of Visit")}
              {field("vehicle",       "Vehicle Number")}
              {field("valid_from",    "Valid From *", { type: "datetime-local", min: today, required: true })}
              {field("valid_until",   "Valid Until *", { type: "datetime-local", min: form.valid_from || today, required: true })}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {passes.map((p) => (
            <PassCard key={p.id} pass={p} onRevoke={handleRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}
