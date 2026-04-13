import React, { useMemo } from "react";
import { Stack, Text } from "@fluentui/react";
import { ticketStatuses } from "../constants.js";
import { shellTheme } from "../theme.js";

const cardTones = {
  total: {
    accent: shellTheme.palette.themePrimary,
    valueColor: "#1d4ed8",
    labelColor: "#34507a",
    hintColor: "#5f7aa4",
    background: "linear-gradient(135deg, #eef5ff 0%, #ffffff 100%)",
    borderColor: "rgba(59, 130, 246, 0.22)",
  },
  OPEN: {
    accent: "#dc2626",
    valueColor: "#b91c1c",
    labelColor: "#7f1d1d",
    hintColor: "#a63b3b",
    background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)",
    borderColor: "rgba(220, 38, 38, 0.22)",
  },
  ASSIGNED: {
    accent: "#d97706",
    valueColor: "#b45309",
    labelColor: "#7c4a03",
    hintColor: "#9a6700",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
    borderColor: "rgba(217, 119, 6, 0.22)",
  },
  IN_PROGRESS: {
    accent: "#2563eb",
    valueColor: "#1d4ed8",
    labelColor: "#1e3a8a",
    hintColor: "#4361b5",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  RESOLVED: {
    accent: "#16a34a",
    valueColor: "#15803d",
    labelColor: "#14532d",
    hintColor: "#337a4f",
    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
    borderColor: "rgba(22, 163, 74, 0.22)",
  },
  CLOSED: {
    accent: "#475569",
    valueColor: "#334155",
    labelColor: "#334155",
    hintColor: "#64748b",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    borderColor: "rgba(71, 85, 105, 0.18)",
  },
};

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
            <Text variant="xxLarge" styles={{ root: { fontWeight: 700, color: tone.valueColor } }}>
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
