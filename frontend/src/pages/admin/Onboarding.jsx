import React, { useEffect, useState, useCallback } from "react";
import {
  Stack, Text, PrimaryButton, DefaultButton,
  Spinner, SpinnerSize, MessageBar, MessageBarType,
  Icon, ProgressIndicator,
} from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import { SOCIETY_TYPE_LABELS } from "../../constants.js";
import { SOCIETY_TYPE_COLORS } from "../../styles/cssConstants.js";
import "../../styles/Onboarding.css";

// ─── Constants ─────────────────────────────────────────────────────────────────
const STEP_LABELS = ["Building Details", "Unit Structure", "Residents"];

// ─── StepBadge ─────────────────────────────────────────────────────────────────
// Dynamic: color changes per step → kept inline only where needed.
// ProgressIndicator Fluent style slots can't go in plain CSS, so a minimal
// styles object is composed here.
function StepBadge({ step }) {
  const pct   = ((step - 1) / 2) * 100;
  const color = step === 3 ? "#16a34a" : step === 2 ? "#2563eb" : "#94a3b8";
  const label = step === 3 ? "Complete"  : step === 2 ? "Units Added" : "Basic Info";

  const progressStyles = {
    progressBar:  { background: color, borderRadius: 4 },
    progressTrack: { background: "#e2e8f0", borderRadius: 4 },
    root:         { padding: 0 },
    itemProgress: { padding: 0 },
  };

  return (
    <Stack tokens={{ childrenGap: 4 }}>
      <Stack horizontal horizontalAlign="space-between">
        <Text variant="xSmall" className="ob-step-progress-label">
          Onboarding Progress
        </Text>
        <Text variant="xSmall" style={{ color, fontWeight: 600 }}>
          {label}
        </Text>
      </Stack>

      <ProgressIndicator
        percentComplete={pct / 100}
        barHeight={6}
        styles={progressStyles}
      />

      <Stack horizontal tokens={{ childrenGap: 8 }}>
        {[1, 2, 3].map((s) => (
          <Text
            key={s}
            variant="xSmall"
            style={{ color: s <= step ? color : "#cbd5e1", fontWeight: s === step ? 600 : 400 }}
          >
            {STEP_LABELS[s - 1]}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}

// ─── SocietyCard ───────────────────────────────────────────────────────────────
// Converted from Fluent Stack+selectors to a plain <article> so :hover lives in CSS.
function SocietyCard({ society, onContinue, onView }) {
  const typeColors = SOCIETY_TYPE_COLORS[society.society_type] || SOCIETY_TYPE_COLORS.APARTMENT;
  const typeLabel  = SOCIETY_TYPE_LABELS[society.society_type] || society.society_type;

  return (
    <article
      className="ob-society-card"
      role="button"
      tabIndex={0}
      onClick={() => onView(society)}
      onKeyDown={(e) => { if (e.key === "Enter") onView(society); }}
    >
      {/* Card header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="start">
        <Stack tokens={{ childrenGap: 4 }}>
          <span className="ob-building-id">{society.building_id || "—"}</span>
          <div className="ob-society-name">{society.name}</div>
        </Stack>
        <span
          className="ob-type-badge"
          style={{ background: typeColors.bg, color: typeColors.text, border: `1px solid ${typeColors.border}` }}
        >
          {typeLabel}
        </span>
      </Stack>

      {/* Address */}
      {society.address && (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
          <Icon iconName="Location" className="ob-meta-icon" />
          <span className="ob-meta-text">{society.address}</span>
        </Stack>
      )}

      {/* Stats bar */}
      <div className="ob-stats-bar">
        {[
          { icon: "BuildingEnterpriseCheck", label: "Towers",    value: society.num_towers    ?? "—" },
          { icon: "GridViewSmall",                   label: "Units",     value: society.unit_count    ?? 0   },
          { icon: "People",                  label: "Residents", value: society.resident_count ?? 0  },
        ].map((stat) => (
          <div key={stat.label} className="ob-stat-cell">
            <span className="ob-stat-value">{stat.value}</span>
            <Text styles={T.caption}>{stat.label}</Text>
          </div>
        ))}
      </div>

      {/* Contact */}
      {society.contact_person && (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
          <Icon iconName="Contact" className="ob-meta-icon" />
          <span className="ob-meta-text">
            {society.contact_person}
            {society.contact_phone ? ` · ${society.contact_phone}` : ""}
          </span>
        </Stack>
      )}

      {/* Progress indicator */}
      <StepBadge step={society.onboarding_step || 1} />

      {/* Actions */}
      <Stack horizontal tokens={{ childrenGap: 8 }} className="ob-card-actions">
        {(society.onboarding_step || 1) < 3 ? (
          <PrimaryButton
            text="Continue Setup"
            iconProps={{ iconName: "ChevronRight" }}
            styles={{ root: { borderRadius: 8, height: 36, fontSize: 14, padding: "0 16px" }, label: { fontWeight: 700 } }}
            onClick={(e) => { e.stopPropagation(); onContinue(society); }}
          />
        ) : (
          <DefaultButton
            text="Details"
            iconProps={{ iconName: "OpenInNewWindow" }}
            styles={{ root: { borderRadius: 8, height: 36, fontSize: 14 } }}
            onClick={(e) => { e.stopPropagation(); onView(society); }}
          />
        )}
      </Stack>
    </article>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
// border-top color and icon tint are dynamic (per-card accent) → stay inline.
function StatCard({ icon, value, label, color = "#3b82f6" }) {
  return (
    <div className="ob-stat-card-outer">
      <div
        className="ob-stat-card"
        style={{ borderTop: `4px solid ${color}` }}
      >
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }} styles={{ root: { width: "100%" } }}>
          <div className="ob-stat-icon-wrap" style={{ background: color + "18" }}>
            <Icon iconName={icon} styles={{ root: { color, fontSize: 20 } }} />
          </div>
          <Stack tokens={{ childrenGap: 4 }} styles={{ root: { minWidth: 0 } }}>
            <span className="ob-stat-kpi">{value}</span>
            <span className="ob-stat-caption" style={T.caption.root}>{label}</span>
          </Stack>
        </Stack>
      </div>
    </div>
  );
}

// ─── OnboardingPage ────────────────────────────────────────────────────────────
export function OnboardingPage() {
  const navigate = useNavigate();
  const [societies, setSocieties] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchSocieties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.onboarding.list();
      setSocieties(data.societies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSocieties(); }, [fetchSocieties]);

  const totalUnits = societies.reduce((s, x) => s + Number(x.unit_count || 0), 0);
  const incomplete = societies.filter((x) => (x.onboarding_step || 1) < 3).length;
  const complete   = societies.filter((x) => (x.onboarding_step || 1) >= 3).length;

  const handleContinue = (society) =>
    navigate(`/onboarding/new?societyId=${society.id}&step=${(society.onboarding_step || 1) + 1}`);

  const handleView = (society) => navigate(`/onboarding/${society.id}`);

  return (
    <Stack tokens={{ childrenGap: 24 }}>
      <PageHeader
        title="Building Onboarding"
        subtitle="Register and manage residential & commercial societies"
        action={
          <PrimaryButton
            text="Add Society"
            iconProps={{ iconName: "Add" }}
            onClick={() => navigate("/onboarding/new")}
            styles={{ root: { borderRadius: 8, height: 38 }, label: { fontWeight: 600 } }}
          />
        }
      />

      {/* Stats row */}
      <Stack horizontal wrap tokens={{ childrenGap: 12 }} className="ob-stats-row">
        <StatCard icon="CityNext"  value={societies.length} label="Total Societies"  color="#3b82f6" />
        <StatCard icon="Home"      value={totalUnits}        label="Total Units"      color="#8b5cf6" />
        <StatCard icon="Warning"   value={incomplete}        label="Incomplete Setup" color="#f59e0b" />
        <StatCard icon="CheckMark" value={complete}          label="Fully Onboarded"  color="#10b981" />
      </Stack>

      {/* Error */}
      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)} isMultiline={false}>
          {error}
          <span className="ob-retry-link" onClick={fetchSocieties}>Retry</span>
        </MessageBar>
      )}

      {/* Content */}
      {loading ? (
        <div className="ob-loading">
          <Spinner size={SpinnerSize.large} label="Loading societies…" />
        </div>
      ) : societies.length === 0 ? (
        <div className="ob-empty">
          <div className="ob-empty-icon">
            <Icon iconName="CityNext2" styles={{ root: { fontSize: 40, color: "#3b82f6" } }} />
          </div>
          <div className="ob-empty-copy">
            <Text styles={T.pageHeader}>No societies yet</Text>
            <Text variant="medium" className="ob-empty-subtitle">
              Start by adding your first society or building. The setup wizard will guide you
              through building details, unit structure, and resident import.
            </Text>
          </div>
          <PrimaryButton
            text="Add Your First Society"
            iconProps={{ iconName: "Add" }}
            onClick={() => navigate("/onboarding/new")}
            styles={{ root: { borderRadius: 8, height: 40, padding: "0 24px", marginTop: 8 }, label: { fontWeight: 700 } }}
          />
        </div>
      ) : (
        <div className="ob-cards-grid">
          {societies.map((s) => (
            <SocietyCard key={s.id} society={s} onContinue={handleContinue} onView={handleView} />
          ))}
        </div>
      )}
    </Stack>
  );
}
