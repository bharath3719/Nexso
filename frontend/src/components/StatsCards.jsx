import React, { useMemo } from "react";
import { Stack, Text } from "@fluentui/react";
import { ticketStatuses } from "../constants.js";

const cardStyle = {
  root: {
    width: 220,
    padding: 16,
    borderRadius: 10,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    background: "#fff",
  },
};

export function StatsCards({ tickets, loading }) {
  const counts = useMemo(() => {
    const base = { total: tickets.length };
    ticketStatuses.forEach((s) => {
      base[s.key] = tickets.filter((t) => t.status === s.key).length;
    });
    return base;
  }, [tickets]);

  const items = [{ title: "Total Tickets", value: loading ? "…" : counts.total || 0, hint: "Last 200 records" }, ...ticketStatuses.map((s) => ({ title: s.label, value: loading ? "…" : counts[s.key] || 0, hint: s.key === "OPEN" ? "Needs attention" : undefined }))];

  return (
    <Stack horizontal wrap tokens={{ childrenGap: 12 }} styles={{ root: { width: "100%" } }}>
      {items.map((item) => (
        <Stack key={item.title} styles={cardStyle} tokens={{ childrenGap: 6 }}>
          <Text variant="small" styles={{ root: { color: "#5f6a7a" } }}>
            {item.title}
          </Text>
          <Text variant="xxLarge" styles={{ root: { fontWeight: 700 } }}>
            {item.value}
          </Text>
          {item.hint ? (
            <Text variant="xSmall" styles={{ root: { color: "#8292a2" } }}>
              {item.hint}
            </Text>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
