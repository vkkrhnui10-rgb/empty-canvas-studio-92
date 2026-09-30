import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  Globe,
  Monitor,
  RefreshCw,
  Smartphone,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mail,
  Pencil,
  Phone,
  Pin,
  Play,
  Plus,
  Search,
  Server,
  Trash2,
  Columns3,
  Receipt,
  Wallet,
  Wrench,
  History,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AI_SYSTEMS,
  C,
  CLOSED_PROJECT,
  PROJECT_TEMPLATES,
  PROJ_STATUS,
  SITE_BAD,
  SITE_STATE,
  SITE_TYPES,
  SO_STATES,
  accentFor,
} from "./constants";
import { actions, findProject, newProject, projectSO, useDB } from "./store";
import type { Project, SOState, SiteCheck } from "./types";
import {
  Badge,
  Btn,
  Card,
  Check as CheckBox,
  Drawer,
  EmptyState,
  Field,
  IconBtn,
  Input,
  Modal,
  PageHeader,
  Progress,
  Segmented,
  Select,
  Textarea,
  ProjectAvatar,
} from "./ui";
import { balanceOf, daysSince, fmtDate, ils, isOpen, payState, timeAgo, uid } from "./utils";
import { useNav } from "./nav";
import { SoWhatsAppBtn } from "./billing";
import { checkSite, normUrl } from "./sitecheck";
import { TaskRow } from "./tasks";

const siteColor = (s: string) =>
  SITE_BAD.includes(s)
    ? C.bad
    : s === "פעיל ותקין"
      ? C.ok
      : s === "דורש בדיקה" || s === "בטיפול"
        ? C.warn
        : C.sub;
const soColor = (s: SOState) =>
  s === "ok" ? C.ok : s === "failed" ? C.bad : s === "cancelled" ? C.sub : C.warn;

