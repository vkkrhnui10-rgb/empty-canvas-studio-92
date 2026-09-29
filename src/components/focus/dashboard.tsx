import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Clock,
  FolderKanban,
  Inbox,
  PictureInPicture2,
  Play,
  Plus,
  Rocket,
  ServerCrash,
  Sparkles,
  Sun,
  Wallet,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { C, CLOSED_PROJECT, PRIORITIES, PRIO_COLOR, SITE_BAD, accentFor } from "./constants";
import { actions, activeTask, computeAlerts, findProject, plannedTasks, useDB } from "./store";
import { Badge, Btn, Card, EmptyState, Progress, SectionTitle } from "./ui";
import { balanceOf, fmtMin, ils, isOpen, todayStr } from "./utils";
import { useNav } from "./nav";
import { TaskRow } from "./tasks";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5
    ? "לילה טוב"
    : h < 12
      ? "בוקר טוב"
      : h < 17
        ? "צהריים טובים"
        : h < 21
          ? "ערב טוב"
          : "לילה טוב";
};

export function Dashboard() {
  const db = useDB();
  const nav = useNav();
  const planned = plannedTasks(db);
  const next = activeTask(db);
  const nextP = next ? findProject(db, next.projectId) : undefined;
  const alerts = computeAlerts(db);
  const doneToday = db.tasks.filter(
    (t) => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString(),
  );
  const overdue = db.tasks.filter((t) => isOpen(t) && t.due && t.due < todayStr());
  const plannedMin = planned.filter(isOpen).reduce((s, t) => s + t.estMin, 0);
  const issues = db.projects.filter((p) => SITE_BAD.includes(p.siteState));
  const soBad = db.projects.filter(
    (p) => p.hosted && ["failed", "none", "check"].includes(p.soState),
  );
  const balance = db.projects.reduce((s, p) => s + balanceOf(p), 0);
  const monthly = db.projects
    .filter((p) => p.hosted && !["cancelled", "paused"].includes(p.soState))
    .reduce((s, p) => s + p.hostPrice, 0);
  const active = db.projects.filter((p) => !CLOSED_PROJECT.includes(p.status));
  const planDone = planned.filter((t) => t.status === "done").length;
  const inbox = db.tasks.filter((t) => t.status === "inbox").length;

  if (db.projects.length === 0 && db.tasks.length === 0) return <Onboarding />;

  const tiles = [
    { l: "הושלמו היום", v: doneToday.length, icon: CheckCircle2, c: C.ok },
    {
      l: "באיחור",
      v: overdue.length,
      icon: Clock,
      c: overdue.length ? C.bad : undefined,
      go: () => nav.go("tasks"),
    },
    {
      l: "אתרים עם בעיה",
      v: issues.length,
      icon: ServerCrash,
      c: issues.length ? C.bad : undefined,
      go: () => nav.go("projects"),
    },
    {
      l: "הוראות קבע לטיפול",
      v: soBad.length,
      icon: Receipt,
      c: soBad.length ? C.warn : undefined,
      go: () => nav.go("finances"),
    },
    {
      l: "יתרה לגבייה",
      v: ils(balance),
      icon: Wallet,
      c: balance ? C.warn : undefined,
      go: () => nav.go("finances"),
    },
    { l: "פרויקטים פעילים", v: active.length, icon: FolderKanban, go: () => nav.go("projects") },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm text-[color:var(--focus-muted)]">
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
        </div>
        {inbox > 0 && (
          <Btn size="sm" variant="outline" icon={Inbox} onClick={() => nav.go("inbox")}>
            {inbox} בתיבה לסידור
          </Btn>
        )}
      </div>

      {/* HERO — next task */}
      <Card hi className="focus-hero overflow-hidden p-5 sm:p-7">
        {next ? (
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-[color:var(--focus-mint)]">
                <Sun className="size-3.5" /> המשימה הבאה שלי
              </div>
              <div className="text-balance text-2xl font-bold leading-tight sm:text-3xl">
                {next.title}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[color:var(--focus-muted)]">
                {nextP && <Badge color={accentFor(nextP.id)}>{nextP.name}</Badge>}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {fmtMin(next.estMin)}
                </span>
                {next.priority !== "normal" && (
                  <span style={{ color: PRIO_COLOR[next.priority] }}>
                    עדיפות {PRIORITIES[next.priority]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Btn
                variant="primary"
                size="lg"
                icon={Play}
                onClick={() => {
                  if (db.timer?.taskId !== next.id) actions.startFocus(next.id);
                  nav.go("focus");
                }}
              >
                {db.timer?.taskId === next.id ? "חזרה לפוקוס" : "התחל לעבוד"}
              </Btn>
              <Btn size="lg" variant="outline" icon={PictureInPicture2} onClick={nav.openFloating}>
                פאנל צף
              </Btn>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xl font-bold">
                {planned.length ? "כל משימות היום הושלמו" : "עדיין לא בחרת משימות להיום"}
              </div>
              <div className="mt-1 text-sm text-[color:var(--focus-muted)]">
                {planned.length
                  ? "אפשר לסגור את היום או להוסיף עוד משימה."
                  : "דקה של תכנון בבוקר = יום מסודר ורגוע."}
              </div>
            </div>
            <Btn variant="primary" size="lg" icon={CalendarCheck} onClick={() => nav.go("today")}>
              תכנן את היום
            </Btn>
          </div>
        )}
      </Card>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((x) => (
          <Card key={x.l} onClick={x.go} className="p-4">
            <div className="flex items-center justify-between text-[color:var(--focus-muted)]">
              <span className="text-xs">{x.l}</span>
              <x.icon className="size-4" style={{ color: x.c }} />
            </div>
            <div className="mt-2 truncate text-xl font-bold tabular-nums" style={{ color: x.c }}>
              {x.v}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* today */}
        <Card className="p-5 lg:col-span-3">
          <SectionTitle
            icon={Sun}
            action={
              <Btn size="sm" variant="ghost" onClick={() => nav.go("today")}>
                תכנון <ArrowLeft className="size-3.5" />
              </Btn>
            }
          >
            היום שלי
          </SectionTitle>
          {planned.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--focus-muted)]">
              <Progress
                className="flex-1"
                value={(planDone / planned.length) * 100}
                color={C.violet}
              />
              <span className="tabular-nums">
                {planDone}/{planned.length} · נותרו {fmtMin(plannedMin)} מתוך{" "}
                {db.settings.workHours} ש׳
              </span>
            </div>
          )}
          {planned.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="אין משימות מתוכננות"
              action={
                <Btn size="sm" variant="primary" onClick={() => nav.go("today")}>
                  תכנן את היום
                </Btn>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {planned.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </Card>

        {/* attention */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            icon={AlertTriangle}
            action={
              alerts.length > 0 && (
                <Btn size="sm" variant="ghost" onClick={() => nav.go("alerts")}>
                  הכול ({alerts.length})
                </Btn>
              )
            }
          >
            דורש תשומת לב
          </SectionTitle>
          {alerts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="הכול תקין"
              subtitle="אין כרגע משהו שדורש ממך פעולה"
            />
          ) : (
            <div className="space-y-1.5">
              {alerts.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  onClick={() =>
                    a.projectId
                      ? nav.go("project", a.projectId)
                      : a.taskId && nav.openTask(a.taskId)
                  }
                  className="flex w-full items-center gap-2.5 rounded-xl bg-[var(--focus-bg2)] px-3 py-2.5 text-right text-sm transition-colors hover:bg-[var(--focus-card-hi)]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: a.sev === "bad" ? C.bad : C.warn }}
                  />
                  <span className="line-clamp-1 flex-1">{a.txt}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <SectionTitle
            icon={FolderKanban}
            action={
              <Btn size="sm" variant="ghost" onClick={() => nav.go("projects")}>
                כל הפרויקטים
              </Btn>
            }
          >
            פרויקטים פעילים
          </SectionTitle>
          {active.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="אין פרויקטים פעילים"
              action={
                <Btn size="sm" variant="primary" icon={Plus} onClick={() => nav.editProject("new")}>
                  פרויקט חדש
                </Btn>
              }
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {active.slice(0, 6).map((p) => {
                const all = db.tasks.filter(
                  (t) => t.projectId === p.id && t.status !== "cancelled",
                );
                const done = all.filter((t) => t.status === "done").length;
                const nx = all.find(isOpen);
                return (
                  <button
                    key={p.id}
                    onClick={() => nav.go("project", p.id)}
                    className="relative overflow-hidden rounded-2xl bg-[var(--focus-bg2)] p-3 text-right transition-colors hover:bg-[var(--focus-card-hi)]"
                  >
                    <span
                      className="absolute inset-y-0 right-0 w-1"
                      style={{ background: accentFor(p.id) }}
                    />
                    <div className="flex items-center justify-between gap-2 pr-1.5">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-[color:var(--focus-muted)]">
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-1 truncate pr-1.5 text-xs text-[color:var(--focus-muted)]">
                      {nx ? `הבא: ${nx.title}` : "אין משימה הבאה"}
                    </div>
                    <Progress
                      className="mr-1.5 mt-2"
                      value={all.length ? (done / all.length) * 100 : 0}
                      color={accentFor(p.id)}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            icon={Wallet}
            action={
              <Btn size="sm" variant="ghost" onClick={() => nav.go("finances")}>
                כספים
              </Btn>
            }
          >
            תמונת מצב כספית
          </SectionTitle>
          <div className="space-y-3">
            <MoneyRow l="נשאר לגבות" v={ils(balance)} c={balance ? C.warn : C.ok} />
            <MoneyRow l="אחסון חודשי צפוי" v={ils(monthly)} />
            <MoneyRow l="אחסון שנתי משוער" v={ils(monthly * 12)} />
            <MoneyRow
              l="הוראות קבע תקינות"
              v={`${db.projects.filter((p) => p.hosted && p.soState === "ok").length}/${db.projects.filter((p) => p.hosted).length}`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
function MoneyRow({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--focus-bg2)] px-3 py-2.5 text-sm">
      <span className="text-[color:var(--focus-muted)]">{l}</span>
      <span className="font-semibold tabular-nums" style={{ color: c }}>
        {v}
      </span>
    </div>
  );
}

function Onboarding() {
  const nav = useNav();
  const steps = [
    {
      icon: FolderKanban,
      t: "הוסף פרויקט",
      d: "כל אתר לקוח = פרויקט אחד: לקוח, אחסון, cPanel, כסף ומשימות.",
      a: () => nav.editProject("new"),
      b: "פרויקט חדש",
    },
    {
      icon: Inbox,
      t: "זרוק משימות לתיבה",
      d: "מקש N מכל מקום. רק שם — את השאר משלימים אחר כך.",
      a: () => nav.quickAdd(),
      b: "משימה חדשה",
    },
    {
      icon: Rocket,
      t: "תכנן והתחל לעבוד",
      d: "בוחרים משימות להיום, לוחצים התחל — ו-FOCUS מוביל משימה אחרי משימה.",
      a: () => nav.go("today"),
      b: "תכנון היום",
    },
  ];
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--focus-mint)] text-xl font-black text-[color:var(--focus-mint-foreground)]">
          F
        </div>
        <h1 className="text-3xl font-bold tracking-tight">ברוך הבא ל-FOCUS</h1>
        <p className="mt-2 text-[color:var(--focus-muted)]">
          מערכת ההפעלה של העסק שלך — שלושה צעדים ואתה בפנים.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.t} className="flex flex-col p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-[var(--focus-card-hi)] text-xs font-bold text-[color:var(--focus-mint)]">
                {i + 1}
              </span>
              <s.icon className="size-4 text-[color:var(--focus-muted)]" />
            </div>
            <div className="font-semibold">{s.t}</div>
            <p className="mt-1 flex-1 text-sm text-[color:var(--focus-muted)]">{s.d}</p>
            <Btn className="mt-4" variant={i === 0 ? "primary" : "soft"} onClick={s.a}>
              {s.b}
            </Btn>
          </Card>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Btn variant="ghost" icon={Sparkles} onClick={actions.loadDemo}>
          רוצה לראות קודם? טען נתוני דוגמה
        </Btn>
      </div>
    </div>
  );
}
