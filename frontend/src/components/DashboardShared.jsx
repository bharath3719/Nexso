import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@fluentui/react";

export function PortalStatCard({ icon, iconBg, value, label, onClick }) {
  return (
    <div
      style={{
        background: "#fff", borderRadius: 10, padding: "20px 24px",
        border: "1px solid #e2e8f0", display: "flex", alignItems: "center",
        gap: 16, transition: "box-shadow 150ms ease",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon iconName={icon} style={{ color: "#fff", fontSize: 20 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#1e293b" }}>{value ?? "—"}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export function useDashboardData(fetchStats, fetchTickets, { pollMs = 0 } = {}) {
  const [stats,   setStats]   = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const fetchStatsRef   = useRef(fetchStats);
  const fetchTicketsRef = useRef(fetchTickets);
  fetchStatsRef.current   = fetchStats;
  fetchTicketsRef.current = fetchTickets;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [statsData, ticketsData] = await Promise.all([
          fetchStatsRef.current(),
          fetchTicketsRef.current({ limit: 8 }),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setTickets(ticketsData.tickets || []);
        }
      } catch {
        if (!cancelled) setError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = pollMs > 0 ? setInterval(() => { if (!cancelled) load(); }, pollMs) : null;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { stats, tickets, loading, error };
}
