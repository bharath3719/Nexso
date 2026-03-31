import React from "react";
import { CommandBar, Nav, Stack } from "@fluentui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { commandButtonStyles } from "../theme.js";

export function Layout({ navLinks, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = React.useMemo(() => {
    const found = navLinks.find((l) => (l.path === "/" ? location.pathname === "/" : location.pathname.startsWith(l.path)));
    return found?.key || navLinks[0]?.key;
  }, [location.pathname, navLinks]);

  return (
    <Stack verticalFill styles={{ root: { minHeight: "100vh", background: "#f5f7fa" } }}>
      <CommandBar
        items={[{ key: "brand", text: "Nexso", iconProps: { iconName: "Home" }, buttonStyles: commandButtonStyles, onClick: () => navigate("/") }]}
        farItems={[]}
        styles={{
          root: {
            background: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 45%, #3b82f6 100%)",
            color: "#fff",
            padding: "0 8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          },
          primarySet: { color: "#fff" },
          secondarySet: { color: "#fff" },
        }}
      />

      <Stack horizontal grow styles={{ root: { overflow: "hidden" } }}>
        <Stack styles={{ root: { width: 240, flexShrink: 0, background: "#ffffff", boxShadow: "2px 0 12px rgba(0,0,0,0.05)", paddingTop: 12 } }}>
          <Nav
            groups={[{ links: navLinks.map((l) => ({ name: l.name, key: l.key, url: l.path })) }]}
            selectedKey={selectedKey}
            onLinkClick={(_e, item) => {
              if (item?.url) navigate(item.url);
            }}
          />
        </Stack>

        {/*
          KEY FIX: `minWidth: 0` is required on any flex child that should shrink.
          Without it, the flex item expands to fit its content and the inner
          overflow container never gets a constrained width to scroll against.
          `overflow: hidden` clips any stray overflow at this boundary.
        */}
        <Stack grow styles={{ root: { padding: 24, minWidth: 0, overflow: "hidden" } }} tokens={{ childrenGap: 16 }}>
          {children}
        </Stack>
      </Stack>
    </Stack>
  );
}
