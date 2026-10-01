import type { DB, Project, SiteType } from "./types";

/** minutes of focus time per project (tasks' banked time, or the session log if that is higher) */
export function minutesByProject(db: DB): Map<string, number> {
  const fromTasks = new Map<string, number>();
  for (const t of db.tasks)
    if (t.projectId)
      fromTasks.set(t.projectId, (fromTasks.get(t.projectId) ?? 0) + (t.actualMin || 0));
  const fromSessions = new Map<string, number>();
  for (const s of db.sessions)
    if (s.projectId)
      fromSessions.set(s.projectId, (fromSessions.get(s.projectId) ?? 0) + (s.min || 0));
  const out = new Map<string, number>();
  for (const p of db.projects)
    out.set(p.id, Math.max(fromTasks.get(p.id) ?? 0, fromSessions.get(p.id) ?? 0));
  return out;
}

export interface ProjProfit {
  p: Project;
  min: number;
  hours: number;
  price: number;
  perHour: number;
}

/** shekels per hour for every project that has both a build price and enough tracked time */
export function profitRows(db: DB, minMinutes = 30): ProjProfit[] {
  const mins = minutesByProject(db);
  return db.projects
    .map((p) => {
      const min = mins.get(p.id) ?? 0;
      return { p, min, hours: min / 60, price: p.buildPrice || 0, perHour: 0 };
    })
    .filter((r) => r.price > 0 && r.min >= minMinutes)
    .map((r) => ({ ...r, perHour: Math.round(r.price / r.hours) }));
}

export interface TypeProfit {
  type: SiteType;
  n: number;
  hours: number;
  price: number;
  perHour: number;
  avgHours: number;
}
export function profitByType(rows: ProjProfit[], types: SiteType[]): TypeProfit[] {
  return types
    .map((type) => {
      const l = rows.filter((r) => r.p.siteType === type);
      const hours = l.reduce((s, r) => s + r.hours, 0);
      const price = l.reduce((s, r) => s + r.price, 0);
      return {
        type,
        n: l.length,
        hours,
        price,
        perHour: hours ? Math.round(price / hours) : 0,
        avgHours: l.length ? hours / l.length : 0,
      };
    })
    .filter((t) => t.n > 0);
}
