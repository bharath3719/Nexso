import React from "react";
import { Text } from "@fluentui/react";
import nexsoLogo from "../../assets/logo.png";
import { useShellState, ShellSidebar, SignOutButton } from "./LayoutShared.jsx";
import "../../styles/Layout.css";
import "../../styles/SecretaryLayout.css";

const secretaryNavLinks = [
  { name: "Dashboard",      key: "sec-dashboard",    path: "/secretary",                  iconProps: { iconName: "Home"        } },
  { name: "Residents",      key: "sec-residents",    path: "/secretary/residents",        iconProps: { iconName: "Group"       } },
  { name: "Tickets",        key: "sec-tickets",      path: "/secretary/tickets",          iconProps: { iconName: "Ticket"      } },
  { name: "Announcements",  key: "sec-announce",     path: "/secretary/announcements",    iconProps: { iconName: "Megaphone"   } },
  { name: "Maintenance",    key: "sec-maintenance",  path: "/secretary/maintenance",      iconProps: { iconName: "PaymentCard" } },
  { name: "My Profile",     key: "sec-profile",      path: "/secretary/profile",          iconProps: { iconName: "Contact"     } },
];

export function SecretaryLayout({ children, societyName, onLogout }) {
  const { collapsed, setCollapsed, headerRef, selectedKey, cssVars, navigate } = useShellState(secretaryNavLinks, "/secretary");

  return (
    <div className="layout-root" style={cssVars}>
      <header ref={headerRef} className="layout-header">
        <div className="layout-header-bar">
          <div className="layout-logo" onClick={() => navigate("/secretary")}>
            <img src={nexsoLogo} alt="Nexso" className="layout-logo-img" />
          </div>

          {societyName && !collapsed && (
            <div className="secretary-header-society">
              <Text styles={{ root: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 } }}>
                {societyName}
              </Text>
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8, gap: 4 }}>
            <div className="secretary-role-badge">Secretary</div>
            <SignOutButton onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="layout-body">
        <ShellSidebar
          navLinks={secretaryNavLinks}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          selectedKey={selectedKey}
          navigate={navigate}
        />
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
