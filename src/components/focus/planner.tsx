import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Plus,
  Play,
  Search,
  Sparkles,
  X,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { C, accentFor } from "./constants";
import { actions, findProject, plannedTasks, suggestions, useDB } from "./store";
import type { Task } from "./types";
import { Badge, Btn, Card, EmptyState, IconBtn, Input, PageHeader, Progress } from "./ui";
import { fmtDate, fmtMin, isOpen, todayStr } from "./utils";
import { useNav } from "./nav";

const DT = "application/x-focus-task";

export function Planner() {
  const db = useDB();
  const nav = useNav();
  const [q, setQ] = React.useState("");
  const [over, setOver] = React.useState<string | null>(null);
  const planned = plannedTasks(db);
  const openPlanned = planned.filter(isOpen);
  const sugg = suggestions(db);
  const suggIds = new Set(sugg.map((s) => s.t.id));
  const pool = db.tasks
    .filter(
      (t) =>
        ["inbox", "todo", "doing", "deferred", "waiting", "blocked"].includes(t.status) &&
        !db.plan.ids.includes(t.id) &&
        !suggIds.has(t.id),
    )
    .filter((t) => !q || t.title.includes(q) || findProject(db, t.projectId)?.name.includes(q))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));

  const total = openPlanned.reduce((s, t) => s + (t.estMin || 0), 0);
  const cap = db.settings.workHours * 60;
  const free = cap - total;
  const byProject = Object.entries(
    openPlanned.reduce<Record<string, number>>((acc, t) => {
      acc[t.projectId || ""] = (acc[t.projectId || ""] || 0) + t.estMin;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const first = openPlanned.find((t) => !["waiting", "blocked"].includes(t.status));

  const onDropToday = (e: React.DragEvent, beforeId?: string) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData(DT);
    if (!id) return;
    if (!db.plan.ids.includes(id)) actions.toToday([id]);
    const ids = db.plan.ids.filter((x) => x !== id);
    const idx = beforeId ? ids.indexOf(beforeId) : ids.length;
    actions.movePlan(id, idx < 0 ? ids.length : idx);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="תכנון היום"
        subtitle={new Date().toLocaleDateString("he-IL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-3 py-1.5 text-sm">
            <span className="text-[color:var(--focus-muted)]">שעות עבודה היום</span>
            <input
              type="number"
              min={1}
              max={16}
              value={db.settings.workHours}
              onChange={(e) =>
                actions.settings({ workHours: Math.max(1, Math.min(16, +e.target.value || 1)) })
              }
              className="w-12 bg-transparent text-center font-semibold tabular-nums outline-none"
              aria-label="שעות עבודה"
            />
          </div>
        }
      />

      {/* capacity strip */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Metric l="נבחרו" v={`${openPlanned.length} משימות`} />
          <Metric l="זמן משוער" v={fmtMin(total)} />
          <Metric
            l="זמן פנוי"
            v={free >= 0 ? fmtMin(free) : `חריגה של ${fmtMin(-free)}`}
            c={free < 0 ? C.warn : C.ok}
          />
          <div className="min-w-40 flex-1">
            <Progress value={(total / cap) * 100} color={free < 0 ? C.warn : C.mint} />
          </div>
        </div>
        {byProject.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {byProject.map(([pid, min]) => (
              <Badge key={pid} color={pid ? accentFor(pid) : C.sub}>
                {findProject(db, pid)?.name ?? "ללא פרויקט"} · {fmtMin(min)}
              </Badge>
            ))}
          </div>
        )}
        {free < 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[color:color-mix(in_oklab,var(--focus-warning)_12%,transparent)] px-3 py-2 text-sm text-[color:var(--focus-warning)]">
            <AlertTriangle className="size-4" /> תכננת יותר ממה שיש לך היום. שווה להוריד משהו — יום
            ריאלי הוא יום שמסיימים.
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* POOL */}
        <Card className="flex flex-col p-4 lg:max-h-[calc(100vh-280px)]">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-semibold">משימות פתוחות</h2>
            <div className="relative mr-auto w-44">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--focus-muted)]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="סינון"
                className="h-8 pr-8 text-sm"
              />
            </div>
            <IconBtn icon={Plus} label="משימה חדשה" onClick={() => nav.quickAdd()} />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pl-1">
            {sugg.length > 0 && !q && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--focus-mint)]">
                  <Sparkles className="size-3.5" /> מומלץ להיום
                </div>
                <div className="space-y-1.5">
                  {sugg.map(({ t, reasons }) => (
                    <PoolRow key={t.id} t={t} reasons={reasons} highlight />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              {pool.map((t) => (
                <PoolRow key={t.id} t={t} />
              ))}
            </div>
            {pool.length === 0 && sugg.length === 0 && (
              <EmptyState
                icon={Sparkles}
                title="אין משימות פתוחות"
                subtitle="הכול מתוכנן או הושלם"
              />
            )}
          </div>
        </Card>

        {/* TODAY */}
        <Card
          className={cn(
            "flex flex-col p-4 transition-colors lg:max-h-[calc(100vh-280px)]",
            over === "zone" && "border-[color:var(--focus-mint)]",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setOver("zone");
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => onDropToday(e)}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">היום שלי</h2>
            <span className="text-xs text-[color:var(--focus-muted)]">גרור לשינוי סדר</span>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pl-1">
            {planned.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-[color:var(--focus-border)] p-8 text-center text-sm text-[color:var(--focus-muted)]">
                גרור לכאן משימות, או לחץ + ליד משימה
              </div>
            )}
            {planned.map((t, i) => {
              const p = findProject(db, t.projectId);
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(DT, t.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOver(t.id);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    onDropToday(e, t.id);
                  }}
                  className={cn(
                    "group flex cursor-grab items-center gap-3 rounded-2xl bg-[var(--focus-bg2)] px-3 py-2.5 transition-all active:cursor-grabbing",
                    over === t.id && "translate-y-1 shadow-[0_-2px_0_0_var(--focus-mint)]",
                    t.status === "done" && "opacity-50",
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--focus-card-hi)] text-xs font-semibold tabular-nums text-[color:var(--focus-muted)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-sm font-medium",
                        t.status === "done" && "line-through",
                      )}
                    >
                      {t.title}
                    </div>
                    <div className="text-xs text-[color:var(--focus-muted)]">
                      {p?.name ?? "ללא פרויקט"} · {fmtMin(t.estMin)}
                      {["waiting", "blocked"].includes(t.status) && (
                        <span className="mr-1 text-[color:var(--focus-pink)]">
                          {" "}
                          · {t.status === "waiting" ? "ממתין ללקוח" : "חסום"}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconBtn
                    icon={X}
                    label="הסר מהיום"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => actions.removeFromToday(t.id)}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-[color:var(--focus-border)] pt-4">
            {first ? (
              <Btn
                variant="primary"
                size="lg"
                className="w-full"
                icon={Play}
                onClick={() => {
                  actions.startFocus(first.id);
                  nav.go("focus");
                }}
              >
                התחל את יום העבודה
              </Btn>
            ) : (
              <Btn size="lg" className="w-full" icon={CalendarCheck} disabled>
                בחר משימות כדי להתחיל
              </Btn>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PoolRow({ t, reasons, highlight }: { t: Task; reasons?: string[]; highlight?: boolean }) {
  const db = useDB();
  const nav = useNav();
  const p = findProject(db, t.projectId);
  const overdue = t.due && t.due < todayStr();
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DT, t.id)}
      className={cn(
        "group flex cursor-grab items-center gap-2.5 rounded-2xl border border-transparent bg-[var(--focus-bg2)] px-3 py-2.5 transition-colors hover:border-[color:var(--focus-border)] active:cursor-grabbing",
        highlight && "border-[color:color-mix(in_oklab,var(--focus-mint)_25%,transparent)]",
      )}
    >
      <div className="min-w-0 flex-1">
        <button
          onClick={() => nav.openTask(t.id)}
          className="block w-full truncate text-right text-sm font-medium"
        >
          {t.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--focus-muted)]">
          {p && <span>{p.name}</span>}
          <span className="inline-flex items-center gap-0.5">
            <Clock className="size-3" />
            {fmtMin(t.estMin)}
          </span>
          {t.due && <span style={{ color: overdue ? C.bad : undefined }}>{fmtDate(t.due)}</span>}
          {t.status === "inbox" && <Badge>בתיבה</Badge>}
          {reasons?.map((r) => (
            <Badge key={r} color={r === "באיחור" ? C.bad : C.mint}>
              {r}
            </Badge>
          ))}
        </div>
      </div>
      <button
        aria-label="הוסף להיום"
        onClick={() => actions.toToday([t.id])}
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-card-hi)] text-[color:var(--focus-mint)] transition-colors hover:bg-[var(--focus-mint)] hover:text-[color:var(--focus-mint-foreground)]"
      >
        <ArrowLeft className="size-4" />
      </button>
    </div>
  );
}

function Metric({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div>
      <div className="text-xs text-[color:var(--focus-muted)]">{l}</div>
      <div className="font-semibold tabular-nums" style={{ color: c }}>
        {v}
      </div>
    </div>
  );
}
