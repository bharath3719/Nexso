import React from "react";
import { Stack, Text } from "@fluentui/react";

export function PaymentsPage() {
  return (
    <Stack tokens={{ childrenGap: 12 }}>
      <Text variant="xLarge">Payments</Text>
      <Text variant="medium" styles={{ root: { color: "#697586" } }}>
        Payment flows are not wired yet. Add your gateway integration here and surface status cards or invoices.
      </Text>
    </Stack>
  );
}
