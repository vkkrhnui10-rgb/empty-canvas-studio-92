import * as React from "react";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  FolderKanban,
  Inbox,
  Keyboard,
  LayoutDashboard,
  ListTodo,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Search,
  Server,
  Settings as SettingsIcon,
  Timer,
  Wallet,
} from "lucide-react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { C } from "./constants";
import {
  actions,
  activeTask,
  checkTimerEnd,
  computeAlerts,
  hydrate,
  remainingSec,
  useDB,
  useHydrated,
} from "./store";
import type { View } from "./types";
import { NavCtx, type Nav } from "./nav";
import { IconBtn, Kbd } from "./ui";
import { fmtClock, greeting } from "./utils";
import { Dashboard } from "./dashboard";
import { Planner } from "./planner";
import { FocusView, useTick } from "./focus";
import { TasksView, WeeklyView } from "./lists";
import { ProjectDrawer, ProjectPage, ProjectsView } from "./projects";
import { AlertsView, CpanelsView, FinancesView } from "./money";
import { CommandPalette, SettingsView, ShortcutsDialog } from "./settings";
import { QuickAddDialog, TaskDrawer } from "./tasks";
import { InlineFloating, useFloating } from "./floating";

const NAV: { v: View; l: string; i: typeof LayoutDashboard; group?: string }[] = [
  { v: "dashboard", l: "ראשי", i: LayoutDashboard, group: "העבודה שלי" },
  { v: "today", l: "היום שלי", i: CalendarCheck },
  { v: "focus", l: "מצב פוקוס", i: Timer },
  { v: "inbox", l: "תיבת משימות", i: Inbox, group: "משימות ופרויקטים" },
  { v: "tasks", l: "כל המשימות", i: ListTodo },
  { v: "projects", l: "פרויקטים", i: FolderKanban },
  { v: "weekly", l: "סיכום שבועי", i: BarChart3 },
  { v: "cpanels", l: "פאנלי cPanel", i: Server, group: "העסק שלך" },
  { v: "finances", l: "כספים", i: Wallet },
  { v: "alerts", l: "התראות", i: Bell },
  { v: "settings", l: "הגדרות", i: SettingsIcon },
];
const MOBILE_NAV: View[] = ["dashboard", "today", "focus", "projects"];

/* hash routing → browser back/forward works, views are linkable */
function parseHash(): { view: View; projectId: string | null } {
  if (typeof window === "undefined") return { view: "dashboard", projectId: null };
  const [, v, id] = window.location.hash.split("/");
  const views: View[] = [
    "dashboard",
    "today",
    "focus",
    "weekly",
    "inbox",
    "tasks",
    "projects",
    "project",
    "cpanels",
    "finances",
    "alerts",
    "settings",
  ];
  const view = (views.includes(v as View) ? v : "dashboard") as View;
  return { view, projectId: view === "project" ? (id ?? null) : null };
}

