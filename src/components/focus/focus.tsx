import * as React from "react";
import {
  AlertOctagon,
  ArrowRight,
  CalendarArrowUp,
  Check,
  Coffee,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  Server,
  SkipForward,
  Sparkles,
  Trophy,
  UserX,
  X,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { C, FOCUS_QUOTES } from "./constants";
import {
  actions,
  activeTask,
  checkTimerEnd,
  elapsedMs,
  findProject,
  plannedTasks,
  remainingSec,
  useDB,
} from "./store";
import type { Task } from "./types";
import { Badge, Btn, Card, IconBtn, Input, Modal, Progress } from "./ui";
import { fmtClock, fmtMin, isOpen, todayStr } from "./utils";
import { useNav } from "./nav";
import { Checklist, StatusBadge } from "./tasks";

/** re-render every second while a timer exists (and fire end-of-block alerts) */
export function useTick(active: boolean) {
  const [, set] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const i = setInterval(() => {
      set((x) => x + 1);
      checkTimerEnd();
    }, 1000);
    return () => clearInterval(i);
  }, [active]);
}

/* ------------------------------ Timer ring ------------------------------ */
function TimerRing({
  frac,
  size,
  stroke = 7,
  color,
  children,
  glow,
}: {
  frac: number;
  size: number;
  stroke?: number;
  color: string;
  children: React.ReactNode;
  glow?: boolean;
}) {
  const r = (size - stroke * 2) / 2 - 10;
  const circ = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  const c = size / 2;
  const gid = React.useId().replace(/:/g, "");
  // knob position (svg is rotated -90deg, so angle 0 = top)
  const ang = 2 * Math.PI * f;
  const kx = c + r * Math.cos(ang);
  const ky = c + r * Math.sin(ang);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {glow && (
        <div
          className="pointer-events-none absolute rounded-full transition-opacity duration-700"
          style={{
            inset: stroke + 10,
            boxShadow: `0 0 70px -8px color-mix(in oklab, ${color} 50%, transparent), inset 0 0 50px -12px color-mix(in oklab, ${color} 35%, transparent)`,
          }}
        />
      )}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: stroke + 22,
          background:
            "radial-gradient(circle at 50% 35%, color-mix(in oklab, var(--focus-card-hi) 70%, transparent), transparent 70%)",
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--focus-violet)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          const major = i % 5 === 0;
          const r1 = r + stroke / 2 + 5;
          const r2 = r1 + (major ? 6 : 3);
          return (
            <line
              key={i}
              x1={c + r1 * Math.cos(a)}
              y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)}
              y2={c + r2 * Math.sin(a)}
              stroke="var(--focus-muted)"
              strokeOpacity={major ? 0.5 : 0.22}
              strokeWidth={major ? 1.5 : 1}
              strokeLinecap="round"
            />
          );
        })}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--focus-border)"
          strokeOpacity={0.6}
          strokeWidth={stroke}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#g${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - f)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        {f > 0.005 && f < 0.995 && (
          <circle
            cx={kx}
            cy={ky}
            r={stroke * 0.95}
            fill="#fff"
            stroke={color}
            strokeWidth={3}
            style={{
              transition: "cx 1s linear, cy 1s linear",
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function useFlow() {
  const db = useDB();
  const task = activeTask(db);
  const planned = plannedTasks(db);
  const t = db.timer;
  const timerOnTask = !!t && (t.taskId === task?.id || t.mode === "break");
  return { db, task, planned, t: timerOnTask ? t : null };
}

/* ------------------------------ Success burst ------------------------------ */
function SuccessBurst({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="focus-burst flex size-28 items-center justify-center rounded-full bg-[var(--focus-primary)] text-[color:var(--focus-primary-foreground)] shadow-[0_0_80px_color-mix(in_oklab,var(--focus-primary)_60%,transparent)]">
        <Check className="size-14" strokeWidth={3} />
      </div>
    </div>
  );
}

/* ------------------------------ Focus screen ------------------------------ */
export function FocusView() {
  const nav = useNav();
  const { db, task, planned, t } = useFlow();
  useTick(!!db.timer);
  const [minutes, setMinutes] = React.useState(db.settings.defaultFocusMin);
  const [custom, setCustom] = React.useState("");
  const [burst, setBurst] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [quote] = React.useState(
    () => FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)],
  );
  const p = task ? findProject(db, task.projectId) : undefined;
  const cp = p?.cpanelId ? db.cpanels.find((c) => c.id === p.cpanelId) : undefined;

  const done = planned.filter((x) => x.status === "done").length;
  const idx = task ? planned.findIndex((x) => x.id === task.id) + 1 : 0;
  const isBreak = t?.mode === "break";
  const rem = t ? remainingSec(t) : minutes * 60;
  const frac = t ? rem / (t.plannedMin * 60) : 1;
  const running = !!t && !t.pausedAt;
  const color = isBreak ? C.violet : rem < 0 ? C.warn : C.primary;

  const complete = () => {
    if (!task) return;
    setBurst(true);
    setTimeout(() => setBurst(false), 750);
    actions.completeTask(task.id);
  };

  // keyboard: space = play/pause, Enter+Ctrl = done
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (t) actions.togglePause();
        else if (task) actions.startFocus(task.id, minutes);
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) complete();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!task && !isBreak) return <DaySummary />;

  return (
    <div className="focus-stage focus-dark relative min-h-full overflow-hidden">
      <SuccessBurst show={burst} />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-5 sm:px-6">
        {/* top bar */}
        <div className="mb-6 flex w-full items-center justify-between">
          <Btn variant="ghost" size="sm" icon={ArrowRight} onClick={() => nav.go("dashboard")}>
            יציאה מפוקוס
          </Btn>
          <div className="flex items-center gap-1">
            <IconBtn
              icon={PictureInPicture2}
              label="פאנל צף מעל כל החלונות"
              onClick={nav.openFloating}
              active={nav.floatingOpen}
            />
            <IconBtn icon={LayoutDashboard} label="לוח בקרה" onClick={() => nav.go("dashboard")} />
          </div>
        </div>

        {/* header */}
        <div className="w-full text-center">
          {planned.length > 0 && (
            <div className="mx-auto mb-4 max-w-sm">
              <div className="mb-1.5 flex justify-between text-xs text-[color:var(--focus-muted)]">
                <span>{idx > 0 ? `משימה ${idx} מתוך ${planned.length}` : "מחוץ לתכנון היום"}</span>
                <span>{done} הושלמו</span>
              </div>
              <Progress value={(done / planned.length) * 100} />
            </div>
          )}
          <div className="text-sm font-semibold text-[color:var(--focus-primary)]">
            {isBreak ? "הפסקה" : "עכשיו בפוקוס"}
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-4xl">
            {task?.title ?? "הפסקה קצרה"}
          </h1>
          {p && (
            <button
              onClick={() => nav.go("project", p.id)}
              className="mt-2 text-sm text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
            >
              {p.name}
              {p.client && ` · ${p.client}`}
            </button>
          )}
        </div>

        {/* timer */}
        <div className="my-7 sm:my-9">
          <TimerRing
            frac={frac}
            size={typeof window !== "undefined" && window.innerWidth < 480 ? 260 : 320}
            color={color}
            glow={running}
          >
            <div
              className="font-light tabular-nums tracking-tight"
              style={{ fontSize: "clamp(3.2rem, 11vw, 4.6rem)", color: rem < 0 ? C.warn : C.text }}
            >
              {fmtClock(rem)}
            </div>
            <div className="mt-1 text-sm text-[color:var(--focus-muted)]">
              {!t
                ? "מוכן להתחיל"
                : t.pausedAt
                  ? "מושהה"
                  : isBreak
                    ? rem < 0
                      ? "ההפסקה נגמרה"
                      : "נושמים רגע"
                    : rem < 0
                      ? "זמן נוסף — ממשיך למדוד"
                      : "זמן עבודה"}
            </div>
          </TimerRing>
        </div>

        {/* controls */}
        {!t ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-2">
              {[25, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    "h-10 rounded-full px-5 text-sm font-medium transition-all",
                    minutes === m
                      ? "bg-[var(--focus-primary)] text-[color:var(--focus-primary-foreground)]"
                      : "border border-[color:var(--focus-border)] bg-[var(--focus-card)]/70 hover:bg-[var(--focus-card-hi)]",
                  )}
                >
                  {m} דק׳
                </button>
              ))}
              <Input
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (+e.target.value > 0) setMinutes(Math.min(600, +e.target.value));
                }}
                placeholder="אחר"
                inputMode="numeric"
                className={cn(
                  "h-10 w-20 rounded-full text-center",
                  ![25, 45, 60].includes(minutes) && "ring-2 ring-[var(--focus-primary)]",
                )}
              />
            </div>
            <button
              onClick={() => task && actions.startFocus(task.id, minutes)}
              className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--focus-primary)] to-[var(--focus-violet)] text-[color:var(--focus-primary-foreground)] shadow-[0_10px_40px_-8px_color-mix(in_oklab,var(--focus-primary)_70%,transparent)] transition-transform hover:scale-105 active:scale-95"
              aria-label="התחל"
            >
              <Play className="size-8 translate-x-[-2px]" fill="currentColor" />
            </button>
            <div className="text-xs text-[color:var(--focus-muted)]">
              רווח = התחל/השהה · Ctrl+Enter = בוצע
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 sm:gap-4">
            <IconBtn
              icon={RotateCcw}
              label="איפוס טיימר (הזמן שעבדת נשמר)"
              onClick={actions.resetTimer}
              className="size-11 border border-[color:var(--focus-border)]"
            />
            <button
              onClick={actions.togglePause}
              className="flex size-20 items-center justify-center rounded-full text-[color:var(--focus-primary-foreground)] shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${color}, var(--focus-violet))` }}
              aria-label={running ? "השהה" : "המשך"}
            >
              {running ? (
                <Pause className="size-8" fill="currentColor" />
              ) : (
                <Play className="size-8 translate-x-[-2px]" fill="currentColor" />
              )}
            </button>
            {isBreak ? (
              <Btn variant="outline" onClick={actions.endBreak} icon={Play}>
                חזרה לעבודה
              </Btn>
            ) : (
              <IconBtn
                icon={Plus}
                label="הוסף 5 דקות"
                onClick={() => actions.extend(5)}
                className="size-11 border border-[color:var(--focus-border)]"
              />
            )}
          </div>
        )}
        <div className="mt-4 text-sm italic text-[color:var(--focus-muted)]">״{quote}״</div>

        {/* flow actions */}
        {task && !isBreak && (
          <div className="mt-8 flex w-full flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2.5">
              <Btn
                variant="primary"
                icon={Check}
                onClick={complete}
                className="h-12 rounded-full px-7 text-[15px] shadow-[0_10px_30px_-10px_var(--focus-primary)]"
              >
                בוצע
              </Btn>
              <Btn icon={Coffee} onClick={actions.startBreak} className="h-12 rounded-full px-6">
                הפסקה
              </Btn>
              <Btn
                variant="outline"
                icon={SkipForward}
                onClick={() => actions.skipLater(task.id)}
                className="h-12 rounded-full px-6"
              >
                אחר כך
              </Btn>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-[color:var(--focus-border)] bg-[var(--focus-card)]/60 p-1 backdrop-blur">
              {(
                [
                  [
                    UserX,
                    "ממתין ללקוח",
                    () => actions.setFlowStatus(task.id, "waiting", {}, "הועבר להמתנה ללקוח"),
                  ],
                  [AlertOctagon, "נתקלתי בבעיה", () => setBlockOpen(true)],
                  [CalendarArrowUp, "למחר", () => actions.moveToTomorrow(task.id)],
                  [Pencil, "עריכה", () => nav.openTask(task.id)],
                ] as const
              ).map(([Icon, label, fn]) => (
                <button
                  key={label}
                  onClick={fn}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[color:var(--focus-muted)] transition-colors hover:bg-[var(--focus-card-hi)] hover:text-[color:var(--focus-foreground)]"
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* details */}
        {task && (
          <div className="mt-8 grid w-full gap-4 md:grid-cols-5">
            <Card className="p-5 md:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">מה עושים</div>
                <StatusBadge status={task.status} />
              </div>
              {task.desc ? (
                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--focus-muted)]">
                  {task.desc}
                </p>
              ) : null}
              <Checklist t={task} />
              {task.notes && (
                <p className="mt-3 rounded-xl bg-[var(--focus-bg2)] p-3 text-sm text-[color:var(--focus-muted)]">
                  {task.notes}
                </p>
              )}
            </Card>
            <Card className="space-y-4 p-5 md:col-span-2">
              <div>
                <div className="mb-2 text-sm font-semibold">זמן</div>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-2xl font-semibold tabular-nums">
                    {fmtMin(
                      task.actualMin +
                        (t && t.mode === "work" ? Math.round(elapsedMs(t) / 60000) : 0),
                    )}
                  </span>
                  <span className="text-[color:var(--focus-muted)]">
                    מתוך {fmtMin(task.estMin)} משוער
                  </span>
                </div>
                <Progress
                  className="mt-2"
                  value={
                    ((task.actualMin + (t && t.mode === "work" ? elapsedMs(t) / 60000 : 0)) /
                      Math.max(1, task.estMin)) *
                    100
                  }
                  color={task.actualMin > task.estMin ? C.warn : C.violet}
                />
              </div>
              <QuickLinks
                task={task}
                projectUrl={p?.url}
                adminUrl={p?.adminUrl || p?.aiUrl}
                cpanelUrl={cp?.url}
                cpanelName={cp?.name}
              />
            </Card>
          </div>
        )}
      </div>
      {task && <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} task={task} />}
    </div>
  );
}

