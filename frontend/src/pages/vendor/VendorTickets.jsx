/**
 * VendorTickets.jsx
 * ──────────────────
 * Full ticket list for the vendor portal.
 * - Filter by status
 * - Click any row to open a detail slide-in panel
 * - Panel shows: ticket info, society, unit/floor, resident WhatsApp (tap-to-chat)
 * - Status action buttons: "Start Work" (ASSIGNED→IN_PROGRESS), "Mark Resolved" (IN_PROGRESS→RESOLVED)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dropdown, Spinner, Text } from "@fluentui/react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader.jsx";
import { StatusBadge, STATUS_COLORS, PRIORITY_COLORS, TicketTableHeader } from "../../components/TicketShared.jsx";
import { api } from "../../services/api.js";
import "../../styles/VendorLayout.css";

// ── Options ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { key: "ALL",         text: "All Statuses"  },
  { key: "ASSIGNED",    text: "Assigned (New)" },
  { key: "IN_PROGRESS", text: "In Progress"   },
  { key: "RESOLVED",    text: "Resolved"      },
  { key: "CLOSED",      text: "Closed"        },
];

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailRow({ label, children }) {
  return (
    <div className="vnd-detail-row">
      <span className="vnd-detail-label">{label}</span>
      <span className="vnd-detail-value">{children}</span>
    </div>
  );
}

function TicketDetailPanel({ ticket, onClose, onStatusUpdated }) {
  const [updating, setUpdating] = useState(false);
  const [error,    setError]    = useState("");

  const nextAction = {
    ASSIGNED:    { label: "▶  Start Work",    className: "vnd-btn--primary" },
    IN_PROGRESS: { label: "✓  Mark Resolved", className: "vnd-btn--success" },
  }[ticket.status];

  async function handleAction() {
    setUpdating(true);
    setError("");
    try {
      const data = await api.vendorPortal.updateStatus(ticket.id);
      onStatusUpdated(data.ticket);
    } catch (err) {
      setError(err.message || "Failed to update ticket status.");
    } finally {
      setUpdating(false);
    }
  }

  // Build location string
  const location = [ticket.tower_name, ticket.floor_number != null ? `Floor ${ticket.floor_number}` : null, ticket.unit_number]
    .filter(Boolean)
    .join(" · ");
  const locationFallback = ticket.resident_apartment || "—";

  // WhatsApp link
  const wa = ticket.resident_whatsapp
    ? ticket.resident_whatsapp.replace(/\D/g, "")
    : null;

  return (
    <div className="vnd-panel-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="vnd-panel">
        {/* Header */}
        <div className="vnd-panel-header">
          <div>
            <Text styles={{ root: { fontSize: 16, fontWeight: 700, color: "#1e293b" } }}>
              {ticket.ticket_id || `#${ticket.id}`}
            </Text>
            <div style={{ marginTop: 4 }}>
              <StatusBadge status={ticket.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="vnd-btn vnd-btn--ghost"
            style={{ padding: "6px 10px" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="vnd-panel-body">
          {/* Ticket info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <DetailRow label="Category">{ticket.category}</DetailRow>
            <DetailRow label="Priority">
              <span style={{ color: PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.NORMAL, fontWeight: 600 }}>
                {ticket.priority}
              </span>
            </DetailRow>
          </div>

          {ticket.description && (
            <DetailRow label="Description">
              <span style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ticket.description}</span>
            </DetailRow>
          )}

          <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />

          {/* Location */}
          <DetailRow label="Society">{ticket.society_name || "—"}</DetailRow>

          <DetailRow label="Unit / Location">
            {location || locationFallback}
          </DetailRow>

          <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />

          {/* Resident contact */}
          {ticket.resident_name && (
            <DetailRow label="Resident Name">{ticket.resident_name}</DetailRow>
          )}

          <DetailRow label="WhatsApp Number">
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vnd-wa-link"
              >
                {/* WhatsApp icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {ticket.resident_whatsapp}
              </a>
            ) : (
              <span style={{ color: "#94a3b8" }}>—</span>
            )}
          </DetailRow>

          {/* Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <DetailRow label="Created">
              {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </DetailRow>
            <DetailRow label="Last Updated">
              {new Date(ticket.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </DetailRow>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer with action */}
        <div className="vnd-panel-footer">
          {nextAction ? (
            <button
              className={`vnd-btn ${nextAction.className}`}
              style={{ width: "100%", justifyContent: "center", padding: "10px 0" }}
              onClick={handleAction}
              disabled={updating}
            >
              {updating ? "Updating…" : nextAction.label}
            </button>
          ) : (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              {ticket.status === "RESOLVED" ? "✓ Ticket resolved — no further action needed." : "No actions available."}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VendorTickets() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";

  const [tickets,  setTickets]  = useState([]);
  const [status,   setStatus]   = useState(initialStatus);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null); // ticket shown in detail panel

  // Keep the initial status from the URL query param
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const load = useCallback(async (s) => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: 200 };
      if (s && s !== "ALL") params.status = s;
      const data = await api.vendorPortal.tickets(params);
      setTickets(data.tickets || []);
    } catch {
      setError("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [load, status]);

  // When vendor updates status in the panel, patch the ticket in the list
  function handleStatusUpdated(updatedTicket) {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === updatedTicket.id ? { ...t, status: updatedTicket.status, updated_at: updatedTicket.updated_at } : t,
      ),
    );
    // Also update the selected panel ticket
    setSelected((prev) => prev ? { ...prev, status: updatedTicket.status, updated_at: updatedTicket.updated_at } : prev);
    // Reload to get fresh sort order after a moment
    setTimeout(() => load(status), 600);
  }

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="vnd-page">
      <PageHeader
        title="My Tickets"
        subtitle="Tickets assigned to you — start work or mark them resolved"
      />

      {/* Status filter chips + dropdown */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt.key;
          const cnt = opt.key === "ALL" ? tickets.length : (counts[opt.key] || 0);
          const c = STATUS_COLORS[opt.key] || { bg: "#f8fafc", color: "#64748b" };
          return (
            <button
              key={opt.key}
              onClick={() => setStatus(opt.key)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "1px solid",
                borderColor: active ? c.color : "#e2e8f0",
                background:  active ? c.bg    : "#fff",
                color:       active ? c.color : "#64748b",
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: "pointer", transition: "all 120ms",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {opt.text}
              {cnt > 0 && (
                <span style={{
                  background: active ? c.color : "#e2e8f0",
                  color:      active ? "#fff"  : "#64748b",
                  borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      <div className="vnd-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}><Spinner label="Loading tickets…" /></div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {status === "ALL" ? "No tickets assigned to you yet." : `No ${status.replace(/_/g," ").toLowerCase()} tickets.`}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TicketTableHeader columns={["Ticket ID", "Category", "Society", "Unit / Apt", "Status", "Priority", "Date", ""]} />
            <tbody>
              {tickets.map((t, i) => {
                const loc = [t.tower_name, t.unit_number].filter(Boolean).join(" · ") || t.resident_apartment || "—";
                const pc  = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.NORMAL;
                const nextAction = { ASSIGNED: "Start Work", IN_PROGRESS: "Mark Resolved" }[t.status];

                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: i % 2 === 0 ? "#fff" : "#fafafa",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f0f9ff"}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
                  >
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                      {t.ticket_id || `#${t.id}`}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#475569" }}>{t.category}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#475569" }}>{t.society_name || "—"}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#475569" }}>{loc}</td>
                    <td style={{ padding: "11px 16px" }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 600, color: pc }}>{t.priority}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#94a3b8" }}>
                      {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      {nextAction && (
                        <button
                          className={`vnd-btn ${t.status === "ASSIGNED" ? "vnd-btn--primary" : "vnd-btn--success"}`}
                          style={{ padding: "5px 12px", fontSize: 12 }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const data = await api.vendorPortal.updateStatus(t.id);
                              handleStatusUpdated(data.ticket);
                            } catch {
                              // show error in panel if open, else alert
                              alert("Failed to update status — please try again.");
                            }
                          }}
                        >
                          {nextAction}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <TicketDetailPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
}
