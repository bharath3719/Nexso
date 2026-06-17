import React, { useMemo } from "react";
import { Stack, Text } from "@fluentui/react";
import { ticketStatuses } from "../../constants.js";
import { cardTones } from "../../styles/cssConstants.js";

function getCardStyles(tone) {
  return {
    root: {
      width: 220,
      minHeight: 118,
      padding: 16,
      borderRadius: 12,
      boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
      background: tone.background,
      border: `1px solid ${tone.borderColor}`,
      borderTop: `4px solid ${tone.accent}`,
    },
  };
}

export function StatsCards({ tickets, loading }) {
  const counts = useMemo(() => {
    const base = { total: tickets.length };
    ticketStatuses.forEach((status) => {
      base[status.key] = 0;
    });

    tickets.forEach((ticket) => {
      if (ticket.status in base) {
        base[ticket.status] += 1;
      }
    });

    return base;
  }, [tickets]);

  const items = [
    { title: "Total Tickets", statusKey: "total", value: loading ? "…" : counts.total || 0, hint: "Last 200 records" },
    ...ticketStatuses.map((status) => ({
      title: status.label,
      statusKey: status.key,
      value: loading ? "…" : counts[status.key] || 0,
      hint: {
        OPEN: "Needs attention",
        ASSIGNED: "Waiting on owner",
        IN_PROGRESS: "Actively being worked",
        RESOLVED: "Ready to close",
        CLOSED: "Completed",
      }[status.key],
    })),
  ];

  return (
    <Stack horizontal wrap tokens={{ childrenGap: 12 }} styles={{ root: { width: "100%" } }}>
      {items.map((item) => {
        const tone = cardTones[item.statusKey] || cardTones.total;

        return (
          <Stack key={item.title} styles={getCardStyles(tone)} tokens={{ childrenGap: 6 }}>
            <Text variant="small" styles={{ root: { color: tone.labelColor, fontWeight: 600 } }}>
              {item.title}
            </Text>
            {/* KPI stat number — intentionally larger than page headings */}
            <Text styles={{ root: { fontSize: 28, fontWeight: 700, color: tone.valueColor } }}>
              {item.value}
            </Text>
            {item.hint ? (
              <Text variant="xSmall" styles={{ root: { color: tone.hintColor } }}>
                {item.hint}
              </Text>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
