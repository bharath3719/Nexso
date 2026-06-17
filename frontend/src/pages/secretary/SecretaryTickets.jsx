/**
 * SecretaryTickets.jsx
 * ─────────────────────
 * Read-only view of service tickets for the secretary's society.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Dropdown, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { StatusBadge, PRIORITY_COLORS } from "../../components/tickets/TicketShared.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { TICKET_STATUS_FILTER_OPTIONS } from "../../constants.js";
import "../../styles/SecretaryLayout.css";

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
    } catch (err) {
      setError(getErrMsg(err, "Failed to load tickets."));
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
      <div className="sec-filter-sm">
        <Dropdown
          label="Filter by status"
          selectedKey={status}
          options={TICKET_STATUS_FILTER_OPTIONS}
          onChange={(_, opt) => setStatus(opt.key)}
        />
      </div>

      <ErrorBanner message={error} onRetry={() => load(status)} />

      <div className="sec-card">
        {loading ? (
          <div className="sec-spinner-center"><Spinner label="Loading tickets…" /></div>
        ) : tickets.length === 0 ? (
          <div className="sec-empty">No tickets found.</div>
        ) : (
          <div className="sec-table-scroll">
            <table className="sec-table">
              <thead>
                <tr>
                  {["Ticket ID", "Category", "Status", "Priority", "Raised By", "Assigned Vendor", "Date"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.NORMAL;
                  return (
                    <tr key={t.id}>
                      <td className="sec-td--primary">{t.ticket_id || `#${t.id}`}</td>
                      <td className="sec-td--secondary">{t.category}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td className="sec-td--caption" style={{ color: pc }}>{t.priority}</td>
                      <td className="sec-td--secondary">{t.raised_by_name || "—"}</td>
                      <td className="sec-td--secondary">{t.vendor_name || "—"}</td>
                      <td className="sec-td--caption">
                        {new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
