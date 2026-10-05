import { allSORuns, type SOEntry } from "./store";
import { heMonth, ils } from "./utils";
import type { DB, Project } from "./types";

/**
 * Monthly hosting report: who paid, who owes, what reaches the bank on the payout day,
 * and a list of reasons that adds up exactly to the difference from the previous month.
 * Pure function of the workspace — no clock, no network.
 */

export type RowState = "paid" | "failed" | "missing" | "pending" | "inactive";

export interface ReportRow {
  projectId: string;
  name: string;
  state: RowState;
  gross: number;
  net: number;
  /** last successful charge date in the month ("" when none) */
  date: string;
  /** failure reason or short remark */
  note: string;
}

export interface Reason {
  kind:
    | "new"
    | "back"
    | "lost"
    | "failed"
    | "stopped"
    | "more"
    | "less"
    | "price"
    | "fees"
    | "fee"
    | "other";
  projectId: string;
  who: string;
  /** signed effect on the bank credit, in ₪ */
  delta: number;
  text: string;
}

export interface HostReport {
  key: string;
  prevKey: string;
  rows: ReportRow[];
  gross: number;
  net: number;
  fee: number;
  /** what reaches the bank (0 when nothing was charged) */
  payout: number;
  payoutDate: string;
  /** the month is still running, so numbers are partial */
  open: boolean;
  /** what the price list says should come in every month */
  expected: number;
  prevPayout: number;
  prevGross: number;
  diff: number;
  reasons: Reason[];
  /** at least one run in the month has no net figure from a Grow report, so fees are not exact */
  netGuess: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;
const mk = (d: string) => d.slice(0, 7);
export const shiftKey = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** months that have any run, newest first, always including the current one */
export function reportMonths(db: DB, today: string): string[] {
  const set = new Set<string>([mk(today)]);
  for (const r of allSORuns(db)) set.add(mk(r.date));
  return [...set].sort().reverse();
}

const isActive = (p: Project) => p.hosted && !["cancelled", "paused"].includes(p.soState);

export function buildHostReport(db: DB, key: string, today: string): HostReport {
  const payDay = db.settings?.growPayoutDay || 10;
  const fee = db.settings?.growMonthlyFee ?? 19.94;
  const prevKey = shiftKey(key, -1);
  const runs = allSORuns(db);
  const projects = new Map(db.projects.map((p) => [p.id, p]));
  const nameOf = (id: string, fallback = "") => {
    const p = projects.get(id);
    return p ? p.client || p.name : fallback || "לא משויך";
  };

  const netKnown = new Set<string>();
  for (const c of db.soContacts) for (const r of c.runs) if (r.net != null) netKnown.add(r.id);
  for (const p of db.projects)
    for (const r of p.soRuns || []) if (r.net != null) netKnown.add(r.id);

  const inMonth = (k: string) => runs.filter((r) => mk(r.date) === k);
  const sumBy = (rs: SOEntry[]) => {
    const m = new Map<
      string,
      { gross: number; net: number; n: number; date: string; who: string }
    >();
    for (const r of rs) {
      if (!r.ok) continue;
      const x = m.get(r.projectId) ?? { gross: 0, net: 0, n: 0, date: "", who: r.who };
      x.gross = round(x.gross + r.sum);
      x.net = round(x.net + r.net);
      x.n += 1;
      if (r.date > x.date) x.date = r.date;
      m.set(r.projectId, x);
    }
    return m;
  };
  const failsBy = (rs: SOEntry[]) => {
    const m = new Map<string, string>();
    for (const r of rs) if (!r.ok) m.set(r.projectId, r.id);
    return m;
  };

  const cur = inMonth(key);
  const prev = inMonth(prevKey);
  const curP = sumBy(cur);
  const prevP = sumBy(prev);
  const curFail = failsBy(cur);
  const open = key >= mk(today);

  // failure reasons live on the raw runs
  const failNote = new Map<string, string>();
  for (const c of db.soContacts)
    for (const r of c.runs)
      if (!r.ok && mk(r.date) === key && r.note) failNote.set(c.projectId, r.note);
  for (const p of db.projects)
    for (const r of p.soRuns || [])
      if (!r.ok && mk(r.date) === key && r.note) failNote.set(p.id, r.note);

  const typicalDay = (id: string) => {
    const last = runs.find((r) => r.projectId === id && r.ok && mk(r.date) < key);
    return last ? Number(last.date.slice(8, 10)) : 0;
  };

  const ids = new Set<string>([...curP.keys(), ...curFail.keys()]);
  for (const p of db.projects) if (p.hosted && (isActive(p) || ids.has(p.id))) ids.add(p.id);

  const rows: ReportRow[] = [];
  for (const id of ids) {
    const p = projects.get(id);
    const paid = curP.get(id);
    let state: RowState;
    if (paid) state = "paid";
    else if (curFail.has(id)) state = "failed";
    else if (p && !isActive(p)) state = "inactive";
    else if (open && typicalDay(id) > Number(today.slice(8, 10))) state = "pending";
    else state = "missing";
    if (state === "inactive" && !paid) continue;
    rows.push({
      projectId: id,
      name: nameOf(id, paid?.who),
      state,
      gross: paid?.gross ?? 0,
      net: paid?.net ?? 0,
      date: paid?.date ?? "",
      note: state === "failed" ? failNote.get(id) || p?.soFailReason || "" : "",
    });
  }
  const order: RowState[] = ["failed", "missing", "pending", "paid", "inactive"];
  rows.sort(
    (a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.name.localeCompare(b.name, "he"),
  );

  const tot = (m: Map<string, { gross: number; net: number }>) => ({
    gross: round([...m.values()].reduce((s, x) => s + x.gross, 0)),
    net: round([...m.values()].reduce((s, x) => s + x.net, 0)),
  });
  const T = tot(curP);
  const PT = tot(prevP);
  const payout = curP.size ? Math.max(0, round(T.net - fee)) : 0;
  const prevPayout = prevP.size ? Math.max(0, round(PT.net - fee)) : 0;

  /* ---- why it differs from last month: reasons add up to the exact bank-credit difference ---- */
  const reasons: Reason[] = [];
  const everBefore = (id: string) =>
    runs.some((r) => r.projectId === id && r.ok && mk(r.date) < prevKey);
  for (const id of new Set([...curP.keys(), ...prevP.keys()])) {
    const a = prevP.get(id);
    const b = curP.get(id);
    const g0 = a?.gross ?? 0;
    const g1 = b?.gross ?? 0;
    const d = round(g1 - g0);
    if (Math.abs(d) < 0.005) continue;
    const who = nameOf(id, (b ?? a)?.who);
    const p = projects.get(id);
    let kind: Reason["kind"];
    let text: string;
    if (!a && b) {
      kind = everBefore(id) ? "back" : "new";
      text = kind === "new" ? "לקוח חדש בהוראת קבע" : "חזר לשלם אחרי חודש בלי חיוב";
    } else if (a && !b) {
      if (curFail.has(id) || p?.soState === "failed") {
        kind = "failed";
        text = `החיוב נכשל${failNote.get(id) ? ` (${failNote.get(id)})` : ""}`;
      } else if (p && !isActive(p)) {
        kind = "stopped";
        text = p.soState === "paused" ? "הוראת הקבע הושהתה" : "הוראת הקבע בוטלה";
      } else {
        kind = "lost";
        text = open ? "עדיין לא חויב החודש" : "לא היה חיוב החודש";
      }
    } else if ((b?.n ?? 0) > (a?.n ?? 0)) {
      kind = "more";
      text = `${b!.n} חיובים החודש לעומת ${a!.n}`;
    } else if ((b?.n ?? 0) < (a?.n ?? 0)) {
      kind = "less";
      text = `${b!.n} חיובים החודש לעומת ${a!.n}`;
    } else {
      kind = "price";
      text = `סכום החיוב השתנה מ-${ils(g0)} ל-${ils(g1)}`;
    }
    reasons.push({ kind, projectId: id, who, delta: d, text });
  }
  // Grow's per-charge fees (gross minus net) differ between the months
  const feesNow = round(T.gross - T.net);
  const feesPrev = round(PT.gross - PT.net);
  const feeDelta = round(-(feesNow - feesPrev));
  if (Math.abs(feeDelta) >= 0.01)
    reasons.push({
      kind: "fees",
      projectId: "",
      who: "עמלות Grow",
      delta: feeDelta,
      text: `עמלות על חיובים: ${ils(feesNow)} החודש לעומת ${ils(feesPrev)}`,
    });
  // the monthly operational fee only applies to a month that had charges
  const opNow = curP.size ? fee : 0;
  const opPrev = prevP.size ? fee : 0;
  if (opNow !== opPrev)
    reasons.push({
      kind: "fee",
      projectId: "",
      who: "עמלה תפעולית",
      delta: round(-(opNow - opPrev)),
      text: opNow ? `${ils(fee)} עמלה חודשית של Grow` : "בלי חיובים אין עמלה חודשית",
    });
  const diff = round(payout - prevPayout);
  const explained = round(reasons.reduce((s, r) => s + r.delta, 0));
  const rest = round(diff - explained);
  if (Math.abs(rest) >= 0.01)
    reasons.push({
      kind: "other",
      projectId: "",
      who: "אחר",
      delta: rest,
      text: "הפרשי עיגול או יתרה",
    });
  reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    key,
    prevKey,
    rows,
    gross: T.gross,
    net: T.net,
    fee,
    payout,
    payoutDate: `${shiftKey(key, 1)}-${String(payDay).padStart(2, "0")}`,
    open,
    expected: round(db.projects.filter(isActive).reduce((s, p) => s + (p.hostPrice || 0), 0)),
    prevPayout,
    prevGross: PT.gross,
    diff,
    reasons,
    netGuess: cur.some((r) => r.ok && !netKnown.has(r.id)),
  };
}

const STATE_LABEL: Record<RowState, string> = {
  paid: "שילמו",
  failed: "חיוב נכשל",
  missing: "לא חויבו",
  pending: "ממתינים לחיוב",
  inactive: "לא פעילים",
};
export const stateLabel = (s: RowState) => STATE_LABEL[s];

/** plain text for WhatsApp / clipboard */
export function reportText(r: HostReport): string {
  const L: string[] = [];
  L.push(`*דוח אחסון ${heMonth(r.key)}*${r.open ? " (עד עכשיו)" : ""}`);
  L.push(`זיכוי לבנק ב-${r.payoutDate.split("-").reverse().join(".")}: *${ils(r.payout)}*`);
  L.push(`${ils(r.gross)} ברוטו − עמלות − ${ils(r.fee)} עמלה חודשית`);
  if (r.netGuess) L.push("(חלק מהעמלות לא מדויקות: חסר דוח Grow)");
  for (const s of ["failed", "missing", "pending", "paid"] as RowState[]) {
    const rs = r.rows.filter((x) => x.state === s);
    if (!rs.length) continue;
    L.push("", `*${STATE_LABEL[s]} (${rs.length})*`);
    for (const x of rs)
      L.push(`• ${x.name}${s === "paid" ? ` ${ils(x.gross)}` : x.note ? ` (${x.note})` : ""}`);
  }
  if (r.reasons.length) {
    L.push(
      "",
      `*מה השתנה מ${heMonth(r.prevKey)}* (${r.diff >= 0 ? "+" : "−"}${ils(Math.abs(r.diff))})`,
    );
    for (const x of r.reasons)
      L.push(`• ${x.delta >= 0 ? "+" : "−"}${ils(Math.abs(x.delta))} ${x.who}: ${x.text}`);
  }
  return L.join("\n");
}

export function reportCsv(r: HostReport): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["לקוח", "מצב", "ברוטו", "נטו", "תאריך", "הערה"];
  const lines = r.rows.map((x) =>
    [x.name, STATE_LABEL[x.state], x.gross, x.net, x.date, x.note].map(q).join(","),
  );
  return "﻿" + [head.map(q).join(","), ...lines].join("\n");
}
