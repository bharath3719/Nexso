import React, { useMemo, useState } from "react";
import { DefaultButton, Dropdown, IconButton, MessageBar, MessageBarType, Modal, PrimaryButton, Stack, Text, TextField } from "@fluentui/react";
import { ConstrainMode, DetailsList, DetailsListLayoutMode, SelectionMode } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { listStyles } from "../theme.js";

export function VendorsPage({ apiBase }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useJsonData(`${apiBase}/api/vendors?limit=200&k=${refreshKey}`);
  const vendors = data?.vendors || [];
  const [columnWidths, setColumnWidths] = useState({});
  const [form, setForm] = useState({ name: "", code: "", whatsapp_number: "", categories: "", active: true });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const vendorColumns = useMemo(
    () => [
      { key: "name", name: "Name", fieldName: "name", minWidth: 140, isResizable: true, currentWidth: columnWidths.name },
      { key: "code", name: "Code", fieldName: "code", minWidth: 120, isResizable: true, currentWidth: columnWidths.code },
      { key: "whatsapp", name: "WhatsApp", fieldName: "whatsapp_number", minWidth: 140, isResizable: true, currentWidth: columnWidths.whatsapp },
      { key: "categories", name: "Categories", minWidth: 140, isResizable: true, currentWidth: columnWidths.categories, onRender: (v) => (v.categories || []).join(", ") },
      { key: "active", name: "Active", minWidth: 80, isResizable: true, currentWidth: columnWidths.active, onRender: (v) => (v.active === false ? "No" : "Yes") },
      {
        key: "actions",
        name: "Actions",
        minWidth: 160,
        isResizable: true,
        currentWidth: columnWidths.actions,
        onRender: (item) => (
          <Stack horizontal tokens={{ childrenGap: 6 }}>
            <IconButton
              iconProps={{ iconName: "Edit" }}
              title="Edit"
              ariaLabel="Edit"
              onClick={() => {
                setEditing(item);
                setForm({
                  name: item.name || "",
                  code: item.code || "",
                  whatsapp_number: item.whatsapp_number || "",
                  categories: (item.categories || []).join(", "),
                  active: item.active !== false,
                });
                setModalOpen(true);
              }}
            />
            <IconButton
              iconProps={{ iconName: "Delete" }}
              title="Delete"
              ariaLabel="Delete"
              onClick={async () => {
                try {
                  await fetch(`${apiBase}/api/vendors/${item.id}`, { method: "DELETE" });
                  setRefreshKey((k) => k + 1);
                } catch (err) {
                  console.error("Delete vendor failed", err);
                }
              }}
            />
          </Stack>
        ),
      },
    ],
    [apiBase, columnWidths],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        name: form.name,
        code: form.code,
        whatsapp_number: form.whatsapp_number,
        categories: form.categories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        active: !!form.active,
      };

      const method = editing ? "PUT" : "POST";
      const url = editing ? `${apiBase}/api/vendors/${editing.id}` : `${apiBase}/api/vendors`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setForm({ name: "", code: "", whatsapp_number: "", categories: "", active: true });
      setEditing(null);
      setModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSaveError(err.message || "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Stack horizontal verticalAlign="center" horizontalAlign="space-between">
        <Text variant="xLarge" styles={{ root: { fontWeight: 700 } }}>
          Vendors
        </Text>
        <PrimaryButton
          text="Add Vendor"
          onClick={() => {
            setEditing(null);
            setForm({ name: "", code: "", whatsapp_number: "", categories: "", active: true });
            setSaveError("");
            setModalOpen(true);
          }}
        />
      </Stack>
      {error ? <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar> : null}

      <Stack styles={{ root: { overflowX: "auto", width: "100%" } }}>
        <DetailsList
          items={vendors}
          columns={vendorColumns}
          layoutMode={DetailsListLayoutMode.fixedColumns}
          constrainMode={ConstrainMode.unconstrained}
          selectionMode={SelectionMode.none}
          styles={listStyles}
          onColumnResize={(column, newWidth) => {
            if (!column?.key || !newWidth) return;
            setColumnWidths((prev) => ({ ...prev, [column.key]: newWidth }));
          }}
        />
      </Stack>

      <Modal isOpen={modalOpen} onDismiss={() => setModalOpen(false)} isBlocking={false}>
        <Stack styles={{ root: { minWidth: 540, maxWidth: 760, boxShadow: "0 18px 48px rgba(0,0,0,0.18)" } }}>
          <Stack horizontal verticalAlign="center" horizontalAlign="space-between" styles={{ root: { padding: "16px 20px", background: "linear-gradient(120deg, #1e3a8a, #2563eb)", color: "#fff" } }}>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 700, color: "#fff" } }}>
                {editing ? "Edit Vendor" : "Add Vendor"}
              </Text>
              {editing ? (
                <Text variant="small" styles={{ root: { color: "#e5edff" } }}>
                  Code {editing.code || "—"} · WhatsApp {editing.whatsapp_number || "—"}
                </Text>
              ) : (
                <Text variant="small" styles={{ root: { color: "#e5edff" } }}>
                  Capture vendor details and categories for assignments.
                </Text>
              )}
            </Stack>
            <IconButton iconProps={{ iconName: "Cancel" }} ariaLabel="Close" onClick={() => setModalOpen(false)} styles={{ root: { color: "#fff" } }} />
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack tokens={{ childrenGap: 16 }} styles={{ root: { padding: 20, background: "#f8fafc" } }}>
              <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
                <Stack grow styles={{ root: { minWidth: 240, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                  <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                    Identity
                  </Text>
                  <TextField label="Name" value={form.name} onChange={(_, v) => setForm((s) => ({ ...s, name: v || "" }))} required />
                  <TextField label="Code" value={form.code} onChange={(_, v) => setForm((s) => ({ ...s, code: v || "" }))} required />
                </Stack>

                <Stack grow styles={{ root: { minWidth: 240, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                  <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                    Contact & Status
                  </Text>
                  <TextField label="WhatsApp" value={form.whatsapp_number} onChange={(_, v) => setForm((s) => ({ ...s, whatsapp_number: v || "" }))} placeholder="+91…" />
                  <Dropdown
                    label="Active"
                    options={[
                      { key: true, text: "Yes" },
                      { key: false, text: "No" },
                    ]}
                    selectedKey={form.active}
                    onChange={(_e, option) => setForm((s) => ({ ...s, active: option?.key !== false }))}
                    styles={{ dropdown: { width: 160 } }}
                  />
                </Stack>
              </Stack>

              <Stack styles={{ root: { background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                  Categories
                </Text>
                <TextField label="Categories (comma separated)" value={form.categories} onChange={(_, v) => setForm((s) => ({ ...s, categories: v || "" }))} placeholder="Electrical, Plumbing, Cleaning" />
                <Text variant="small" styles={{ root: { color: "#6b7280" } }}>
                  Helps route the right tickets to this vendor.
                </Text>
              </Stack>

              {saveError ? <MessageBar messageBarType={MessageBarType.error}>{saveError}</MessageBar> : null}

              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                <DefaultButton text="Cancel" onClick={() => setModalOpen(false)} />
                <PrimaryButton type="submit" text={saving ? "Saving..." : "Save Vendor"} disabled={saving} />
              </Stack>
            </Stack>
          </form>
        </Stack>
      </Modal>
    </Stack>
  );
}
