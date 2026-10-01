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

export interface EstStat {
  type: SiteType;
  n: number;
  estMin: number;
  actMin: number;
  /** actual ÷ estimate (1.3 = takes 30% longer than you think) */
  ratio: number;
}
/** how your estimates compare with the time you really measured, per site type (finished tasks only) */
export function estimateStats(db: DB, types: SiteType[]): EstStat[] {
  const typeOf = new Map(db.projects.map((p) => [p.id, p.siteType]));
  return types
    .map((type) => {
      const l = db.tasks.filter(
        (t) =>
          t.status === "done" &&
          t.estMin > 0 &&
          t.actualMin > 0 &&
          typeOf.get(t.projectId) === type,
      );
      const estMin = l.reduce((s, t) => s + t.estMin, 0);
      const actMin = l.reduce((s, t) => s + t.actualMin, 0);
      return { type, n: l.length, estMin, actMin, ratio: estMin ? actMin / estMin : 1 };
    })
    .filter((e) => e.n >= 3);
}

export interface Quote {
  type: SiteType;
  n: number;
  avgHours: number;
  avgPrice: number;
  minPrice: number;
  target: number;
}
/** what to ask for a new site of this type, from your own history */
export function quoteFor(db: DB, type: SiteType, types: SiteType[]): Quote {
  const t = profitByType(profitRows(db), types).find((x) => x.type === type);
  const target = db.settings.hourlyTarget;
  return {
    type,
    n: t?.n ?? 0,
    avgHours: t?.avgHours ?? 0,
    avgPrice: t ? Math.round(t.price / t.n) : 0,
    minPrice: t && target ? Math.round((t.avgHours * target) / 50) * 50 : 0,
    target,
  };
}
