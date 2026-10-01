/* Grow monthly report (xlsx/csv) → standing-order runs */
import { normPhone } from "./grow";

export interface ReportRow {
  key: string; // stable id for de-duplication (Grow reference)
  date: string; // YYYY-MM-DD
  sum: number;
  net: number;
  name: string;
  phone: string;
  email: string;
  desc: string;
}

const norm = (s: string) => s.replace(/[\s"'״׳]/g, "").toLowerCase();

/** Excel date serial (or an already formatted date) → YYYY-MM-DD */
export function toDate(v: string): string {
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400) * 1000);
    return d.toISOString().slice(0, 10);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dm = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (dm) {
    const y = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    return `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }
  return "";
}

const SO_KINDS = new Set(["הוראת קבע", 'הו"ק', "הוק"].map(norm));
/** statuses (new export) that are not a real successful charge: refunds / disputes */
const okStatus = (s: string) => !s || norm(s) === norm("חוייב") || norm(s) === norm("חויב");

/** returns the standing-order charge rows of a Grow report (both export formats); `skipped` counts everything else */
export function parseGrowReport(rows: string[][]): { rows: ReportRow[]; skipped: number } {
  const hi = rows.findIndex((r) => r.some((c) => norm(c ?? "") === norm("תאריך חיוב")));
  if (hi < 0) throw new Error("לא נמצאו כותרות של דוח Grow");
  const head = rows[hi].map((c) => norm(c ?? ""));
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = head.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    date: col("תאריך חיוב"),
    first: col("שם"),
    last: col("משפחה"),
    email: col("אימייל", "כתובת מייל"),
    phone: col("טלפון"),
    kind: col("סוג תשלום"),
    status: col("סטטוס"),
    sum: col("סכום", "שולם"),
    net: col("להעברה", 'סה"כ העברה לבנק'),
    ref: col("אסמכתא"),
    desc: col("תיאור התשלום", "תיאור עסקה"),
  };
  const missing = [
    c.date < 0 && "תאריך חיוב",
    c.sum < 0 && "סכום / שולם",
    c.kind < 0 && "סוג תשלום",
    c.phone < 0 && c.email < 0 && "טלפון / מייל",
  ].filter(Boolean);
  if (missing.length) throw new Error(`חסרות עמודות בדוח: ${missing.join(", ")}`);
  const out: ReportRow[] = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    const date = toDate(get(c.date));
    const sum = Number(get(c.sum)) || 0;
    const isSO = SO_KINDS.has(norm(get(c.kind)));
    if (!date || !isSO || sum <= 0 || !okStatus(get(c.status))) {
      if (r.some((x) => x)) skipped++;
      continue;
    }
    const net =
      c.net >= 0 && get(c.net) !== "" ? Math.round(Number(get(c.net)) * 100) / 100 || sum : sum;
    out.push({
      key: get(c.ref) ? `rep-${get(c.ref)}` : `rep-${date}-${get(c.phone)}-${sum}`,
      date,
      sum,
      net,
      name: `${get(c.first)} ${get(c.last)}`.trim(),
      phone: get(c.phone),
      email: get(c.email).toLowerCase(),
      desc: get(c.desc),
    });
  }
  return { rows: out, skipped };
}

export interface OrderRow {
  name: string;
  start: string;
  count: number;
  nextSum: number;
  nextDate: string;
  state: "active" | "cancelled" | "attention";
  lastPay: string;
}

/** Grow's "standing orders" list (creation date, client, charges so far, next charge, status) */
export const isOrdersTable = (rows: string[][]) =>
  rows.some((r) => r.some((c) => norm(c ?? "") === norm("שם הלקוח"))) &&
  rows.some((r) => r.some((c) => norm(c ?? "").includes(norm("תאריך הקמה"))));

export function parseGrowOrders(rows: string[][]): OrderRow[] {
  const hi = rows.findIndex((r) => r.some((c) => norm(c ?? "") === norm("שם הלקוח")));
  if (hi < 0) throw new Error("לא נמצאה טבלת הוראות קבע");
  const head = rows[hi].map((c) => norm(c ?? ""));
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = head.findIndex((h) => h.includes(norm(n)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    start: col("תאריך הקמה"),
    name: col("שם הלקוח"),
    count: col("מספר החיובים"),
    sum: col("סכום החיוב הבא"),
    next: col("תאריך חיוב הבא"),
    state: col('סטטוס הו"ק', "סטטוס"),
    last: col("תשלום אחרון"),
  };
  const out: OrderRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    const name = get(c.name);
    if (!name) continue;
    const st = get(c.state);
    out.push({
      name,
      start: toDate(get(c.start)),
      count: parseInt(get(c.count), 10) || 0,
      nextSum: Number(get(c.sum).replace(/[^\d.]/g, "")) || 0,
      nextDate: toDate(get(c.next)),
      state: st.includes("בוטל") ? "cancelled" : st.includes("טיפול") ? "attention" : "active",
      lastPay: get(c.last),
    });
  }
  return out;
}

export const nameKey = (s: string) => norm(s);

export const samePerson = (
  p: { phone: string; email: string },
  r: { phone: string; email: string },
) => {
  const a = normPhone(r.phone);
  return (
    (a.length >= 9 && normPhone(p.phone) === a) ||
    (!!r.email && p.email.trim().toLowerCase() === r.email)
  );
};
