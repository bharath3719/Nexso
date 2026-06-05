import React from "react";
import { Text, Spinner, Icon } from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader.jsx";
import { STATUS_COLORS, StatusBadge } from "../../components/TicketShared.jsx";
import { PortalStatCard, useDashboardData } from "../../components/DashboardShared.jsx";
import { api } from "../../services/api.js";
import "../../styles/VendorLayout.css";

export function VendorDashboard({ vendorName }) {
  const navigate = useNavigate();
  const { stats, tickets, loading, error } = useDashboardData(
    api.vendorPortal.stats,
    api.vendorPortal.tickets,
  );

  const s = stats;

  return (
    <div className="vnd-page">
      <PageHeader
        title={vendorName ? `Welcome, ${vendorName}` : "Vendor Dashboard"}
        subtitle="Manage your assigned service tickets"
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <PortalStatCard
              icon="Clock"       iconBg="#f59e0b" value={s?.assigned}   label="Waiting (Assigned)"
              onClick={() => navigate("/vendor/tickets?status=ASSIGNED")}
            />
            <PortalStatCard
              icon="Processing"  iconBg="#3b82f6" value={s?.inProgress} label="In Progress"
              onClick={() => navigate("/vendor/tickets?status=IN_PROGRESS")}
            />
            <PortalStatCard
              icon="CheckMark"   iconBg="#10b981" value={s?.resolved}   label="Resolved"
              onClick={() => navigate("/vendor/tickets?status=RESOLVED")}
            />
            <PortalStatCard
              icon="Ticket"      iconBg="#6366f1" value={s?.total}      label="All Time Total"
              onClick={() => navigate("/vendor/tickets")}
            />
          </div>

          {/* Assigned tickets alert */}
          {s?.assigned > 0 && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fbbf24",
              borderRadius: 8, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <Icon iconName="Warning" style={{ color: "#d97706", fontSize: 18 }} />
              <Text styles={{ root: { fontSize: 14, color: "#92400e", fontWeight: 500 } }}>
                You have {s.assigned} new ticket{s.assigned !== 1 ? "s" : ""} waiting for you to start.
              </Text>
              <button
                onClick={() => navigate("/vendor/tickets?status=ASSIGNED")}
                style={{
                  marginLeft: "auto", background: "#f59e0b", color: "#fff",
                  border: "none", borderRadius: 6, padding: "6px 14px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                View tickets →
              </button>
            </div>
          )}

          {/* Recent tickets */}
          <div className="vnd-card">
            <div className="vnd-card-header">
              <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
                Recent Tickets
              </Text>
              <span
                onClick={() => navigate("/vendor/tickets")}
                style={{ fontSize: 13, color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}
              >
                View all →
              </span>
            </div>

            {tickets.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No tickets assigned to you yet.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["Ticket ID", "Category", "Society", "Status", "Priority", "Date"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate("/vendor/tickets")}
                      style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f0f9ff"}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
                    >
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                        {t.ticket_id || `#${t.id}`}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.category}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.society_name || "—"}</td>
                      <td style={{ padding: "10px 16px" }}><StatusBadge status={t.status} /></td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b" }}>{t.priority}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                        {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
