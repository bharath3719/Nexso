import React from "react";
import { Stack } from "@fluentui/react";
import { PageHeader } from "../components/PageHeader.jsx";

export function PaymentsPage() {
  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <PageHeader
        title="Payments"
        subtitle="Payment flows are not wired yet. Add your gateway integration here."
      />
    </Stack>
  );
}
