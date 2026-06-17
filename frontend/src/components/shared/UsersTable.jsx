import React, { useMemo, useState } from "react";
import { ConstrainMode, DetailsList, DetailsListLayoutMode, SelectionMode, Spinner, SpinnerSize, Stack, Text, TextField } from "@fluentui/react";
import { listStyles } from "../../theme.js";
import { formatDate } from "../../utils/formatDate.js";
import { useTableSort, baseGetValue } from "../../hooks/useTableSort.js";

function getUserName(item) {
  return item.name || item.full_name || item.user_name || "";
}

function filterUsers(items, text) {
  if (!text) return items;
  return items.filter((item) =>
    [item.id, getUserName(item), item.whatsapp_number, item.role, item.society_id, item.apartment, item.created_at]
      .filter(Boolean).join(" ").toLowerCase().includes(text)
  );
}

export function UsersTable({ items, loading, showFilters = true }) {
  const [filterText, setFilterText] = useState("");
  const { sortState, handleColumnResize, applySortOrder, makeCol } = useTableSort("created");

  const columns = useMemo(() => [
    makeCol("id",        "ID",        { fieldName: "id",              minWidth: 80,  maxWidth: 120 }),
    makeCol("name",      "Name",      { fieldName: "name",            minWidth: 140, maxWidth: 200, onRender: (item) => getUserName(item) || "—" }),
    makeCol("whatsapp",  "WhatsApp",  { fieldName: "whatsapp_number", minWidth: 140, maxWidth: 200 }),
    makeCol("role",      "Role",      { fieldName: "role",            minWidth: 100, maxWidth: 140 }),
    makeCol("society",   "Society",   { fieldName: "society_id",      minWidth: 80,  maxWidth: 120 }),
    makeCol("apartment", "Apartment", { fieldName: "apartment",       minWidth: 120, maxWidth: 160 }),
    makeCol("created",   "Created",   { fieldName: "created_at",      minWidth: 180, onRender: (item) => formatDate(item.created_at) }),
  ], [makeCol]);

  const processedItems = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const filtered = filterUsers(items || [], text);
    return applySortOrder(filtered, (item) => {
      if (sortState.key === "name") return getUserName(item).toLowerCase();
      return baseGetValue(item, sortState.key);
    });
  }, [items, filterText, sortState, applySortOrder]);

  if (loading) return <Spinner label="Loading…" size={SpinnerSize.medium} />;
  if (!items || items.length === 0)
    return <Text variant="small" styles={{ root: { color: "#697586" } }}>No users found.</Text>;

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
          onColumnResize={handleColumnResize}
        />
      </Stack>
    </Stack>
  );
}
