import React from "react";
import { Text } from "@fluentui/react";
import nexsoLogo from "../assets/logo.png";
import { useShellState, ShellSidebar, SignOutButton } from "./LayoutShared.jsx";
import "../styles/Layout.css";
import "../styles/ResidentLayout.css";

const residentNavLinks = [
  { name: "Home",          key: "res-home",     path: "/resident",                 iconProps: { iconName: "Home"    } },
  { name: "Announcements", key: "res-announce",  path: "/resident/announcements",   iconProps: { iconName: "Megaphone" } },
  { name: "Visitor Passes",key: "res-visitor",   path: "/resident/visitor-passes",  iconProps: { iconName: "Contact" } },
];

export function ResidentLayout({ children, unitNumber, societyName, onLogout }) {
  const { collapsed, setCollapsed, headerRef, selectedKey, cssVars, navigate } =
    useShellState(residentNavLinks, "/resident");

  const subtitle = [societyName, unitNumber ? `Unit ${unitNumber}` : null].filter(Boolean).join(" · ");

  return (
    <div className="layout-root" style={cssVars}>
      <header ref={headerRef} className="layout-header">
        <div className="layout-header-bar">
          <div className="layout-logo" onClick={() => navigate("/resident")}>
            <img src={nexsoLogo} alt="Nexso" className="layout-logo-img" />
          </div>

          {subtitle && !collapsed && (
            <div className="resident-header-unit">
              <Text styles={{ root: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 } }}>
                {subtitle}
              </Text>
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 8, gap: 4 }}>
            <div className="resident-role-badge">Resident</div>
            <SignOutButton onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="layout-body">
        <ShellSidebar
          navLinks={residentNavLinks}
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
