import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown, IconButton, MessageBar, MessageBarType, Modal, PrimaryButton, DefaultButton, Stack, Text } from "@fluentui/react";
import { useJsonData } from "../hooks/useJsonData.js";
import { TicketsTable } from "../components/TicketsTable.jsx";
import { ticketStatuses } from "../constants.js";
import { shellTheme } from "../theme.js";
import { formatDate } from "../utils/formatDate.js";

export function ComplaintsPage({ apiBase }) {
  const { loading, data, error, refetch } = useJsonData(`${apiBase}/api/tickets?limit=200`);
  const { data: vendorsData } = useJsonData(`${apiBase}/api/vendors?limit=200`);
  const complaints = data?.tickets || [];
  const vendors = vendorsData?.vendors || [];
  const pageSize = 10;
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusValue, setStatusValue] = useState("");
  const [vendorValue, setVendorValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const vendorOptions = useMemo(
    () => [
      { key: "", text: "Unassigned" },
      ...vendors
        .filter((v) => v.active !== false)
        .map((v) => {
          const key = (v.id ?? v.vendor_id ?? v.code ?? v.name ?? `${v}`).toString();
          const label = v.name || v.vendor_name || v.code || `Vendor ${v.id || v.vendor_id || v.code || ""}`;
          return { key, text: label };
        }),
    ],
    [vendors],
  );

  const openModal = (item) => {
    setSelectedComplaint(item);
    setStatusValue(item?.status || "OPEN");

    const rawVendorId = item?.vendor_id;
    const matchedOption = vendorOptions.find((o) => o.key !== "" && o.key === rawVendorId?.toString());
    if (rawVendorId && !matchedOption) {
      console.warn(`[ComplaintsPage] vendor_id "${rawVendorId}" on ticket #${item?.id} has no matching vendor option.`);
    }
    setVendorValue(matchedOption ? matchedOption.key : "");

    setSaveError("");
    setModalOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!selectedComplaint) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${apiBase}/api/tickets/${selectedComplaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusValue,
          vendor_id: vendorValue || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Server error ${res.status}`);
      }

      if (!isMountedRef.current) return;
      setModalOpen(false);
      if (typeof refetch === "function") refetch();
    } catch (err) {
      if (!isMountedRef.current) return;
      setSaveError(err.message || "Failed to save. Please try again.");
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  return (
    /*
      KEY FIX: minWidth: 0 prevents this Stack from bloating its flex parent
      (Layout's content area) beyond the viewport width, which would defeat
      the horizontal scroll on TicketsTable.
    */
    <Stack tokens={{ childrenGap: 16 }} styles={{ root: { minWidth: 0 } }}>
      {error ? <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar> : null}
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
        <Text variant="xLarge" styles={{ root: { fontWeight: 700 } }}>
          Complaints
        </Text>
        <IconButton iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }} title="Toggle filters" ariaLabel="Toggle filters" onClick={() => setShowFilters((v) => !v)} styles={{ root: { height: 28, width: 28, color: shellTheme.palette.themePrimary } }} />
      </Stack>
      <TicketsTable items={complaints} loading={loading} emptyLabel="No complaints yet." pageSize={pageSize} showFilters={showFilters} onAction={openModal} actionLabel="Manage" extraColumns={complaintExtraColumns} />

      <Modal isOpen={modalOpen} onDismiss={handleClose} isBlocking={false}>
        <Stack styles={{ root: { minWidth: 520, maxWidth: 720, boxShadow: "0 18px 48px rgba(0,0,0,0.18)" } }}>
          <Stack horizontal verticalAlign="center" horizontalAlign="space-between" styles={{ root: { padding: "16px 20px", background: "linear-gradient(120deg, #1e3a8a, #2563eb)", color: "#fff" } }}>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 700, color: "#fff" } }}>
                Manage Complaint
              </Text>
              {selectedComplaint ? (
                <Text variant="small" styles={{ root: { color: "#e5edff" } }}>
                  ID #{selectedComplaint.id} · {formatDate(selectedComplaint.created_at)}
                </Text>
              ) : null}
            </Stack>
            <IconButton
              iconProps={{ iconName: "Cancel" }}
              ariaLabel="Close"
              onClick={handleClose}
              disabled={saving}
              styles={{
                root: { color: "#fff" },
                rootHovered: { color: "#fff", background: "rgba(255,255,255,0.15)" },
                rootPressed: { color: "#ddd", background: "rgba(255,255,255,0.25)" },
                rootDisabled: { color: "rgba(255,255,255,0.4)" },
              }}
            />
          </Stack>

          <Stack tokens={{ childrenGap: 16 }} styles={{ root: { padding: 20, background: "#f8fafc", maxHeight: "75vh", overflowY: "auto" } }}>
            {selectedComplaint ? (
              <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
                <Stack styles={{ root: { flex: 1, minWidth: 220, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                  <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                    Category
                  </Text>
                  <Text variant="mediumPlus" styles={{ root: { fontWeight: 700 } }}>
                    {selectedComplaint.category || "—"}
                  </Text>
                </Stack>

                <Stack styles={{ root: { flex: 1, minWidth: 220, background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                  <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                    Current Status
                  </Text>
                  <Text variant="mediumPlus" styles={{ root: { fontWeight: 700, color: shellTheme.palette.themePrimary } }}>
                    {selectedComplaint.status || "OPEN"}
                  </Text>
                </Stack>

                <Stack styles={{ root: { width: "100%", background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb" } }} tokens={{ childrenGap: 6 }}>
                  <Text variant="small" styles={{ root: { color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 } }}>
                    Description
                  </Text>
                  <Text variant="smallPlus" styles={{ root: { color: "#374151" } }}>
                    {selectedComplaint.description || "No description provided."}
                  </Text>
                </Stack>
              </Stack>
            ) : null}

            <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
              <Stack grow styles={{ root: { minWidth: 240 } }} tokens={{ childrenGap: 6 }}>
                <Dropdown label="Status" options={ticketStatuses.map((s) => ({ key: s.key, text: s.label }))} selectedKey={statusValue} onChange={(_e, option) => setStatusValue((option?.key || "OPEN").toString())} />
                <Text variant="small" styles={{ root: { color: "#6b7280" } }}>
                  Move the complaint through your workflow.
                </Text>
              </Stack>

              <Stack grow styles={{ root: { minWidth: 240 } }} tokens={{ childrenGap: 6 }}>
                <Dropdown label="Assign Vendor" options={vendorOptions} selectedKey={vendorValue} onChange={(_e, option) => setVendorValue(option?.key?.toString() || "")} />
                <Text variant="small" styles={{ root: { color: "#6b7280" } }}>
                  Choose an active vendor or keep it unassigned.
                </Text>
              </Stack>
            </Stack>

            {saveError ? <MessageBar messageBarType={MessageBarType.error}>{saveError}</MessageBar> : null}

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton text="Cancel" onClick={handleClose} disabled={saving} />
              <PrimaryButton text={saving ? "Saving..." : "Save"} onClick={handleSave} disabled={saving} />
            </Stack>
          </Stack>
        </Stack>
      </Modal>
    </Stack>
  );
}

const complaintExtraColumns = [
  { key: "raised_by_name", name: "Resident", minWidth: 140, onRender: (item) => item.raised_by_name || "—" },
  { key: "raised_by_number", name: "WhatsApp", minWidth: 140, onRender: (item) => item.raised_by_number || "—" },
  {
    key: "created_from",
    name: "From",
    minWidth: 180,
    onRender: (item) => {
      const society = item.society_name || "—";
      const apt = item.raised_by_apartment ? ` / ${item.raised_by_apartment}` : "";
      return `${society}${apt}`;
    },
  },
  { key: "assigned_vendor", name: "Assigned Vendor", minWidth: 160, onRender: (item) => item.vendor_name || "Unassigned" },
];
