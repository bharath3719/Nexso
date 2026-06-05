import React, { useEffect, useState } from "react";
import { IconButton, MessageBar, MessageBarType, Separator, Stack, Text } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { StatsCards } from "../components/StatsCards.jsx";
import { TicketsTable } from "../components/TicketsTable.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { T } from "../styles/typography.js";
import { filterIconButtonStyles } from "../theme.js";

const PAGE_SIZE = 5;

export function Dashboard() {
  const { loading, data, error, refetch } = useJsonData('/api/tickets?limit=200');
  const tickets = data?.tickets || [];
  const [showFilters, setShowFilters] = useState(false);

  // Auto-refresh every 30 seconds so new tickets appear without a manual reload
  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <PageHeader title="Dashboard" />

      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}

      <StatsCards tickets={tickets} loading={loading} />

      <Separator />

      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
        <Text styles={T.sectionHeader}>Recent Tickets</Text>
        <IconButton
          iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }}
          title="Toggle filters"
          ariaLabel="Toggle filters"
          onClick={() => setShowFilters((v) => !v)}
          styles={filterIconButtonStyles}
        />
      </Stack>

      <TicketsTable
        items={tickets}
        loading={loading}
        emptyLabel="No tickets available."
        showFilters={showFilters}
        pageSize={PAGE_SIZE}
      />
    </Stack>
  );
}
