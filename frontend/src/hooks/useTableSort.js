import { useCallback, useState } from "react";

const VALUE_GETTERS = {
  created:  (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
  id:       (item) => Number(item.id) || 0,
  whatsapp: (item) => (item.whatsapp_number || "").toString().toLowerCase(),
  society:  (item) => (item.society_id || "").toString().toLowerCase(),
};

export function baseGetValue(item, key) {
  return (VALUE_GETTERS[key] ?? ((i) => (i[key] || "").toString().toLowerCase()))(item);
}

export function useTableSort(defaultKey = "created") {
  const [sortState, setSortState] = useState({ key: defaultKey, isDesc: true });
  const [columnWidths, setColumnWidths] = useState({});

  const handleSort = useCallback((_e, column) => {
    const isDesc = sortState.key === column.key
      ? !sortState.isDesc
      : column.key === "created" || column.key === "id";
    setSortState({ key: column.key, isDesc });
  }, [sortState]);

  const handleColumnResize = useCallback((column, newWidth) => {
    if (!column?.key || !newWidth) return;
    setColumnWidths((prev) => ({ ...prev, [column.key]: newWidth }));
  }, []);

  const applySortOrder = useCallback((items, getValue) => {
    const dir = sortState.isDesc ? -1 : 1;
    return items.slice().sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av === bv) return 0;
      return av > bv ? -dir : dir;
    });
  }, [sortState]);

  const makeCol = useCallback((key, name, extra = {}) => ({
    key,
    name,
    isSorted:           sortState.key === key,
    isSortedDescending: sortState.isDesc,
    onColumnClick:      handleSort,
    isResizable:        true,
    currentWidth:       columnWidths[key],
    ...extra,
  }), [sortState, handleSort, columnWidths]);

  return { sortState, columnWidths, handleSort, handleColumnResize, applySortOrder, makeCol };
}
