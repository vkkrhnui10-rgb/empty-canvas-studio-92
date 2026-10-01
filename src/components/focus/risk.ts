import { allSORuns } from "./store";
import type { DB, Project } from "./types";

export interface Risk {
  p: Project;
  reasons: { k: "fail" | "silent" | "source"; txt: string }[];
  score: number;
  /** days since the last real sign of contact */
  quietDays: number;
  /** monthly hosting income that is at stake */
  monthly: number;
}

const DAY = 86400000;
const dayMs = (d: string) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
};

/** last time anything happened with this client: a note, a lead conversation, a message, a payment, finished work */
export function lastTouch(db: DB, p: Project): number {
  const t: number[] = [p.created || 0, p.soMsgAt || 0];
  for (const n of p.notes) t.push(n.updated ?? n.created);
  for (const pay of p.payments) t.push(dayMs(pay.date));
  for (const task of db.tasks)
    if (task.projectId === p.id && task.completedAt) t.push(task.completedAt);
  for (const l of db.leads)
    if (l.projectId === p.id) for (const n of l.notes) if (n.kind !== "system") t.push(n.at);
  return Math.max(...t);
}

/** share of customers from each lead source that later cancelled hosting */
export function sourceChurn(db: DB) {
  const m = new Map<string, { n: number; cancelled: number }>();
  for (const l of db.leads) {
    const p = l.projectId ? db.projects.find((x) => x.id === l.projectId) : undefined;
    if (!p || !p.hosted || !l.source) continue;
    const s = m.get(l.source) ?? { n: 0, cancelled: 0 };
    s.n++;
    if (p.soState === "cancelled") s.cancelled++;
    m.set(l.source, s);
  }
  return m;
}

/** active hosted customers that show warning signs, riskiest first */
export function riskRows(db: DB, now = Date.now()): Risk[] {
  const runs = allSORuns(db);
  const churn = sourceChurn(db);
  const out: Risk[] = [];
  for (const p of db.projects) {
    if (!p.hosted || p.soState === "cancelled" || p.soState === "paused") continue;
    const reasons: Risk["reasons"] = [];

    const fails = runs.filter(
      (r) => r.projectId === p.id && !r.ok && now - dayMs(r.date) <= 120 * DAY,
    ).length;
    if (fails >= 2)
      reasons.push({ k: "fail", txt: `חיוב נכשל ${fails} פעמים ב-4 החודשים האחרונים` });

    const quiet = Math.floor((now - lastTouch(db, p)) / DAY);
    if (quiet >= 90) reasons.push({ k: "silent", txt: `אין קשר ${quiet} ימים` });

    const lead = db.leads.find((l) => l.projectId === p.id);
    const s = lead?.source ? churn.get(lead.source) : undefined;
    if (lead && s && s.n >= 3 && s.cancelled / s.n >= 0.4)
      reasons.push({
        k: "source",
        txt: `בא מ"${lead.source}" — ${Math.round((s.cancelled / s.n) * 100)}% מהלקוחות משם ביטלו`,
      });

    if (!reasons.length) continue;
    out.push({
      p,
      reasons,
      score: reasons.reduce((a, r) => a + (r.k === "fail" ? 2 : 1), 0),
      quietDays: quiet,
      monthly: p.hostPrice || 0,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.monthly - a.monthly);
}
