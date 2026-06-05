import React, { useState } from "react";
import { IconButton, MessageBar, MessageBarType, Stack } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { UsersTable } from "../components/UsersTable.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { filterIconButtonStyles } from "../theme.js";

export function UsersPage() {
  const { loading, data, error } = useJsonData('/api/users?limit=200');
  const users = data?.users || [];
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <PageHeader
        title="Users"
        action={
          <IconButton
            iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }}
            title="Toggle filters"
            ariaLabel="Toggle filters"
            onClick={() => setShowFilters((v) => !v)}
            styles={filterIconButtonStyles}
          />
        }
      />
      {error && <MessageBar messageBarType={MessageBarType.warning}>{error}</MessageBar>}
      <UsersTable items={users} loading={loading} showFilters={showFilters} />
    </Stack>
  );
}
