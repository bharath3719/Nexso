/**
 * PageHeader — standard top-of-page header used by every page.
 *
 * Props
 * ─────
 *  title     {string}      Required. The page name shown as the main heading.
 *  subtitle  {string}      Optional. One-line description shown below the title.
 *  action    {ReactNode}   Optional. A button / control placed on the right side.
 *
 * Example
 * ───────
 *  <PageHeader
 *    title="Vendors"
 *    subtitle="Manage and verify your service vendors"
 *    action={<PrimaryButton text="Add Vendor" iconProps={{ iconName: "Add" }} onClick={…} />}
 *  />
 */

import React from "react";
import { Stack, Text } from "@fluentui/react";
import { T } from "../../styles/typography.js";

export function PageHeader({ title, subtitle, action }) {
  return (
    <Stack
      horizontal
      horizontalAlign="space-between"
      verticalAlign="center"
      styles={{ root: { marginBottom: 4 } }}
    >
      <Stack tokens={{ childrenGap: 3 }}>
        <Text styles={T.pageHeader}>{title}</Text>
        {subtitle && <Text styles={T.pageSubtitle}>{subtitle}</Text>}
      </Stack>

      {action && <div>{action}</div>}
    </Stack>
  );
}
