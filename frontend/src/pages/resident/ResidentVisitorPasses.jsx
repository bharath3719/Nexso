import React from "react";
import { Text, Spinner, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
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

function PassCard({ pass, onRevoke }) {
  const isActive = pass.status === "ACTIVE";
  return (
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
        <span>📅 {new Date(pass.valid_from).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {new Date(pass.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "monospace", fontSize: 13, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 12px", color: "#334155", fontWeight: 600 }}>
          Pass code: {pass.pass_code}
        </div>
        {isActive && (
          <DefaultButton
            text="Revoke"
            onClick={() => onRevoke(pass.id)}
            styles={{ root: { borderColor: "#fca5a5", color: "#dc2626", fontSize: 12, height: 28, padding: "0 12px" } }}
          />
        )}
      </div>
    </div>
  );
}

const DEFAULT_FORM = {
  visitor_name: "", visitor_phone: "", purpose: "", vehicle: "",
  valid_from: "", valid_until: "",
};

export function ResidentVisitorPasses() {
  const [passes,      setPasses]      = React.useState([]);
  const [loading,     setLoading]     = React.useState(true);
  const [error,       setError]       = React.useState("");
  const [showForm,    setShowForm]    = React.useState(false);
  const [form,        setForm]        = React.useState(DEFAULT_FORM);
  const [formError,   setFormError]   = React.useState("");
  const [submitting,  setSubmitting]  = React.useState(false);

  function load() {
    setLoading(true);
    api.resident.visitorPasses.list()
      .then((d) => setPasses(d.passes || []))
      .catch((e) => setError(e.message || "Failed to load passes."))
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
      setFormError(err.message || "Failed to create pass.");
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
      setError(err.message || "Failed to revoke pass.");
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

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="res-card">
          <div className="res-card-header">
            <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
              New Visitor Pass
            </Text>
          </div>
          <form onSubmit={handleCreate} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {formError && (
              <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
                {formError}
              </div>
            )}

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
