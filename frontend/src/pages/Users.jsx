import React, { useState } from "react";
import { IconButton, MessageBar, MessageBarType, Stack, Text } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { UsersTable } from "../components/UsersTable.jsx";
import { shellTheme } from "../theme.js";

export function UsersPage({ apiBase }) {
  const { loading, data, error } = useJsonData(`${apiBase}/api/users?limit=200`);
  const users = data?.users || [];
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
        <Text variant="xLarge" styles={{ root: { fontWeight: 700 } }}>
          Users
        </Text>
        <IconButton iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }} title="Toggle filters" ariaLabel="Toggle filters" onClick={() => setShowFilters((v) => !v)} styles={{ root: { height: 28, width: 28, color: shellTheme.palette.themePrimary } }} />
      </Stack>
      {error ? <MessageBar messageBarType={MessageBarType.warning}>{error}</MessageBar> : null}
      <UsersTable items={users} loading={loading} showFilters={showFilters} />
    </Stack>
  );
}