export default function FocusApp() {
  const hydrated = useHydrated();
  React.useEffect(() => hydrate(), []);
  return (
    <TooltipProvider delayDuration={350}>
      <div dir="rtl" lang="he" className="focus-app">
        {hydrated ? <Shell /> : <Splash />}
        <Toaster
          dir="rtl"
          position="top-center"
          theme="light"
          toastOptions={{
            classNames: { toast: "focus-toast", actionButton: "focus-toast-action" },
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="flex items-center gap-3 text-[color:var(--focus-muted)]">
        <div className="flex size-10 animate-pulse items-center justify-center rounded-2xl bg-[var(--focus-primary)] font-black text-[color:var(--focus-primary-foreground)]">
          F
        </div>
        טוען את FOCUS…
      </div>
    </div>
  );
}

function Shell() {
  const db = useDB();
  const [{ view, projectId }, setRoute] = React.useState(parseHash);
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [projEdit, setProjEdit] = React.useState<string | null>(null);
  const [quick, setQuick] = React.useState<{
    open: boolean;
    preset?: { projectId?: string; today?: boolean };
  }>({ open: false });
  const [palette, setPalette] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const [mobileMenu, setMobileMenu] = React.useState(false);
  const mainRef = React.useRef<HTMLDivElement>(null);
  useTick(!!db.timer);

  React.useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const go = React.useCallback((v: View, pid?: string | null) => {
    const hash = v === "project" && pid ? `#/project/${pid}` : `#/${v}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute({ view: v, projectId: v === "project" ? (pid ?? null) : null });
    setMobileMenu(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);
  const floating = useFloating(React.useCallback(() => go("focus"), [go]));

  const nav: Nav = React.useMemo(
    () => ({
      view,
      projectId,
      go,
      openTask: setTaskId,
      editProject: (id) => setProjEdit(id),
      quickAdd: (preset) => setQuick({ open: true, preset }),
      openPalette: () => setPalette(true),
      openFloating: () =>
        floating.isOpen && floating.mode === "inline" ? floating.close() : floating.open(),
      floatingOpen: floating.isOpen,
    }),
    [view, projectId, go, floating],
  );

  /* global shortcuts */
  React.useEffect(() => {
    let g = false;
    let gTimer: ReturnType<typeof setTimeout>;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((x) => !x);
        return;
      }
      const el = e.target as HTMLElement;
      if (
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.tagName === "SELECT" ||
        el?.isContentEditable
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (g) {
        g = false;
        if (k === "d") go("dashboard");
        if (k === "t") go("today");
        if (k === "p") go("projects");
        if (k === "i") go("inbox");
        return;
      }
      if (k === "g") {
        g = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => (g = false), 1200);
        return;
      }
      if (k === "n" || k === "מ") {
        e.preventDefault();
        setQuick({ open: true });
      }
      if (k === "f" || k === "כ") go("focus");
      if (k === "p" || k === "פ") nav.openFloating();
      if (e.key === "?") setHelp(true);
      if (k === "/") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, nav]);

  /* tab title shows the running timer — visible from any other tab */
  const active = activeTask(db);
  const t = db.timer;
  React.useEffect(() => {
    checkTimerEnd();
    if (t) {
      const rem = remainingSec(t);
      document.title = `${t.pausedAt ? "⏸ " : ""}${fmtClock(rem)} · ${t.mode === "break" ? "הפסקה" : (active?.title ?? "FOCUS")}`;
    } else document.title = "FOCUS";
  });

  const alerts = computeAlerts(db);
  const inboxCount = db.tasks.filter((x) => x.status === "inbox").length;
  const isFocus = view === "focus";
  const collapsed = db.settings.sidebarCollapsed;

  let page: React.ReactNode;
  switch (view) {
    case "today":
      page = <Planner />;
      break;
    case "focus":
      page = <FocusView />;
      break;
    case "weekly":
      page = <WeeklyView />;
      break;
    case "inbox":
      page = <TasksView inbox />;
      break;
    case "tasks":
      page = <TasksView />;
      break;
    case "projects":
      page = <ProjectsView />;
      break;
    case "project":
      page = projectId ? <ProjectPage id={projectId} /> : <ProjectsView />;
      break;
    case "cpanels":
      page = <CpanelsView />;
      break;
    case "finances":
      page = <FinancesView />;
      break;
    case "alerts":
      page = <AlertsView />;
      break;
    case "settings":
      page = <SettingsView />;
      break;
    default:
      page = <Dashboard />;
  }

  const navItems = (onPick?: () => void, compact = false) =>
    NAV.map((n, i) => {
      const on = view === n.v || (n.v === "projects" && view === "project");
      const badge = n.v === "alerts" ? alerts.length : n.v === "inbox" ? inboxCount : 0;
      return (
        <React.Fragment key={n.v}>
          {n.group && !compact && (
            <div
              className={cn(
                "mb-2 px-4 text-[15px] font-medium text-[color:var(--focus-muted)]",
                i > 0 && "mt-6 border-t border-[color:var(--focus-border)] pt-6",
              )}
            >
              {n.group}
            </div>
          )}
          {n.group && compact && i > 0 && (
            <div className="mx-2 my-3 h-px bg-[var(--focus-border)]" />
          )}
          <button
            onClick={() => {
              go(n.v);
              onPick?.();
            }}
            title={compact ? n.l : undefined}
            className={cn(
              "relative flex h-11 w-full items-center gap-3 rounded-lg px-4 text-[16px] transition-colors",
              on
                ? "bg-[var(--focus-navy)] font-semibold text-white shadow-[0_6px_16px_-8px_rgb(11_12_63/0.6)]"
                : "text-[color:var(--focus-foreground)] hover:bg-white",
              compact && "justify-center px-0",
            )}
          >
            <n.i className="size-[19px] shrink-0" strokeWidth={on ? 2.4 : 2} />
            {!compact && <span className="flex-1 text-right">{n.l}</span>}
            {badge > 0 && (
              <span
                className={cn(
                  "min-w-5 rounded-md px-1.5 text-center text-xs font-bold tabular-nums",
                  compact && "absolute left-1 top-1",
                )}
                style={
                  on
                    ? { background: "rgb(255 255 255 / 0.18)", color: "#fff" }
                    : {
                        background:
                          n.v === "alerts"
                            ? `color-mix(in oklab, ${C.bad} 14%, transparent)`
                            : "var(--focus-soft)",
                        color: n.v === "alerts" ? C.bad : C.primary,
                      }
                }
              >
                {badge}
              </span>
            )}
          </button>
        </React.Fragment>
      );
    });

  return (
    <NavCtx.Provider value={nav}>
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* ---------- navy top bar (Grow-style) ---------- */}
        {!isFocus && (
          <header className="focus-topbar flex h-16 shrink-0 items-center gap-2 pb-1 pl-3 pr-3 sm:gap-3 sm:pl-5 sm:pr-6">
            <button
              aria-label="תפריט"
              onClick={() => setMobileMenu(true)}
              className="flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <button onClick={() => go("dashboard")} className="shrink-0" aria-label="FOCUS">
              <Logo />
            </button>
            <div className="hidden items-center gap-2 text-[17px] text-white/90 lg:flex">
              <GreetIcon />
              {greeting()}
              {db.settings.ownerName && `, ${db.settings.ownerName}`}
            </div>

            <div className="mr-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setPalette(true)}
                className="hidden h-10 w-72 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-white/65 ring-1 ring-white/10 transition-colors hover:bg-white/15 md:flex xl:w-96"
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 truncate text-right">חיפוש משימה, פרויקט, לקוח…</span>
                <kbd className="rounded bg-white/10 px-1.5 font-mono text-[11px]">Ctrl K</kbd>
              </button>
              <button
                aria-label="חיפוש"
                onClick={() => setPalette(true)}
                className="flex size-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 md:hidden"
              >
                <Search className="size-5" />
              </button>
              {t && (active || t.mode === "break") && <TimerPill onOpen={() => go("focus")} />}
              <TopIcon
                icon={PictureInPicture2}
                label="פאנל צף (P)"
                onClick={nav.openFloating}
                active={floating.isOpen}
                className="hidden sm:flex"
              />
              <div className="relative">
                <TopIcon
                  icon={Bell}
                  label={`התראות (${alerts.length})`}
                  onClick={() => go("alerts")}
                />
                {alerts.length > 0 && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-[#ff5b5b] px-1 text-[10px] leading-4 font-bold text-white">
                    {alerts.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setQuick({ open: true })}
                className="hidden h-10 items-center gap-2 rounded-lg bg-[var(--focus-primary)] px-4 text-[15px] font-semibold text-white shadow-[0_6px_18px_-6px_rgb(91_79_232/0.8)] transition-colors hover:bg-[#4d41d6] sm:flex"
              >
                <Plus className="size-4" />
                משימה חדשה
              </button>
            </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1">
          {/* ---------- sidebar (right in RTL) ---------- */}
          {!isFocus && (
            <aside
              className={cn(
                "focus-sidebar hidden shrink-0 flex-col border-l border-[color:var(--focus-border)] py-6 transition-[width] duration-200 md:flex",
                collapsed ? "w-[76px] px-3" : "w-[264px] px-4",
              )}
            >
              <nav className="flex-1 space-y-1 overflow-y-auto">
                {navItems(undefined, collapsed)}
              </nav>
              <div
                className={cn(
                  "mt-4 flex items-center border-t border-[color:var(--focus-border)] pt-3",
                  collapsed ? "flex-col gap-1" : "justify-between",
                )}
              >
                {!collapsed && (
                  <button
                    onClick={() => setHelp(true)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
                  >
                    <Keyboard className="size-4" /> קיצורי מקלדת <Kbd>?</Kbd>
                  </button>
                )}
                <IconBtn
                  icon={collapsed ? PanelRightOpen : PanelRightClose}
                  label={collapsed ? "הרחב תפריט" : "כווץ תפריט"}
                  onClick={() => actions.settings({ sidebarCollapsed: !collapsed })}
                />
              </div>
            </aside>
          )}

          <main
            ref={mainRef}
            className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", !isFocus && "pb-24 md:pb-0")}
          >
            <div key={view + (projectId ?? "")} className="focus-page-in min-h-full">
              {page}
            </div>
          </main>
        </div>
      </div>

      {/* ---------- mobile bottom nav + FAB ---------- */}
      {!isFocus && (
        <>
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[color:var(--focus-border)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            {MOBILE_NAV.map((v) => {
              const n = NAV.find((x) => x.v === v)!;
              const on = view === v || (v === "projects" && view === "project");
              return (
                <button
                  key={v}
                  onClick={() => go(v)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[12px]",
                    on
                      ? "font-semibold text-[color:var(--focus-navy)]"
                      : "text-[color:var(--focus-muted)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full",
                      on && "bg-[var(--focus-soft)] text-[color:var(--focus-primary)]",
                    )}
                  >
                    <n.i className="size-5" />
                  </span>
                  {n.l}
                </button>
              );
            })}
            <button
              onClick={() => setMobileMenu(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[12px] text-[color:var(--focus-muted)]"
            >
              <span className="flex h-7 w-12 items-center justify-center">
                <Menu className="size-5" />
              </span>
              עוד
            </button>
          </nav>
          <button
            aria-label="משימה חדשה"
            onClick={() => setQuick({ open: true })}
            className="fixed bottom-20 left-4 z-30 flex size-14 items-center justify-center rounded-2xl bg-[var(--focus-primary)] text-white shadow-[0_12px_28px_-8px_rgb(91_79_232/0.75)] active:scale-95 md:hidden"
          >
            <Plus className="size-6" />
          </button>
          <Sheet open={mobileMenu} onOpenChange={setMobileMenu}>
            <SheetContent side="right" dir="rtl" className="focus-dialog w-72 !bg-[#f3f4f8] p-4">
              <SheetTitle className="mb-4">
                <Logo dark />
              </SheetTitle>
              <SheetDescription className="sr-only">ניווט</SheetDescription>
              <nav className="space-y-1">{navItems(() => setMobileMenu(false))}</nav>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* ---------- overlays ---------- */}
      <QuickAddDialog
        open={quick.open}
        preset={quick.preset}
        onClose={() => setQuick({ open: false })}
      />
      <TaskDrawer id={taskId} onClose={() => setTaskId(null)} />
      <ProjectDrawer id={projEdit} onClose={() => setProjEdit(null)} />
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      {floating.mode === "inline" && (
        <InlineFloating onClose={floating.close} onOpenApp={() => go("focus")} />
      )}
    </NavCtx.Provider>
  );
}

/** wordmark — the O is a focus ring */
export function Logo({ dark }: { dark?: boolean }) {
  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex items-center text-[27px] leading-none font-extrabold tracking-[0.04em]",
        dark ? "text-[color:var(--focus-navy)]" : "text-white",
      )}
    >
      F
      <span className="relative mx-[1px] inline-flex size-[22px] items-center justify-center rounded-full border-[3.5px] border-[#8f86ff]">
        <span className="size-[6px] rounded-full bg-[#8f86ff]" />
      </span>
      CUS
    </span>
  );
}

function GreetIcon() {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? (
    <span className="relative inline-flex size-6 items-center justify-center">
      <span className="size-3 rounded-full bg-[#8f86ff]" />
      <span className="absolute inset-0 rounded-full border-2 border-dashed border-[#8f86ff]/70" />
    </span>
  ) : (
    <span className="size-4 rounded-full bg-[#8f86ff] shadow-[inset_-5px_-2px_0_0_var(--focus-navy)]" />
  );
}

function TopIcon({
  icon: Icon,
  label,
  onClick,
  active,
  className,
}: {
  icon: typeof Bell;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white/15 text-white",
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function TimerPill({ onOpen }: { onOpen: () => void }) {
  const db = useDB();
  const t = db.timer!;
  const task = activeTask(db);
  const rem = remainingSec(t);
  const color = t.pausedAt ? "#ffc071" : rem < 0 ? "#ffc071" : "#b8b2ff";
  return (
    <div className="flex h-10 items-center gap-1 rounded-lg bg-white/10 pl-1 pr-3 text-sm text-white ring-1 ring-white/10">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", !t.pausedAt && "animate-pulse")}
          style={{ background: color }}
        />
        <span className="hidden max-w-44 truncate xl:inline">
          {t.mode === "break" ? "הפסקה" : task?.title}
        </span>
        <span className="text-[15px] font-bold tabular-nums" style={{ color }}>
          {fmtClock(rem)}
        </span>
      </button>
      <button
        aria-label={t.pausedAt ? "המשך" : "השהה"}
        onClick={actions.togglePause}
        className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
      >
        {t.pausedAt ? (
          <Play className="size-3.5" fill="currentColor" />
        ) : (
          <Pause className="size-3.5" fill="currentColor" />
        )}
      </button>
    </div>
  );
}
