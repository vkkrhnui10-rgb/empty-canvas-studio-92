import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { OrderRow, ReportRow } from "./growreport";
import { nameKey, samePerson } from "./growreport";
import type {
  Alert,
  Cpanel,
  DB,
  GrowEntry,
  SORun,
  SOContact,
  Lead,
  LeadNote,
  LeadStage,
  Project,
  Task,
  TaskStatus,
  TimerState,
} from "./types";
import { fields as growFields, normPhone, type GrowKind } from "./grow";
import {
  CLOSED_PROJECT,
  DEFAULT_SO_MSG,
  LEAD_OPEN,
  LEAD_STAGES,
  OPEN_STATUSES,
  PROJECT_TEMPLATES,
  SITE_BAD,
  SITE_TYPES,
  SO_STALE_DAYS,
  WAITING_STALE_DAYS,
} from "./constants";
import {
  addDays,
  balanceOf,
  chime,
  daysSince,
  isOpen,
  nextRepeatDate,
  todayStr,
  uid,
} from "./utils";

/* ============================================================
 * FOCUS store — single source of truth for all data + the timer.
 * - useSyncExternalStore (no extra deps), SSR-safe.
 * - Persisted to localStorage; syncs live across tabs and the
 *   floating (Picture-in-Picture) window.
 * - Persistence goes through `adapter`, so swapping to Supabase
 *   later means replacing load/save only.
 * ============================================================ */

const KEY = "focus-db-v2";
const LEGACY_KEY = "focus-db";
const VERSION = 2;
export const HANDLED = Number.MAX_SAFE_INTEGER;

export const defaultSettings: DB["settings"] = {
  workHours: 6,
  defaultHostPrice: 48.99,
  defaultFocusMin: 45,
  breakMin: 5,
  sound: true,
  notifications: false,
  autoStartNext: true,
  projectsView: "cards",
  taskFilter: "open",
  sidebarCollapsed: false,
  pipCompact: false,
  ownerName: "",
  cardUpdateUrl: "",
  soMsgTemplate: DEFAULT_SO_MSG,
};

const emptyDB = (): DB => ({
  version: VERSION,
  tasks: [],
  projects: [],
  cpanels: [],
  leads: [],
  growLog: [],
  soContacts: [],
  plan: { date: todayStr(), ids: [], closed: false },
  timer: null,
  sessions: [],
  activity: [],
  dismissed: {},
  settings: { ...defaultSettings },
});

export const newLead = (p: Partial<Lead> = {}): Lead => ({
  id: uid(),
  name: "",
  business: "",
  phone: "",
  email: "",
  source: "",
  interest: "",
  budget: 0,
  stage: "new",
  followUp: "",
  notes: [],
  lostReason: "",
  projectId: "",
  created: Date.now(),
  updated: p.notes?.[0]?.at ?? p.created ?? Date.now(),
  ...p,
});

export const newTask = (p: Partial<Task> = {}): Task => ({
  id: uid(),
  title: "",
  desc: "",
  projectId: "",
  status: "inbox",
  priority: "normal",
  type: "אחר",
  due: "",
  estMin: 30,
  actualMin: 0,
  created: Date.now(),
  checklist: [],
  links: [],
  notes: "",
  repeat: "none",
  ...p,
});

export const newProject = (p: Partial<Project> = {}): Project => ({
  id: uid(),
  name: "",
  client: "",
  phone: "",
  email: "",
  url: "",
  adminUrl: "",
  status: "אפיון",
  siteState: "בפיתוח",
  siteType: "אתר WordPress",
  aiSystem: "Lovable",
  aiUrl: "",
  cpanelId: "",
  startDate: todayStr(),
  launchDate: "",
  buildPrice: 0,
  paid: 0,
  payDue: "",
  payments: [],
  hosted: true,
  hostStart: todayStr(),
  hostPrice: state?.settings?.defaultHostPrice ?? 48.99,
  hostPriceNote: "",
  soState: "none",
  soLastCharge: "",
  soChecked: "",
  soFailedAt: "",
  soFailReason: "",
  doneDate: "",
  soStart: "",
  soRuns: [],
  cardUrl: "",
  cardUrlAt: 0,
  soMsgAt: 0,
  notes: [],
  issues: [],
  created: Date.now(),
  ...p,
});

/* ---------------- persistence adapter ---------------- */
const adapter = {
  load(): DB | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(db: DB) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.error("FOCUS: save failed", e);
      toast.error("השמירה נכשלה — כדאי לייצא גיבוי מההגדרות");
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(raw: any): DB {
  const base = emptyDB();
  const db: DB = {
    ...base,
    ...raw,
    version: VERSION,
    settings: { ...base.settings, ...(raw.settings || {}) },
    plan: { ...base.plan, ...(raw.plan || {}) },
    dismissed: Array.isArray(raw.dismissedAlerts)
      ? Object.fromEntries(raw.dismissedAlerts.map((id: string) => [id, HANDLED]))
      : raw.dismissed || {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: (raw.tasks || []).map((t: any) =>
      newTask({
        ...t,
        repeat: t.repeat || "none",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklist: (t.checklist || []).map((c: any) => ({
          id: c.id || uid(),
          txt: c.txt,
          done: !!c.done,
        })),
      }),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: (raw.projects || []).map((p: any) =>
      newProject({
        ...p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notes: (p.notes || []).map((n: any) => ({
          id: n.id || uid(),
          txt: n.txt,
          pinned: !!n.pinned,
          created: typeof n.created === "number" ? n.created : Date.now(),
        })),
      }),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leads: (raw.leads || []).map((l: any) => newLead({ ...l, notes: l.notes || [] })),
    sessions: (raw.sessions || []).map((s: { projectId?: string }) => ({ projectId: "", ...s })),
    activity: raw.activity || [],
    growLog: raw.growLog || [],
    soContacts: Array.isArray(raw.soContacts) ? raw.soContacts : [],
  };
  if (db.timer && !("mode" in db.timer)) db.timer = { ...(db.timer as TimerState), mode: "work" };
  return rollDay(db);
}

/** new calendar day → fresh plan; unfinished "today" tasks go back to the pool */
function rollDay(db: DB): DB {
  if (db.plan.date === todayStr()) return db;
  db.tasks.forEach((t) => {
    if (t.status === "today") t.status = "todo";
  });
  db.plan = { date: todayStr(), ids: [], closed: false };
  return db;
}

/* ---------------- core store ---------------- */
let state: DB = emptyDB();
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = adapter.load() ?? emptyDB();
  emit();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = migrate(JSON.parse(e.newValue));
        emit();
      } catch {
        /* ignore */
      }
    }
  });
  // day rollover while the app stays open overnight
  setInterval(() => {
    if (state.plan.date !== todayStr()) set(rollDay(structuredClone(state)));
  }, 60_000);
}
export const isHydrated = () => hydrated;

