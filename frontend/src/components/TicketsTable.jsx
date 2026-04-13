import React, { useEffect, useMemo, useState } from "react";
import { Dropdown, IconButton, PrimaryButton, Spinner, SpinnerSize, Stack, Text, TextField } from "@fluentui/react";
import { ticketStatuses } from "../constants.js";
import { formatDate } from "../utils/formatDate.js";
import { listStyles } from "../theme.js";
import { ConstrainMode, DetailsList, DetailsListLayoutMode, SelectionMode } from "@fluentui/react";

export function TicketsTable({ items, loading, emptyLabel, showFilters = true, pageSize = null, onAction = null, actionLabel = "Manage", extraColumns = [] }) {
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortState, setSortState] = useState({ key: "created", isDesc: true });
  const [page, setPage] = useState(0);
  const [columnWidths, setColumnWidths] = useState({});

  const columns = useMemo(() => {
    const handleSort = (_e, column) => {
      const isDesc = sortState.key === column.key ? !sortState.isDesc : column.key === "created" || column.key === "id";
      setSortState({ key: column.key, isDesc });
    };

    const baseColumns = [
      { key: "id", name: "ID", fieldName: "id", minWidth: 90, maxWidth: 140, onColumnClick: handleSort, isSorted: sortState.key === "id", isSortedDescending: sortState.isDesc, isResizable: true },
      { key: "status", name: "Status", fieldName: "status", minWidth: 90, maxWidth: 120, onColumnClick: handleSort, isSorted: sortState.key === "status", isSortedDescending: sortState.isDesc, isResizable: true },
      { key: "category", name: "Category", fieldName: "category", minWidth: 120, maxWidth: 180, onColumnClick: handleSort, isSorted: sortState.key === "category", isSortedDescending: sortState.isDesc, isResizable: true },
      { key: "description", name: "Description", fieldName: "description", minWidth: 220, onColumnClick: handleSort, isSorted: sortState.key === "description", isSortedDescending: sortState.isDesc, isResizable: true },
      ...extraColumns,
      { key: "created", name: "Created", fieldName: "created_at", minWidth: 180, onRender: (item) => formatDate(item.created_at), onColumnClick: handleSort, isSorted: sortState.key === "created", isSortedDescending: sortState.isDesc, isResizable: true },
    ];

    if (onAction) {
      baseColumns.push({
        key: "action",
        name: "Action",
        minWidth: 110,
        maxWidth: 120,
        isResizable: true,
        onRender: (item) => <PrimaryButton text={actionLabel} onClick={() => onAction(item)} />,
      });
    }

    return baseColumns.map((col) => ({
      ...col,
      isResizable: col.isResizable ?? true,
      currentWidth: columnWidths[col.key] ?? col.currentWidth,
    }));
  }, [sortState, onAction, actionLabel, extraColumns, columnWidths]);

  const processedItems = useMemo(() => {
    const source = items || [];
    const text = filterText.trim().toLowerCase();
    const filtered = source
      .filter((item) => (statusFilter === "ALL" ? true : item.status === statusFilter))
      .filter((item) => {
        if (!text) return true;
        const haystack = `${item.id || ""} ${item.status || ""} ${item.category || ""} ${item.description || ""} ${item.created_at || ""}`.toLowerCase();
        return haystack.includes(text);
      });

    const getValue = (item) => {
      if (sortState.key === "created") return item.created_at ? new Date(item.created_at).getTime() : 0;
      if (sortState.key === "id") return Number(item.id) || 0;
      if (sortState.key === "whatsapp") return (item.whatsapp_number || "").toString().toLowerCase();
      if (sortState.key === "society") return (item.society_id || "").toString().toLowerCase();
      return (item[sortState.key] || "").toString().toLowerCase();
    };

    return filtered.slice().sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av === bv) return 0;
      if (sortState.isDesc) return av > bv ? -1 : 1;
      return av > bv ? 1 : -1;
    });
  }, [items, filterText, statusFilter, sortState]);

  useEffect(() => {
    setPage(0);
  }, [filterText, statusFilter, sortState]);

  useEffect(() => {
    const pageCount = pageSize ? Math.max(1, Math.ceil(processedItems.length / pageSize)) : 1;
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [processedItems.length, pageSize, page]);

  if (loading) return <Spinner label="Loading…" size={SpinnerSize.medium} />;
  if (!items || items.length === 0)
    return (
      <Text variant="small" styles={{ root: { color: "#697586" } }}>
        {emptyLabel}
      </Text>
    );

  return (
    /*
      KEY FIX: minWidth: 0 on the outer Stack ensures this component shrinks
      properly when it is itself a flex child (e.g. inside Layout's content area).
      Without it the Stack expands to fit its content and the scroll div below
      never gets a constrained width to trigger overflow scrolling.
    */
    <Stack tokens={{ childrenGap: 8 }} styles={{ root: { minWidth: 0 } }}>
      {showFilters ? (
        <Stack horizontal tokens={{ childrenGap: 8 }} wrap>
          <TextField label="Search" value={filterText} onChange={(_, v) => setFilterText(v || "")} styles={{ fieldGroup: { maxWidth: 260 } }} />
          <Dropdown label="Status" options={[{ key: "ALL", text: "All" }, ...ticketStatuses.map((s) => ({ key: s.key, text: s.label }))]} selectedKey={statusFilter} onChange={(_e, option) => setStatusFilter((option?.key || "ALL").toString())} styles={{ dropdown: { width: 160 } }} />
        </Stack>
      ) : null}

      {/*
        The scroll container: overflowX: auto gives us the horizontal scrollbar,
        width: 100% + minWidth: 0 ensure it is bounded by the parent's width
        rather than the table's natural (potentially wider) width.
      */}
      <div style={{ overflowX: "auto", overflowY: "visible", width: "100%", minWidth: 0 }}>
        <DetailsList
          items={pageSize ? processedItems.slice(page * pageSize, page * pageSize + pageSize) : processedItems}
          columns={columns}
          layoutMode={DetailsListLayoutMode.fixedColumns}
          constrainMode={ConstrainMode.unconstrained}
          selectionMode={SelectionMode.none}
          styles={listStyles}
          onColumnResize={(column, newWidth) => {
            if (!column?.key || !newWidth) return;
            setColumnWidths((prev) => ({ ...prev, [column.key]: newWidth }));
          }}
        />
      </div>

      {pageSize ? (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <IconButton iconProps={{ iconName: "ChevronLeft" }} ariaLabel="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
          <IconButton iconProps={{ iconName: "ChevronRight" }} ariaLabel="Next page" disabled={(page + 1) * pageSize >= processedItems.length} onClick={() => setPage((p) => ((p + 1) * pageSize >= processedItems.length ? p : p + 1))} />
          <Text variant="small" styles={{ root: { color: "#5f6a7a" } }}>
            Page {page + 1} of {Math.max(1, Math.ceil(processedItems.length / pageSize))}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