/* ============================ Projects list ============================ */
export function ProjectsView() {
  const db = useDB();
  const nav = useNav();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("__active");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const view = db.settings.projectsView;

  let list = db.projects;
  if (status === "__active") list = list.filter((p) => !CLOSED_PROJECT.includes(p.status));
  else if (status !== "__all") list = list.filter((p) => p.status === status);
  if (q)
    list = list.filter((p) =>
      `${p.name} ${p.client} ${p.url} ${p.phone} ${p.email}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    );

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="פרויקטים"
        subtitle={`${db.projects.length} פרויקטים · ${db.projects.filter((p) => !CLOSED_PROJECT.includes(p.status)).length} פעילים`}
        actions={
          <Btn variant="primary" icon={Plus} onClick={() => nav.editProject("new")}>
            פרויקט חדש
          </Btn>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--focus-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם, לקוח, דומיין, טלפון…"
            className="pr-9"
          />
        </div>
        {view !== "kanban" && (
          <Select
            className="w-40"
            value={status}
            onChange={setStatus}
            options={["__active", "__all", ...PROJ_STATUS]}
            labels={{ __active: "פעילים", __all: "הכול" }}
          />
        )}
        <Segmented
          value={view}
          onChange={(v) => actions.settings({ projectsView: v })}
          options={[
            { value: "cards", label: "כרטיסים", icon: LayoutGrid },
            { value: "list", label: "רשימה", icon: List },
            { value: "kanban", label: "Kanban", icon: Columns3 },
          ]}
        />
      </div>

      {db.projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="עדיין אין פרויקטים"
            subtitle="כל אתר לקוח הוא פרויקט אחד — עם הכל בפנים"
            action={
              <Btn variant="primary" icon={Plus} onClick={() => nav.editProject("new")}>
                צור פרויקט ראשון
              </Btn>
            }
          />
        </Card>
      ) : view === "kanban" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {PROJ_STATUS.map((s) => {
            const ps = db.projects.filter(
              (p) => p.status === s && (!q || `${p.name} ${p.client}`.includes(q)),
            );
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) actions.patchProject(dragId, { status: s }, `סטטוס → ${s}`);
                  setDragId(null);
                }}
                className="flex w-64 shrink-0 flex-col rounded-2xl bg-[var(--focus-bg2)]/60 p-2"
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1 text-sm">
                  <span className="font-medium">{s}</span>
                  <span className="text-xs text-[color:var(--focus-muted)]">{ps.length}</span>
                </div>
                <div className="min-h-16 space-y-2">
                  {ps.map((p) => (
                    <div key={p.id} draggable onDragStart={() => setDragId(p.id)}>
                      <ProjectCard p={p} compact />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="לא נמצאו פרויקטים" />
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-right text-[15px]">
            <thead>
              <tr className="focus-table-head border-b border-[color:var(--focus-border)]">
                {["פרויקט", "סטטוס", "מצב האתר", "פתוחות", "יתרה", "הוראת קבע"].map((h) => (
                  <th key={h} className="px-5 py-4 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--focus-border)]">
              {list.map((p) => (
                <ProjectRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export function ProjectCard({ p, compact }: { p: Project; compact?: boolean }) {
  const db = useDB();
  const nav = useNav();
  const all = db.tasks.filter((t) => t.projectId === p.id && t.status !== "cancelled");
  const open = all.filter(isOpen);
  const done = all.length - open.length;
  const next = open[0];
  const bal = balanceOf(p);
  const cp = db.cpanels.find((c) => c.id === p.cpanelId);
  const accent = accentFor(p.id);
  const pinned = p.notes.find((n) => n.pinned);
  return (
    <Card onClick={() => nav.go("project", p.id)} className="p-5">
      <div className="flex items-start gap-3">
        <ProjectAvatar id={p.id} name={p.name} size={compact ? 34 : 42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[16px] font-bold">
            <span className="truncate">{p.name}</span>
            {pinned && <Pin className="size-3 shrink-0 text-[color:var(--focus-primary)]" />}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-[color:var(--focus-muted)]">
            {p.client || "—"} · {p.siteType}
            {cp && ` · ${cp.name}`}
          </div>
        </div>
        <Badge color={siteColor(p.siteState)}>{p.siteState}</Badge>
      </div>
      {!compact && (
        <>
          <div className="mt-4 truncate rounded-lg bg-[var(--focus-bg2)] px-3 py-2 text-[14px]">
            <span className="text-[color:var(--focus-muted)]">הבא: </span>
            {next ? (
              next.title
            ) : (
              <span className="text-[color:var(--focus-warning)]">אין משימה הבאה</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{p.status}</Badge>
            <Badge>{open.length} פתוחות</Badge>
            {bal > 0 && <Badge color={C.warn}>יתרה {ils(bal)}</Badge>}
            {p.hosted && (
              <Badge color={soColor(p.soState)}>
                {ils(p.hostPrice)} · {SO_STATES[p.soState]}
              </Badge>
            )}
          </div>
          {all.length > 0 && (
            <div className="mt-4 flex items-center gap-3 text-[12px] text-[color:var(--focus-muted)]">
              <Progress className="flex-1" value={(done / all.length) * 100} color={accent} />
              <span className="tabular-nums">
                {done}/{all.length}
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ProjectRow({ p }: { p: Project }) {
  const db = useDB();
  const nav = useNav();
  const open = db.tasks.filter((t) => t.projectId === p.id && isOpen(t)).length;
  const bal = balanceOf(p);
  return (
    <tr
      onClick={() => nav.go("project", p.id)}
      className="cursor-pointer transition-colors hover:bg-[var(--focus-bg2)]"
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <ProjectAvatar id={p.id} name={p.name} size={36} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{p.name}</div>
            <div className="truncate text-[13px] text-[color:var(--focus-muted)]">{p.client}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <Badge color={C.primary}>{p.status}</Badge>
      </td>
      <td className="px-5 py-3.5">
        <Badge color={siteColor(p.siteState)}>{p.siteState}</Badge>
      </td>
      <td className="px-5 py-3.5 tabular-nums">{open}</td>
      <td
        className="px-5 py-3.5 font-semibold tabular-nums"
        style={{ color: bal ? C.warn : C.sub }}
      >
        {bal ? ils(bal) : "—"}
      </td>
      <td className="px-5 py-3.5">
        {p.hosted ? (
          <Badge color={soColor(p.soState)}>{SO_STATES[p.soState]}</Badge>
        ) : (
          <span className="text-[color:var(--focus-muted)]">לא מאוחסן</span>
        )}
      </td>
    </tr>
  );
}

/* ============================ Project create / edit ============================ */
export function ProjectDrawer({ id, onClose }: { id: string | "new" | null; onClose: () => void }) {
  const db = useDB();
  const existing = id && id !== "new" ? findProject(db, id) : undefined;
  const [f, setF] = React.useState<Project>(() => existing ?? newProject());
  const [template, setTemplate] = React.useState("");
  const [cpForm, setCpForm] = React.useState<{ name: string; url: string } | null>(null);
  React.useEffect(() => {
    if (id) {
      setF(existing ?? newProject({ hostPrice: db.settings.defaultHostPrice }));
      setTemplate("");
      setCpForm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const s = <K extends keyof Project>(k: K, v: Project[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return;
    actions.saveProject(f, existing ? undefined : template);
    onClose();
  };
  const isWP = f.siteType === "אתר WordPress" || f.siteType === "משולב";
  const isAI = f.siteType === "אתר AI" || f.siteType === "משולב";
  const custom = f.hostPrice !== db.settings.defaultHostPrice;

  return (
    <Drawer open={!!id} onClose={onClose} title={existing ? "עריכת פרויקט" : "פרויקט חדש"}>
      <div className="space-y-5">
        <Field label="שם הפרויקט / האתר">
          <Input
            autoFocus
            value={f.name}
            onChange={(e) => s("name", e.target.value)}
            placeholder="לדוגמה: סטודיו כגוונא"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="לקוח">
            <Input value={f.client} onChange={(e) => s("client", e.target.value)} />
          </Field>
          <Field label="טלפון">
            <Input dir="ltr" value={f.phone} onChange={(e) => s("phone", e.target.value)} />
          </Field>
          <Field label="אימייל">
            <Input dir="ltr" value={f.email} onChange={(e) => s("email", e.target.value)} />
          </Field>
          <Field label="כתובת האתר">
            <Input
              dir="ltr"
              value={f.url}
              onChange={(e) => s("url", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="סטטוס">
            <Select value={f.status} onChange={(v) => s("status", v)} options={PROJ_STATUS} />
          </Field>
          <Field label="מצב האתר">
            <Select value={f.siteState} onChange={(v) => s("siteState", v)} options={SITE_STATE} />
          </Field>
        </div>

        <div className="rounded-2xl border border-[color:var(--focus-border)] p-4">
          <Field label="סוג האתר">
            <Segmented
              value={f.siteType}
              onChange={(v) => s("siteType", v)}
              options={SITE_TYPES.map((x) => ({ value: x, label: x.replace("אתר ", "") }))}
            />
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {isAI && (
              <>
                <Field label="מערכת AI">
                  <Select
                    value={f.aiSystem}
                    onChange={(v) => s("aiSystem", v)}
                    options={AI_SYSTEMS}
                  />
                </Field>
                <Field label="קישור לפרויקט ב-AI">
                  <Input dir="ltr" value={f.aiUrl} onChange={(e) => s("aiUrl", e.target.value)} />
                </Field>
              </>
            )}
            <Field label={isWP ? "קישור לניהול WordPress" : "קישור לניהול"} className="col-span-2">
              <Input
                dir="ltr"
                value={f.adminUrl}
                onChange={(e) => s("adminUrl", e.target.value)}
                placeholder={isWP ? "https://site.co.il/wp-admin" : "https://"}
              />
            </Field>
            {isWP && (
              <Field label="פאנל cPanel" className="col-span-2">
                {cpForm ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="שם הפאנל"
                      value={cpForm.name}
                      onChange={(e) => setCpForm({ ...cpForm, name: e.target.value })}
                    />
                    <Input
                      dir="ltr"
                      placeholder="קישור כניסה"
                      value={cpForm.url}
                      onChange={(e) => setCpForm({ ...cpForm, url: e.target.value })}
                    />
                    <Btn
                      size="sm"
                      variant="primary"
                      className="h-10"
                      onClick={() => {
                        if (!cpForm.name.trim()) return;
                        const c = {
                          id: uid(),
                          name: cpForm.name,
                          url: cpForm.url,
                          host: "",
                          notes: "",
                        };
                        actions.saveCpanel(c);
                        s("cpanelId", c.id);
                        setCpForm(null);
                      }}
                    >
                      הוסף
                    </Btn>
                    <IconBtn icon={X} label="ביטול" onClick={() => setCpForm(null)} />
                  </div>
                ) : (
                  <Select
                    value={f.cpanelId}
                    onChange={(v) =>
                      v === "__new" ? setCpForm({ name: "", url: "" }) : s("cpanelId", v)
                    }
                    options={["", ...db.cpanels.map((c) => c.id), "__new"]}
                    labels={{
                      "": "— לא משויך —",
                      __new: "+ פאנל חדש…",
                      ...Object.fromEntries(
                        db.cpanels.map((c) => [c.id, `${c.name}${c.host ? ` · ${c.host}` : ""}`]),
                      ),
                    }}
                  />
                )}
              </Field>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="התחלת פרויקט">
            <Input
              type="date"
              value={f.startDate}
              onChange={(e) => s("startDate", e.target.value)}
            />
          </Field>
          <Field label="סיום פרויקט" hint="נקבע לבד כשהסטטוס הופך ל״הושק״">
            <Input type="date" value={f.doneDate} onChange={(e) => s("doneDate", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר בנייה (₪)">
            <Input
              type="number"
              min={0}
              value={f.buildPrice || ""}
              onChange={(e) => s("buildPrice", +e.target.value || 0)}
            />
          </Field>
          <Field label="שולם עד כה (₪)">
            <Input
              type="number"
              min={0}
              value={f.paid || ""}
              onChange={(e) => s("paid", +e.target.value || 0)}
            />
          </Field>
          <div className="col-span-2 -mt-1 text-sm text-[color:var(--focus-muted)]">
            יתרה:{" "}
            <b className="tabular-nums" style={{ color: balanceOf(f) ? C.warn : C.ok }}>
              {ils(balanceOf(f))}
            </b>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[color:var(--focus-border)] p-4">
          <CheckBox
            checked={f.hosted}
            onChange={(v) => s("hosted", v)}
            label={<span className="font-medium">האתר מאוחסן אצלי</span>}
          />
          {f.hosted && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="מחיר חודשי (₪)" hint={custom ? "מחיר חריג" : "מחיר רגיל"}>
                <Input
                  type="number"
                  step="0.01"
                  value={f.hostPrice}
                  onChange={(e) => s("hostPrice", +e.target.value || 0)}
                />
              </Field>
              <Field label="הוראת קבע">
                <Select
                  value={f.soState}
                  onChange={(v) => s("soState", v as SOState)}
                  options={Object.keys(SO_STATES)}
                  labels={SO_STATES}
                />
              </Field>
              <Field label="תחילת הוראת קבע">
                <Input
                  type="date"
                  value={f.soStart}
                  onChange={(e) => s("soStart", e.target.value)}
                />
              </Field>
              {custom && (
                <Field label="הערה למחיר חריג" className="col-span-2">
                  <Input
                    value={f.hostPriceNote}
                    onChange={(e) => s("hostPriceNote", e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
        </div>

        {!existing && (
          <Field
            label="תבנית משימות"
            hint={
              template
                ? `ייווצרו ${PROJECT_TEMPLATES[template].tasks.length} משימות מוכנות לפרויקט`
                : "חוסך להקליד את אותן משימות בכל פרויקט"
            }
          >
            <Select
              value={template}
              onChange={setTemplate}
              options={["", ...Object.keys(PROJECT_TEMPLATES)]}
              labels={{
                "": "— בלי תבנית —",
                ...Object.fromEntries(
                  Object.entries(PROJECT_TEMPLATES).map(([k, v]) => [k, v.label]),
                ),
              }}
            />
          </Field>
        )}

        <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-6 py-4">
          <Btn variant="primary" icon={Check} onClick={save} disabled={!f.name.trim()}>
            {existing ? "שמור" : "צור פרויקט"}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            ביטול
          </Btn>
          {template && !existing && (
            <LayoutTemplate className="mr-auto size-4 self-center text-[color:var(--focus-muted)]" />
          )}
        </div>
      </div>
    </Drawer>
  );
}

/* ============================ Project page ============================ */
export function ProjectPage({ id }: { id: string }) {
  const db = useDB();
  const nav = useNav();
  const p = findProject(db, id);
  const [tab, setTab] = React.useState("overview");
  if (!p)
    return (
      <div className="p-6">
        <EmptyState
          icon={FolderKanban}
          title="הפרויקט לא נמצא"
          action={<Btn onClick={() => nav.go("projects")}>לכל הפרויקטים</Btn>}
        />
      </div>
    );
  const tasks = db.tasks.filter((t) => t.projectId === p.id);
  const open = tasks.filter(isOpen);
  const next = open.find((t) => !["waiting", "blocked"].includes(t.status)) ?? open[0];
  const cp = db.cpanels.find((c) => c.id === p.cpanelId);
  const bal = balanceOf(p);
  const patch = (x: Partial<Project>, log?: string) => actions.patchProject(p.id, x, log);
  const pinned = p.notes.find((n) => n.pinned);
  const activity = db.activity.filter((a) => a.projectId === p.id).slice(0, 80);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <button
        onClick={() => nav.go("projects")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
      >
        <ArrowRight className="size-4" /> כל הפרויקטים
      </button>

      <Card hi className="relative mb-4 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <ProjectAvatar id={p.id} name={p.name} size={56} />
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-bold">{p.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[color:var(--focus-muted)]">
                {p.client && <span>{p.client}</span>}
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    className="inline-flex items-center gap-1 hover:text-[color:var(--focus-primary)]"
                    dir="ltr"
                  >
                    <Phone className="size-3.5" />
                    {p.phone}
                  </a>
                )}
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    className="inline-flex items-center gap-1 hover:text-[color:var(--focus-primary)]"
                  >
                    <Mail className="size-3.5" />
                    {p.email}
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{p.siteType}</Badge>
                <Badge color={C.violet}>{p.status}</Badge>
                <Badge color={siteColor(p.siteState)}>{p.siteState}</Badge>
              </div>
              <ProjectDates p={p} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {next && (
              <Btn
                variant="primary"
                icon={Play}
                onClick={() => {
                  actions.startFocus(next.id);
                  nav.go("focus");
                }}
              >
                פוקוס
              </Btn>
            )}
            <Btn icon={Plus} onClick={() => nav.quickAdd({ projectId: p.id })}>
              משימה
            </Btn>
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer">
                <Btn variant="outline" icon={Globe}>
                  האתר
                </Btn>
              </a>
            )}
            <IconBtn
              icon={Pencil}
              label="עריכת פרויקט"
              onClick={() => nav.editProject(p.id)}
              className="absolute top-3 left-3 border border-[color:var(--focus-border)] sm:static"
            />
          </div>
        </div>
        {next && (
          <button
            onClick={() => nav.openTask(next.id)}
            className="mt-4 flex w-full items-center gap-2 rounded-xl bg-[var(--focus-bg2)] px-3 py-2.5 text-right text-sm hover:bg-[var(--focus-card)]"
          >
            <span className="text-[color:var(--focus-primary)]">המשימה הבאה:</span>
            <span className="truncate">{next.title}</span>
          </button>
        )}
      </Card>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="no-scrollbar mb-6 h-auto w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none border-b border-[color:var(--focus-border)] bg-transparent p-0 sm:flex-wrap">
          {[
            ["overview", "סקירה"],
            ["tasks", `משימות (${open.length})`],
            ["money", "בנייה ותשלום"],
            ["hosting", "אחסון והוראת קבע"],
            [
              "issues",
              `תקלות${p.issues.filter((i) => !i.resolvedAt).length ? ` (${p.issues.filter((i) => !i.resolvedAt).length})` : ""}`,
            ],
            ["links", "קישורים"],
            ["notes", "הערות"],
            ["activity", "פעילות"],
          ].map(([v, l]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="-mb-px flex-none whitespace-nowrap rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-3.5 py-3 text-[15px] sm:px-4 text-[color:var(--focus-muted)] shadow-none hover:text-[color:var(--focus-foreground)] data-[state=active]:border-[color:var(--focus-navy)] data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-[color:var(--focus-foreground)] data-[state=active]:shadow-none"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          {p.url && <SiteCard p={p} />}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <MiniCard icon={Wallet} title="תשלום" onClick={() => setTab("money")}>
              <div
                className="text-xl font-bold tabular-nums"
                style={{ color: bal ? C.warn : C.ok }}
              >
                {bal ? ils(bal) : "שולם"}
              </div>
              <div className="text-xs text-[color:var(--focus-muted)]">
                {payState(p)} · {ils(p.paid)} מתוך {ils(p.buildPrice)}
              </div>
            </MiniCard>
            <MiniCard icon={Receipt} title="אחסון" onClick={() => setTab("hosting")}>
              {p.hosted ? (
                <>
                  <div className="text-xl font-bold tabular-nums">
                    {ils(p.hostPrice)}
                    <span className="text-sm font-normal text-[color:var(--focus-muted)]">
                      {" "}
                      /חודש
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: soColor(p.soState) }}>
                    {SO_STATES[p.soState]}
                  </div>
                </>
              ) : (
                <div className="text-sm text-[color:var(--focus-muted)]">לא מאוחסן אצלי</div>
              )}
            </MiniCard>
            <MiniCard icon={Server} title="שרת" onClick={() => setTab("links")}>
              <div className="truncate font-semibold">
                {cp?.name ?? (p.siteType === "אתר AI" ? p.aiSystem : "—")}
              </div>
              <div className="text-xs text-[color:var(--focus-muted)]">
                {cp?.host || (cp ? "cPanel" : p.siteType)}
              </div>
            </MiniCard>
          </div>
          {pinned && (
            <Card className="mt-3 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-[color:var(--focus-primary)]">
                <Pin className="size-3" />
                הערה מוצמדת
              </div>
              <p className="whitespace-pre-wrap text-sm">{pinned.txt}</p>
            </Card>
          )}
          <Card className="mt-3 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">משימות פתוחות</div>
              <Btn
                size="sm"
                variant="ghost"
                icon={Plus}
                onClick={() => nav.quickAdd({ projectId: p.id })}
              >
                הוסף
              </Btn>
            </div>
            {open.length ? (
              <div className="-mx-2 divide-y divide-[color:var(--focus-border)]">
                {open.slice(0, 6).map((t) => (
                  <TaskRow key={t.id} t={t} showProject={false} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--focus-warning)]">
                אין משימה הבאה — כדאי להוסיף אחת כדי שהפרויקט לא ייתקע.
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="space-y-1.5">
            {tasks.length === 0 && (
              <Card>
                <EmptyState
                  icon={FolderKanban}
                  title="אין משימות בפרויקט"
                  action={
                    <Btn
                      size="sm"
                      variant="primary"
                      icon={Plus}
                      onClick={() => nav.quickAdd({ projectId: p.id })}
                    >
                      משימה חדשה
                    </Btn>
                  }
                />
              </Card>
            )}
            {tasks.length > 0 && (
              <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
                {[...open, ...tasks.filter((t) => !isOpen(t))].map((t) => (
                  <TaskRow key={t.id} t={t} showProject={false} />
                ))}
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="money">
          <MoneyTab p={p} />
        </TabsContent>
        <TabsContent value="hosting">
          <HostingTab p={p} />
        </TabsContent>
        <TabsContent value="issues">
          <IssuesTab p={p} />
        </TabsContent>

        <TabsContent value="links">
          <Card className="grid gap-3 p-5 sm:grid-cols-2">
            <LinkField label="כתובת האתר" value={p.url} onChange={(v) => patch({ url: v })} />
            <LinkField
              label="קישור ניהול"
              value={p.adminUrl}
              onChange={(v) => patch({ adminUrl: v })}
            />
            {(p.siteType === "אתר AI" || p.siteType === "משולב") && (
              <>
                <Field label="מערכת AI">
                  <Select
                    value={p.aiSystem}
                    onChange={(v) => patch({ aiSystem: v })}
                    options={AI_SYSTEMS}
                  />
                </Field>
                <LinkField
                  label="קישור לפרויקט ב-AI"
                  value={p.aiUrl}
                  onChange={(v) => patch({ aiUrl: v })}
                />
              </>
            )}
            {(p.siteType === "אתר WordPress" || p.siteType === "משולב") && (
              <Field label="פאנל cPanel" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Select
                    value={p.cpanelId}
                    onChange={(v) => patch({ cpanelId: v }, "שויך לפאנל cPanel")}
                    options={["", ...db.cpanels.map((c) => c.id)]}
                    labels={{
                      "": "— לא משויך —",
                      ...Object.fromEntries(db.cpanels.map((c) => [c.id, c.name])),
                    }}
                  />
                  {cp?.url && (
                    <a href={cp.url} target="_blank" rel="noreferrer">
                      <Btn variant="outline" icon={ExternalLink} className="h-10">
                        כניסה
                      </Btn>
                    </a>
                  )}
                </div>
              </Field>
            )}
            <p className="text-xs text-[color:var(--focus-muted)] sm:col-span-2">
              סיסמאות לא נשמרות ב-FOCUS. שמור קישור למנהל הסיסמאות שלך בהערות.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab p={p} />
        </TabsContent>

        <TabsContent value="activity">
          <Card className="p-5">
            {activity.length === 0 ? (
              <EmptyState icon={History} title="אין עדיין פעילות" />
            ) : (
              <ol className="relative space-y-3 border-r border-[color:var(--focus-border)] pr-4">
                {activity.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute -right-[21px] top-1.5 size-2 rounded-full bg-[var(--focus-violet)]" />
                    <div>{a.txt}</div>
                    <div className="text-xs text-[color:var(--focus-muted)]">
                      {new Date(a.at).toLocaleString("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-end">
        <Btn
          size="sm"
          variant="ghost"
          icon={Trash2}
          className="text-[color:var(--focus-destructive)]"
          onClick={() => {
            if (confirm(`למחוק את "${p.name}"? המשימות יישארו ללא פרויקט.`)) {
              actions.deleteProject(p.id);
              nav.go("projects");
            }
          }}
        >
          מחיקת פרויקט
        </Btn>
      </div>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  title,
  children,
  onClick,
}: {
  icon: typeof Wallet;
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-[color:var(--focus-muted)]">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </Card>
  );
}

function LinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--focus-border)] hover:text-[color:var(--focus-primary)]"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </Field>
  );
}

function MoneyTab({ p }: { p: Project }) {
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const bal = balanceOf(p);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר בנייה">
            <Input
              type="number"
              value={p.buildPrice || ""}
              onChange={(e) => actions.patchProject(p.id, { buildPrice: +e.target.value || 0 })}
            />
          </Field>
          <Field label="שולם">
            <Input
              type="number"
              value={p.paid || ""}
              onChange={(e) => actions.patchProject(p.id, { paid: +e.target.value || 0 })}
            />
          </Field>
          <Field label="מועד תשלום צפוי" className="col-span-2">
            <Input
              type="date"
              value={p.payDue}
              onChange={(e) => actions.patchProject(p.id, { payDue: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[var(--focus-bg2)] p-3">
          <span className="text-sm text-[color:var(--focus-muted)]">יתרה · {payState(p)}</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: bal ? C.warn : C.ok }}>
            {ils(bal)}
          </span>
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-3 font-semibold">רישום תשלום שהתקבל</div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="סכום"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28"
          />
          <Input
            placeholder="הערה (ביט, העברה…)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Btn
            variant="primary"
            className="h-10"
            disabled={!(+amount > 0)}
            onClick={() => {
              actions.recordPayment(p.id, +amount, note);
              setAmount("");
              setNote("");
            }}
          >
            רשום
          </Btn>
        </div>
        {bal > 0 && (
          <button
            className="mt-2 text-xs text-[color:var(--focus-primary)] hover:underline"
            onClick={() => setAmount(String(bal))}
          >
            מלא יתרה ({ils(bal)})
          </button>
        )}
        {p.payments.some((x) => !(x.invoiced || x.invoiceUrl)) && (
          <div className="mt-3 text-xs text-[color:var(--focus-warning)]">
            {p.payments.filter((x) => !(x.invoiced || x.invoiceUrl)).length} תשלומים בלי חשבונית —
            לחץ על התג כדי לסמן שהונפקה.
          </div>
        )}
        <div className="mt-4 space-y-1.5">
          {p.payments.map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between rounded-xl bg-[var(--focus-bg2)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                {fmtDate(x.date)}
                {x.note && ` · ${x.note}`}
              </span>
              <button
                onClick={() =>
                  actions.setPaymentInvoiced(p.id, x.id, !(x.invoiced || x.invoiceUrl))
                }
                className={cn(
                  "mx-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  x.invoiced || x.invoiceUrl
                    ? "bg-[color:color-mix(in_oklab,var(--focus-success)_14%,transparent)] text-[color:var(--focus-success)]"
                    : "bg-[color:color-mix(in_oklab,var(--focus-warning)_16%,transparent)] text-[color:var(--focus-warning)]",
                )}
                title="לחץ לשינוי"
              >
                {x.invoiced || x.invoiceUrl ? "חשבונית ✓" : "ללא חשבונית"}
              </button>
              {x.invoiceUrl && (
                <a
                  href={x.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs font-semibold text-[color:var(--focus-primary)] hover:underline"
                >
                  פתח
                </a>
              )}
              <span className="font-semibold tabular-nums text-[color:var(--focus-success)]">
                {ils(x.amount)}
              </span>
            </div>
          ))}
          {!p.payments.length && (
            <div className="text-sm text-[color:var(--focus-muted)]">עוד לא נרשמו תשלומים</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function HostingTab({ p }: { p: Project }) {
  const db = useDB();
  const nav = useNav();
  const [failOpen, setFailOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const patch = (x: Partial<Project>, log?: string) => actions.patchProject(p.id, x, log);
  const stale = p.hosted && daysSince(p.soChecked) > 35;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-4 p-5">
        <CheckBox
          checked={p.hosted}
          onChange={(v) => patch({ hosted: v })}
          label={<span className="font-medium">האתר מאוחסן אצלי</span>}
        />
        {p.hosted && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="מחיר חודשי"
              hint={p.hostPrice !== db.settings.defaultHostPrice ? "מחיר חריג" : "מחיר רגיל"}
            >
              <Input
                type="number"
                step="0.01"
                value={p.hostPrice}
                onChange={(e) => patch({ hostPrice: +e.target.value || 0 })}
              />
            </Field>
            <Field label="תחילת אחסון">
              <Input
                type="date"
                value={p.hostStart}
                onChange={(e) => patch({ hostStart: e.target.value })}
              />
            </Field>
            {p.hostPrice !== db.settings.defaultHostPrice && (
              <Field label="הערה למחיר חריג" className="col-span-2">
                <Input
                  value={p.hostPriceNote}
                  onChange={(e) => patch({ hostPriceNote: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </Card>
      {p.hosted && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">הוראת קבע</div>
            <Badge color={soColor(p.soState)}>{SO_STATES[p.soState]}</Badge>
          </div>
          <Select
            value={p.soState}
            onChange={(v) =>
              patch({ soState: v as SOState }, `הוראת קבע → ${SO_STATES[v as SOState]}`)
            }
            options={Object.keys(SO_STATES)}
            labels={SO_STATES}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="חיוב אחרון">
              <Input
                type="date"
                value={p.soLastCharge}
                onChange={(e) => patch({ soLastCharge: e.target.value })}
              />
            </Field>
            <Field label="נבדק לאחרונה">
              <Input
                type="date"
                value={p.soChecked}
                onChange={(e) => patch({ soChecked: e.target.value })}
              />
            </Field>
          </div>
          <Field label="תחילת הוראת קבע">
            <Input
              type="date"
              value={p.soStart}
              onChange={(e) => patch({ soStart: e.target.value })}
            />
          </Field>
          <SoRuns p={p} />
          {p.soState === "failed" && (
            <div className="rounded-xl bg-[color:color-mix(in_oklab,var(--focus-destructive)_12%,transparent)] p-3 text-sm text-[color:var(--focus-destructive)]">
              נכשל: {fmtDate(p.soFailedAt)}
              {p.soFailReason && ` · ${p.soFailReason}`}
            </div>
          )}
          {stale && p.soState !== "failed" && (
            <div className="text-xs text-[color:var(--focus-warning)]">
              לא נבדקה מעל 35 יום — כדאי לוודא שהחיוב עובר.
            </div>
          )}
          {["failed", "none", "check"].includes(p.soState) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#128c4a]/[0.07] p-3">
              <SoWhatsAppBtn p={p} size="md" />
              <span className="text-xs text-[color:var(--focus-muted)]">
                {p.soMsgAt
                  ? `נשלחה הודעה ${timeAgo(p.soMsgAt)}`
                  : "מדביקים את הקישור מהמייל של Grow — וההודעה מוכנה"}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn
              size="sm"
              variant="primary"
              icon={CheckCircle2}
              onClick={() => actions.markSOOk(p.id)}
            >
              {p.soState === "failed" ? "סמן שהסתדר" : "נבדק — תקין"}
            </Btn>
            <Btn size="sm" variant="danger" icon={AlertCircle} onClick={() => setFailOpen(true)}>
              דווח על חיוב שנכשל
            </Btn>
            {p.soState === "failed" && (
              <Btn
                size="sm"
                icon={Plus}
                onClick={() => {
                  actions.addTask(
                    {
                      title: `טיפול בחיוב שנכשל — ${p.name}`,
                      projectId: p.id,
                      status: "todo",
                      priority: "high",
                      type: "תשלום",
                      estMin: 15,
                    },
                    { today: true },
                  );
                  nav.go("today");
                }}
              >
                צור משימת טיפול
              </Btn>
            )}
          </div>
          <p className="text-xs text-[color:var(--focus-muted)]">
            מעקב ידני. מבנה הנתונים מוכן לחיבור עתידי למערכת סליקה — החיבור עוד לא קיים.
          </p>
        </Card>
      )}
      <Modal
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title="חיוב שנכשל"
        description="תיווצר התראה והפרויקט יופיע ב״דורש תשומת לב״."
      >
        <div className="space-y-3">
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="סיבה (אופציונלי): כרטיס פג תוקף…"
          />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setFailOpen(false)}>
              ביטול
            </Btn>
            <Btn
              variant="outline"
              onClick={() => {
                actions.reportSOFailed(p.id, reason);
                actions.addTask({
                  title: `טיפול בחיוב שנכשל — ${p.name}`,
                  projectId: p.id,
                  status: "todo",
                  priority: "high",
                  type: "תשלום",
                  estMin: 15,
                });
                setFailOpen(false);
                setReason("");
              }}
            >
              דווח + צור משימה
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                actions.reportSOFailed(p.id, reason);
                setFailOpen(false);
                setReason("");
              }}
            >
              דווח
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IssuesTab({ p }: { p: Project }) {
  const [v, setV] = React.useState("");
  const set = (issues: Project["issues"], log?: string, extra: Partial<Project> = {}) =>
    actions.patchProject(p.id, { issues, ...extra }, log);
  const open = p.issues.filter((i) => !i.resolvedAt);
  const add = () => {
    if (!v.trim()) return;
    set(
      [{ id: uid(), title: v.trim(), created: Date.now() }, ...p.issues],
      `נפתחה תקלה: ${v.trim()}`,
      p.siteState === "פעיל ותקין" ? { siteState: "קיימת תקלה" } : {},
    );
    setV("");
  };
  return (
    <Card className="p-5">
      <div className="mb-4 flex gap-2">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="תאר תקלה באתר…"
        />
        <Btn variant="primary" icon={Plus} className="h-10" onClick={add}>
          פתח תקלה
        </Btn>
      </div>
      {p.issues.length === 0 && <EmptyState icon={Wrench} title="אין תקלות" subtitle="האתר נקי" />}
      <div className="space-y-1.5">
        {p.issues.map((i) => (
          <div
            key={i.id}
            className={cn(
              "flex items-center gap-2 rounded-xl bg-[var(--focus-bg2)] px-3 py-2.5 text-sm",
              i.resolvedAt && "opacity-55",
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: i.resolvedAt ? C.ok : C.bad }}
            />
            <span className={cn("flex-1", i.resolvedAt && "line-through")}>{i.title}</span>
            <span className="text-xs text-[color:var(--focus-muted)]">
              {new Date(i.created).toLocaleDateString("he-IL")}
            </span>
            {!i.resolvedAt && (
              <>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    actions.addTask({
                      title: `תקלה: ${i.title}`,
                      projectId: p.id,
                      status: "todo",
                      type: "תיקון",
                      priority: "high",
                    })
                  }
                >
                  משימה
                </Btn>
                <Btn
                  size="sm"
                  icon={Check}
                  onClick={() =>
                    set(
                      p.issues.map((x) => (x.id === i.id ? { ...x, resolvedAt: Date.now() } : x)),
                      `תקלה טופלה: ${i.title}`,
                      open.length === 1 && SITE_BAD.includes(p.siteState)
                        ? { siteState: "פעיל ותקין" }
                        : {},
                    )
                  }
                >
                  טופל
                </Btn>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function NotesTab({ p }: { p: Project }) {
  const [v, setV] = React.useState("");
  const set = (notes: Project["notes"]) => actions.patchProject(p.id, { notes });
  const add = () => {
    if (!v.trim()) return;
    set([{ id: uid(), txt: v.trim(), created: Date.now(), pinned: false }, ...p.notes]);
    setV("");
  };
  const sorted = [...p.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <Textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="הערה פנימית חדשה… (Ctrl+Enter לשמירה)"
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && add()}
        />
        <div className="mt-2 flex justify-end">
          <Btn size="sm" variant="primary" icon={Plus} onClick={add} disabled={!v.trim()}>
            הוסף הערה
          </Btn>
        </div>
      </Card>
      {sorted.map((n) => (
        <Card
          key={n.id}
          className={cn("p-4", n.pinned && "border-[color:var(--focus-primary)]/40")}
        >
          <textarea
            defaultValue={n.txt}
            onBlur={(e) =>
              e.target.value !== n.txt &&
              set(
                p.notes.map((x) =>
                  x.id === n.id ? { ...x, txt: e.target.value, updated: Date.now() } : x,
                ),
              )
            }
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
            rows={Math.min(8, Math.max(2, n.txt.split("\n").length))}
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--focus-muted)]">
            <span>
              {new Date(n.created).toLocaleDateString("he-IL")}
              {n.updated && ` · עודכן ${new Date(n.updated).toLocaleDateString("he-IL")}`}
            </span>
            <span className="mr-auto" />
            <IconBtn
              icon={Pin}
              label={n.pinned ? "בטל הצמדה" : "הצמד לסקירה"}
              active={n.pinned}
              onClick={() =>
                set(p.notes.map((x) => ({ ...x, pinned: x.id === n.id ? !x.pinned : false })))
              }
            />
            <IconBtn
              icon={Trash2}
              label="מחק הערה"
              onClick={() => set(p.notes.filter((x) => x.id !== n.id))}
            />
          </div>
        </Card>
      ))}
      {!p.notes.length && (
        <div className="text-center text-sm text-[color:var(--focus-muted)]">
          הערות פנימיות — רק אתה רואה אותן.
        </div>
      )}
    </div>
  );
}

/* ---------------- dates line + standing-order history ---------------- */
export function ProjectDates({ p }: { p: Project }) {
  const db = useDB();
  const so = projectSO(db, p);
  const items: [string, string][] = [];
  if (p.startDate) items.push(["התחיל", fmtDate(p.startDate)]);
  if (p.doneDate) items.push(["הסתיים", fmtDate(p.doneDate)]);
  if (p.hosted && so.first) items.push(["הוראת קבע מ-", fmtDate(so.first)]);
  if (p.hosted && so.ok > 0) {
    items.push(["ריצות שעברו", String(so.ok)]);
    items.push(["הרווחתי מאחסון", ils(so.net)]);
  }
  if (!items.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--focus-muted)]">
      {items.map(([l, v]) => (
        <span key={l}>
          {l} <b className="font-semibold text-[color:var(--focus-foreground)]">{v}</b>
        </span>
      ))}
    </div>
  );
}

function SoRuns({ p }: { p: Project }) {
  const db = useDB();
  const so = projectSO(db, p);
  const own = new Set((p.soRuns || []).map((r) => r.id));
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [sum, setSum] = React.useState(String(p.hostPrice || ""));
  const free = db.soContacts.filter((c) => !c.projectId);
  return (
    <div className="space-y-3 rounded-xl bg-[var(--focus-bg2)] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["ריצות עברו", String(so.ok)],
            ["נכשלו", String(so.bad)],
            ["נגבה (ברוטו)", ils(so.gross)],
            ["הרווחתי (נטו)", ils(so.net)],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-lg bg-[var(--focus-card)] px-2.5 py-2">
            <div className="text-[11px] text-[color:var(--focus-muted)]">{l}</div>
            <div className="font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-[color:var(--focus-muted)]">
          אנשי קשר של ההוראה (מי שמשלם על האחסון)
        </div>
        {so.contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-lg bg-[var(--focus-card)] px-2.5 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">
              <b>{c.name || c.email || c.phone}</b>
              <span className="text-xs text-[color:var(--focus-muted)]" dir="auto">
                {" "}
                · {c.phone || c.email}
              </span>
            </span>
            <IconBtn icon={X} label="נתק" onClick={() => actions.linkContact(c.id, "")} />
          </div>
        ))}
        {free.length > 0 ? (
          <Select
            value=""
            onChange={(cid) => cid && actions.linkContact(cid, p.id)}
            options={["", ...free.map((c) => c.id)]}
            labels={{
              "": "+ קשר איש קשר מהוראות הקבע…",
              ...Object.fromEntries(
                free.map((c) => [c.id, `${c.name || c.email || c.phone} · ${c.phone || c.email}`]),
              ),
            }}
          />
        ) : (
          so.contacts.length === 0 && (
            <p className="text-xs text-[color:var(--focus-muted)]">
              אין אנשי קשר לקישור. ייבא דוח Grow בכספים ← הוראות קבע · אנשי קשר.
            </p>
          )
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[color:var(--focus-muted)]">היסטוריית ריצות</div>
        <Btn size="sm" variant="soft" icon={Plus} onClick={() => setOpen((v) => !v)}>
          רשום ריצה
        </Btn>
      </div>
      {open && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="תאריך">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="סכום (₪)">
            <Input
              type="number"
              step="0.01"
              value={sum}
              onChange={(e) => setSum(e.target.value)}
              className="w-28"
            />
          </Field>
          <Btn
            size="sm"
            variant="primary"
            onClick={() => {
              actions.addSORun(p.id, { date, ok: true, sum: +sum || 0, note: "" });
              setOpen(false);
            }}
          >
            עברה
          </Btn>
          <Btn
            size="sm"
            variant="danger"
            onClick={() => {
              actions.addSORun(p.id, { date, ok: false, sum: +sum || 0, note: "" });
              setOpen(false);
            }}
          >
            נכשלה
          </Btn>
        </div>
      )}
      {so.runs.length === 0 ? (
        <p className="text-xs text-[color:var(--focus-muted)]">
          עוד אין ריצות. חיובים מ-Grow והדוח המיובא יירשמו כאן, ואפשר גם לרשום ידנית.
        </p>
      ) : (
        <ul className="max-h-56 divide-y divide-[color:var(--focus-border)] overflow-auto text-sm">
          {so.runs.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: r.ok ? C.ok : C.bad }}
              />
              <span className="tabular-nums">{fmtDate(r.date)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--focus-muted)]">
                {r.ok ? r.desc || "עברה" : `נכשלה${r.note ? ` · ${r.note}` : ""}`}
              </span>
              {r.sum > 0 && <span className="tabular-nums">{ils(r.sum)}</span>}
              {own.has(r.id) && (
                <IconBtn icon={X} label="מחק" onClick={() => actions.deleteSORun(p.id, r.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- live site: is it up + live preview ---------------- */
function SiteCard({ p }: { p: Project }) {
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const c: SiteCheck | undefined = p.siteCheck;

  const run = React.useCallback(async () => {
    setBusy(true);
    const r = await checkSite(p.url);
    actions.patchProject(p.id, { siteCheck: r });
    setBusy(false);
  }, [p.id, p.url]);

  // check automatically when the project opens (if the last check is older than 10 minutes)
  const last = c?.at ?? 0;
  React.useEffect(() => {
    if (Date.now() - last > 10 * 60_000) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, p.url]);

  const up = c?.ok;
  const color = !c ? "var(--focus-muted)" : up ? C.ok : C.bad;
  const label = !c
    ? "טרם נבדק"
    : up
      ? `האתר עובד${c.status ? ` · ${c.status}` : ""}${c.ms ? ` · ${c.ms}ms` : ""}`
      : `האתר לא זמין${c.status ? ` · ${c.status}` : ""}${c.error ? ` · ${c.error}` : ""}`;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn("size-3 shrink-0 rounded-full", busy && "animate-pulse")}
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold" style={{ color: up === false ? C.bad : undefined }}>
            {busy ? "בודק…" : label}
          </div>
          <div className="truncate text-xs text-[color:var(--focus-muted)]" dir="ltr">
            {c ? `נבדק ${timeAgo(c.at)} · ` : ""}
            {p.url}
          </div>
        </div>
        <Btn size="sm" variant="soft" icon={RefreshCw} disabled={busy} onClick={run}>
          בדוק עכשיו
        </Btn>
        <Btn
          size="sm"
          variant={preview ? "primary" : "outline"}
          icon={Globe}
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? "סגור תצוגה" : "תצוגה חיה"}
        </Btn>
        <a href={normUrl(p.url)} target="_blank" rel="noreferrer">
          <IconBtn icon={ExternalLink} label="פתח בכרטיסייה חדשה" />
        </a>
      </div>
      {preview && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Btn
              size="sm"
              variant={mobile ? "outline" : "soft"}
              icon={Monitor}
              onClick={() => setMobile(false)}
            >
              מחשב
            </Btn>
            <Btn
              size="sm"
              variant={mobile ? "soft" : "outline"}
              icon={Smartphone}
              onClick={() => setMobile(true)}
            >
              נייד
            </Btn>
            <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => setNonce((n) => n + 1)}>
              רענן
            </Btn>
          </div>
          <div className="flex justify-center overflow-hidden rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)]">
            <iframe
              key={`${nonce}-${mobile}`}
              src={normUrl(p.url)}
              title={p.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="h-[520px] bg-white"
              style={{ width: mobile ? 390 : "100%", maxWidth: "100%" }}
            />
          </div>
          <p className="mt-2 text-xs text-[color:var(--focus-muted)]">
            אם התצוגה ריקה, האתר חוסם הצגה בתוך אתרים אחרים — השתמש בכפתור "פתח בכרטיסייה חדשה".
          </p>
        </div>
      )}
    </Card>
  );
}