function QuickLinks({
  task,
  projectUrl,
  adminUrl,
  cpanelUrl,
  cpanelName,
}: {
  task: Task;
  projectUrl?: string;
  adminUrl?: string;
  cpanelUrl?: string;
  cpanelName?: string;
}) {
  const items = [
    projectUrl && { href: projectUrl, label: "האתר", icon: Globe },
    adminUrl && { href: adminUrl, label: "ניהול האתר", icon: ExternalLink },
    cpanelUrl && {
      href: cpanelUrl,
      label: `cPanel${cpanelName ? ` · ${cpanelName}` : ""}`,
      icon: Server,
    },
    ...task.links.map((l, i) => ({ href: l, label: `קישור ${i + 1}`, icon: ExternalLink })),
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];
  if (!items.length)
    return (
      <div className="text-xs text-[color:var(--focus-muted)]">
        אין קישורים — אפשר להוסיף בעריכת המשימה או הפרויקט.
      </div>
    );
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">קישורים</div>
      <div className="flex flex-wrap gap-2">
        {items.map((x, i) => (
          <a
            key={i}
            href={x.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-3 py-1.5 text-sm transition-colors hover:border-[color:var(--focus-primary)] hover:text-[color:var(--focus-primary)]"
          >
            <x.icon className="size-3.5" />
            {x.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function BlockDialog({ open, onClose, task }: { open: boolean; onClose: () => void; task: Task }) {
  const [reason, setReason] = React.useState("");
  const submit = (makeTask: boolean) => {
    actions.setFlowStatus(task.id, "blocked", { blockReason: reason }, "המשימה סומנה כחסומה");
    if (makeTask && reason.trim())
      actions.addTask({
        title: `לשחרר חסימה: ${reason}`,
        projectId: task.projectId,
        status: "todo",
        priority: "high",
      });
    setReason("");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="מה חוסם?"
      description="נשמור את הסיבה ונעבור למשימה הבאה."
    >
      <div className="space-y-3">
        <Input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="לדוגמה: חסרה גישה ל-cPanel"
          onKeyDown={(e) => e.key === "Enter" && submit(false)}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>
            ביטול
          </Btn>
          <Btn variant="outline" onClick={() => submit(true)} disabled={!reason.trim()}>
            סמן + צור משימת טיפול
          </Btn>
          <Btn variant="primary" onClick={() => submit(false)}>
            סמן כחסום
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Day summary ------------------------------ */
export function DaySummary() {
  const db = useDB();
  const nav = useNav();
  const planned = plannedTasks(db);
  const done = planned.filter((t) => t.status === "done");
  const waiting = planned.filter((t) => t.status === "waiting");
  const blocked = planned.filter((t) => t.status === "blocked");
  const deferred = db.tasks.filter((t) => t.due === addOne() && (t.deferCount ?? 0) > 0);
  const todaySessions = db.sessions.filter(
    (s) => new Date(s.at).toDateString() === new Date().toDateString(),
  );
  const focusMin = todaySessions.reduce((s, x) => s + x.min, 0);
  const projects = [...new Set(done.map((t) => t.projectId).filter(Boolean))]
    .map((id) => findProject(db, id)?.name)
    .filter(Boolean);
  const empty = planned.length === 0;

  return (
    <div className="focus-stage focus-dark flex min-h-full items-center justify-center p-4">
      <Card hi className="relative z-10 w-full max-w-lg p-7 text-center sm:p-9">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--focus-primary)]/15 text-[color:var(--focus-primary)]">
          {empty ? <Sparkles className="size-8" /> : <Trophy className="size-8" />}
        </div>
        <h1 className="text-2xl font-bold">
          {empty
            ? "אין עדיין משימות להיום"
            : db.plan.closed
              ? "היום נסגר. כל הכבוד."
              : "סיימת את כל משימות היום!"}
        </h1>
        {empty ? (
          <p className="mt-2 text-sm text-[color:var(--focus-muted)]">
            בחר כמה משימות ריאליות, ו-FOCUS ילווה אותך אחת אחרי השנייה.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Stat n={done.length} l="הושלמו" c={C.ok} />
            <Stat n={fmtMin(focusMin)} l="זמן פוקוס" c={C.primary} />
            <Stat n={waiting.length + blocked.length} l="בהמתנה / חסומות" c={C.pink} />
          </div>
        )}
        {projects.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {projects.map((n) => (
              <Badge key={n} color={C.violet}>
                {n}
              </Badge>
            ))}
          </div>
        )}
        {deferred.length > 0 && (
          <div className="mt-3 text-xs text-[color:var(--focus-muted)]">
            {deferred.length} משימות הועברו למחר
          </div>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Btn variant="primary" icon={Plus} onClick={() => nav.go("today")}>
            {empty ? "תכנן את היום" : "הוסף עוד משימה"}
          </Btn>
          {!empty && !db.plan.closed && (
            <Btn
              onClick={() => {
                actions.closeDay();
                nav.go("weekly");
              }}
            >
              סיים את היום
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => nav.go("dashboard")}>
            ללוח הבקרה
          </Btn>
        </div>
      </Card>
    </div>
  );
}
const addOne = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function Stat({ n, l, c }: { n: React.ReactNode; l: string; c: string }) {
  return (
    <div className="rounded-2xl bg-[var(--focus-bg2)] p-3">
      <div className="text-xl font-bold tabular-nums" style={{ color: c }}>
        {n}
      </div>
      <div className="mt-0.5 text-xs text-[color:var(--focus-muted)]">{l}</div>
    </div>
  );
}

/* ------------------------------ Floating panel content ------------------------------ */
/** Rendered both inside the Document-PiP window and as the in-app fallback. */
export function FloatingContent({
  onClose,
  onOpenApp,
  inPip,
}: {
  onClose?: () => void;
  onOpenApp?: () => void;
  inPip?: boolean;
}) {
  const { db, task, planned, t } = useFlow();
  useTick(!!db.timer);
  const compact = db.settings.pipCompact;
  const p = task ? findProject(db, task.projectId) : undefined;
  const isBreak = t?.mode === "break";
  const rem = t ? remainingSec(t) : db.settings.defaultFocusMin * 60;
  const frac = t ? Math.max(0, Math.min(1, rem / (t.plannedMin * 60))) : 1;
  const running = !!t && !t.pausedAt;
  const over = rem < 0;
  const color = isBreak ? C.violet : over ? C.warn : C.primary;
  const mainLink = p?.adminUrl || p?.aiUrl || p?.url || task?.links[0];
  const doneCount = planned.filter((x) => x.status === "done").length;
  const idx = task ? planned.findIndex((x) => x.id === task.id) + 1 : 0;
  const next = planned.find((x) => isOpen(x) && x.id !== task?.id);
  const checkDone = task?.checklist.filter((c) => c.done).length ?? 0;

  const status = !t
    ? { label: "מוכן", dot: "var(--focus-muted)", pulse: false }
    : isBreak
      ? { label: "הפסקה", dot: C.violet, pulse: running }
      : t.pausedAt
        ? { label: "מושהה", dot: C.warn, pulse: false }
        : over
          ? { label: "זמן נוסף", dot: C.warn, pulse: true }
          : { label: "בפוקוס", dot: "#3ddc97", pulse: true };

  // ring around the play button
  const R = 25;
  const circ = 2 * Math.PI * R;

  return (
    <div
      dir="rtl"
      className={cn(
        "focus-float focus-dark relative flex h-full flex-col overflow-hidden text-[color:var(--focus-foreground)]",
        compact ? "px-3.5 py-3" : "p-4",
      )}
    >
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 size-44 rounded-full opacity-40 blur-3xl transition-colors duration-700"
        style={{ background: color }}
      />

      {/* header */}
      <div className="relative flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/10">
          <span className="relative flex size-1.5">
            {status.pulse && (
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-70"
                style={{ background: status.dot }}
              />
            )}
            <span
              className="relative inline-flex size-1.5 rounded-full"
              style={{ background: status.dot }}
            />
          </span>
          {status.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[color:var(--focus-muted)]">
          {isBreak ? "נושמים רגע" : (p?.name ?? (task ? "ללא פרויקט" : "FOCUS"))}
          {!compact && planned.length > 0 && idx > 0 && ` · ${idx}/${planned.length}`}
        </span>
        <div className="flex items-center">
          {onOpenApp && (
            <FloatIcon label="פתח את המערכת" onClick={onOpenApp}>
              <LayoutDashboard className="size-3.5" />
            </FloatIcon>
          )}
          <FloatIcon
            label={compact ? "הרחב" : "צמצם"}
            onClick={() => actions.settings({ pipCompact: !compact })}
          >
            {compact ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </FloatIcon>
          {onClose && (
            <FloatIcon label="סגור פאנל" onClick={onClose}>
              <X className="size-3.5" />
            </FloatIcon>
          )}
        </div>
      </div>

      {/* title */}
      <div
        className={cn(
          "relative shrink-0 font-bold leading-snug",
          compact ? "mt-1 truncate text-[14px]" : "mt-2 line-clamp-2 text-[16px]",
        )}
        title={task?.title}
      >
        {task?.title ?? (isBreak ? "הפסקה קצרה" : "אין משימה פעילה")}
      </div>

      {/* timer row */}
      <div className={cn("relative flex shrink-0 items-center gap-3", compact ? "mt-1.5" : "mt-3")}>
        {(task || isBreak) && (
          <button
            aria-label={running ? "השהה" : t ? "המשך" : "התחל"}
            onClick={() => (t ? actions.togglePause() : task && actions.startFocus(task.id))}
            className="group relative flex size-[58px] shrink-0 items-center justify-center"
          >
            <svg width="58" height="58" className="absolute inset-0 -rotate-90">
              <circle
                cx="29"
                cy="29"
                r={R}
                fill="none"
                stroke="rgb(255 255 255 / .1)"
                strokeWidth="3.5"
              />
              <circle
                cx="29"
                cy="29"
                r={R}
                fill="none"
                stroke={color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - frac)}
                style={{ transition: "stroke-dashoffset 1s linear, stroke .5s" }}
              />
            </svg>
            <span
              className="flex size-10 items-center justify-center rounded-full text-[color:var(--focus-primary-foreground)] shadow-lg transition-transform group-hover:scale-105 group-active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${color}, var(--focus-violet))`,
                boxShadow: `0 6px 18px -4px ${color}`,
              }}
            >
              {running ? (
                <Pause className="size-4" fill="currentColor" />
              ) : (
                <Play className="size-4 translate-x-[-1px]" fill="currentColor" />
              )}
            </span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div
            className="text-[34px] leading-none font-semibold tracking-tight tabular-nums"
            style={{ color: over ? C.warn : undefined }}
          >
            {fmtClock(rem)}
          </div>
          {!compact && (
            <div className="mt-1 text-[11px] text-[color:var(--focus-muted)]">
              {!t
                ? `בלוק של ${db.settings.defaultFocusMin} דק׳`
                : isBreak
                  ? "הפסקה"
                  : over
                    ? "עברת את הזמן — ממשיך למדוד"
                    : `מתוך ${t.plannedMin} דק׳`}
            </div>
          )}
        </div>
        {task && !isBreak && (
          <button
            aria-label="בוצע"
            onClick={() => actions.completeTask(task.id)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-[#0b0c3f] shadow-[0_6px_18px_-6px_rgb(255_255_255/.5)] transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Check className="size-4" strokeWidth={3} />
            בוצע
          </button>
        )}
        {isBreak && (
          <button
            onClick={actions.endBreak}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-[#0b0c3f]"
          >
            <Play className="size-3.5" fill="currentColor" />
            חזרה
          </button>
        )}
      </div>

      {/* expanded body */}
      {!compact && task && !isBreak && (
        <div className="relative mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
          {planned.length > 0 && (
            <div className="flex gap-1" aria-label={`${doneCount} מתוך ${planned.length} הושלמו`}>
              {planned.map((x) => (
                <span
                  key={x.id}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    background:
                      x.status === "done"
                        ? C.primary
                        : x.id === task.id
                          ? `color-mix(in oklab, ${C.primary} 45%, transparent)`
                          : "rgb(255 255 255 / .1)",
                  }}
                />
              ))}
            </div>
          )}

          {task.checklist.length > 0 && (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/[0.06]">
              <div className="mb-1 flex items-center justify-between px-1 text-[10.5px] font-semibold text-[color:var(--focus-muted)]">
                <span>צ׳קליסט</span>
                <span className="tabular-nums">
                  {checkDone}/{task.checklist.length}
                </span>
              </div>
              {task.checklist.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    actions.patchTask(task.id, {
                      checklist: task.checklist.map((x) =>
                        x.id === c.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-right text-[12.5px] hover:bg-white/5"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      c.done
                        ? "border-[color:var(--focus-primary)] bg-[var(--focus-primary)] text-[color:var(--focus-primary-foreground)]"
                        : "border-white/25",
                    )}
                  >
                    {c.done && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      c.done && "text-[color:var(--focus-muted)] line-through",
                    )}
                  >
                    {c.txt}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!task.checklist.length && task.desc && (
            <p className="line-clamp-3 text-[12px] leading-relaxed text-[color:var(--focus-muted)]">
              {task.desc}
            </p>
          )}

          {next && (
            <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--focus-muted)]">
              <SkipForward className="size-3 shrink-0" />
              <span className="shrink-0">הבא:</span>
              <span className="truncate text-[color:var(--focus-foreground)]/85">{next.title}</span>
            </div>
          )}

          <div className="mt-auto grid grid-cols-4 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
            <FloatAction icon={Coffee} label="הפסקה" onClick={actions.startBreak} />
            <FloatAction
              icon={SkipForward}
              label="אחר כך"
              onClick={() => actions.skipLater(task.id)}
            />
            <FloatAction
              icon={UserX}
              label="ממתין"
              onClick={() => actions.setFlowStatus(task.id, "waiting", {}, "הועבר להמתנה ללקוח")}
            />
            {mainLink ? (
              <FloatAction
                icon={ExternalLink}
                label="לאתר"
                onClick={() => window.open(mainLink, "_blank", "noopener")}
              />
            ) : (
              <FloatAction icon={Plus} label="+5 דק׳" onClick={() => actions.extend(5)} />
            )}
          </div>
        </div>
      )}
      {!task && !isBreak && (
        <div className="relative mt-2 text-[12px] text-[color:var(--focus-muted)]">
          {plannedTasks(db).length
            ? "כל משימות היום הושלמו ✓ כל הכבוד"
            : `תכנן משימות להיום (${todayStr()})`}
        </div>
      )}
    </div>
  );
}
function FloatIcon({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-lg text-[color:var(--focus-muted)] transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
function FloatAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium text-[color:var(--focus-foreground)]/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
