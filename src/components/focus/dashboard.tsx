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
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  LinkAction,
  Progress,
  ProjectAvatar,
  SectionTitle,
  StatCard,
} from "./ui";
import { balanceOf, fmtMin, greeting, ils, isOpen, todayStr } from "./utils";
import { useNav } from "./nav";
import { TaskRow } from "./tasks";

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
  const hosted = db.projects.filter((p) => p.hosted);

  if (db.projects.length === 0 && db.tasks.length === 0) return <Onboarding />;

  const kpis = [
    {
      l: "יתרה לגבייה",
      v: ils(balance),
      icon: Wallet,
      c: balance ? C.warn : C.ok,
      sub: `${db.projects.filter((p) => balanceOf(p) > 0).length} לקוחות`,
      go: () => nav.go("finances"),
    },
    {
      l: "אחסון חודשי",
      v: ils(monthly),
      icon: Receipt,
      sub: soBad.length ? `${soBad.length} הוראות קבע לטיפול` : "כל הוראות הקבע תקינות",
      subC: soBad.length ? C.warn : C.ok,
      go: () => nav.go("finances"),
    },
    {
      l: "הושלמו היום",
      v: String(doneToday.length),
      icon: CheckCircle2,
      c: C.ok,
      sub: planned.length ? `מתוך ${planned.length} מתוכננות` : "עוד לא תכננת",
    },
    {
      l: "באיחור",
      v: String(overdue.length),
      icon: Clock,
      c: overdue.length ? C.bad : undefined,
      sub: overdue.length ? "דורש טיפול" : "אין משימות באיחור",
      go: () => nav.go("tasks"),
    },
  ];

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[26px] leading-tight font-bold">
            {greeting()}
            {db.settings.ownerName && `, ${db.settings.ownerName}`}
          </h1>
          <span className="text-[15px] text-[color:var(--focus-muted)]">
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
        {inbox > 0 && (
          <Btn size="sm" variant="outline" icon={Inbox} onClick={() => nav.go("inbox")}>
            {inbox} בתיבה לסידור
          </Btn>
        )}
      </div>

      {/* row 1 — hero + quick actions */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="focus-gradient relative overflow-hidden rounded-[16px] p-6 sm:p-8 lg:col-span-8">
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full border-[36px] border-white/[0.06]" />
          {next ? (
            <div className="relative flex h-full flex-col">
              <div className="flex items-center gap-2 text-[17px] font-bold text-white/90">
                <Sun className="size-[18px]" /> המשימה הבאה שלי
              </div>
              <div className="mt-4 text-balance text-[30px] leading-tight font-bold sm:text-[36px]">
                {next.title}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/75">
                {nextP && <span className="font-semibold text-white">{nextP.name}</span>}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {fmtMin(next.estMin)}
                </span>
                {next.priority !== "normal" && next.priority !== "low" && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[13px] font-semibold text-white">
                    עדיפות {PRIORITIES[next.priority]}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-3 pt-7">
                <button
                  onClick={() => {
                    if (db.timer?.taskId !== next.id) actions.startFocus(next.id);
                    nav.go("focus");
                  }}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[16px] font-bold text-[color:var(--focus-navy)] shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  <Play className="size-4" fill="currentColor" />
                  {db.timer?.taskId === next.id ? "חזרה לפוקוס" : "התחל לעבוד"}
                </button>
                <button
                  onClick={nav.openFloating}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-5 text-[15px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/15"
                >
                  <PictureInPicture2 className="size-4" />
                  פאנל צף
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex h-full flex-col">
              <div className="flex items-center gap-2 text-[17px] font-bold text-white/90">
                <CalendarCheck className="size-[18px]" /> היום שלי
              </div>
              <div className="mt-4 text-[30px] leading-tight font-bold">
                {planned.length ? "כל משימות היום הושלמו" : "עדיין לא בחרת משימות להיום"}
              </div>
              <div className="mt-2 text-[16px] text-white/75">
                {planned.length
                  ? "אפשר לסגור את היום או להוסיף עוד משימה."
                  : "דקה של תכנון בבוקר = יום מסודר ורגוע."}
              </div>
              <div className="mt-auto pt-7">
                <button
                  onClick={() => nav.go("today")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[16px] font-bold text-[color:var(--focus-navy)] shadow-lg"
                >
                  <CalendarCheck className="size-4" />
                  תכנן את היום
                </button>
              </div>
            </div>
          )}
        </div>

        <Card className="p-6 lg:col-span-4">
          <h2 className="mb-4 text-[17px] font-bold">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "משימה חדשה", i: Plus, a: () => nav.quickAdd() },
              { l: "פרויקט חדש", i: FolderKanban, a: () => nav.editProject("new") },
              { l: "תכנון היום", i: CalendarCheck, a: () => nav.go("today") },
              { l: "פאנל צף", i: PictureInPicture2, a: nav.openFloating },
            ].map((x) => (
              <button
                key={x.l}
                onClick={x.a}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--focus-primary)] px-2 text-[15px] font-semibold text-white transition-colors hover:bg-[#4d41d6]"
              >
                <x.i className="size-4" />
                {x.l}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-[var(--focus-bg2)] p-4">
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold">התקדמות היום</span>
              <span className="tabular-nums text-[color:var(--focus-muted)]">
                {planDone}/{planned.length}
              </span>
            </div>
            <Progress
              className="mt-2.5 h-2"
              value={planned.length ? (planDone / planned.length) * 100 : 0}
            />
            <div className="mt-2 text-[13px] text-[color:var(--focus-muted)]">
              נותרו {fmtMin(plannedMin)} מתוך {db.settings.workHours} שעות עבודה
            </div>
          </div>
        </Card>
      </div>

      {/* row 2 — KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((x) => (
          <StatCard
            key={x.l}
            label={x.l}
            value={x.v}
            sub={x.sub}
            icon={x.icon}
            color={x.c}
            subColor={x.subC}
            onClick={x.go}
          />
        ))}
      </div>

      {/* row 3 — today + attention */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <SectionTitle
            action={<LinkAction onClick={() => nav.go("today")}>לתכנון היום</LinkAction>}
          >
            היום שלי
          </SectionTitle>
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
            <div className="-mx-2">
              {planned.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-5">
          <SectionTitle
            action={
              alerts.length > 0 && (
                <LinkAction onClick={() => nav.go("alerts")}>
                  לכל ההתראות ({alerts.length})
                </LinkAction>
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
            <div className="divide-y divide-[color:var(--focus-border)]">
              {alerts.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  onClick={() =>
                    a.projectId
                      ? nav.go("project", a.projectId)
                      : a.taskId && nav.openTask(a.taskId)
                  }
                  className="flex w-full items-center gap-3 py-3 text-right text-[15px] transition-colors hover:text-[color:var(--focus-primary)]"
                >
                  <AlertTriangle
                    className="size-4 shrink-0"
                    style={{ color: a.sev === "bad" ? C.bad : C.warn }}
                  />
                  <span className="line-clamp-1 flex-1">{a.txt}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* row 4 — projects table + money */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7">
          <SectionTitle
            action={<LinkAction onClick={() => nav.go("projects")}>לכל הפרויקטים</LinkAction>}
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-right text-[15px]">
                <thead>
                  <tr className="focus-table-head border-b border-[color:var(--focus-border)]">
                    <th className="pb-3 font-bold">פרויקט</th>
                    <th className="pb-3 font-bold">סטטוס</th>
                    <th className="pb-3 font-bold">המשימה הבאה</th>
                    <th className="w-28 pb-3 font-bold">התקדמות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--focus-border)]">
                  {active.slice(0, 6).map((p) => {
                    const all = db.tasks.filter(
                      (t) => t.projectId === p.id && t.status !== "cancelled",
                    );
                    const done = all.filter((t) => t.status === "done").length;
                    const nx = all.find(isOpen);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => nav.go("project", p.id)}
                        className="cursor-pointer transition-colors hover:bg-[var(--focus-bg2)]"
                      >
                        <td className="py-3.5 pl-3">
                          <div className="flex items-center gap-2 font-semibold">
                            <ProjectAvatar id={p.id} name={p.name} size={34} />
                            <div className="min-w-0">
                              <div className="truncate">{p.name}</div>
                              <div className="text-[13px] font-normal text-[color:var(--focus-muted)]">
                                {p.client}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pl-3">
                          <Badge color={C.primary}>{p.status}</Badge>
                        </td>
                        <td className="max-w-52 truncate py-3.5 pl-3 text-[color:var(--focus-muted)]">
                          {nx ? nx.title : <span style={{ color: C.warn }}>אין משימה הבאה</span>}
                        </td>
                        <td className="py-3.5">
                          <Progress
                            value={all.length ? (done / all.length) * 100 : 0}
                            color={accentFor(p.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="p-6 lg:col-span-5">
          <SectionTitle action={<LinkAction onClick={() => nav.go("finances")}>לכספים</LinkAction>}>
            תמונת מצב כספית
          </SectionTitle>
          <div className="divide-y divide-[color:var(--focus-border)]">
            <MoneyRow l="נשאר לגבות" v={ils(balance)} c={balance ? C.warn : C.ok} />
            <MoneyRow l="אחסון חודשי צפוי" v={ils(monthly)} />
            <MoneyRow l="אחסון שנתי משוער" v={ils(monthly * 12)} />
            <MoneyRow
              l="הוראות קבע תקינות"
              v={`${hosted.filter((p) => p.soState === "ok").length} / ${hosted.length}`}
              c={soBad.length ? C.warn : C.ok}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
function MoneyRow({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 text-[15px]">
      <span className="text-[color:var(--focus-muted)]">{l}</span>
      <span className="text-[17px] font-bold tabular-nums" style={{ color: c }}>
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
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-[var(--focus-navy)] shadow-lg">
          <span className="flex size-7 items-center justify-center rounded-full border-4 border-[#8f86ff]">
            <span className="size-2 rounded-full bg-[#8f86ff]" />
          </span>
        </div>
        <h1 className="text-[32px] font-bold">ברוך הבא ל-FOCUS</h1>
        <p className="mt-2 text-[color:var(--focus-muted)]">
          מערכת ההפעלה של העסק שלך — שלושה צעדים ואתה בפנים.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.t} className="flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--focus-soft)] text-sm font-bold text-[color:var(--focus-primary)]">
                {i + 1}
              </span>
              <s.icon className="size-4 text-[color:var(--focus-muted)]" />
            </div>
            <div className="text-[17px] font-bold">{s.t}</div>
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
