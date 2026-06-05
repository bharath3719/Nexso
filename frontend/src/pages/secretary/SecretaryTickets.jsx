/**
 * SecretaryTickets.jsx
 * ─────────────────────
 * Read-only view of service tickets for the secretary's society.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Text, Dropdown, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/PageHeader.jsx";
import { StatusBadge, PRIORITY_COLORS, TicketTableHeader } from "../../components/TicketShared.jsx";
import { api } from "../../services/api.js";
import "../../styles/SecretaryLayout.css";

const STATUS_OPTIONS = [
  { key: "ALL",        text: "All Statuses"  },
  { key: "OPEN",       text: "Open"          },
  { key: "ASSIGNED",   text: "Assigned"      },
  { key: "IN_PROGRESS",text: "In Progress"   },
  { key: "RESOLVED",   text: "Resolved"      },
  { key: "CLOSED",     text: "Closed"        },
];

export function SecretaryTickets() {
  const [tickets, setTickets] = useState([]);
  const [status,  setStatus]  = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async (s) => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: 100 };
      if (s && s !== "ALL") params.status = s;
      const data = await api.secretary.tickets(params);
      setTickets(data.tickets || []);
    } catch {
      setError("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status); }, [load, status]);

  return (
    <div className="sec-page">
      <PageHeader
        title="Service Tickets"
        subtitle="Tickets raised by residents of your society"
      />

      {/* Filter */}
      <div style={{ maxWidth: 220 }}>
        <Dropdown
          label="Filter by status"
          selectedKey={status}
          options={STATUS_OPTIONS}
          onChange={(_, opt) => setStatus(opt.key)}
        />
      </div>

      {error && (
        <div style={{ color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      <div className="sec-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Spinner label="Loading tickets…" /></div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No tickets found.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TicketTableHeader columns={["Ticket ID", "Category", "Status", "Priority", "Raised By", "Assigned Vendor", "Date"]} />
            <tbody>
              {tickets.map((t, i) => {
                const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.NORMAL;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{t.ticket_id || `#${t.id}`}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.category}</td>
                    <td style={{ padding: "10px 16px" }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: pc }}>{t.priority}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.raised_by_name || "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#475569" }}>{t.vendor_name || "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                      {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
