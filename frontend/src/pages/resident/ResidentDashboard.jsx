import React from "react";
import { Text, Spinner } from "@fluentui/react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { api } from "../../services/api.js";
import "../../styles/ResidentLayout.css";

function StatCard({ icon, label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
        padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 150ms",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>
          {value ?? "—"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export function ResidentDashboard({ unitNumber, societyName, residentName }) {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = React.useState([]);
  const [passes,        setPasses]        = React.useState([]);
  const [dues,          setDues]          = React.useState([]);
  const [complaints,    setComplaints]    = React.useState([]);
  const [loading,       setLoading]       = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [ann, vp, billing, comp] = await Promise.all([
          api.resident.announcements().catch(() => ({ announcements: [] })),
          api.resident.visitorPasses.list({ status: "ACTIVE" }).catch(() => ({ passes: [] })),
          api.resident.maintenance.dues("pending").catch(() => ({ dues: [] })),
          api.resident.complaints.list().catch(() => ({ complaints: [] })),
        ]);
        if (!cancelled) {
          setAnnouncements(ann.announcements || []);
          setPasses(vp.passes || []);
          setDues(billing.dues || []);
          setComplaints(comp.complaints || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const urgentAnnouncements = announcements.filter((a) => a.priority === "URGENT" || a.pinned);
  const activePasses        = passes.length;
  const overdueDues         = dues.filter((d) => d.status === "OVERDUE").length;
  const pendingDues         = dues.filter((d) => d.status === "PENDING").length;
  const openComplaints      = complaints.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length;

  return (
    <div className="res-page">
      <PageHeader
        title={residentName ? `Welcome, ${residentName.split(" ")[0]}` : "My Home"}
        subtitle={[societyName, unitNumber ? `Unit ${unitNumber}` : null].filter(Boolean).join(" · ")}
      />

      {loading ? (
        <Spinner label="Loading…" />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            <StatCard icon="📢" label="Active Announcements" value={announcements.length} color="#dbeafe"
              onClick={() => navigate("/resident/announcements")} />
            <StatCard icon="🚨" label="Urgent Notices" value={urgentAnnouncements.length} color="#fee2e2"
              onClick={() => navigate("/resident/announcements")} />
            <StatCard icon="🎫" label="Active Visitor Passes" value={activePasses} color="#dcfce7"
              onClick={() => navigate("/resident/visitor-passes")} />
            <StatCard
              icon={overdueDues > 0 ? "⚠️" : "💰"}
              label={overdueDues > 0 ? "Overdue Dues" : "Pending Dues"}
              value={overdueDues > 0 ? overdueDues : pendingDues}
              color={overdueDues > 0 ? "#fee2e2" : "#fef9c3"}
              onClick={() => navigate("/resident/billing")}
            />
            <StatCard icon="🔧" label="Open Complaints" value={openComplaints} color="#ede9fe"
              onClick={() => navigate("/resident/complaints")} />
          </div>

          {urgentAnnouncements.length > 0 && (
            <div className="res-card">
              <div className="res-card-header">
                <Text styles={{ root: { fontSize: 15, fontWeight: 600, color: "#1e293b" } }}>
                  Urgent Notices
                </Text>
              </div>
              <div className="res-card-body--padded" style={{ padding: 0 }}>
                {urgentAnnouncements.slice(0, 3).map((a) => (
                  <div key={a.id} style={{
                    padding: "14px 20px", borderBottom: "1px solid #f1f5f9",
                    background: a.priority === "URGENT" ? "#fef2f2" : "#fff",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {a.pinned && <span style={{ fontSize: 11, background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>PINNED</span>}
                      {a.priority === "URGENT" && <span style={{ fontSize: 11, background: "#ef4444", color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>URGENT</span>}
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{a.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "💰  My Payments",        path: "/resident/billing"          },
              { label: "📢  View Announcements", path: "/resident/announcements"    },
              { label: "🎫  Create Visitor Pass", path: "/resident/visitor-passes"  },
              { label: "🔧  My Complaints",       path: "/resident/complaints"       },
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
