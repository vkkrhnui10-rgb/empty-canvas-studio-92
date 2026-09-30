/* Grow monthly report (xlsx/csv) → standing-order runs */
import { normPhone } from "./grow";

export interface ReportRow {
  key: string; // stable id for de-duplication (Grow reference)
  date: string; // YYYY-MM-DD
  sum: number;
  name: string;
  phone: string;
  email: string;
  desc: string;
}

const norm = (s: string) => s.replace(/[\s"'״׳]/g, "").toLowerCase();

/** Excel date serial (or an already formatted date) → YYYY-MM-DD */
function toDate(v: string): string {
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

/** returns the standing-order charge rows of a Grow report; `skipped` counts everything else */
export function parseGrowReport(rows: string[][]): { rows: ReportRow[]; skipped: number } {
  const hi = rows.findIndex((r) => r.some((c) => norm(c ?? "") === norm("תאריך חיוב")));
  if (hi < 0) throw new Error("לא נמצאו כותרות של דוח Grow");
  const head = rows[hi].map((c) => norm(c ?? ""));
  const col = (name: string) => head.indexOf(norm(name));
  const c = {
    date: col("תאריך חיוב"),
    first: col("שם"),
    last: col("משפחה"),
    email: col("אימייל"),
    phone: col("טלפון"),
    kind: col("סוג תשלום"),
    sum: col("סכום"),
    ref: col("אסמכתא"),
    desc: col("תיאור התשלום"),
  };
  if (c.date < 0 || c.sum < 0) throw new Error("חסרות עמודות בדוח");
  const out: ReportRow[] = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    const date = toDate(get(c.date));
    const sum = Number(get(c.sum)) || 0;
    const isSO = norm(get(c.kind)) === norm("הוראת קבע");
    if (!date || !isSO || sum <= 0) {
      if (r.some((x) => x)) skipped++;
      continue;
    }
    out.push({
      key: get(c.ref) ? `rep-${get(c.ref)}` : `rep-${date}-${get(c.phone)}-${sum}`,
      date,
      sum,
      name: `${get(c.first)} ${get(c.last)}`.trim(),
      phone: get(c.phone),
      email: get(c.email).toLowerCase(),
      desc: get(c.desc),
    });
  }
  return { rows: out, skipped };
}

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
