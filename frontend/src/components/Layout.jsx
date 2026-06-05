import React from "react";
import nexsoLogo from "../assets/logo.png";
import { useShellState, ShellSidebar, SignOutButton } from "./LayoutShared.jsx";
import { api } from "../services/api.js";
import "../styles/Layout.css";

export function Layout({ navLinks, children, onLogout }) {
  const { collapsed, setCollapsed, headerRef, selectedKey, cssVars, navigate } = useShellState(navLinks, "/");

  const [openCount, setOpenCount] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const d = await api.tickets.stats();
        if (!cancelled) setOpenCount((d?.open ?? 0) + (d?.assigned ?? 0));
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="layout-root" style={cssVars}>
      <header ref={headerRef} className="layout-header">
        <div className="layout-header-bar">
          <div className="layout-logo" onClick={() => navigate("/")}>
            <img src={nexsoLogo} alt="Nexso" className="layout-logo-img" />
          </div>
          {onLogout && (
            <div style={{ marginLeft: "auto", paddingRight: 8 }}>
              <SignOutButton onLogout={onLogout} />
            </div>
          )}
        </div>
      </header>

      <div className="layout-body">
        <ShellSidebar
          navLinks={navLinks}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          selectedKey={selectedKey}
          navigate={navigate}
          getNavLabel={(l) =>
            l.key === "dashboard" && openCount > 0
              ? `${l.name}  (${openCount})`
              : l.name
          }
        />
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
