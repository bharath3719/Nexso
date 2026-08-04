import React, { useEffect, useMemo, useState } from "react";
import { ConstrainMode, DetailsList, DetailsListLayoutMode, Dropdown, IconButton, PrimaryButton, SelectionMode, Spinner, SpinnerSize, Stack, Text, TextField } from "@fluentui/react";
import { ticketStatuses } from "../../constants.js";
import { formatDate } from "../../utils/formatDate.js";
import { listStyles } from "../../theme.js";
import { useTableSort, baseGetValue } from "../../hooks/useTableSort.js";
import { StatusBadge } from "./TicketShared.jsx";
import "../../styles/TicketsTable.css";

// Rows are taller than the shared default so the two-line "Raised By" cell fits.
const ticketListStyles = {
  ...listStyles,
  contentWrapper: {
    paddingTop: 0,
    selectors: {
      ".ms-DetailsRow":           { minHeight: 48 },
      ".ms-DetailsRow-cell":      { height: 48, paddingTop: 0, paddingBottom: 0, display: "flex", alignItems: "center" },
      ".ms-DetailsRow-cellCheck": { height: 48 },
    },
  },
};

/** Deterministic hue from a name → vendor avatar background colour. */
function nameToHue(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Reusable extra columns ───────────────────────────────────────────────────
// Passed via `extraColumns` by the pages that have the joined fields available
// (the /api/tickets rows carry raised_by_name, society_name, raised_by_apartment
// and vendor_name). Defined at module scope so the array reference stays stable.

/** Resident who raised the ticket + where they live, stacked in one cell. */
export const raisedByColumn = {
  key: "raised_by",
  name: "Raised By",
  minWidth: 140,
  maxWidth: 220,
  onRender: (item) => {
    const who   = item.raised_by_name || item.raised_by_number || "Unknown";
    const where = [item.society_name, item.raised_by_apartment].filter(Boolean).join(" · ");
    return (
      <div className="tt-stacked-cell">
        <span className="tt-stacked-cell__primary" title={who}>{who}</span>
        <span className="tt-stacked-cell__meta" title={where}>{where || "—"}</span>
      </div>
    );
  },
};

/** Assigned vendor, with an initials avatar — or a muted "Unassigned" pill. */
export const vendorColumn = {
  key: "vendor_name",
  name: "Assigned Vendor",
  minWidth: 120,
  maxWidth: 190,
  onRender: (item) => {
    if (!item.vendor_name) return <span className="tt-vendor-none">Unassigned</span>;
    return (
      <span className="tt-vendor" title={item.vendor_name}>
        <span className="tt-vendor__avatar" style={{ background: `hsl(${nameToHue(item.vendor_name)}, 50%, 40%)` }}>
          {initials(item.vendor_name)}
        </span>
        <span className="tt-vendor__name">{item.vendor_name}</span>
      </span>
    );
  },
};

function filterTickets(items, statusFilter, text) {
  return items
    .filter((t) => statusFilter === "ALL" || t.status === statusFilter)
    .filter((t) => !text || [t.id, t.status, t.category, t.description, t.created_at, t.raised_by_name, t.society_name, t.raised_by_apartment, t.vendor_name].filter(Boolean).join(" ").toLowerCase().includes(text));
}

export function TicketsTable({ items, loading, emptyLabel, showFilters = true, pageSize = null, onAction = null, actionLabel = "Manage", actionFirst = false, extraColumns = [] }) {
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const { sortState, columnWidths, handleColumnResize, applySortOrder, makeCol } = useTableSort("created");

  const columns = useMemo(() => {
    const actionCol = onAction ? {
      key: "action",
      name: "",
      minWidth: 72,
      maxWidth: 80,
      isResizable: false,
      onRender: (item) => <PrimaryButton text={actionLabel} onClick={() => onAction(item)} styles={{ root: { minWidth: 0, padding: "0 10px", height: 28 } }} />,
    } : null;

    return [
      makeCol("id",          "ID",          { fieldName: "id",          minWidth: 46,  maxWidth: 70  }),
      ...(actionFirst && actionCol ? [actionCol] : []),
      makeCol("status",      "Status",      {
        fieldName: "status", minWidth: 96, maxWidth: 120,
        onRender: (item) => <StatusBadge status={item.status || "OPEN"} />,
      }),
      makeCol("category",    "Category",    { fieldName: "category",    minWidth: 70,  maxWidth: 110 }),
      makeCol("description", "Description", {
        fieldName: "description", minWidth: 120, maxWidth: 280, isMultiline: false,
        onRender: (item) => <span title={item.description} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description || "—"}</span>,
      }),
      ...extraColumns.map((col) => ({ isResizable: true, currentWidth: columnWidths[col.key], ...col })),
      makeCol("created",     "Created",     { fieldName: "created_at",  minWidth: 80,  maxWidth: 120, onRender: (item) => formatDate(item.created_at) }),
      ...(!actionFirst && actionCol ? [actionCol] : []),
    ];
  }, [makeCol, onAction, actionLabel, extraColumns, actionFirst, columnWidths]);

  const processedItems = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const filtered = filterTickets(items || [], statusFilter, text);
    return applySortOrder(filtered, (item) => baseGetValue(item, sortState.key));
  }, [items, filterText, statusFilter, sortState.key, applySortOrder]);

  useEffect(() => { setPage(0); }, [filterText, statusFilter, sortState]);

  useEffect(() => {
    const pageCount = pageSize ? Math.max(1, Math.ceil(processedItems.length / pageSize)) : 1;
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [processedItems.length, pageSize, page]);

  if (loading) return <Spinner label="Loading…" size={SpinnerSize.medium} />;
  if (!items || items.length === 0)
    return <Text variant="small" className="tt-empty-label">{emptyLabel}</Text>;

  return (
    /*
      minWidth: 0 on the outer Stack ensures this component shrinks properly when
      it is itself a flex child — without it the Stack expands to fit its content
      and the scroll div below never gets a constrained width for overflow scrolling.
    */
    <Stack tokens={{ childrenGap: 8 }} className="tt-root">
      {showFilters ? (
        <Stack horizontal tokens={{ childrenGap: 8 }} wrap>
          <TextField label="Search" value={filterText} onChange={(_, v) => setFilterText(v || "")} styles={{ fieldGroup: { maxWidth: 260 } }} />
          <Dropdown label="Status" options={[{ key: "ALL", text: "All" }, ...ticketStatuses.map((s) => ({ key: s.key, text: s.label }))]} selectedKey={statusFilter} onChange={(_e, option) => setStatusFilter((option?.key || "ALL").toString())} styles={{ dropdown: { width: 160 } }} />
        </Stack>
      ) : null}

      <div className="tt-scroll-container">
        <DetailsList
          items={pageSize ? processedItems.slice(page * pageSize, page * pageSize + pageSize) : processedItems}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          constrainMode={ConstrainMode.horizontalConstrained}
          selectionMode={SelectionMode.none}
          styles={ticketListStyles}
          onColumnResize={handleColumnResize}
        />
      </div>

      {pageSize ? (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <IconButton iconProps={{ iconName: "ChevronLeft" }} ariaLabel="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
          <IconButton iconProps={{ iconName: "ChevronRight" }} ariaLabel="Next page" disabled={(page + 1) * pageSize >= processedItems.length} onClick={() => setPage((p) => ((p + 1) * pageSize >= processedItems.length ? p : p + 1))} />
          <Text variant="small" className="tt-pagination-label">
            Page {page + 1} of {Math.max(1, Math.ceil(processedItems.length / pageSize))}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
