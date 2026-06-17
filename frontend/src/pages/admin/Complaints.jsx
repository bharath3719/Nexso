import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dropdown, IconButton, MessageBar, MessageBarType,
  Modal, PrimaryButton, DefaultButton, Stack, Text,
} from "@fluentui/react";
import { useJsonData } from "../../hooks/useJsonData.js";
import { TicketsTable } from "../../components/tickets/TicketsTable.jsx";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { T } from "../../styles/typography.js";
import { ticketStatuses } from "../../constants.js";
import { formatDate } from "../../utils/formatDate.js";
import { api } from "../../services/api.js";
import "../../styles/Complaints.css";

// Fluent pseudo-state styles for the white close button can't live in a plain
// CSS file (rootHovered / rootPressed are Fluent-specific slots), so they're
// extracted here as a constant rather than inlined at the call-site.
const modalCloseBtnStyles = {
  root:         { color: "#fff" },
  rootHovered:  { color: "#fff",                 background: "rgba(255,255,255,0.15)" },
  rootPressed:  { color: "#ddd",                 background: "rgba(255,255,255,0.25)" },
  rootDisabled: { color: "rgba(255,255,255,0.4)" },
};

export function ComplaintsPage() {
  const { loading, data, error, refetch } = useJsonData('/api/tickets?limit=200');
  const { data: vendorsData }             = useJsonData('/api/vendors?limit=200');
  const complaints = data?.tickets   || [];
  const vendors    = vendorsData?.vendors || [];
  const pageSize   = 10;

  const [showFilters,        setShowFilters]        = useState(false);
  const [modalOpen,          setModalOpen]          = useState(false);
  const [selectedComplaint,  setSelectedComplaint]  = useState(null);
  const [statusValue,        setStatusValue]        = useState("");
  const [vendorValue,        setVendorValue]        = useState("");
  const [saving,             setSaving]             = useState(false);
  const [saveError,          setSaveError]          = useState("");

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const vendorOptions = useMemo(() => [
    { key: "", text: "Unassigned" },
    ...vendors
      .filter((v) => v.active !== false)
      .map((v) => {
        const key   = (v.id ?? v.vendor_id ?? v.code ?? v.name ?? `${v}`).toString();
        const label = v.name || v.vendor_name || v.code || `Vendor ${v.id || v.vendor_id || v.code || ""}`;
        return { key, text: label };
      }),
  ], [vendors]);

  const openModal = (item) => {
    setSelectedComplaint(item);
    setStatusValue(item?.status || "OPEN");
    const rawVendorId    = item?.vendor_id;
    const matchedOption  = vendorOptions.find((o) => o.key !== "" && o.key === rawVendorId?.toString());
    if (rawVendorId && !matchedOption) {
      console.warn(`[ComplaintsPage] vendor_id "${rawVendorId}" on ticket #${item?.id} has no matching vendor option.`);
    }
    setVendorValue(matchedOption ? matchedOption.key : "");
    setSaveError("");
    setModalOpen(true);
  };

  const handleClose = () => { if (saving) return; setModalOpen(false); };

  const handleSave = async () => {
    if (!selectedComplaint) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.tickets.update(selectedComplaint.id, {
        status:    statusValue,
        vendor_id: vendorValue || null,
      });
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
    <Stack tokens={{ childrenGap: 20 }} className="cp-root">
      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}

      <PageHeader
        title="Complaints"
        action={
          <IconButton
            iconProps={{ iconName: showFilters ? "FilterSolid" : "Filter" }}
            title="Toggle filters"
            ariaLabel="Toggle filters"
            className="cp-filter-btn"
            onClick={() => setShowFilters((v) => !v)}
          />
        }
      />

      <TicketsTable
        items={complaints}
        loading={loading}
        emptyLabel="No complaints yet."
        pageSize={pageSize}
        showFilters={showFilters}
        onAction={openModal}
        actionLabel="Manage"
        actionFirst
        extraColumns={complaintExtraColumns}
      />

      <Modal isOpen={modalOpen} onDismiss={handleClose} isBlocking={false}>
        <Stack className="cp-modal-wrap">
          {/* ── Header ── */}
          <Stack
            horizontal
            verticalAlign="center"
            horizontalAlign="space-between"
            className="cp-modal-header"
          >
            <Stack tokens={{ childrenGap: 4 }}>
              <Text styles={T.modalHeader} className="cp-modal-header-title">
                Manage Complaint
              </Text>
              {selectedComplaint && (
                <Text styles={T.caption} className="cp-modal-header-subtitle">
                  ID #{selectedComplaint.id} · {formatDate(selectedComplaint.created_at)}
                </Text>
              )}
            </Stack>
            <IconButton
              iconProps={{ iconName: "Cancel" }}
              ariaLabel="Close"
              onClick={handleClose}
              disabled={saving}
              styles={modalCloseBtnStyles}
            />
          </Stack>

          {/* ── Body ── */}
          <Stack tokens={{ childrenGap: 16 }} className="cp-modal-body">
            {/* Info tiles */}
            {selectedComplaint && (
              <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
                <Stack className="cp-info-card" tokens={{ childrenGap: 4 }}>
                  <Text styles={T.caption} className="cp-card-label">Category</Text>
                  <Text styles={T.sectionHeader}>{selectedComplaint.category || "—"}</Text>
                </Stack>

                <Stack className="cp-info-card" tokens={{ childrenGap: 4 }}>
                  <Text styles={T.caption} className="cp-card-label">Current Status</Text>
                  <Text styles={T.sectionHeader} className="cp-card-status">
                    {selectedComplaint.status || "OPEN"}
                  </Text>
                </Stack>

                <Stack className="cp-info-card--full" tokens={{ childrenGap: 4 }}>
                  <Text styles={T.caption} className="cp-card-label">Description</Text>
                  <Text styles={T.tableSecondary}>
                    {selectedComplaint.description || "No description provided."}
                  </Text>
                </Stack>
              </Stack>
            )}

            {/* Controls */}
            <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
              <Stack grow className="cp-dropdown-col" tokens={{ childrenGap: 6 }}>
                <Dropdown
                  label="Status"
                  options={ticketStatuses.map((s) => ({ key: s.key, text: s.label }))}
                  selectedKey={statusValue}
                  onChange={(_e, option) => setStatusValue((option?.key || "OPEN").toString())}
                />
                <Text styles={T.caption}>Move the complaint through your workflow.</Text>
              </Stack>

              <Stack grow className="cp-dropdown-col" tokens={{ childrenGap: 6 }}>
                <Dropdown
                  label="Assign Vendor"
                  options={vendorOptions}
                  selectedKey={vendorValue}
                  onChange={(_e, option) => setVendorValue(option?.key?.toString() || "")}
                />
                <Text styles={T.caption}>Choose an active vendor or keep it unassigned.</Text>
              </Stack>
            </Stack>

            {saveError && <MessageBar messageBarType={MessageBarType.error}>{saveError}</MessageBar>}

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton text="Cancel"                       onClick={handleClose} disabled={saving} />
              <PrimaryButton text={saving ? "Saving..." : "Save"} onClick={handleSave}  disabled={saving} />
            </Stack>
          </Stack>
        </Stack>
      </Modal>
    </Stack>
  );
}

// Extra columns appended to TicketsTable for the complaints context.
// Defined outside the component so the array reference is stable (no useMemo needed).
const complaintExtraColumns = [
  { key: "raised_by_name",  name: "Resident",       minWidth: 90, maxWidth: 140, onRender: (item) => item.raised_by_name || "—" },
  {
    key: "created_from",
    name: "Society / Apt",
    minWidth: 100, maxWidth: 160,
    onRender: (item) => {
      const society = item.society_name || "—";
      const apt     = item.raised_by_apartment ? ` · ${item.raised_by_apartment}` : "";
      return `${society}${apt}`;
    },
  },
  { key: "assigned_vendor", name: "Vendor", minWidth: 90, maxWidth: 130, onRender: (item) => item.vendor_name || "—" },
];
