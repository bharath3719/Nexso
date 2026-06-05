import React from "react";
import { TextField } from "@fluentui/react";

export function PasswordChangeFields({ form, onFieldChange, mismatch, loading, currentLabel = "Current password" }) {
  return (
    <>
      <TextField
        label={currentLabel}
        type="password"
        value={form.currentPassword}
        onChange={(_, v) => onFieldChange("currentPassword", v || "")}
        required
        disabled={loading}
      />
      <TextField
        label="New password"
        type="password"
        description="Minimum 8 characters"
        value={form.newPassword}
        onChange={(_, v) => onFieldChange("newPassword", v || "")}
        required
        disabled={loading}
      />
      <TextField
        label="Confirm new password"
        type="password"
        value={form.confirm}
        onChange={(_, v) => onFieldChange("confirm", v || "")}
        errorMessage={mismatch ? "Passwords do not match" : ""}
        required
        disabled={loading}
      />
    </>
  );
}
