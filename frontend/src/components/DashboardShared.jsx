import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@fluentui/react";
import "../styles/DashboardShared.css";

export function PortalStatCard({ icon, iconBg, value, label, onClick }) {
  return (
    <div
      className={`portalStatCard${onClick ? " portalStatCard--clickable" : ""}`}
      onClick={onClick}
    >
      <div className="portalStatCard__iconWrap" style={{ background: iconBg }}>
        <Icon iconName={icon} />
      </div>
      <div className="portalStatCard__body">
        <div className="portalStatCard__value">{value ?? "—"}</div>
        <div className="portalStatCard__label">{label}</div>
      </div>
    </div>
  );
}

export function useDashboardData(fetchStats, fetchTickets, { pollMs = 0, limit = 8 } = {}) {
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
          fetchTicketsRef.current({ limit }),
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
  }, [pollMs, limit]);

  return { stats, tickets, loading, error };
}
