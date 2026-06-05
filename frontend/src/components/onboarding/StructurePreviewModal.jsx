import React, { useState } from "react";
import { Icon } from "@fluentui/react";
import "../../styles/onboardingModals.css";

// Tower colours cycled by index — [accent, tint-bg]
const TOWER_COLORS = [
  ["#3b82f6", "#eff6ff"],
  ["#8b5cf6", "#f5f3ff"],
  ["#10b981", "#ecfdf5"],
  ["#f59e0b", "#fffbeb"],
  ["#ef4444", "#fef2f2"],
  ["#06b6d4", "#ecfeff"],
];

const STATS_CONFIG = [
  { label: "Total Units", icon: "Home"                    },
  { label: "Assigned",    icon: "Accept"                  },
  { label: "Remaining",   icon: null /* resolved below */ },
  { label: "Towers",      icon: "BuildingEnterpriseCheck" },
];

// ─── StructurePreviewModal ────────────────────────────────────────────────────
// Read-only grid of all towers, floors, and units showing resident assignment
// coverage. Clicking an empty unit fires onUnitClick(towerIdx, floorIdx, unit)
// to open AddResidentModal pre-filled.

export function StructurePreviewModal({ towers, residents, onClose, onUnitClick }) {
  // Key by "towerIdx:unit_number" so the same unit in different towers stays separate
  const assignedUnits  = new Set(residents.map((r) => `${r.tower_idx}:${r.unit_number}`));
  const residentByUnit = {};
  residents.forEach((r) => { residentByUnit[`${r.tower_idx}:${r.unit_number}`] = r; });

  const totalUnits = towers.reduce((s, t) => s + t.floors.reduce((fs, f) => fs + f.units.length, 0), 0);

  // Count distinct *units* that have at least one resident — not residents.
  // Iterating the structure (not the residents array) avoids double-counting
  // units that have multiple residents (e.g. owner + tenant on the same unit).
  const filledUnits = towers.reduce(
    (sum, tower, ti) =>
      sum +
      tower.floors.reduce(
        (fsum, floor) =>
          fsum + floor.units.filter((u) => assignedUnits.has(`${ti}:${u}`)).length,
        0,
      ),
    0,
  );

  const remaining = totalUnits - filledUnits;

  const [expandedTowers, setExpandedTowers] = useState(() => towers.map(() => true));
  const toggleTower = (i) => setExpandedTowers((p) => p.map((v, idx) => (idx === i ? !v : v)));

  const coveragePct = totalUnits > 0 ? Math.round((filledUnits / totalUnits) * 100) : 0;

  // Build stat rows dynamically so colours/icons stay co-located with data
  const stats = [
    { ...STATS_CONFIG[0], value: totalUnits,    color: "#3b82f6" },
    { ...STATS_CONFIG[1], value: filledUnits,   color: "#10b981" },
    { label: "Remaining", value: remaining,
      color: remaining > 0 ? "#f59e0b" : "#10b981",
      icon:  remaining > 0 ? "Warning" : "Accept" },
    { ...STATS_CONFIG[3], value: towers.length, color: "#8b5cf6" },
  ];

  return (
    <div className="spm-overlay">
      <div className="spm-container">

        {/* Header */}
        <div className="spm-header">
          <div className="spm-header-inner">
            <div className="spm-icon-wrap">
              <Icon iconName="View" styles={{ root: { color: "#93c5fd", fontSize: 20 } }} />
            </div>
            <div>
              <div className="spm-title">Structure Overview</div>
              <div className="spm-subtitle">
                {towers.length} tower{towers.length !== 1 ? "s" : ""} · {totalUnits} units total
              </div>
            </div>
          </div>
          <button onClick={onClose} className="ob-close-btn">×</button>
        </div>

        {/* Stats bar */}
        <div className="spm-stats-bar">
          {stats.map((s, i) => (
            <div key={s.label} className={`spm-stat-cell${i === stats.length - 1 ? " spm-stat-cell--last" : ""}`}>
              <div className="spm-stat-top">
                <Icon iconName={s.icon} styles={{ root: { fontSize: 13, color: s.color } }} />
                {/* color is dynamic (per-stat accent) */}
                <span className="spm-stat-value" style={{ color: s.color }}>{s.value}</span>
              </div>
              <div className="spm-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="spm-progress-section">
          <div className="spm-progress-header">
            <span className="spm-progress-label">Resident Coverage</span>
            <span className="spm-progress-pct">{coveragePct}%</span>
          </div>
          <div className="spm-progress-track">
            {/* width is dynamic (runtime percentage) */}
            <div className="spm-progress-fill" style={{ width: `${coveragePct}%` }} />
          </div>
        </div>

        {/* Tower list */}
        <div className="spm-tower-list">
          {towers.length === 0 ? (
            <div className="spm-empty">No towers defined yet.</div>
          ) : (
            towers.map((tower, ti) => {
              const [tColor, tBg] = TOWER_COLORS[ti % TOWER_COLORS.length];
              const towerUnits    = tower.floors.flatMap((f) => f.units);
              const towerFilled   = towerUnits.filter((u) => assignedUnits.has(`${ti}:${u}`)).length;
              const towerTotal    = towerUnits.length;
              const isOpen        = expandedTowers[ti];
              const towerCoverage = towerTotal > 0 ? (towerFilled / towerTotal) * 100 : 0;

              return (
                <div key={ti} className="spm-tower-card">
                  {/* Tower header — background tint is dynamic per tower */}
                  <button
                    onClick={() => toggleTower(ti)}
                    className="spm-tower-header-btn"
                    style={{ background: tBg }}
                  >
                    <div className="spm-tower-header-left">
                      {/* background colour is dynamic per tower */}
                      <div className="spm-tower-avatar" style={{ background: tColor }}>
                        {tower.name.charAt(tower.name.length - 1)}
                      </div>
                      <div className="spm-tower-info">
                        <div className="spm-tower-name">{tower.name}</div>
                        <div className="spm-tower-meta">
                          {tower.floors.length} floor{tower.floors.length !== 1 ? "s" : ""} · {towerTotal} units
                        </div>
                      </div>
                    </div>
                    <div className="spm-tower-header-right">
                      <div className="spm-tower-stats">
                        {/* color is dynamic per tower */}
                        <span className="spm-tower-filled-count" style={{ color: tColor }}>
                          {towerFilled}/{towerTotal}
                        </span>
                        <div className="spm-tower-mini-track">
                          {/* background and width are dynamic per tower */}
                          <div
                            className="spm-tower-mini-fill"
                            style={{ background: tColor, width: `${towerCoverage}%` }}
                          />
                        </div>
                      </div>
                      <Icon
                        iconName={isOpen ? "ChevronUp" : "ChevronDown"}
                        styles={{ root: { color: "#94a3b8", fontSize: 12 } }}
                      />
                    </div>
                  </button>

                  {/* Floors */}
                  {isOpen && (
                    <div className="spm-floors-body">
                      {tower.floors.map((floor, fi) => {
                        const floorFilled = floor.units.filter((u) => assignedUnits.has(`${ti}:${u}`)).length;
                        return (
                          <div key={fi} className="spm-floor-item">
                            {/* Floor label row */}
                            <div className="spm-floor-label-row">
                              <div className="spm-floor-label-chip">FLOOR {floor.floor_number}</div>
                              <div className="spm-floor-assigned">
                                {floorFilled}/{floor.units.length} assigned
                              </div>
                              <div className="spm-floor-divider" />
                            </div>

                            {/* Unit chips — CSS :hover handles the empty-unit hover state */}
                            <div className="spm-units-row">
                              {floor.units.length === 0 ? (
                                <span className="spm-no-units">No units</span>
                              ) : (
                                floor.units.map((u, ui) => {
                                  const filled = assignedUnits.has(`${ti}:${u}`);
                                  const res    = residentByUnit[`${ti}:${u}`];
                                  return (
                                    <div
                                      key={ui}
                                      onClick={() => !filled && onUnitClick?.(ti, fi, u)}
                                      title={filled ? `${res?.name} · ${res?.phone}` : "Click to assign resident"}
                                      className={`spm-unit-chip${filled ? " spm-unit-chip--filled" : ""}`}
                                    >
                                      {filled ? (
                                        <>
                                          <span className="spm-unit-dot-filled">●</span>
                                          <span>{u}</span>
                                          <span className="spm-unit-check-filled">✓</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="spm-unit-dot-empty">○</span>
                                          <span>{u}</span>
                                          <span className="spm-unit-plus-empty">+</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="spm-modal-footer-split">
          <div className="spm-footer-text">
            {remaining > 0 ? (
              <><span className="spm-footer-remaining">{remaining} units</span> still need residents</>
            ) : (
              <span className="spm-footer-complete">✓ All units have residents assigned</span>
            )}
          </div>
          <button onClick={onClose} className="arm-cancel-btn">Close</button>
        </div>
      </div>
    </div>
  );
}
