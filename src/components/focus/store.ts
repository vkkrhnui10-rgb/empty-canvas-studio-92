import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Alert, Cpanel, DB, Project, Task, TaskStatus, TimerState } from "./types";
import {
  CLOSED_PROJECT,
  OPEN_STATUSES,
  PROJECT_TEMPLATES,
  SITE_BAD,
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
};

const emptyDB = (): DB => ({
  version: VERSION,
  tasks: [],
  projects: [],
  cpanels: [],
  plan: { date: todayStr(), ids: [], closed: false },
  timer: null,
  sessions: [],
  activity: [],
  dismissed: {},
  settings: { ...defaultSettings },
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
    sessions: (raw.sessions || []).map((s: { projectId?: string }) => ({ projectId: "", ...s })),
    activity: raw.activity || [],
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
function set(next: DB) {
  state = next;
  adapter.save(state);
  emit();
}
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
      log(d, id, `חיוב הוראת קבע נכשל${reason ? `: ${reason}` : ""}`);
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
