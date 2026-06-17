import React from "react";
import { Text, Spinner, DefaultButton } from "@fluentui/react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { StatusBadge } from "../../components/tickets/TicketShared.jsx";
import { PortalStatCard, useDashboardData } from "../../components/dashboard/DashboardShared.jsx";
import { ErrorBanner } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import { BRAND } from "../../styles/cssConstants.js";
import "../../styles/SecretaryLayout.css";

const QUICK_ACTIONS = [
  { label: "Add Resident",     icon: "AddFriend",    path: "/secretary/residents" },
  { label: "View All Tickets", icon: "BulletedList", path: "/secretary/tickets"  },
];

export function SecretaryDashboard({ societyName }) {
  const navigate = useNavigate();
  const { stats, tickets, loading, error, reload } = useDashboardData(
    api.secretary.stats,
    api.secretary.tickets,
    { pollMs: 30_000 },
  );

  return (
    <div className="sec-page">
      <PageHeader
        title={societyName || "My Society"}
        subtitle="Secretary portal — manage residents and track service tickets"
      />

      <ErrorBanner message={error} onRetry={reload} />

      {loading ? (
        <Spinner label="Loading dashboard…" />
      ) : (
        <>
          {/* Stats row */}
          <div className="sec-stats-grid">
            <PortalStatCard icon="Group"      iconBg={BRAND.blue}   value={stats?.residents?.total}    label="Total Residents" />
            <PortalStatCard icon="Home"       iconBg={BRAND.green}  value={stats?.units?.total}        label="Total Units" />
            <PortalStatCard icon="Ticket"     iconBg={BRAND.amber}  value={stats?.tickets?.open}       label="Open Tickets" />
            <PortalStatCard icon="Processing" iconBg={BRAND.indigo} value={stats?.tickets?.inProgress} label="In Progress" />
          </div>

          {/* Recent tickets */}
          <div className="sec-card">
            <div className="sec-card-header">
              <Text styles={T.sectionHeader}>Recent Tickets</Text>
              <Link to="/secretary/tickets" className="sec-nav-link">View all →</Link>
            </div>

            {tickets.length === 0 ? (
              <div className="sec-empty">No tickets yet for your society.</div>
            ) : (
              <div className="sec-table-scroll">
                <table className="sec-table">
                  <thead>
                    <tr>
                      {["Ticket ID", "Category", "Status", "Priority", "Raised by", "Date"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td className="sec-td--primary">{t.ticket_id || `#${t.id}`}</td>
                        <td className="sec-td--secondary">{t.category}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td className="sec-td--caption">{t.priority}</td>
                        <td className="sec-td--secondary">{t.raised_by_name || "—"}</td>
                        <td className="sec-td--caption">
                          {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="sec-action-row">
            {QUICK_ACTIONS.map(({ label, icon, path }) => (
              <DefaultButton
                key={path}
                text={label}
                iconProps={{ iconName: icon }}
                onClick={() => navigate(path)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