export const getState = () => state;
/** listeners for LOCAL edits (the cloud sync subscribes here) */
const changeHooks = new Set<(db: DB) => void>();
export function onLocalChange(fn: (db: DB) => void) {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}
function set(next: DB) {
  state = next;
  adapter.save(state);
  emit();
  changeHooks.forEach((h) => h(state));
}
/** replace everything with data that came from the cloud (does not echo back) */
export function replaceFromRemote(raw: unknown) {
  state = migrate(raw ?? {});
  adapter.save(state);
  emit();
}
export const hasLocalData = () =>
  state.projects.length + state.tasks.length + state.leads.length + state.cpanels.length > 0;
/** immutable-style update on a deep clone; returns the previous snapshot (for undo) */
export function update(fn: (d: DB) => void): DB {
  const prev = state;
  const d = structuredClone(state);
  fn(d);
  set(d);
  return prev;
}
export function restore(snapshot: DB) {
  set(snapshot);
}
/** run an action and show a toast with an Undo button */
export function undoable(msg: string, fn: () => void) {
  const prev = state;
  fn();
  toast.success(msg, { action: { label: "בטל", onClick: () => restore(prev) }, duration: 5000 });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const serverSnap = emptyDB();
export function useDB(): DB {
  return useSyncExternalStore(subscribe, getState, () => serverSnap);
}
export function useHydrated() {
  return useSyncExternalStore(subscribe, isHydrated, () => false);
}

/* ---------------- timer math (timestamp based, drift/sleep-proof) ---------------- */
export const elapsedMs = (t: TimerState, now = Date.now()) =>
  Math.max(0, now - t.startedAt - t.pausedTotal - (t.pausedAt ? now - t.pausedAt : 0));
export const remainingSec = (t: TimerState, now = Date.now()) =>
  Math.round((t.plannedMin * 60000 - elapsedMs(t, now)) / 1000);
const mkTimer = (
  taskId: string | null,
  min: number,
  mode: TimerState["mode"] = "work",
): TimerState => ({
  taskId,
  mode,
  startedAt: Date.now(),
  plannedMin: min,
  pausedTotal: 0,
  pausedAt: null,
});

/* ---------------- selectors ---------------- */
export const findTask = (db: DB, id?: string | null) => db.tasks.find((t) => t.id === id);
export const findProject = (db: DB, id?: string) => db.projects.find((p) => p.id === id);
export const plannedTasks = (db: DB) =>
  db.plan.ids.map((id) => findTask(db, id)).filter(Boolean) as Task[];
const workable = (t: Task) =>
  t.status !== "done" &&
  t.status !== "cancelled" &&
  t.status !== "waiting" &&
  t.status !== "deferred" &&
  t.status !== "blocked";
/** the task you should be working on right now */
export const activeTask = (db: DB): Task | undefined => {
  if (db.timer?.taskId) {
    const t = findTask(db, db.timer.taskId);
    if (t && workable(t)) return t;
  }
  return plannedTasks(db).find(workable);
};

export function suggestions(db: DB) {
  const today = todayStr();
  const weekAgo = Date.now() - 7 * 86400000;
  const stalledProjects = new Set(
    db.projects
      .filter((p) => !CLOSED_PROJECT.includes(p.status))
      .filter(
        (p) =>
          !db.tasks.some((t) => t.projectId === p.id && t.completedAt && t.completedAt > weekAgo),
      )
      .map((p) => p.id),
  );
  return db.tasks
    .filter(
      (t) =>
        ["inbox", "todo", "doing", "deferred"].includes(t.status) && !db.plan.ids.includes(t.id),
    )
    .map((t) => {
      const reasons: string[] = [];
      let score = 0;
      const add = (n: number, r: string) => {
        score += n;
        reasons.push(r);
      };
      if (t.due && t.due < today) add(100, "באיחור");
      if (t.due === today) add(60, "יעד היום");
      if (t.status === "doing") add(50, "כבר התחלת");
      if (t.priority === "urgent") add(45, "דחופה");
      else if (t.priority === "high") add(25, "עדיפות גבוהה");
      if (t.projectId && stalledProjects.has(t.projectId)) add(20, "פרויקט תקוע");
      if (t.due && t.due > today && t.due <= addDays(today, 2)) add(15, "יעד קרוב");
      return { t, score, reasons };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export function computeAlerts(db: DB): Alert[] {
  const a: Alert[] = [];
  const today = todayStr();
  const now = Date.now();
  db.tasks.forEach((t) => {
    if (!isOpen(t)) return;
    if (t.due && t.due < today)
      a.push({
        id: `overdue-${t.id}-${t.due}`,
        kind: "overdue",
        txt: `משימה באיחור: ${t.title}`,
        taskId: t.id,
        projectId: t.projectId,
        sev: "bad",
      });
    if (t.status === "blocked")
      a.push({
        id: `blocked-${t.id}`,
        kind: "blocked",
        txt: `משימה חסומה: ${t.title}${t.blockReason ? ` — ${t.blockReason}` : ""}`,
        taskId: t.id,
        projectId: t.projectId,
        sev: "warn",
      });
    if (
      t.status === "waiting" &&
      t.waitingSince &&
      now - t.waitingSince > WAITING_STALE_DAYS * 86400000
    )
      a.push({
        id: `waiting-${t.id}-${t.waitingSince}`,
        kind: "waiting",
        txt: `ממתין ללקוח ${Math.floor((now - t.waitingSince) / 86400000)} ימים: ${t.title}`,
        taskId: t.id,
        projectId: t.projectId,
        sev: "warn",
      });
  });
  db.projects.forEach((p) => {
    if (p.hosted && p.soState === "failed")
      a.push({
        id: `so-failed-${p.id}-${p.soFailedAt}`,
        kind: "so",
        txt: `חיוב נכשל: ${p.name}${p.soFailReason ? ` — ${p.soFailReason}` : ""}`,
        projectId: p.id,
        sev: "bad",
      });
    if (p.hosted && p.soState === "none")
      a.push({
        id: `so-none-${p.id}`,
        kind: "so",
        txt: `הוראת קבע לא הוקמה: ${p.name}`,
        projectId: p.id,
        sev: "warn",
      });
    if (p.hosted && ["ok", "check"].includes(p.soState) && daysSince(p.soChecked) > SO_STALE_DAYS)
      a.push({
        id: `so-stale-${p.id}-${p.soChecked}`,
        kind: "so",
        txt: `הוראת קבע לא נבדקה ${p.soChecked ? `${daysSince(p.soChecked)} ימים` : "מעולם"}: ${p.name}`,
        projectId: p.id,
        sev: "warn",
      });
    if (SITE_BAD.includes(p.siteState))
      a.push({
        id: `site-${p.id}-${p.siteState}`,
        kind: "site",
        txt: `${p.siteState}: ${p.name}`,
        projectId: p.id,
        sev: "bad",
      });
    const bal = balanceOf(p);
    if (bal > 0 && (p.payDue ? p.payDue < today : CLOSED_PROJECT.includes(p.status)))
      a.push({
        id: `pay-${p.id}-${bal}`,
        kind: "pay",
        txt: `יתרה לגבייה ${new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(bal)}: ${p.name}`,
        projectId: p.id,
        sev: "warn",
      });
    if (
      !CLOSED_PROJECT.includes(p.status) &&
      !db.tasks.some((t) => t.projectId === p.id && OPEN_STATUSES.includes(t.status))
    )
      a.push({
        id: `nonext-${p.id}`,
        kind: "nonext",
        txt: `אין משימה הבאה: ${p.name}`,
        projectId: p.id,
        sev: "warn",
      });
  });
  (db.leads || []).forEach((l) => {
    if (!LEAD_OPEN.includes(l.stage)) return;
    if (l.followUp && l.followUp <= today)
      a.push({
        id: `lead-fu-${l.id}-${l.followUp}`,
        kind: "lead",
        txt: `${l.followUp < today ? "פולואפ באיחור" : "פולואפ היום"}: ${l.name}${l.business ? ` (${l.business})` : ""}`,
        leadId: l.id,
        sev: l.followUp < addDays(today, -2) ? "bad" : "warn",
      });
    else if (!l.followUp && l.stage === "new" && now - l.created > 2 * 86400000)
      a.push({
        id: `lead-new-${l.id}`,
        kind: "lead",
        txt: `ליד חדש שעוד לא חזרת אליו: ${l.name}`,
        leadId: l.id,
        sev: "warn",
      });
  });
  return a.filter((x) => !(db.dismissed[x.id] > now));
}

/* ---------------- internal helpers ---------------- */
function log(d: DB, projectId: string, txt: string) {
  if (!projectId) return;
  d.activity.unshift({ id: uid(), projectId, txt, at: Date.now() });
  if (d.activity.length > 1500) d.activity.length = 1500;
}
/** stop counting time on the active task and bank the minutes */
function bankTimer(d: DB) {
  const t = d.timer;
  if (!t || t.mode !== "work" || !t.taskId) return;
  const min = Math.round(elapsedMs(t) / 60000);
  const task = findTask(d, t.taskId);
  if (task && min > 0) {
    task.actualMin = (task.actualMin || 0) + min;
    d.sessions.push({ taskId: task.id, projectId: task.projectId, min, at: Date.now() });
  }
}
/** after the active task leaves the flow, line up the next one */
function advance(d: DB, fromId: string) {
  const wasRunning = d.timer?.taskId === fromId && d.timer.mode === "work";
  const planned = d.timer?.plannedMin ?? d.settings.defaultFocusMin;
  if (d.timer?.taskId === fromId) d.timer = null;
  const next = plannedTasks(d).find((t) => t.id !== fromId && workable(t));
  if (next && wasRunning && d.settings.autoStartNext) {
    d.timer = mkTimer(next.id, planned);
    next.status = "doing";
  }
  return next;
}

/** append a standing-order run (skips a duplicate Grow transaction) */
function addRun(p: Project, r: Omit<SORun, "id">) {
  if (!Array.isArray(p.soRuns)) p.soRuns = [];
  if (r.txCode && p.soRuns.some((x) => x.txCode === r.txCode)) return;
  p.soRuns.unshift({ id: uid(), ...r });
  p.soRuns.sort((a, b) => b.date.localeCompare(a.date));
}

/** link unlinked contacts to the project with the same phone / email; keeps project dates in sync */
function autoLink(d: DB): number {
  let n = 0;
  for (const c of d.soContacts) {
    if (c.projectId) continue;
    const p = d.projects.find((x) => samePerson(x, c));
    if (!p) continue;
    c.projectId = p.id;
    syncProjectFromContacts(d, p);
    log(d, p.id, `הוראת קבע קושרה לאיש הקשר ${c.name || c.phone}`);
    n++;
  }
  return n;
}

/** a project's standing-order start / last charge follow the runs of its linked contacts */
function syncProjectFromContacts(d: DB, p: Project) {
  const mine = d.soContacts.filter((c) => c.projectId === p.id);
  const runs = mine.flatMap((c) => c.runs.filter((r) => r.ok));
  const starts = mine.map((c) => c.growStart).filter(Boolean) as string[];
  if (starts.length) {
    const first = [...starts].sort()[0];
    if (!p.soStart || first < p.soStart) p.soStart = first;
  }
  if (!runs.length) return;
  const dates = runs.map((r) => r.date).sort();
  if (!p.soStart || dates[0] < p.soStart) p.soStart = dates[0];
  const last = dates[dates.length - 1];
  if (!p.soLastCharge || last > p.soLastCharge) p.soLastCharge = last;
  if (["none", "check"].includes(p.soState) && daysSince(last) <= 40) {
    p.soState = "ok";
    p.soChecked = todayStr();
  }
}

export interface SOStats {
  runs: SORun[];
  ok: number;
  bad: number;
  gross: number;
  net: number;
  first: string;
  last: string;
  contacts: SOContact[];
}
/** everything known about a project's standing order: its own runs + its linked contacts' runs */
export function projectSO(db: DB, p: Project): SOStats {
  const contacts = db.soContacts.filter((c) => c.projectId === p.id);
  const seen = new Map<string, SORun>();
  for (const r of [...contacts.flatMap((c) => c.runs), ...(p.soRuns || [])]) {
    const k = `${r.date}|${r.ok ? 1 : 0}|${r.sum}`;
    const prev = seen.get(k);
    if (!prev || (prev.net === undefined && r.net !== undefined)) seen.set(k, r);
  }
  const runs = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
  const good = runs.filter((r) => r.ok);
  const dates = good.map((r) => r.date).sort();
  return {
    runs,
    ok: good.length,
    bad: runs.length - good.length,
    gross: Math.round(good.reduce((s, r) => s + r.sum, 0) * 100) / 100,
    net: Math.round(good.reduce((s, r) => s + (r.net ?? r.sum), 0) * 100) / 100,
    first:
      p.soStart ||
      [...contacts.map((c) => c.growStart || "").filter(Boolean), dates[0] || ""]
        .filter(Boolean)
        .sort()[0] ||
      "",
    last: dates[dates.length - 1] || "",
    contacts,
  };
}

export interface SOEntry {
  id: string;
  date: string;
  ok: boolean;
  sum: number;
  net: number;
  who: string;
  projectId: string;
}
/** every standing-order run we know of (contacts' runs + project-only runs), for the by-month report */
export function allSORuns(db: DB): SOEntry[] {
  const out: SOEntry[] = [];
  const byProject = new Map<string, Set<string>>();
  for (const c of db.soContacts) {
    const set = byProject.get(c.projectId) ?? new Set<string>();
    for (const r of c.runs) {
      out.push({
        id: r.id,
        date: r.date,
        ok: r.ok,
        sum: r.sum,
        net: r.net ?? r.sum,
        who: c.name || c.email || c.phone,
        projectId: c.projectId,
      });
      set.add(`${r.date}|${r.sum}`);
    }
    byProject.set(c.projectId, set);
  }
  for (const p of db.projects)
    for (const r of p.soRuns || []) {
      if (byProject.get(p.id)?.has(`${r.date}|${r.sum}`)) continue;
      out.push({
        id: r.id,
        date: r.date,
        ok: r.ok,
        sum: r.sum,
        net: r.net ?? r.sum,
        who: p.client || p.name,
        projectId: p.id,
      });
    }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** what a Grow event means for a project — mutates the draft, returns a short summary */
function applyGrowToProject(d: DB, p: Project, e: GrowEntry, day: string) {
  const date = day || todayStr();
  if (e.kind === "so_failed") {
    p.soState = "failed";
    p.soFailedAt = date;
    p.soFailReason = e.error;
    addRun(p, { date, ok: false, sum: e.sum, note: e.error, txCode: e.txCode });
    log(d, p.id, `Grow: חיוב הוראת קבע נכשל${e.error ? ` — ${e.error}` : ""}`);
    return "סומן: הוראת קבע נכשלה";
  }
  if (e.kind === "so_charge") {
    p.soState = "ok";
    p.soLastCharge = date;
    p.soChecked = todayStr();
    p.soFailReason = "";
    if (!p.soStart) p.soStart = date;
    addRun(p, { date, ok: true, sum: e.sum, note: "", txCode: e.txCode });
    log(d, p.id, `Grow: חיוב הוראת קבע עבר (${e.sum} ₪)`);
    return "הוראת קבע: תקינה";
  }
  // one-off payment → count it against the build balance when it fits
  const bal = balanceOf(p);
  if (e.sum > 0 && bal > 0 && e.sum <= bal + 0.5) {
    p.paid = (p.paid || 0) + e.sum;
    p.payments.unshift({
      id: uid(),
      amount: e.sum,
      date,
      note: `Grow${e.desc ? ` — ${e.desc}` : ""}`,
      txCode: e.txCode,
      invoiceUrl: e.invoiceUrl || undefined,
    });
    log(d, p.id, `Grow: התקבל תשלום ${e.sum} ₪`);
    return "נרשם כתשלום על הבנייה";
  }
  log(d, p.id, `Grow: תשלום ${e.sum} ₪${e.desc ? ` — ${e.desc}` : ""}`);
  return "נרשם ביומן";
}

/* ================= actions ================= */
export const actions = {
  addTask(p: Partial<Task>, opts: { today?: boolean } = {}) {
    const t = newTask(p);
    update((d) => {
      d.tasks.unshift(t);
      if (opts.today) {
        t.status = "today";
        d.plan.ids.push(t.id);
      }
      log(d, t.projectId, `נוספה משימה: ${t.title}`);
    });
    return t;
  },
  patchTask(id: string, patch: Partial<Task>) {
    update((d) => {
      const t = findTask(d, id);
      if (!t) return;
      if (patch.status && patch.status !== t.status) {
        if (patch.status === "waiting") t.waitingSince = Date.now();
        log(d, t.projectId, `"${t.title}" → ${patch.status}`);
      }
      Object.assign(t, patch);
    });
  },
  completeTask(id: string) {
    let nextId: string | undefined;
    undoable("המשימה הושלמה", () => {
      update((d) => {
        const t = findTask(d, id);
        if (!t) return;
        if (d.timer?.taskId === id) bankTimer(d);
        t.status = "done";
        t.completedAt = Date.now();
        log(d, t.projectId, `הושלמה: ${t.title}`);
        if (t.repeat !== "none") {
          const again = newTask({
            ...t,
            id: uid(),
            status: "todo",
            actualMin: 0,
            completedAt: undefined,
            created: Date.now(),
            due: nextRepeatDate(t.due || todayStr(), t.repeat),
            checklist: t.checklist.map((c) => ({ ...c, id: uid(), done: false })),
          });
          d.tasks.unshift(again);
        }
        nextId = advance(d, id)?.id;
      });
    });
    return nextId;
  },
  deleteTasks(ids: string[]) {
    undoable(ids.length > 1 ? `${ids.length} משימות נמחקו` : "המשימה נמחקה", () =>
      update((d) => {
        if (d.timer?.taskId && ids.includes(d.timer.taskId)) d.timer = null;
        d.tasks = d.tasks.filter((t) => !ids.includes(t.id));
        d.plan.ids = d.plan.ids.filter((i) => !ids.includes(i));
      }),
    );
  },
  bulk(ids: string[], patch: Partial<Task>, msg: string) {
    undoable(msg, () =>
      update((d) =>
        d.tasks.forEach((t) => {
          if (ids.includes(t.id))
            Object.assign(t, patch, patch.status === "done" ? { completedAt: Date.now() } : {});
        }),
      ),
    );
  },
  duplicate(id: string) {
    const src = findTask(state, id);
    if (!src) return;
    return actions.addTask({
      ...src,
      id: uid(),
      title: `${src.title} (עותק)`,
      status: "todo",
      actualMin: 0,
      completedAt: undefined,
      created: Date.now(),
    });
  },
  followUp(id: string) {
    const src = findTask(state, id);
    if (!src) return;
    return actions.addTask({
      title: `המשך: ${src.title}`,
      projectId: src.projectId,
      type: src.type,
      status: "todo",
    });
  },
  toToday(ids: string[]) {
    update((d) => {
      ids.forEach((id) => {
        const t = findTask(d, id);
        if (!t || !isOpen(t) || d.plan.ids.includes(id)) return;
        d.plan.ids.push(id);
        if (t.status !== "doing") t.status = "today";
      });
      d.plan.closed = false;
    });
  },
  removeFromToday(id: string) {
    update((d) => {
      d.plan.ids = d.plan.ids.filter((i) => i !== id);
      const t = findTask(d, id);
      if (t && t.status === "today") t.status = "todo";
      if (d.timer?.taskId === id) {
        bankTimer(d);
        d.timer = null;
      }
    });
  },
  movePlan(id: string, toIndex: number) {
    update((d) => {
      const ids = d.plan.ids.filter((i) => i !== id);
      ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
      d.plan.ids = ids;
    });
  },

  /* ---- flow actions (focus screen / floating panel) ---- */
  startFocus(taskId: string, min?: number) {
    update((d) => {
      if (d.timer && d.timer.taskId !== taskId) bankTimer(d);
      const t = findTask(d, taskId);
      if (!t) return;
      if (!d.plan.ids.includes(taskId)) d.plan.ids.unshift(taskId);
      t.status = "doing";
      d.timer = mkTimer(taskId, min ?? d.settings.defaultFocusMin);
      d.plan.closed = false;
    });
    if (
      state.settings.notifications &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    )
      Notification.requestPermission();
  },
  togglePause() {
    update((d) => {
      const t = d.timer;
      if (!t) return;
      if (t.pausedAt) {
        t.pausedTotal += Date.now() - t.pausedAt;
        t.pausedAt = null;
      } else t.pausedAt = Date.now();
    });
  },
  extend(min: number) {
    update((d) => {
      if (d.timer) d.timer.plannedMin += min;
    });
  },
  resetTimer() {
    update((d) => {
      bankTimer(d);
      d.timer = null;
    });
  },
  startBreak() {
    update((d) => {
      const taskId = d.timer?.taskId ?? activeTask(d)?.id ?? null;
      bankTimer(d);
      d.timer = mkTimer(taskId, d.settings.breakMin, "break");
    });
  },
  endBreak() {
    update((d) => {
      const taskId = d.timer?.taskId;
      d.timer = taskId ? mkTimer(taskId, d.settings.defaultFocusMin) : null;
    });
  },
  setFlowStatus(id: string, status: TaskStatus, extra: Partial<Task> = {}, msg = "עודכן") {
    undoable(msg, () =>
      update((d) => {
        const t = findTask(d, id);
        if (!t) return;
        if (d.timer?.taskId === id) bankTimer(d);
        Object.assign(t, extra, { status });
        if (status === "waiting") t.waitingSince = Date.now();
        log(d, t.projectId, `"${t.title}" → ${status}`);
        advance(d, id);
      }),
    );
  },
  skipLater(id: string) {
    update((d) => {
      if (d.timer?.taskId === id) bankTimer(d);
      d.plan.ids = [...d.plan.ids.filter((i) => i !== id), id];
      const t = findTask(d, id);
      if (t) t.status = "today";
      advance(d, id);
    });
  },
  moveToTomorrow(id: string) {
    undoable("הועבר למחר", () =>
      update((d) => {
        if (d.timer?.taskId === id) bankTimer(d);
        const t = findTask(d, id);
        if (!t) return;
        t.due = addDays(todayStr(), 1);
        t.status = "todo";
        t.deferCount = (t.deferCount || 0) + 1;
        d.plan.ids = d.plan.ids.filter((i) => i !== id);
        advance(d, id);
      }),
    );
  },
  closeDay() {
    update((d) => {
      bankTimer(d);
      d.timer = null;
      d.plan.closed = true;
    });
  },

  /* ---- projects ---- */
  saveProject(p: Project, template?: string) {
    update((d) => {
      const i = d.projects.findIndex((x) => x.id === p.id);
      if (i > -1) d.projects[i] = p;
      else {
        d.projects.unshift(p);
        log(d, p.id, "הפרויקט נוצר");
        const tpl = template ? PROJECT_TEMPLATES[template] : undefined;
        tpl?.tasks
          .slice()
          .reverse()
          .forEach(([title, type, estMin]) =>
            d.tasks.unshift(newTask({ title, type, estMin, projectId: p.id, status: "todo" })),
          );
      }
    });
  },
  patchProject(id: string, patch: Partial<Project>, logTxt?: string) {
    update((d) => {
      const p = findProject(d, id);
      if (!p) return;
      Object.assign(p, patch);
      if (patch.status === "הושק" && !p.doneDate) p.doneDate = todayStr();
      if (patch.soState === "ok" && !p.soStart) p.soStart = todayStr();
      if (logTxt) log(d, id, logTxt);
    });
  },
  deleteProject(id: string) {
    undoable("הפרויקט נמחק", () =>
      update((d) => {
        d.projects = d.projects.filter((p) => p.id !== id);
        d.tasks.forEach((t) => {
          if (t.projectId === id) t.projectId = "";
        });
      }),
    );
  },
  reportSOFailed(id: string, reason: string) {
    update((d) => {
      const p = findProject(d, id);
      if (!p) return;
      p.soState = "failed";
      p.soFailedAt = todayStr();
      p.soFailReason = reason;
      p.soLastCharge = todayStr();
      addRun(p, { date: todayStr(), ok: false, sum: 0, note: reason });
      log(d, id, `חיוב הוראת קבע נכשל${reason ? `: ${reason}` : ""}`);
    });
  },
  addSORun(id: string, r: { date: string; ok: boolean; sum: number; note: string }) {
    update((d) => {
      const p = findProject(d, id);
      if (!p) return;
      addRun(p, r);
      if (r.ok) {
        if (!p.soStart || r.date < p.soStart) p.soStart = r.date;
        if (!p.soLastCharge || r.date > p.soLastCharge) p.soLastCharge = r.date;
      }
      log(d, id, `נרשמה ריצת הוראת קבע (${r.ok ? "עברה" : "נכשלה"}) — ${r.date}`);
    });
  },
  deleteSORun(id: string, runId: string) {
    update((d) => {
      const p = findProject(d, id);
      if (p) p.soRuns = (p.soRuns || []).filter((x) => x.id !== runId);
    });
  },
  markSOOk(id: string) {
    update((d) => {
      const p = findProject(d, id);
      if (!p) return;
      p.soState = "ok";
      p.soChecked = todayStr();
      p.soFailReason = "";
      log(d, id, "הוראת הקבע תקינה");
    });
  },
  setPaymentInvoiced(id: string, payId: string, invoiced: boolean) {
    update((d) => {
      const p = findProject(d, id);
      const x = p?.payments.find((y) => y.id === payId);
      if (!p || !x) return;
      x.invoiced = invoiced;
      log(
        d,
        id,
        invoiced ? `הונפקה חשבונית לתשלום ${x.amount} ₪` : `סומן: אין חשבונית לתשלום ${x.amount} ₪`,
      );
    });
  },
  recordPayment(id: string, amount: number, note = "") {
    undoable(`נרשם תשלום`, () =>
      update((d) => {
        const p = findProject(d, id);
        if (!p || !amount) return;
        p.paid = (p.paid || 0) + amount;
        p.payments.unshift({ id: uid(), amount, date: todayStr(), note });
        log(d, id, `התקבל תשלום ${amount} ₪${note ? ` (${note})` : ""}`);
      }),
    );
  },
  saveCpanel(c: Cpanel) {
    update((d) => {
      const i = d.cpanels.findIndex((x) => x.id === c.id);
      if (i > -1) d.cpanels[i] = c;
      else d.cpanels.push(c);
    });
  },
  deleteCpanel(id: string) {
    undoable("הפאנל נמחק", () =>
      update((d) => {
        d.cpanels = d.cpanels.filter((c) => c.id !== id);
        d.projects.forEach((p) => {
          if (p.cpanelId === id) p.cpanelId = "";
        });
      }),
    );
  },

  soMessageSent(id: string, link?: string) {
    update((d) => {
      const p = findProject(d, id);
      if (!p) return;
      p.soMsgAt = Date.now();
      if (link) {
        p.cardUrl = link;
        p.cardUrlAt = Date.now();
      }
      log(d, id, "נשלחה בוואטסאפ בקשה לעדכון כרטיס");
    });
  },

  /* ---- Grow ---- */
  /** apply one webhook event; returns the log entry (projectId "" when unmatched) */
  applyGrow(ev: { id: string; kind: string; payload: unknown; received_at?: string }) {
    if (state.growLog.some((g) => g.id === ev.id)) return;
    const f = growFields(ev.payload);
    const entry: GrowEntry = {
      id: ev.id,
      at: ev.received_at ? Date.parse(ev.received_at) || Date.now() : Date.now(),
      kind: ev.kind as GrowKind,
      name: f.name,
      phone: f.phone,
      email: f.email,
      sum: f.sum,
      desc: f.desc || f.invoiceNumber,
      error: f.error,
      txCode: f.txCode,
      invoiceUrl: f.invoiceUrl,
      projectId: "",
      applied: "",
    };
    update((d) => {
      // invoices point at an earlier transaction — attach, don't match by person
      if (entry.kind === "invoice") {
        const prev = d.growLog.find((g) => g.txCode && g.txCode === entry.txCode);
        if (prev) {
          prev.invoiceUrl = entry.invoiceUrl;
          entry.projectId = prev.projectId;
          entry.name = entry.name || prev.name;
          const p = findProject(d, prev.projectId);
          const pay = p?.payments.find((x) => x.txCode === entry.txCode);
          if (pay) pay.invoiceUrl = entry.invoiceUrl;
          entry.applied = "החשבונית צורפה לתשלום";
        }
      } else {
        const ph = normPhone(f.phone);
        const p = d.projects.find(
          (x) =>
            (ph.length >= 9 && normPhone(x.phone) === ph) ||
            (!!f.email && x.email.trim().toLowerCase() === f.email),
        );
        if (p) {
          entry.projectId = p.id;
          entry.applied = applyGrowToProject(d, p, entry, f.date);
        }
      }
      d.growLog.unshift(entry);
      if (d.growLog.length > 500) d.growLog.length = 500;
    });
  },
  /** manually link an unmatched Grow event to a project (and apply it) */
  assignGrow(entryId: string, projectId: string, rememberContact = true) {
    update((d) => {
      const e = d.growLog.find((g) => g.id === entryId);
      const p = findProject(d, projectId);
      if (!e || !p) return;
      e.projectId = p.id;
      e.applied = applyGrowToProject(d, p, e, "");
      if (rememberContact) {
        if (!p.phone && e.phone) p.phone = e.phone;
        if (!p.email && e.email) p.email = e.email;
      }
    });
  },

  /** import a Grow report into standing-order contacts (created on the fly, linked to projects when they match) */
  importGrowRows(rows: ReportRow[]) {
    let added = 0;
    let dup = 0;
    let created = 0;
    let linked = 0;
    update((d) => {
      for (const r of rows) {
        let c =
          d.soContacts.find((x) => samePerson(x, r)) ??
          d.soContacts.find(
            (x) => !x.phone && !x.email && !!r.name && nameKey(x.name) === nameKey(r.name),
          );
        if (!c) {
          c = {
            id: uid(),
            name: r.name,
            phone: r.phone,
            email: r.email,
            note: "",
            projectId: "",
            runs: [],
            created: Date.now(),
          };
          d.soContacts.push(c);
          created++;
        } else {
          if (!c.name && r.name) c.name = r.name;
          if (!c.phone && r.phone) c.phone = r.phone;
          if (!c.email && r.email) c.email = r.email;
        }
        if (c.runs.some((x) => x.txCode === r.key || (x.date === r.date && x.sum === r.sum))) {
          dup++;
          continue;
        }
        c.runs.push({
          id: uid(),
          date: r.date,
          ok: true,
          sum: r.sum,
          net: r.net,
          note: "",
          desc: r.desc,
          txCode: r.key,
        });
        c.runs.sort((a, b) => b.date.localeCompare(a.date));
        added++;
      }
      linked += autoLink(d);
    });
    return { added, dup, created, linked };
  },
  /** apply Grow's standing-orders list (start date, charges so far, next charge, status) to contacts by name */
  importGrowOrders(rows: OrderRow[]) {
    let updated = 0;
    let created = 0;
    update((d) => {
      const groups = new Map<string, OrderRow[]>();
      for (const r of rows)
        groups.set(nameKey(r.name), [...(groups.get(nameKey(r.name)) ?? []), r]);
      for (const [key, list] of groups) {
        let c = d.soContacts.find((x) => nameKey(x.name) === key);
        if (!c) {
          c = {
            id: uid(),
            name: list[0].name,
            phone: "",
            email: "",
            note: "",
            projectId: "",
            runs: [],
            created: Date.now(),
          };
          d.soContacts.push(c);
          created++;
        } else updated++;
        // a client can hold several orders: earliest start, all charges, live if any order is live
        const starts = list
          .map((x) => x.start)
          .filter(Boolean)
          .sort();
        c.growStart = starts[0];
        c.growCount = list.reduce((s, x) => s + x.count, 0);
        const live = list.find((x) => x.state === "active");
        const bad = list.find((x) => x.state === "attention");
        c.growState = live ? "active" : bad ? "attention" : "cancelled";
        const pick = live ?? bad ?? list[0];
        c.nextDate = live?.nextDate || "";
        c.nextSum = live?.nextSum || 0;
        c.lastPay = (bad ?? pick).lastPay;
      }
      d.projects.forEach((p) => syncProjectFromContacts(d, p));
    });
    return { updated, created };
  },
  /** link contacts to projects by matching phone / email; returns how many were linked */
  autoLinkContacts() {
    let n = 0;
    update((d) => {
      n = autoLink(d);
    });
    return n;
  },
  /** link a standing-order contact to a project ("" = unlink) */
  linkContact(contactId: string, projectId: string) {
    update((d) => {
      const c = d.soContacts.find((x) => x.id === contactId);
      if (!c) return;
      c.projectId = projectId;
      const p = findProject(d, projectId);
      if (p) syncProjectFromContacts(d, p);
    });
  },
  patchContact(id: string, patch: Partial<SOContact>) {
    update((d) => {
      const c = d.soContacts.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  },
  deleteContact(id: string) {
    undoable("איש הקשר נמחק", () =>
      update((d) => {
        d.soContacts = d.soContacts.filter((x) => x.id !== id);
      }),
    );
  },

  /* ---- leads ---- */
  saveLead(l: Lead, firstNote?: string) {
    update((d) => {
      l.updated = Date.now();
      const i = d.leads.findIndex((x) => x.id === l.id);
      if (i > -1) d.leads[i] = l;
      else {
        if (firstNote?.trim())
          l.notes = [
            { id: uid(), txt: firstNote.trim(), at: Date.now(), kind: "note" },
            ...l.notes,
          ];
        d.leads.unshift(l);
      }
    });
  },
  patchLead(id: string, patch: Partial<Lead>) {
    update((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (l) Object.assign(l, patch, { updated: Date.now() });
    });
  },
  addLeadNote(id: string, txt: string, kind: LeadNote["kind"] = "note") {
    if (!txt.trim()) return;
    update((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (!l) return;
      l.notes.unshift({ id: uid(), txt: txt.trim(), at: Date.now(), kind });
      l.updated = Date.now();
      if (l.stage === "new" && kind !== "system") l.stage = "contacted";
    });
  },
  deleteLeadNote(id: string, noteId: string) {
    update((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (l) l.notes = l.notes.filter((n) => n.id !== noteId);
    });
  },
  setLeadStage(id: string, stage: LeadStage, reason = "") {
    update((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (!l || l.stage === stage) return;
      const label = LEAD_STAGES.find((x) => x.v === stage)?.l ?? stage;
      l.stage = stage;
      if (stage === "lost") l.lostReason = reason;
      if (!LEAD_OPEN.includes(stage)) l.followUp = "";
      l.notes.unshift({
        id: uid(),
        txt: `שלב: ${label}${reason ? ` — ${reason}` : ""}`,
        at: Date.now(),
        kind: "system",
      });
      l.updated = Date.now();
    });
  },
  leadFollowUp(id: string, days: number | "") {
    update((d) => {
      const l = d.leads.find((x) => x.id === id);
      if (l) {
        l.followUp = days === "" ? "" : addDays(todayStr(), days);
        l.updated = Date.now();
      }
    });
  },
  deleteLead(id: string) {
    undoable("הליד נמחק", () =>
      update((d) => {
        d.leads = d.leads.filter((l) => l.id !== id);
      }),
    );
  },
  /** won lead → real project (keeps contact details + conversation as a note) */
  convertLead(id: string): string | undefined {
    const l = state.leads.find((x) => x.id === id);
    if (!l) return;
    if (l.projectId && findProject(state, l.projectId)) return l.projectId;
    const siteType = (SITE_TYPES as string[]).includes(l.interest)
      ? (l.interest as Project["siteType"])
      : "אחר";
    const p = newProject({
      name: l.business || l.name,
      client: l.name,
      phone: l.phone,
      email: l.email,
      siteType,
      status: "אפיון",
      buildPrice: l.budget || 0,
      startDate: todayStr(),
    });
    const convo = l.notes
      .filter((n) => n.kind !== "system")
      .slice()
      .reverse()
      .map((n) => `• ${new Date(n.at).toLocaleDateString("he-IL")}: ${n.txt}`)
      .join("\n");
    if (convo)
      p.notes = [
        { id: uid(), txt: `מהשיחות בשלב הליד:\n${convo}`, created: Date.now(), pinned: true },
      ];
    update((d) => {
      d.projects.unshift(p);
      log(d, p.id, `הפרויקט נוצר מליד: ${l.name}`);
      d.tasks.unshift(
        newTask({
          title: "פגישת אפיון / קבלת חומרים",
          projectId: p.id,
          status: "todo",
          estMin: 60,
          type: "אפיון",
        }),
      );
      const x = d.leads.find((y) => y.id === id)!;
      x.projectId = p.id;
      if (x.stage !== "won") {
        x.stage = "won";
        x.notes.unshift({ id: uid(), txt: "נסגר — נפתח פרויקט", at: Date.now(), kind: "system" });
      }
      x.followUp = "";
      x.updated = Date.now();
    });
    toast.success(`נפתח פרויקט: ${p.name}`);
    return p.id;
  },

  /* ---- misc ---- */
  dismissAlert(id: string, days?: number) {
    update((d) => {
      d.dismissed[id] = days ? Date.now() + days * 86400000 : HANDLED;
    });
  },
  settings(patch: Partial<DB["settings"]>) {
    update((d) => Object.assign(d.settings, patch));
  },
  importJSON(text: string) {
    const prev = state;
    set(migrate(JSON.parse(text)));
    toast.success("הנתונים יובאו", { action: { label: "בטל", onClick: () => restore(prev) } });
  },
  reset() {
    undoable("כל הנתונים נמחקו", () => set(emptyDB()));
  },
  loadDemo() {
    const cp = {
      id: uid(),
      name: "שרת ראשי",
      url: "https://example.com:2083",
      host: "חברת אחסון",
      notes: "",
    };
    const p1 = newProject({
      name: "סטודיו כגוונא",
      client: "נריה",
      siteType: "אתר WordPress",
      cpanelId: cp.id,
      status: "בבנייה",
      buildPrice: 4500,
      paid: 2000,
      soState: "ok",
      soChecked: addDays(todayStr(), -10),
      url: "https://example.com",
    });
    const p2 = newProject({
      name: "משרד עו״ד זוהר",
      client: "שוקי",
      phone: "052-3334444",
      siteType: "אתר AI",
      status: "תיקונים",
      buildPrice: 3800,
      paid: 3800,
      soState: "failed",
      soFailedAt: todayStr(),
      soFailReason: "כרטיס פג תוקף",
    });
    const p3 = newProject({
      name: "ALL IN PRINT",
      client: "דפוס",
      siteType: "משולב",
      status: "הושק",
      siteState: "פעיל ותקין",
      buildPrice: 5200,
      paid: 4000,
      soState: "ok",
      soChecked: addDays(todayStr(), -50),
      hostPrice: 39,
    });
    update((d) => {
      d.cpanels.push(cp);
      d.projects.unshift(p1, p2, p3);
      const mk = (title: string, projectId: string, extra: Partial<Task> = {}) =>
        d.tasks.unshift(newTask({ title, projectId, status: "todo", ...extra }));
      mk("עיצוב עמוד הבית", p1.id, { estMin: 120, priority: "high", type: "עיצוב" });
      mk("העלאת גלריית עבודות", p1.id, { estMin: 60, type: "תוכן" });
      mk("תיקון טופס יצירת קשר", p2.id, {
        estMin: 30,
        priority: "urgent",
        due: addDays(todayStr(), -1),
        type: "תיקון",
      });
      mk("לחדש הוראת קבע מול הלקוח", p2.id, { estMin: 10, type: "תשלום" });
      mk("בדיקת גיבויים חודשית", p3.id, { estMin: 20, repeat: "monthly", type: "תחזוקה" });
      mk("רעיון: דף נחיתה לעסקים", "", { status: "inbox" });
      const h = 3600000;
      d.leads.unshift(
        newLead({
          name: "מיכל לוי",
          business: "קליניקה לפיזיותרפיה",
          phone: "050-1234567",
          source: "המלצה",
          interest: "אתר תדמית",
          budget: 4500,
          stage: "proposal",
          followUp: todayStr(),
          created: Date.now() - 6 * 24 * h,
          notes: [
            {
              id: uid(),
              txt: "שלחתי הצעת מחיר ל-4,500 ₪ כולל 3 סבבי תיקונים",
              at: Date.now() - 20 * h,
              kind: "whatsapp",
            },
            {
              id: uid(),
              txt: "רוצה אתר נקי עם קביעת תורים. ראתה את האתר של כגוונא ואהבה. חשוב לה שיהיה מהיר בנייד",
              at: Date.now() - 5 * 24 * h,
              kind: "call",
            },
          ],
        }),
        newLead({
          name: "יוסי כהן",
          business: "נגריית כהן",
          phone: "052-7654321",
          source: "אינסטגרם",
          interest: "חנות אונליין",
          budget: 8000,
          stage: "meeting",
          followUp: addDays(todayStr(), 2),
          created: Date.now() - 3 * 24 * h,
          notes: [
            {
              id: uid(),
              txt: "קבענו פגישה ביום ראשון בסטודיו שלו. רוצה למכור רהיטים בהזמנה אישית",
              at: Date.now() - 2 * 24 * h,
              kind: "call",
            },
          ],
        }),
        newLead({
          name: "דנה אברהם",
          business: "",
          phone: "054-5550000",
          source: "טופס באתר",
          interest: "דף נחיתה",
          stage: "new",
          created: Date.now() - 3 * 24 * h,
          notes: [
            {
              id: uid(),
              txt: 'השאירה פרטים בטופס: "צריכה דף נחיתה לסדנה בנובמבר"',
              at: Date.now() - 3 * 24 * h,
              kind: "note",
            },
          ],
        }),
      );
    });
    toast.success("נטענו נתוני דוגמה — אפשר למחוק אותם מההגדרות");
  },
};

/* notify once when a work block ends (called by the UI tick) */
let notifiedKey = "";
export function checkTimerEnd() {
  const t = state.timer;
  if (!t || t.pausedAt) return;
  const key = `${t.startedAt}-${t.plannedMin}`;
  if (remainingSec(t) <= 0 && notifiedKey !== key) {
    notifiedKey = key;
    const task = findTask(state, t.taskId);
    if (state.settings.sound) chime();
    const msg =
      t.mode === "break" ? "ההפסקה הסתיימה — חוזרים לעבודה" : `הזמן הסתיים: ${task?.title ?? ""}`;
    toast(msg, { duration: 8000 });
    if (
      state.settings.notifications &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    )
      new Notification("FOCUS", { body: msg, silent: true });
  }
}
