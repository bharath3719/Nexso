export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

// "2024-06" → "June 2024"
export function formatMonth(m) {
  if (!m) return "";
  return new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
