import React from "react";
import { IconButton, Text } from "@fluentui/react";
import nexsoLogo from "../../assets/logo.png";
import { api } from "../../services/api.js";
import { useShellState, ShellSidebar, SignOutButton } from "./LayoutShared.jsx";
import "../../styles/Layout.css";
import "../../styles/VendorLayout.css";

const vendorNavLinks = [
  { name: "Dashboard", key: "vnd-dashboard", path: "/vendor",         iconProps: { iconName: "Home"    } },
  { name: "My Tickets",key: "vnd-tickets",   path: "/vendor/tickets", iconProps: { iconName: "Ticket"  } },
  { name: "My Profile",key: "vnd-profile",   path: "/vendor/profile", iconProps: { iconName: "Contact" } },
];

// ── Notification bell ─────────────────────────────────────────────────────────

function NotifBell({ count, onClick }) {
  return (
    <button className="vendor-notif-btn" onClick={onClick} title={`${count} new ticket${count !== 1 ? "s" : ""} assigned`} aria-label="Notifications">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="vendor-notif-badge">{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

export function VendorLayout({ children, vendorName, onLogout }) {
  const { collapsed, setCollapsed, headerRef, selectedKey, cssVars, navigate } = useShellState(vendorNavLinks, "/vendor");

  const [notifCount, setNotifCount] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.vendorPortal.notifications();
        if (!cancelled) setNotifCount(data?.count ?? 0);
      } catch { /* ignore network errors */ }
    }
    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="layout-root" style={cssVars}>
      <header ref={headerRef} className="layout-header">
        <div className="layout-header-bar">
          <div className="layout-logo" onClick={() => navigate("/vendor")}>
            <img src={nexsoLogo} alt="Nexso" className="layout-logo-img" />
          </div>

          {vendorName && !collapsed && (
            <div className="vendor-header-name">
              <Text styles={{ root: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 } }}>
                {vendorName}
              </Text>
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8, gap: 4 }}>
            <div className="vendor-role-badge">Vendor</div>
            <NotifBell count={notifCount} onClick={() => navigate("/vendor/tickets?status=ASSIGNED")} />
            <SignOutButton onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="layout-body">
        <ShellSidebar
          navLinks={vendorNavLinks}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          selectedKey={selectedKey}
          navigate={navigate}
          renderCollapsedItem={(l) => (
            <div key={l.key} style={{ position: "relative" }}>
              <IconButton
                iconProps={l.iconProps}
                styles={{ root: { width: 40, height: 40 } }}
                title={l.name}
                ariaLabel={l.name}
                onClick={() => navigate(l.path)}
              />
              {l.key === "vnd-tickets" && notifCount > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#ef4444", pointerEvents: "none",
                }} />
              )}
            </div>
          )}
          getNavLabel={(l) =>
            l.key === "vnd-tickets" && notifCount > 0 ? `My Tickets  (${notifCount})` : l.name
          }
        />
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
