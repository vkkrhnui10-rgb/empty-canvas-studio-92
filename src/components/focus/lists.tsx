import * as React from "react";
import {
  BarChart3,
  CheckSquare,
  Flag,
  FolderInput,
  Inbox,
  ListTodo,
  Plus,
  Search,
  SkipForward,
  Sun,
  Trash2,
  X,
  Timer,
  CheckCircle2,
  Target,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";
import { C, PRIORITIES, PRIORITY_ORDER, accentFor } from "./constants";
import { actions, findProject, useDB } from "./store";
import type { Task } from "./types";
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Progress,
  Segmented,
  Select,
  StatCard,
} from "./ui";
import { dayKey, fmtMin, isOpen, todayStr } from "./utils";
import { useNav } from "./nav";
import { TaskRow } from "./tasks";

/* ============================ Tasks list (inbox + all) ============================ */
type Filter = "open" | "today" | "waiting" | "overdue" | "done";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "פתוחות" },
  { value: "today", label: "היום" },
  { value: "overdue", label: "באיחור" },
  { value: "waiting", label: "ממתין / חסום" },
  { value: "done", label: "הושלמו" },
];

export function TasksView({ inbox }: { inbox?: boolean }) {
  const db = useDB();
  const nav = useNav();
  const [q, setQ] = React.useState("");
  const [projectId, setProjectId] = React.useState("__all");
  const [prio, setPrio] = React.useState("__all");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const filter = (db.settings.taskFilter as Filter) || "open";

  let list = db.tasks.filter((t) => {
    if (inbox) return t.status === "inbox";
    if (filter === "open") return isOpen(t);
    if (filter === "today") return db.plan.ids.includes(t.id);
    if (filter === "overdue") return isOpen(t) && !!t.due && t.due < todayStr();
    if (filter === "waiting") return t.status === "waiting" || t.status === "blocked";
    return t.status === "done";
  });
  if (projectId !== "__all") list = list.filter((t) => t.projectId === projectId);
  if (prio !== "__all") list = list.filter((t) => t.priority === prio);
  if (q)
    list = list.filter((t) =>
      `${t.title} ${t.desc} ${findProject(db, t.projectId)?.name ?? ""}`.includes(q),
    );
  if (filter === "done")
    list = [...list].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 200);
  else
    list = [...list].sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(b.priority) - PRIORITY_ORDER.indexOf(a.priority) ||
        (a.due || "9").localeCompare(b.due || "9"),
    );

  const ids = [...sel].filter((id) => list.some((t) => t.id === id));
  const toggle = (id: string, v: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  const clear = () => setSel(new Set());

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8 pb-28">
      <PageHeader
        title={inbox ? "תיבת משימות" : "כל המשימות"}
        subtitle={
          inbox ? "כל מה שנכנס מהר — עכשיו מסדרים: פרויקט, זמן, להיום." : `${list.length} משימות`
        }
        actions={
          <Btn variant="primary" icon={Plus} onClick={() => nav.quickAdd()}>
            משימה חדשה
          </Btn>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!inbox && (
          <Segmented
            value={filter}
            onChange={(v) => actions.settings({ taskFilter: v })}
            options={FILTERS}
          />
        )}
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--focus-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש…"
            className="pr-9"
          />
        </div>
        {!inbox && (
          <>
            <Select
              className="w-40"
              value={projectId}
              onChange={setProjectId}
              options={["__all", "", ...db.projects.map((p) => p.id)]}
              labels={{
                __all: "כל הפרויקטים",
                "": "ללא פרויקט",
                ...Object.fromEntries(db.projects.map((p) => [p.id, p.name])),
              }}
            />
            <Select
              className="w-32"
              value={prio}
              onChange={setPrio}
              options={["__all", ...PRIORITY_ORDER]}
              labels={{ __all: "כל העדיפויות", ...PRIORITIES }}
            />
          </>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={inbox ? Inbox : ListTodo}
            title={inbox ? "התיבה ריקה" : "אין משימות כאן"}
            subtitle={inbox ? "לחץ N מכל מקום כדי לזרוק לכאן משימה בשנייה" : "נסה פילטר אחר"}
            action={
              <Btn size="sm" variant="primary" icon={Plus} onClick={() => nav.quickAdd()}>
                משימה חדשה
              </Btn>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TaskRow t={t} selected={sel.has(t.id)} onSelect={(v) => toggle(t.id, v)} />
              </div>
              {inbox && <InboxSort t={t} />}
            </div>
          ))}
        </Card>
      )}

      {/* bulk bar */}
      {ids.length > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--focus-border)] bg-[var(--focus-card-hi)]/95 p-2.5 shadow-2xl backdrop-blur md:bottom-6">
          <span className="px-2 text-sm font-medium">
            <CheckSquare className="ml-1 inline size-4 text-[color:var(--focus-primary)]" />
            {ids.length} נבחרו
          </span>
          <Btn
            size="sm"
            variant="primary"
            icon={Sun}
            onClick={() => {
              actions.toToday(ids);
              clear();
            }}
          >
            להיום
          </Btn>
          <Btn
            size="sm"
            onClick={() => {
              actions.bulk(ids, { status: "done" }, `${ids.length} משימות הושלמו`);
              clear();
            }}
          >
            בוצע
          </Btn>
          <BulkSelect
            label="עדיפות"
            icon={Flag}
            options={PRIORITY_ORDER}
            labels={PRIORITIES}
            onPick={(v) => {
              actions.bulk(ids, { priority: v as Task["priority"] }, "העדיפות עודכנה");
              clear();
            }}
          />
          <BulkSelect
            label="פרויקט"
            icon={FolderInput}
            options={["", ...db.projects.map((p) => p.id)]}
            labels={{
              "": "ללא פרויקט",
              ...Object.fromEntries(db.projects.map((p) => [p.id, p.name])),
            }}
            onPick={(v) => {
              actions.bulk(ids, { projectId: v, status: "todo" }, "הועבר לפרויקט");
              clear();
            }}
          />
          <Btn
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => {
              actions.deleteTasks(ids);
              clear();
            }}
          >
            מחק
          </Btn>
          <button
            aria-label="בטל בחירה"
            onClick={clear}
            className="mr-auto rounded-lg p-1.5 text-[color:var(--focus-muted)] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function BulkSelect({
  label,
  icon: Icon,
  options,
  labels,
  onPick,
}: {
  label: string;
  icon: typeof Flag;
  options: string[];
  labels: Record<string, string>;
  onPick: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-3 text-sm">
      <Icon className="size-3.5" /> {label}
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value="__"
        onChange={(e) => onPick(e.target.value)}
        aria-label={label}
      >
        <option value="__" disabled>
          {label}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** inbox triage: pick a project in one click → moves out of the inbox */
function InboxSort({ t }: { t: Task }) {
  const db = useDB();
  if (!db.projects.length) return null;
  return (
    <div className="hidden w-44 sm:block">
      <Select
        value={t.projectId}
        onChange={(v) => actions.patchTask(t.id, { projectId: v, status: "todo" })}
        options={["", ...db.projects.map((p) => p.id)]}
        labels={{
          "": "שייך לפרויקט…",
          ...Object.fromEntries(db.projects.map((p) => [p.id, p.name])),
        }}
        className="h-9 text-sm"
      />
    </div>
  );
}

/* ============================ Weekly review ============================ */
export function WeeklyView() {
  const db = useDB();
  const nav = useNav();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const keyOf = (ts: number) => dayKey(ts);
  const focusByDay = days.map((d) =>
    db.sessions.filter((s) => keyOf(s.at) === dayKey(d)).reduce((a, s) => a + s.min, 0),
  );
  const doneByDay = days.map(
    (d) => db.tasks.filter((t) => t.completedAt && keyOf(t.completedAt) === dayKey(d)).length,
  );
  const weekStart = days[0].setHours(0, 0, 0, 0);
  const weekSessions = db.sessions.filter((s) => s.at >= weekStart);
  const totalFocus = focusByDay.reduce((a, b) => a + b, 0);
  const totalDone = doneByDay.reduce((a, b) => a + b, 0);
  const maxMin = Math.max(60, ...focusByDay);

  const perProject = Object.entries(
    weekSessions.reduce<Record<string, number>>((acc, s) => {
      acc[s.projectId || ""] = (acc[s.projectId || ""] || 0) + s.min;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const doneWeek = db.tasks.filter(
    (t) => t.completedAt && t.completedAt >= weekStart && t.actualMin > 0 && t.estMin > 0,
  );
  const ratio = doneWeek.length
    ? doneWeek.reduce((a, t) => a + t.actualMin, 0) / doneWeek.reduce((a, t) => a + t.estMin, 0)
    : 0;
  const stalled = db.projects.filter(
    (p) =>
      !["הושק", "הוקפא", "תחזוקה"].includes(p.status) &&
      !db.tasks.some((t) => t.projectId === p.id && t.completedAt && t.completedAt >= weekStart),
  );
  const stuck = db.tasks.filter((t) => (t.deferCount ?? 0) >= 2 && isOpen(t));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8 space-y-4">
      <PageHeader
        title="סיכום שבועי"
        subtitle="7 הימים האחרונים — מה עבד, מה תקוע, איפה הלך הזמן."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="זמן פוקוס" v={fmtMin(totalFocus)} c={C.primary} icon={Timer} sub="7 ימים אחרונים" />
        <Kpi
          l="משימות שהושלמו"
          v={String(totalDone)}
          c={C.ok}
          icon={CheckCircle2}
          sub={`${(totalDone / 7).toFixed(1)} ביום בממוצע`}
        />
        <Kpi
          icon={Target}
          l="דיוק הערכות"
          v={ratio ? `×${ratio.toFixed(1)}` : "—"}
          sub={
            ratio
              ? ratio > 1.2
                ? "לוקח לך יותר מהמשוער"
                : ratio < 0.8
                  ? "מסיים מהר מהמשוער"
                  : "הערכות מדויקות"
              : "אין מספיק נתונים"
          }
          c={ratio > 1.2 ? C.warn : undefined}
        />
        <Kpi
          icon={PauseCircle}
          sub={stalled.length ? "כדאי להחליט עליהם" : "הכול בתנועה"}
          l="פרויקטים שלא זזו"
          v={String(stalled.length)}
          c={stalled.length ? C.warn : undefined}
        />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">זמן פוקוס לפי יום</h2>
          <span className="text-xs text-[color:var(--focus-muted)]">
            ממוצע {fmtMin(totalFocus / 7)} ליום
          </span>
        </div>
        {totalFocus === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="עדיין אין נתוני פוקוס השבוע"
            subtitle="כל דקה שאתה עובד עם הטיימר נאספת לכאן"
          />
        ) : (
          <div className="flex h-44 items-end gap-2 sm:gap-4">
            {days.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] tabular-nums text-[color:var(--focus-muted)]">
                  {focusByDay[i] ? fmtMin(focusByDay[i]) : ""}
                </span>
                <div
                  title={`${doneByDay[i]} משימות הושלמו`}
                  className="w-full max-w-12 rounded-t-[8px] transition-all"
                  style={{
                    height: `${Math.max(3, (focusByDay[i] / maxMin) * 100)}%`,
                    background:
                      i === 6
                        ? `linear-gradient(180deg, ${C.violet}, ${C.primary})`
                        : `color-mix(in oklab, ${C.primary} 22%, var(--focus-card))`,
                  }}
                />
                <span className="text-xs text-[color:var(--focus-muted)]">
                  {d.toLocaleDateString("he-IL", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-[17px] font-bold">לאן הלך הזמן</h2>
          {perProject.length === 0 ? (
            <div className="text-sm text-[color:var(--focus-muted)]">אין עדיין נתונים</div>
          ) : (
            <div className="space-y-3">
              {perProject.map(([pid, min]) => (
                <div key={pid}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{findProject(db, pid)?.name ?? "ללא פרויקט"}</span>
                    <span className="tabular-nums text-[color:var(--focus-muted)]">
                      {fmtMin(min)}
                    </span>
                  </div>
                  <Progress
                    value={(min / perProject[0][1]) * 100}
                    color={pid ? accentFor(pid) : C.sub}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-[17px] font-bold">דורש החלטה</h2>
          <div className="space-y-1.5">
            {stalled.map((p) => (
              <button
                key={p.id}
                onClick={() => nav.go("project", p.id)}
                className="flex w-full items-center gap-2 rounded-xl bg-[var(--focus-bg2)] px-3 py-2 text-right text-sm hover:bg-[var(--focus-card-hi)]"
              >
                <Badge color={C.warn}>לא זז</Badge>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {stuck.map((t) => (
              <button
                key={t.id}
                onClick={() => nav.openTask(t.id)}
                className="flex w-full items-center gap-2 rounded-xl bg-[var(--focus-bg2)] px-3 py-2 text-right text-sm hover:bg-[var(--focus-card-hi)]"
              >
                <SkipForward className="size-3.5 shrink-0 text-[color:var(--focus-warning)]" />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-[color:var(--focus-muted)]">
                  נדחתה {t.deferCount}×
                </span>
              </button>
            ))}
            {!stalled.length && !stuck.length && (
              <div className="text-sm text-[color:var(--focus-muted)]">אין — שבוע נקי ✓</div>
            )}
          </div>
          {stuck.length > 0 && (
            <p className="mt-3 text-xs text-[color:var(--focus-muted)]">
              משימה שנדחית שוב ושוב בדרך כלל צריכה פירוק לצעדים קטנים — או ויתור.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
function Kpi({
  l,
  v,
  c,
  sub,
  icon,
}: {
  l: string;
  v: string;
  c?: string;
  sub?: string;
  icon?: LucideIcon;
}) {
  return <StatCard label={l} value={v} color={c} sub={sub} icon={icon} />;
}
