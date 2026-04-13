import React, { useMemo, useState } from "react";
import { ConstrainMode, DetailsList, DetailsListLayoutMode, SelectionMode, Spinner, SpinnerSize, Stack, Text, TextField } from "@fluentui/react";
import { listStyles } from "../theme.js";
import { formatDate } from "../utils/formatDate.js";

function getUserName(item) {
  return item.name || item.full_name || item.user_name || "";
}

export function UsersTable({ items, loading, showFilters = true }) {
  const [filterText, setFilterText] = useState("");
  const [sortState, setSortState] = useState({ key: "created", isDesc: true });
  const [columnWidths, setColumnWidths] = useState({});

  const columns = useMemo(() => {
    const handleSort = (_e, column) => {
      const isDesc = sortState.key === column.key ? !sortState.isDesc : column.key === "created" || column.key === "id";
      setSortState({ key: column.key, isDesc });
    };

    return [
      { key: "id", name: "ID", fieldName: "id", minWidth: 80, maxWidth: 120, onColumnClick: handleSort, isSorted: sortState.key === "id", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.id },
      {
        key: "name",
        name: "Name",
        fieldName: "name",
        minWidth: 140,
        maxWidth: 200,
        onRender: (item) => getUserName(item) || "—",
        onColumnClick: handleSort,
        isSorted: sortState.key === "name",
        isSortedDescending: sortState.isDesc,
        isResizable: true,
        currentWidth: columnWidths.name,
      },
      { key: "whatsapp", name: "WhatsApp", fieldName: "whatsapp_number", minWidth: 140, maxWidth: 200, onColumnClick: handleSort, isSorted: sortState.key === "whatsapp", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.whatsapp },
      { key: "role", name: "Role", fieldName: "role", minWidth: 100, maxWidth: 140, onColumnClick: handleSort, isSorted: sortState.key === "role", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.role },
      { key: "society", name: "Society", fieldName: "society_id", minWidth: 80, maxWidth: 120, onColumnClick: handleSort, isSorted: sortState.key === "society", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.society },
      { key: "apartment", name: "Apartment", fieldName: "apartment", minWidth: 120, maxWidth: 160, onColumnClick: handleSort, isSorted: sortState.key === "apartment", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.apartment },
      { key: "created", name: "Created", fieldName: "created_at", minWidth: 180, onRender: (item) => formatDate(item.created_at), onColumnClick: handleSort, isSorted: sortState.key === "created", isSortedDescending: sortState.isDesc, isResizable: true, currentWidth: columnWidths.created },
    ];
  }, [sortState, columnWidths]);

  const processedItems = useMemo(() => {
    const source = items || [];
    const text = filterText.trim().toLowerCase();
    const filtered = source.filter((item) => {
      if (!text) return true;
      const haystack = `${item.id || ""} ${getUserName(item)} ${item.whatsapp_number || ""} ${item.role || ""} ${item.society_id || ""} ${item.apartment || ""} ${item.created_at || ""}`.toLowerCase();
      return haystack.includes(text);
    });

    const getValue = (item) => {
      if (sortState.key === "created") return item.created_at ? new Date(item.created_at).getTime() : 0;
      if (sortState.key === "id") return Number(item.id) || 0;
      if (sortState.key === "name") return getUserName(item).toLowerCase();
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
  }, [items, filterText, sortState]);

  if (loading) return <Spinner label="Loading…" size={SpinnerSize.medium} />;
  if (!items || items.length === 0)
    return (
      <Text variant="small" styles={{ root: { color: "#697586" } }}>
        No users found.
      </Text>
    );

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      {showFilters ? <TextField label="Search" value={filterText} onChange={(_, v) => setFilterText(v || "")} styles={{ fieldGroup: { maxWidth: 260 } }} /> : null}
      <Stack styles={{ root: { overflowX: "auto", width: "100%" } }}>
        <DetailsList
          items={processedItems}
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
      </Stack>
    </Stack>
  );
}
