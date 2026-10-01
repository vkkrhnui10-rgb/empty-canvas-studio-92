import * as React from "react";
import {
  AlertTriangle,
  BellOff,
  Check,
  Clock,
  ExternalLink,
  FolderOpen,
  Pencil,
  Plus,
  Server,
  StickyNote,
  Trash2,
  Wallet,
  Sparkles,
  Receipt,
  TrendingUp,
  Hammer,
  CircleDollarSign,
  Users,
  Tag,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { C, SO_STATES } from "./constants";
import { actions, computeAlerts, findProject, hostingPaid, projectSO, useDB } from "./store";
import type { Alert, Cpanel, Project } from "./types";
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  Field,
  GradientStat,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Textarea,
  ProjectAvatar,
  StatCard,
  Progress,
} from "./ui";
import { balanceOf, daysSince, fmtDate, ils, payState, uid } from "./utils";
import { useNav } from "./nav";
import { SoWhatsAppBtn } from "./billing";
import { GrowTab, SoContactsTab } from "./growui";
import { IncomeTab } from "./income";

/* ============================ Finances ============================ */
export function FinancesView() {
  const db = useDB();
  const nav = useNav();
  const [tab, setTab] = React.useState<"income" | "collect" | "hosting" | "grow" | "contacts">(
    "income",
  );
  const growOpen = db.growLog.filter((g) => !g.projectId && g.kind !== "invoice").length;
  const P = db.projects;
  const totBuild = P.reduce((s, p) => s + (p.buildPrice || 0), 0);
  const totPaid = P.reduce((s, p) => s + (p.paid || 0), 0);
  const totBal = P.reduce((s, p) => s + balanceOf(p), 0);
  const hosted = P.filter((p) => p.hosted && !["cancelled", "paused"].includes(p.soState));
  const host = hostingPaid(db);
  const monthly = host.hasData ? host.paid : host.expected;
  const std = hosted.filter((p) => p.hostPrice === db.settings.defaultHostPrice).length;
  const soOk = P.filter((p) => p.hosted && p.soState === "ok").length;
  const soBad = P.filter((p) => p.hosted && ["failed", "none", "check"].includes(p.soState)).length;
  const debtors = P.filter((p) => balanceOf(p) > 0).sort((a, b) => balanceOf(b) - balanceOf(a));
  const hostList = P.filter((p) => p.hosted).sort(
    (a, b) =>
      ["failed", "none", "check", "paused", "ok", "cancelled"].indexOf(a.soState) -
      ["failed", "none", "check", "paused", "ok", "cancelled"].indexOf(b.soState),
  );

  const kpis: [string, string, LucideIcon, string?, string?][] = [
    [
      "הכנסה שנתית משוערת",
      ils(monthly * 12),
      TrendingUp,
      undefined,
      host.hasData ? "מאחסון, לפי מה ששולם בפועל" : "מאחסון, לפי מחירון",
    ],
    ["סך מחירי בנייה", ils(totBuild), Hammer],
    [
      "סך ששולם",
      ils(totPaid),
      CircleDollarSign,
      C.ok,
      totBuild ? `${Math.round((totPaid / totBuild) * 100)}% מסך הבנייה` : undefined,
    ],
    [`לקוחות במחיר רגיל`, String(std), Users, undefined, ils(db.settings.defaultHostPrice)],
    ["לקוחות במחיר חריג", String(hosted.length - std), Tag],
    ["הוראות קבע", `${soOk} / ${soBad}`, Repeat, soBad ? C.warn : undefined, "תקינות / לטיפול"],
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="כספים" subtitle="תמונת מצב — לא הנהלת חשבונות." />
      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        <GradientStat
          label="יתרה לגבייה"
          value={ils(totBal)}
          sub={`${debtors.length} לקוחות עם יתרה פתוחה`}
          icon={Wallet}
          onClick={() => setTab("collect")}
        />
        <GradientStat
          label={host.hasData ? "אחסון ששולם בפועל (30 יום)" : "הכנסה חודשית מאחסון (מחירון)"}
          value={ils(monthly)}
          sub={
            host.hasData
              ? `נטו ${ils(host.net)} · צפוי ${ils(host.expected)}${host.missing.length ? ` · ${host.missing.length} לא חויבו` : ""}`
              : `${hosted.length} אתרים פעילים · ${soBad} הוראות קבע לטיפול`
          }
          icon={Receipt}
          onClick={() => setTab("hosting")}
        />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map(([l, v, icon, c, sub]) => (
          <StatCard key={l} label={l} value={v} icon={icon} color={c} sub={sub} />
        ))}
      </div>
      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "income", label: "הכנסות" },
            { value: "collect", label: `גבייה (${debtors.length})` },
            { value: "hosting", label: `אחסון והוראות קבע (${hostList.length})` },
            { value: "contacts", label: `הוראות קבע · אנשי קשר (${db.soContacts.length})` },
            { value: "grow", label: growOpen ? `Grow · ${growOpen} לשיוך` : "Grow" },
          ]}
        />
      </div>
      {tab === "income" ? (
        <IncomeTab />
      ) : tab === "contacts" ? (
        <SoContactsTab />
      ) : tab === "grow" ? (
        <GrowTab />
      ) : tab === "collect" ? (
        debtors.length === 0 ? (
          <Card>
            <EmptyState
              icon={Sparkles}
              title="אף אחד לא חייב לך כסף"
              subtitle="כל הפרויקטים שולמו במלואם"
            />
          </Card>
        ) : (
          <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
            {debtors.map((p) => (
              <DebtRow key={p.id} p={p} />
            ))}
          </Card>
        )
      ) : hostList.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="אין אתרים מאוחסנים" />
        </Card>
      ) : (
        <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
          {hostList.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => nav.go("project", p.id)}
              onKeyDown={(e) => e.key === "Enter" && nav.go("project", p.id)}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 text-right text-sm transition-colors hover:bg-[var(--focus-bg2)]"
            >
              <ProjectAvatar id={p.id} name={p.name} size={34} />
              <span className="min-w-32 flex-1 truncate font-semibold">{p.name}</span>
              <span className="w-24 tabular-nums">
                {ils(p.hostPrice)}
                {p.hostPrice !== db.settings.defaultHostPrice && (
                  <span className="mr-1 text-xs text-[color:var(--focus-warning)]">חריג</span>
                )}
              </span>
              <Badge color={p.soState === "ok" ? C.ok : p.soState === "failed" ? C.bad : C.warn}>
                {SO_STATES[p.soState]}
              </Badge>
              <PaidLast p={p} />
              {["failed", "none", "check"].includes(p.soState) ? (
                <SoWhatsAppBtn p={p} size="icon" />
              ) : (
                <span className="size-8" />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function DebtRow({ p }: { p: Project }) {
  const nav = useNav();
  const [amt, setAmt] = React.useState("");
  const bal = balanceOf(p);
  const st = payState(p);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-3.5 text-sm">
      <ProjectAvatar id={p.id} name={p.name} size={38} />
      <button onClick={() => nav.go("project", p.id)} className="min-w-40 flex-1 text-right">
        <div className="font-semibold">{p.name}</div>
        <div className="text-xs text-[color:var(--focus-muted)]">
          {p.client} · שולם {ils(p.paid)} מתוך {ils(p.buildPrice)}
        </div>
        <Progress
          className="mt-1.5 max-w-56"
          value={(p.paid / Math.max(1, p.buildPrice)) * 100}
          color={C.ok}
        />
      </button>
      <Badge color={st === "באיחור" ? C.bad : C.warn}>{st}</Badge>
      <span className="w-24 text-left text-base font-bold tabular-nums text-[color:var(--focus-warning)]">
        {ils(bal)}
      </span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="סכום"
          className="h-8 w-24 text-sm"
        />
        <Btn
          size="sm"
          variant="primary"
          disabled={!(+amt > 0)}
          onClick={() => {
            actions.recordPayment(p.id, +amt);
            setAmt("");
          }}
        >
          התקבל
        </Btn>
        <Btn size="sm" onClick={() => actions.recordPayment(p.id, bal, "סגירת יתרה")}>
          שולם הכול
        </Btn>
      </div>
    </div>
  );
}

/* ============================ cPanels ============================ */
export function CpanelsView() {
  const db = useDB();
  const nav = useNav();
  const [f, setF] = React.useState<Cpanel | null>(null);
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="פאנלי cPanel"
        subtitle="איזה אתר נמצא איפה — בלי לחפש."
        actions={
          <Btn
            variant="primary"
            icon={Plus}
            onClick={() => setF({ id: uid(), name: "", url: "", host: "", notes: "" })}
          >
            פאנל חדש
          </Btn>
        }
      />
      {db.cpanels.length === 0 ? (
        <Card>
          <EmptyState
            icon={Server}
            title="אין פאנלים עדיין"
            subtitle="הוסף פאנל ושייך אליו אתרי WordPress"
            action={
              <Btn
                size="sm"
                variant="primary"
                icon={Plus}
                onClick={() => setF({ id: uid(), name: "", url: "", host: "", notes: "" })}
              >
                פאנל חדש
              </Btn>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {db.cpanels.map((c) => {
            const sites = db.projects.filter((p) => p.cpanelId === c.id);
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--focus-soft)] text-[color:var(--focus-primary)]">
                    <Server className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-[color:var(--focus-muted)]">
                      {c.host || "—"} · {sites.length} אתרים
                    </div>
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <Btn size="sm" variant="outline" icon={ExternalLink}>
                        כניסה
                      </Btn>
                    </a>
                  )}
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon={Pencil}
                    onClick={() => setF(c)}
                    aria-label="עריכה"
                  />
                </div>
                {sites.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sites.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => nav.go("project", s.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--focus-border)] py-0.5 pl-2.5 pr-0.5 text-xs font-medium hover:border-[color:var(--focus-primary)] hover:text-[color:var(--focus-primary)]"
                      >
                        <ProjectAvatar id={s.id} name={s.name} size={20} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {c.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-[color:var(--focus-muted)]">
                    {c.notes}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-[color:var(--focus-muted)]">
        FOCUS לא שומר סיסמאות. אפשר לשמור בהערות קישור למנהל הסיסמאות שלך.
      </p>
      <Modal
        open={!!f}
        onClose={() => setF(null)}
        title={f && db.cpanels.some((c) => c.id === f.id) ? "עריכת פאנל" : "פאנל חדש"}
      >
        {f && (
          <div className="space-y-3">
            <Field label="שם פנימי">
              <Input
                autoFocus
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="קישור כניסה">
              <Input
                dir="ltr"
                value={f.url}
                onChange={(e) => setF({ ...f, url: e.target.value })}
                placeholder="https://server.host.co.il:2083"
              />
            </Field>
            <Field label="חברת אחסון">
              <Input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
            </Field>
            <Field label="הערות / קישור למנהל סיסמאות">
              <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <div className="flex justify-between gap-2 pt-1">
              {db.cpanels.some((c) => c.id === f.id) ? (
                <Btn
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    actions.deleteCpanel(f.id);
                    setF(null);
                  }}
                >
                  מחק
                </Btn>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => setF(null)}>
                  ביטול
                </Btn>
                <Btn
                  variant="primary"
                  disabled={!f.name.trim()}
                  onClick={() => {
                    actions.saveCpanel(f);
                    setF(null);
                  }}
                >
                  שמור
                </Btn>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ Alerts ============================ */
export function AlertsView() {
  const db = useDB();
  const alerts = computeAlerts(db);
  const bad = alerts.filter((a) => a.sev === "bad");
  const warn = alerts.filter((a) => a.sev === "warn");
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="התראות" subtitle="רק מה שדורש ממך פעולה." />
      {alerts.length === 0 ? (
        <Card>
          <EmptyState icon={Sparkles} title="אין התראות" subtitle="הכול תקין. תמשיך לעבוד." />
        </Card>
      ) : (
        <div className="space-y-5">
          {bad.length > 0 && <Group title="דחוף" items={bad} />}
          {warn.length > 0 && <Group title="כדאי לטפל" items={warn} />}
        </div>
      )}
    </div>
  );
}
function Group({ title, items }: { title: string; items: Alert[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span
          className="size-2 rounded-full"
          style={{ background: items[0]?.sev === "bad" ? C.bad : C.warn }}
        />
        {title}
        <span className="rounded-full bg-[var(--focus-bg2)] px-2 py-0.5 text-xs font-semibold text-[color:var(--focus-muted)]">
          {items.length}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((a) => (
          <AlertCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
export function AlertCard({ a }: { a: Alert }) {
  const db = useDB();
  const nav = useNav();
  const [note, setNote] = React.useState<string | null>(null);
  const p = findProject(db, a.projectId);
  return (
    <Card className="relative overflow-hidden p-4 pr-5">
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-1"
        style={{ background: a.sev === "bad" ? C.bad : C.warn }}
      />
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            color: a.sev === "bad" ? C.bad : C.warn,
            background: `color-mix(in oklab, ${a.sev === "bad" ? C.bad : C.warn} 12%, transparent)`,
          }}
        >
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold leading-snug">{a.txt}</div>
          {p && <div className="mt-0.5 text-xs text-[color:var(--focus-muted)]">{p.name}</div>}
        </div>
        <Btn
          size="sm"
          variant="outline"
          icon={Check}
          onClick={() => actions.dismissAlert(a.id)}
          className="shrink-0"
        >
          טופל
        </Btn>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 pr-12">
        {a.projectId && (
          <Btn
            size="sm"
            variant="soft"
            icon={FolderOpen}
            onClick={() => nav.go("project", a.projectId)}
          >
            פתח פרויקט
          </Btn>
        )}
        {a.taskId && (
          <Btn size="sm" variant="soft" onClick={() => nav.openTask(a.taskId!)}>
            פתח משימה
          </Btn>
        )}
        {a.leadId && (
          <Btn size="sm" variant="soft" onClick={() => nav.go("leads", a.leadId)}>
            פתח ליד
          </Btn>
        )}
        {a.kind === "so" && p && p.soState !== "ok" && (
          <SoWhatsAppBtn p={p} label="וואטסאפ לעדכון כרטיס" />
        )}
        {!a.taskId && !a.leadId && (
          <Btn
            size="sm"
            variant="soft"
            icon={Plus}
            onClick={() =>
              actions.addTask({
                title: `טיפול: ${a.txt}`,
                projectId: a.projectId ?? "",
                status: "todo",
                priority: a.sev === "bad" ? "high" : "normal",
              })
            }
          >
            צור משימה
          </Btn>
        )}
        {p && (
          <Btn size="sm" variant="ghost" icon={StickyNote} onClick={() => setNote("")}>
            הערה
          </Btn>
        )}
        <Btn size="sm" variant="ghost" icon={Clock} onClick={() => actions.dismissAlert(a.id, 3)}>
          עוד 3 ימים
        </Btn>
      </div>
      {note !== null && p && (
        <div className="mt-3 flex gap-2 pr-12">
          <Input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הערה לפרויקט…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && note.trim()) {
                actions.patchProject(p.id, {
                  notes: [
                    { id: uid(), txt: note.trim(), created: Date.now(), pinned: false },
                    ...p.notes,
                  ],
                });
                setNote(null);
              }
            }}
          />
          <Btn size="sm" variant="ghost" icon={BellOff} onClick={() => setNote(null)}>
            סגור
          </Btn>
        </div>
      )}
    </Card>
  );
}

/** when the standing order last actually charged — the real signal, not the status label */
function PaidLast({ p }: { p: Project }) {
  const db = useDB();
  const so = projectSO(db, p);
  const run = so.runs.find((r) => r.ok);
  if (!run)
    return (
      <span className="w-36 text-xs text-[color:var(--focus-muted)]">
        {so.runs.length ? "אין חיוב מוצלח" : `נבדק: ${p.soChecked || "מעולם"}`}
      </span>
    );
  const late = daysSince(run.date) > 31;
  return (
    <span
      className="w-36 text-xs"
      style={{ color: late ? "var(--focus-warning)" : "var(--focus-muted)" }}
      title={late ? "לא היה חיוב מוצלח בחודש האחרון" : undefined}
    >
      שולם {fmtDate(run.date)} · {ils(run.sum)}
    </span>
  );
}
