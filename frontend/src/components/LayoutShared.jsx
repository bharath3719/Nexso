import React from "react";
import { Nav, IconButton } from "@fluentui/react";
import { useLocation, useNavigate } from "react-router-dom";

export function useShellState(navLinks, rootPath) {
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = React.useState(
    () => (typeof window !== "undefined" ? window.innerWidth < 900 : false),
  );
  React.useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const headerRef = React.useRef(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  React.useEffect(() => {
    const measure = () => setHeaderHeight(headerRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const selectedKey = React.useMemo(() => {
    const found = navLinks.find((l) =>
      l.path === rootPath
        ? location.pathname === rootPath
        : location.pathname.startsWith(l.path),
    );
    return found?.key ?? navLinks[0]?.key;
  }, [location.pathname, navLinks, rootPath]);

  const cssVars = {
    "--sidebar-w": collapsed ? "56px" : "240px",
    "--header-h":  `${headerHeight}px`,
  };

  return { collapsed, setCollapsed, headerRef, selectedKey, cssVars, navigate };
}

function CollapsedNav({ navLinks, navigate, renderCollapsedItem }) {
  return (
    <div className="layout-icon-nav">
      {navLinks.map((l) =>
        renderCollapsedItem ? renderCollapsedItem(l) : (
          <IconButton
            key={l.key}
            iconProps={l.iconProps}
            styles={{ root: { width: 40, height: 40 } }}
            title={l.name}
            ariaLabel={l.name}
            onClick={() => navigate(l.path)}
          />
        ),
      )}
    </div>
  );
}

function ExpandedNav({ navLinks, selectedKey, navigate, getNavLabel }) {
  return (
    <Nav
      groups={[{
        links: navLinks.map((l) => ({
          name:      getNavLabel ? getNavLabel(l) : l.name,
          key:       l.key,
          url:       l.path,
          iconProps: l.iconProps,
        })),
      }]}
      selectedKey={selectedKey}
      onLinkClick={(event, item) => {
        event?.preventDefault();
        if (item?.url) navigate(item.url);
      }}
    />
  );
}

const TOGGLE_PROPS = {
  true:  { rowClass: "layout-collapse-row layout-collapse-row--centered", icon: "ChevronRight", ariaLabel: "Expand navigation",   title: "Expand"   },
  false: { rowClass: "layout-collapse-row",                               icon: "ChevronLeft",  ariaLabel: "Collapse navigation", title: "Collapse" },
};

function CollapseToggle({ collapsed, onClick }) {
  const t = TOGGLE_PROPS[collapsed];
  return (
    <div className={t.rowClass}>
      <IconButton
        iconProps={{ iconName: t.icon }}
        styles={{ root: { width: 36, height: 36 } }}
        ariaLabel={t.ariaLabel}
        title={t.title}
        onClick={onClick}
      />
    </div>
  );
}

// renderCollapsedItem(link) — optional render prop for collapsed icon slots (e.g. vendor badge overlay)
// getNavLabel(link) — optional to override the expanded nav label per link
export function ShellSidebar({ navLinks, collapsed, setCollapsed, selectedKey, navigate, renderCollapsedItem, getNavLabel }) {
  return (
    <aside className="layout-sidebar">
      <div className="layout-sidebar-inner">
        <div className="layout-nav-scroll">
          {collapsed
            ? <CollapsedNav navLinks={navLinks} navigate={navigate} renderCollapsedItem={renderCollapsedItem} />
            : <ExpandedNav navLinks={navLinks} selectedKey={selectedKey} navigate={navigate} getNavLabel={getNavLabel} />
          }
        </div>
        <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed((c) => !c)} />
      </div>
    </aside>
  );
}

export function SignOutButton({ onLogout }) {
  if (!onLogout) return null;
  return (
    <IconButton
      iconProps={{ iconName: "SignOut" }}
      title="Sign out"
      ariaLabel="Sign out"
      styles={{ root: { color: "#fff" }, icon: { color: "#fff" } }}
      onClick={onLogout}
    />
  );
}
