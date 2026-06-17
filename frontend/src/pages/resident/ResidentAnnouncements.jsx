import React, { useCallback } from "react";
import { Text, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import "../../styles/ResidentLayout.css";

function CategoryBadge({ category }) {
  const key = (category || "GENERAL").toLowerCase();
  return (
    <span className={`ann-cat-badge ann-cat-badge--${key}`}>
      {category || "GENERAL"}
    </span>
  );
}

function AnnouncementCard({ announcement: a }) {
  const cardClass = [
    "ann-card",
    a.priority === "URGENT" ? "ann-card--urgent" : "",
    a.pinned ? "ann-card--pinned" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClass}>
      <div className="ann-card-header">
        {a.pinned && <span className="ann-badge ann-badge--pinned">📌 PINNED</span>}
        {a.priority === "URGENT" && <span className="ann-badge ann-badge--urgent">🚨 URGENT</span>}
        <CategoryBadge category={a.category} />
        <span className="ann-date">
          {new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="ann-title">{a.title}</div>
      <p className="ann-body">{a.body}</p>
    </div>
  );
}

export function ResidentAnnouncements() {
  const [announcements, setAnnouncements] = React.useState([]);
  const [loading, setLoading]             = React.useState(true);
  const [error, setError]                 = React.useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.resident.announcements()
      .then((d) => setAnnouncements(d.announcements || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load announcements.")))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const pinned  = announcements.filter((a) => a.pinned);
  const urgent  = announcements.filter((a) => !a.pinned && a.priority === "URGENT");
  const regular = announcements.filter((a) => !a.pinned && a.priority !== "URGENT");

  const ordered = [...pinned, ...urgent, ...regular];

  return (
    <div className="res-page">
      <PageHeader title="Announcements" subtitle="Official notices from your society secretary" />

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : ordered.length === 0 ? (
        <div className="res-card">
          <div className="res-empty">No announcements yet. Check back later.</div>
        </div>
      ) : (
        <div className="ann-list">
          {ordered.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
