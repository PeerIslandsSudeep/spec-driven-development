export function formatINR(paise) {
  if (paise == null || isNaN(paise)) return "—";
  const rupees = (paise / 100).toFixed(2);
  const [whole, dec] = rupees.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const abs = whole.replace("-", "");
  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${rest ? grouped + "," : ""}${last3}.${dec}`;
}

export function formatDate(input) {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function toPaise(rupees) {
  if (rupees == null || rupees === "") return 0;
  const num = typeof rupees === "string" ? parseFloat(rupees.replace(/,/g, "")) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaise(paise) {
  if (paise == null) return "";
  return (paise / 100).toFixed(2);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isoPlusDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
