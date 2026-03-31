import React, { useState } from "react";
import { IconButton, MessageBar, MessageBarType, Separator, Stack, Text } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { StatsCards } from "../components/StatsCards.jsx";
import { TicketsTable } from "../components/TicketsTable.jsx";
import { shellTheme } from "../theme.js";

export function Dashboard({ apiBase }) {
  const { loading, data, error } = useJsonData(`${apiBase}/api/tickets?limit=200`);
  const tickets = data?.tickets || [];
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 5;

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Text variant="xLarge">Dashboard</Text>
      {error ? <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar> : null}

      <StatsCards tickets={tickets} loading={loading} />

      <Separator />
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
          Recent Tickets
        </Text>
        <IconButton iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }} title="Toggle filters" ariaLabel="Toggle filters" onClick={() => setShowFilters((v) => !v)} styles={{ root: { height: 28, width: 28, color: shellTheme.palette.themePrimary } }} />
      </Stack>
      <TicketsTable items={tickets} loading={loading} emptyLabel="No tickets available." showFilters={showFilters} pageSize={pageSize} />
    </Stack>
  );
}
