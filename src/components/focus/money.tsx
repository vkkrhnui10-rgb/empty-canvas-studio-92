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
} from "lucide-react";
import { C, SO_STATES } from "./constants";
import { actions, computeAlerts, findProject, useDB } from "./store";
import type { Alert, Cpanel, Project } from "./types";
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Textarea,
} from "./ui";
import { balanceOf, ils, payState, uid } from "./utils";
import { useNav } from "./nav";

/* ============================ Finances ============================ */
export function FinancesView() {
  const db = useDB();
  const nav = useNav();
  const [tab, setTab] = React.useState<"collect" | "hosting">("collect");
  const P = db.projects;
  const totBuild = P.reduce((s, p) => s + (p.buildPrice || 0), 0);
  const totPaid = P.reduce((s, p) => s + (p.paid || 0), 0);
  const totBal = P.reduce((s, p) => s + balanceOf(p), 0);
  const hosted = P.filter((p) => p.hosted && !["cancelled", "paused"].includes(p.soState));
  const monthly = hosted.reduce((s, p) => s + (p.hostPrice || 0), 0);
  const std = hosted.filter((p) => p.hostPrice === db.settings.defaultHostPrice).length;
  const soOk = P.filter((p) => p.hosted && p.soState === "ok").length;
  const soBad = P.filter((p) => p.hosted && ["failed", "none", "check"].includes(p.soState)).length;
  const debtors = P.filter((p) => balanceOf(p) > 0).sort((a, b) => balanceOf(b) - balanceOf(a));
  const hostList = P.filter((p) => p.hosted).sort(
    (a, b) =>
      ["failed", "none", "check", "paused", "ok", "cancelled"].indexOf(a.soState) -
      ["failed", "none", "check", "paused", "ok", "cancelled"].indexOf(b.soState),
  );

  const kpis: [string, string, string?][] = [
    ["יתרה לגבייה", ils(totBal), totBal ? C.warn : C.ok],
    ["הכנסה חודשית מאחסון", ils(monthly), C.mint],
    ["הכנסה שנתית משוערת", ils(monthly * 12)],
    ["סך מחירי בנייה", ils(totBuild)],
    ["סך ששולם", ils(totPaid), C.ok],
    [`לקוחות ב-${ils(db.settings.defaultHostPrice)}`, String(std)],
    ["לקוחות במחיר חריג", String(hosted.length - std)],
    ["הוראות קבע תקינות / לטיפול", `${soOk} / ${soBad}`, soBad ? C.warn : undefined],
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader title="כספים" subtitle="תמונת מצב — לא הנהלת חשבונות." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <div className="text-xs text-[color:var(--focus-muted)]">{l}</div>
            <div className="mt-1.5 truncate text-xl font-bold tabular-nums" style={{ color: c }}>
              {v}
            </div>
          </Card>
        ))}
      </div>
      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "collect", label: `גבייה (${debtors.length})` },
            { value: "hosting", label: `אחסון והוראות קבע (${hostList.length})` },
          ]}
        />
      </div>
      {tab === "collect" ? (
        debtors.length === 0 ? (
          <Card>
            <EmptyState
              icon={Sparkles}
              title="אף אחד לא חייב לך כסף"
              subtitle="כל הפרויקטים שולמו במלואם"
            />
          </Card>
        ) : (
          <div className="space-y-1.5">
            {debtors.map((p) => (
              <DebtRow key={p.id} p={p} />
            ))}
          </div>
        )
      ) : hostList.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="אין אתרים מאוחסנים" />
        </Card>
      ) : (
        <div className="space-y-1.5">
          {hostList.map((p) => (
            <button
              key={p.id}
              onClick={() => nav.go("project", p.id)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-[var(--focus-bg2)] px-4 py-3 text-right text-sm hover:bg-[var(--focus-card-hi)]"
            >
              <span className="min-w-32 flex-1 truncate font-medium">{p.name}</span>
              <span className="w-24 tabular-nums">
                {ils(p.hostPrice)}
                {p.hostPrice !== db.settings.defaultHostPrice && (
                  <span className="mr-1 text-xs text-[color:var(--focus-warning)]">חריג</span>
                )}
              </span>
              <Badge color={p.soState === "ok" ? C.ok : p.soState === "failed" ? C.bad : C.warn}>
                {SO_STATES[p.soState]}
              </Badge>
              <span className="w-32 text-xs text-[color:var(--focus-muted)]">
                נבדק: {p.soChecked || "מעולם"}
              </span>
            </button>
          ))}
        </div>
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
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--focus-bg2)] px-4 py-3 text-sm">
      <button onClick={() => nav.go("project", p.id)} className="min-w-32 flex-1 text-right">
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-[color:var(--focus-muted)]">
          {p.client} · שולם {ils(p.paid)} מתוך {ils(p.buildPrice)}
        </div>
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
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
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
        <div className="grid gap-3 md:grid-cols-2">
          {db.cpanels.map((c) => {
            const sites = db.projects.filter((p) => p.cpanelId === c.id);
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--focus-bg2)] text-[color:var(--focus-mint)]">
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
                        className="rounded-full border border-[color:var(--focus-border)] px-2.5 py-0.5 text-xs hover:border-[color:var(--focus-mint)] hover:text-[color:var(--focus-mint)]"
                      >
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
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
      <div className="mb-2 text-xs font-medium text-[color:var(--focus-muted)]">
        {title} · {items.length}
      </div>
      <div className="space-y-2">
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
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0"
          style={{ color: a.sev === "bad" ? C.bad : C.warn }}
        />
        <div className="min-w-0 flex-1 text-sm">{a.txt}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 pr-7">
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
        {!a.taskId && (
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
          דחה ל-3 ימים
        </Btn>
        <Btn size="sm" variant="ghost" icon={Check} onClick={() => actions.dismissAlert(a.id)}>
          טופל
        </Btn>
      </div>
      {note !== null && p && (
        <div className="mt-3 flex gap-2 pr-7">
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
