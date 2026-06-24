export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

// "2024-06-15" → "15 Jun 2024"
export function formatDateShort(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// "2024-06-15" → "15 Jun"
export function formatDayMonth(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// "2024-06" → "June 2024" (parsed in local time, not UTC, to avoid month roll-back)
export function formatMonth(m) {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// "2024-06-15T09:30:00Z" → "15 Jun, 09:30 AM"
export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// 1234.5 → "₹1,234.50"
export function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
