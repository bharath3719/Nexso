import React from "react";
import { Text, Spinner } from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader.jsx";
import { StatusBadge } from "../../components/TicketShared.jsx";
import { PortalStatCard, useDashboardData } from "../../components/DashboardShared.jsx";
import { api } from "../../services/api.js";
import "../../styles/SecretaryLayout.css";

export function SecretaryDashboard({ societyName }) {
  const navigate = useNavigate();
  const { stats, tickets, loading, error } = useDashboardData(
    api.secretary.stats,
    api.secretary.tickets,
    { pollMs: 30_000 },
  );

  const s = stats;

  return (
    <div className="sec-page">
      <PageHeader
        title={societyName || "My Society"}
        subtitle="Secretary portal — manage residents and track service tickets"
      />

      {error && (
        <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading dashboard…" />
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            <PortalStatCard icon="Group"      iconBg="#3b82f6" value={s?.residents?.total}    label="Total Residents" />
            <PortalStatCard icon="Home"       iconBg="#10b981" value={s?.units?.total}        label="Total Units" />
            <PortalStatCard icon="Ticket"     iconBg="#f59e0b" value={s?.tickets?.open}       label="Open Tickets" />
            <PortalStatCard icon="Processing" iconBg="#6366f1" value={s?.tickets?.inProgress} label="In Progress" />
          </div>

          {/* Recent tickets */}
          <div className="sec-card">
            <div className="sec-card-header">
              <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
                Recent Tickets
              </Text>
              <span
                onClick={() => navigate("/secretary/tickets")}
                style={{ fontSize: 13, color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}
              >
                View all →
              </span>
            </div>

            {tickets.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No tickets yet for your society.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Ticket ID", "Category", "Status", "Priority", "Raised by", "Date"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{t.ticket_id || `#${t.id}`}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.category}</td>
                      <td style={{ padding: "10px 16px" }}><StatusBadge status={t.status} /></td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{t.priority}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.raised_by_name || "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                        {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "➕  Add Resident",   path: "/secretary/residents" },
              { label: "🎫  View All Tickets", path: "/secretary/tickets"  },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "12px 20px", fontSize: 14, fontWeight: 500, color: "#1e293b",
                  cursor: "pointer", transition: "box-shadow 150ms",
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
