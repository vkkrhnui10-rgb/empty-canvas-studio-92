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
import { Btn, IconBtn, Kbd } from "./ui";
import { fmtClock } from "./utils";
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
  { v: "dashboard", l: "לוח בקרה", i: LayoutDashboard },
  { v: "today", l: "היום שלי", i: CalendarCheck },
  { v: "focus", l: "מצב פוקוס", i: Timer },
  { v: "inbox", l: "תיבת משימות", i: Inbox, group: "עבודה" },
  { v: "tasks", l: "כל המשימות", i: ListTodo },
  { v: "projects", l: "פרויקטים", i: FolderKanban },
  { v: "weekly", l: "סיכום שבועי", i: BarChart3 },
  { v: "cpanels", l: "פאנלי cPanel", i: Server, group: "עסק" },
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
          theme="dark"
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
        <div className="flex size-10 animate-pulse items-center justify-center rounded-2xl bg-[var(--focus-mint)] font-black text-[color:var(--focus-mint-foreground)]">
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
            <div className="mb-1 mt-4 px-3 text-[11px] font-medium tracking-wider text-[color:var(--focus-muted)]/70">
              {n.group}
            </div>
          )}
          {n.group && compact && i > 0 && (
            <div className="mx-3 my-2 h-px bg-[var(--focus-border)]/60" />
          )}
          <button
            onClick={() => {
              go(n.v);
              onPick?.();
            }}
            title={compact ? n.l : undefined}
            className={cn(
              "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors",
              on
                ? "bg-[var(--focus-card)] text-[color:var(--focus-foreground)]"
                : "text-[color:var(--focus-muted)] hover:bg-[var(--focus-card)]/60 hover:text-[color:var(--focus-foreground)]",
              compact && "justify-center px-0",
            )}
          >
            {on && (
              <span className="absolute right-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-l-full bg-[var(--focus-mint)]" />
            )}
            <n.i className={cn("size-[18px] shrink-0", on && "text-[color:var(--focus-mint)]")} />
            {!compact && <span className="flex-1 text-right">{n.l}</span>}
            {badge > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  compact && "absolute left-1.5 top-1",
                )}
                style={{
                  background:
                    n.v === "alerts"
                      ? `color-mix(in oklab, ${C.bad} 20%, transparent)`
                      : "var(--focus-card-hi)",
                  color: n.v === "alerts" ? C.bad : C.sub,
                }}
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
      <div className="flex h-dvh overflow-hidden">
        {/* ---------- sidebar (right in RTL) ---------- */}
        {!isFocus && (
          <aside
            className={cn(
              "hidden shrink-0 flex-col border-l border-[color:var(--focus-border)]/70 bg-[var(--focus-bg2)]/70 px-3 py-4 backdrop-blur transition-[width] duration-200 md:flex",
              collapsed ? "w-[68px]" : "w-60",
            )}
          >
            <div className={cn("mb-4 flex items-center gap-2.5 px-1", collapsed && "flex-col")}>
              <button
                onClick={() => go("dashboard")}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-mint)] text-lg font-black text-[color:var(--focus-mint-foreground)]"
              >
                F
              </button>
              {!collapsed && (
                <div className="flex-1 text-lg font-bold tracking-[0.12em]">FOCUS</div>
              )}
              <IconBtn
                icon={collapsed ? PanelRightOpen : PanelRightClose}
                label={collapsed ? "הרחב תפריט" : "כווץ תפריט"}
                onClick={() => actions.settings({ sidebarCollapsed: !collapsed })}
              />
            </div>
            <Btn
              variant="primary"
              className={cn("mb-3", collapsed ? "w-full px-0" : "w-full justify-start")}
              onClick={() => setQuick({ open: true })}
              aria-label="משימה חדשה"
            >
              <Plus className="size-4" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-right">משימה חדשה</span>
                  <Kbd>N</Kbd>
                </>
              )}
            </Btn>
            <nav className="flex-1 space-y-0.5 overflow-y-auto">
              {navItems(undefined, collapsed)}
            </nav>
            {!collapsed && (
              <button
                onClick={() => setHelp(true)}
                className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
              >
                <Keyboard className="size-3.5" /> קיצורי מקלדת <Kbd>?</Kbd>
              </button>
            )}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ---------- top bar ---------- */}
          {!isFocus && (
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[color:var(--focus-border)]/70 bg-[var(--focus-background)]/70 px-3 backdrop-blur sm:px-5">
              <IconBtn
                icon={Menu}
                label="תפריט"
                className="md:hidden"
                onClick={() => setMobileMenu(true)}
              />
              <button
                onClick={() => setPalette(true)}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-3 text-sm text-[color:var(--focus-muted)] transition-colors hover:border-[color:var(--focus-mint)]/40 sm:max-w-sm"
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 truncate text-right">חיפוש משימה, פרויקט, לקוח…</span>
                <span className="hidden gap-1 sm:flex">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </button>
              <div className="mr-auto flex items-center gap-1">
                {t && (active || t.mode === "break") && <TimerPill onOpen={() => go("focus")} />}
                <IconBtn
                  icon={PictureInPicture2}
                  label="פאנל צף (P)"
                  onClick={nav.openFloating}
                  active={floating.isOpen}
                  className="hidden sm:inline-flex"
                />
                <div className="relative">
                  <IconBtn
                    icon={Bell}
                    label={`התראות (${alerts.length})`}
                    onClick={() => go("alerts")}
                  />
                  {alerts.length > 0 && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 size-2 rounded-full bg-[var(--focus-destructive)] ring-2 ring-[var(--focus-background)]" />
                  )}
                </div>
                <Btn
                  size="sm"
                  variant="primary"
                  icon={Plus}
                  className="hidden sm:inline-flex md:hidden lg:inline-flex"
                  onClick={() => setQuick({ open: true })}
                >
                  משימה
                </Btn>
              </div>
            </header>
          )}

          <main
            ref={mainRef}
            className={cn("min-h-0 flex-1 overflow-y-auto", !isFocus && "focus-calm pb-24 md:pb-0")}
          >
            <div key={view + (projectId ?? "")} className="focus-page-in h-full">
              {page}
            </div>
          </main>
        </div>
      </div>

      {/* ---------- mobile bottom nav + FAB ---------- */}
      {!isFocus && (
        <>
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[color:var(--focus-border)] bg-[var(--focus-bg2)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            {MOBILE_NAV.map((v) => {
              const n = NAV.find((x) => x.v === v)!;
              const on = view === v || (v === "projects" && view === "project");
              return (
                <button
                  key={v}
                  onClick={() => go(v)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                    on ? "text-[color:var(--focus-mint)]" : "text-[color:var(--focus-muted)]",
                  )}
                >
                  <n.i className="size-5" />
                  {n.l}
                </button>
              );
            })}
            <button
              onClick={() => setMobileMenu(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-[color:var(--focus-muted)]"
            >
              <Menu className="size-5" />
              עוד
            </button>
          </nav>
          <button
            aria-label="משימה חדשה"
            onClick={() => setQuick({ open: true })}
            className="fixed bottom-20 left-4 z-30 flex size-14 items-center justify-center rounded-full bg-[var(--focus-mint)] text-[color:var(--focus-mint-foreground)] shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--focus-mint)_70%,transparent)] active:scale-95 md:hidden"
          >
            <Plus className="size-6" />
          </button>
          <Sheet open={mobileMenu} onOpenChange={setMobileMenu}>
            <SheetContent side="right" dir="rtl" className="focus-dialog w-72 p-4">
              <SheetTitle className="mb-3 text-lg font-bold tracking-[0.12em]">FOCUS</SheetTitle>
              <SheetDescription className="sr-only">ניווט</SheetDescription>
              <nav className="space-y-0.5">{navItems(() => setMobileMenu(false))}</nav>
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

function TimerPill({ onOpen }: { onOpen: () => void }) {
  const db = useDB();
  const t = db.timer!;
  const task = activeTask(db);
  const rem = remainingSec(t);
  const color = t.mode === "break" ? C.violet : rem < 0 ? C.warn : C.mint;
  return (
    <div className="flex h-9 items-center gap-1 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] pl-1 pr-3 text-sm">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", !t.pausedAt && "animate-pulse")}
          style={{ background: t.pausedAt ? C.warn : color }}
        />
        <span className="hidden max-w-40 truncate lg:inline">
          {t.mode === "break" ? "הפסקה" : task?.title}
        </span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {fmtClock(rem)}
        </span>
      </button>
      <button
        aria-label={t.pausedAt ? "המשך" : "השהה"}
        onClick={actions.togglePause}
        className="flex size-7 items-center justify-center rounded-lg hover:bg-[var(--focus-card-hi)]"
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
