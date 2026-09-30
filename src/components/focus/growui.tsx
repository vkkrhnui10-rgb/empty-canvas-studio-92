import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LogOut,
  RefreshCw,
  RotateCcw,
  Webhook,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { C } from "./constants";
import { WEBHOOK_BASE, signOut, syncNow, useCloud } from "./cloud";
import { actions, allSORuns, projectSO, replaceFromRemote, useDB } from "./store";
import type { GrowEntry, SOContact } from "./types";
import { Badge, Btn, Card, EmptyState, ProjectAvatar, Segmented, Select } from "./ui";
import { isOrdersTable, parseGrowOrders, parseGrowReport } from "./growreport";
import { readSheet } from "./xlsx";
import { useNav } from "./nav";
import { daysSince, fmtDate, ils, timeAgo } from "./utils";

const KIND: Record<GrowEntry["kind"], { l: string; c: string }> = {
  so_failed: { l: "הוראת קבע נכשלה", c: C.bad },
  so_charge: { l: "חיוב הוראת קבע", c: C.ok },
  payment: { l: "תשלום", c: C.primary },
  invoice: { l: "חשבונית", c: C.violet },
};

/* ------------------------------ finances tab ------------------------------ */
export function GrowTab() {
  const db = useDB();
  const nav = useNav();
  const cloud = useCloud();
  const list = [...db.growLog].sort(
    (a, b) => Number(!!a.projectId) - Number(!!b.projectId) || b.at - a.at,
  );
  if (!cloud.session)
    return (
      <Card>
        <EmptyState
          icon={Webhook}
          title="החיבור ל-Grow עובד רק עם חשבון ענן"
          subtitle="התחבר לחשבון FOCUS כדי לקבל חיובים אוטומטית"
        />
      </Card>
    );
  if (list.length === 0)
    return (
      <Card>
        <EmptyState
          icon={Webhook}
          title="עוד לא הגיעו אירועים מ-Grow"
          subtitle="אחרי שתגדיר את ה-Webhook ב-Grow (הגדרות ← חיבור ל-Grow), כל חיוב יופיע כאן ויעדכן את הפרויקט לבד"
          action={
            <Btn size="sm" variant="soft" onClick={() => nav.go("settings")}>
              להגדרות החיבור
            </Btn>
          }
        />
      </Card>
    );
  return (
    <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
      {list.map((e) => (
        <GrowRow key={e.id} e={e} />
      ))}
    </Card>
  );
}

function GrowRow({ e }: { e: GrowEntry }) {
  const db = useDB();
  const nav = useNav();
  const p = db.projects.find((x) => x.id === e.projectId);
  const k = KIND[e.kind] ?? KIND.payment;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm">
      {p ? (
        <ProjectAvatar id={p.id} name={p.name} size={36} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:color-mix(in_oklab,var(--focus-warning)_14%,transparent)] text-[color:var(--focus-warning)]">
          <AlertTriangle className="size-4" />
        </span>
      )}
      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{e.name || e.email || e.phone || "ללא שם"}</span>
          <Badge color={k.c}>{k.l}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-[color:var(--focus-muted)]">
          {timeAgo(e.at)}
          {e.desc && ` · ${e.desc}`}
          {e.error && <span className="text-[color:var(--focus-destructive)]"> · {e.error}</span>}
          {e.applied && ` · ${e.applied}`}
        </div>
      </div>
      {e.sum > 0 && <span className="font-bold tabular-nums">{ils(e.sum)}</span>}
      {e.invoiceUrl && (
        <a
          href={e.invoiceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--focus-primary)] hover:underline"
        >
          <FileText className="size-3.5" />
          חשבונית
        </a>
      )}
      {p ? (
        <button
          onClick={() => nav.go("project", p.id)}
          className="text-xs font-semibold text-[color:var(--focus-muted)] hover:text-[color:var(--focus-primary)]"
        >
          {p.name} ›
        </button>
      ) : e.kind !== "invoice" ? (
        <div className="w-full sm:w-56">
          <Select
            value=""
            onChange={(pid) => {
              if (!pid) return;
              actions.assignGrow(e.id, pid);
              toast.success("שויך לפרויקט — הטלפון/מייל נשמרו לפעם הבאה");
            }}
            options={["", ...db.projects.map((x) => x.id)]}
            labels={{
              "": "שייך לפרויקט…",
              ...Object.fromEntries(db.projects.map((x) => [x.id, x.name])),
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ settings: account ------------------------------ */
export function AccountCard() {
  const cloud = useCloud();
  const [busy, setBusy] = React.useState(false);
  if (!cloud.enabled || !cloud.session) return null;
  let backup = "";
  try {
    backup = localStorage.getItem("focus-db-local-backup") ?? "";
  } catch {
    /* no storage */
  }
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Cloud className="size-[18px] text-[color:var(--focus-primary)]" />
        חשבון וסנכרון
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--focus-bg2)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold" dir="ltr">
            {cloud.session.user.email}
          </div>
          <div className="text-xs text-[color:var(--focus-muted)]">
            {cloud.status === "synced"
              ? `מסונכרן · ${timeAgo(cloud.lastSync)}`
              : cloud.status === "saving"
                ? "שומר…"
                : cloud.status === "offline"
                  ? "אין חיבור — השינויים יישמרו כשהחיבור יחזור"
                  : cloud.status === "error"
                    ? `שגיאה: ${cloud.error}`
                    : "טוען…"}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn
            size="sm"
            variant="soft"
            icon={RefreshCw}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await syncNow();
              setBusy(false);
              toast.success("סונכרן");
            }}
          >
            סנכרן עכשיו
          </Btn>
          <Btn size="sm" variant="ghost" icon={LogOut} onClick={() => void signOut()}>
            התנתק
          </Btn>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-[color:var(--focus-muted)]">
        כל שינוי נשמר בענן תוך שנייה ומופיע מיד במכשירים האחרים שמחוברים לאותו חשבון.
      </p>
      {backup && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[color:var(--focus-border)] px-4 py-3 text-xs text-[color:var(--focus-muted)]">
          <span className="flex-1">שמרתי עותק של מה שהיה בדפדפן הזה לפני המעבר לענן.</span>
          <Btn
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={() => {
              try {
                replaceFromRemote(JSON.parse(backup));
                actions.settings({}); // push the restored copy to the cloud
                toast.success("העותק המקומי שוחזר");
              } catch {
                toast.error("לא הצלחתי לשחזר");
              }
            }}
          >
            שחזר את העותק הזה
          </Btn>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ settings: Grow webhook ------------------------------ */
export function GrowConnectCard() {
  const cloud = useCloud();
  const db = useDB();
  if (!cloud.enabled || !cloud.session) return null;
  const url = cloud.webhookToken ? `${WEBHOOK_BASE}?key=${cloud.webhookToken}` : "";
  const last = db.growLog[0];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הכתובת הועתקה");
    } catch {
      toast("סמן את הכתובת והעתק ידנית");
    }
  };
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <Wallet className="size-[18px] text-[color:var(--focus-primary)]" />
        חיבור ל-Grow (Webhook)
      </h2>
      <p className="text-sm text-[color:var(--focus-muted)]">
        כל חיוב, חיוב שנכשל או חשבונית ב-Grow יעדכנו את הפרויקט המתאים לבד — לפי הטלפון או המייל של
        הלקוח.
      </p>
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-[color:var(--focus-muted)]">
          הכתובת שלך (קישור לשרת החברה)
        </div>
        <div className="flex items-stretch gap-2">
          <code
            dir="ltr"
            className="min-w-0 flex-1 truncate rounded-lg border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-3 py-2.5 text-[12.5px]"
          >
            {url || "…"}
          </code>
          <Btn variant="primary" icon={Copy} onClick={copy} disabled={!url}>
            העתק
          </Btn>
        </div>
        <div className="mt-1.5 text-xs text-[color:var(--focus-muted)]">
          הכתובת אישית וסודית — מי שמחזיק בה יכול לשלוח אירועים לחשבון שלך.
        </div>
      </div>
      <ol className="space-y-1.5 rounded-xl bg-[var(--focus-bg2)] p-4 text-sm">
        <li>
          <b>1.</b> ב-Grow: הגדרות ← Webhooks ← יצירת Webhook חדש
        </li>
        <li>
          <b>2.</b> שם: <code>FOCUS</code> · קישור לשרת החברה: הכתובת שלמעלה
        </li>
        <li>
          <b>3.</b> פורמט: <b>JSON</b> · סטטוס: פעיל
        </li>
        <li>
          <b>4.</b> סוג: לחזור על זה לכל סוג — <b>הוראות קבע</b>, <b>הוראות קבע שנכשלו</b>,{" "}
          <b>יצירת חשבונית</b> (ואם אתה גובה בקישורי תשלום — גם אותם)
        </li>
      </ol>
      <div className="flex items-center gap-2 text-sm">
        {last ? (
          <>
            <CheckCircle2 className="size-4 text-[color:var(--focus-success)]" />
            <span>
              אירוע אחרון התקבל {timeAgo(last.at)} ({last.name || "ללא שם"})
            </span>
          </>
        ) : (
          <>
            <ExternalLink className="size-4 text-[color:var(--focus-muted)]" />
            <span className="text-[color:var(--focus-muted)]">
              עוד לא התקבלו אירועים. אחרי ההגדרה ב-Grow, החיוב הבא יופיע בכספים ← Grow.
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ finances: standing-order contacts ------------------------------ */
const cStats = (c: SOContact) => {
  const ok = c.runs.filter((r) => r.ok);
  const dates = ok.map((r) => r.date).sort();
  return {
    ok: ok.length,
    bad: c.runs.length - ok.length,
    gross: ok.reduce((s, r) => s + r.sum, 0),
    net: ok.reduce((s, r) => s + (r.net ?? r.sum), 0),
    first: dates[0] ?? "",
    last: dates[dates.length - 1] ?? "",
  };
};

export type SoState = "active" | "inactive" | "cancelled" | "attention";
const STALE_DAYS = 38;
export const SO_STATE_LABEL: Record<SoState, string> = {
  active: "פעילה",
  inactive: "לא פעילה",
  cancelled: "בוטלה",
  attention: "נדרש טיפול",
};
/** a standing order is active when it charged within the last ~5 weeks, unless set by hand */
export function contactState(c: SOContact): SoState {
  if (c.status === "active" || c.status === "cancelled" || c.status === "attention")
    return c.status;
  if (c.growState) return c.growState;
  const last = c.runs
    .filter((r) => r.ok)
    .map((r) => r.date)
    .sort()
    .pop();
  return last && daysSince(last) <= STALE_DAYS ? "active" : "inactive";
}
const nextCharge = (c: SOContact) => {
  if (c.nextDate) return { date: c.nextDate, sum: c.nextSum ?? 0, net: (c.nextSum ?? 0) * 0.96 };
  const ok = c.runs.filter((r) => r.ok).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!ok) return null;
  const d = new Date(`${ok.date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { date: d.toISOString().slice(0, 10), sum: ok.sum, net: ok.net ?? ok.sum };
};

export function SoContactsTab() {
  const db = useDB();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"contacts" | "months">("months");
  const [flt, setFlt] = React.useState<"all" | "active" | "off">("all");

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const sheet = await readSheet(f);
      if (isOrdersTable(sheet)) {
        const r = actions.importGrowOrders(parseGrowOrders(sheet));
        toast.success(
          `עודכנו ${r.updated} אנשי קשר עם תאריך הקמה, חיוב הבא וסטטוס` +
            (r.created ? ` · ${r.created} חדשים (בלי ריצות עדיין)` : ""),
        );
        return;
      }
      const { rows, skipped } = parseGrowReport(sheet);
      if (!rows.length) {
        toast.error("לא נמצאו חיובי הוראת קבע בדוח");
        return;
      }
      const r = actions.importGrowRows(rows);
      toast.success(
        `יובאו ${r.added} ריצות` +
          (r.created ? ` · ${r.created} אנשי קשר חדשים` : "") +
          (r.linked ? ` · ${r.linked} קושרו לפרויקטים` : "") +
          (r.dup ? ` · ${r.dup} כבר היו` : "") +
          (skipped ? ` · ${skipped} שורות דולגו` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "לא הצלחתי לקרוא את הקובץ");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const all = db.soContacts.map((c) => ({ c, s: cStats(c) }));
  const list = all
    .filter(
      ({ c }) => !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()),
    )
    .filter(({ c }) => flt === "all" || (contactState(c) === "active") === (flt === "active"))
    .sort((a, b) => Number(!!a.c.projectId) - Number(!!b.c.projectId) || b.s.net - a.s.net);
  const tot = all.reduce(
    (t, { s }) => ({ ok: t.ok + s.ok, net: t.net + s.net, gross: t.gross + s.gross }),
    { ok: 0, net: 0, gross: 0 },
  );
  const unlinked = all.filter(({ c }) => !c.projectId).length;
  const activeList = all.filter(({ c }) => contactState(c) === "active");
  const monthly = activeList.reduce((t, { c }) => t + (nextCharge(c)?.net ?? 0), 0);

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">אנשי קשר של הוראות קבע</div>
            <p className="mt-0.5 text-sm text-[color:var(--focus-muted)]">
              מעלים דוח Grow (אקסל/CSV, אפשר מתחילת האחסון). כל משלם נשמר כאיש קשר עם הריצות והרווח
              שלו, וקושרים אותו לפרויקט — גם אם הפרויקט עוד לא קיים או שאיש הקשר שונה.
            </p>
          </div>
          <div className="flex gap-2">
            {unlinked > 0 && (
              <Btn
                variant="outline"
                onClick={() => {
                  const n = actions.autoLinkContacts();
                  toast(n ? `קושרו ${n} אנשי קשר` : "אין התאמה לפי טלפון/מייל");
                }}
              >
                קשר אוטומטית
              </Btn>
            )}
            <Btn
              variant="primary"
              icon={FileSpreadsheet}
              disabled={busy}
              onClick={() => ref.current?.click()}
            >
              {busy ? "קורא…" : "ייבוא דוח Grow"}
            </Btn>
          </div>
          <input
            ref={ref}
            type="file"
            hidden
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </div>
        {all.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["אנשי קשר", `${activeList.length} פעילות מתוך ${all.length}`],
                ["צפוי בחודש (נטו)", ils(monthly)],
                ["ריצות שעברו", String(tot.ok)],
                ["נגבה (ברוטו)", ils(tot.gross)],
                ["הרווחתי (נטו)", ils(tot.net)],
              ] as const
            ).map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[var(--focus-bg2)] px-3 py-2.5">
                <div className="text-xs text-[color:var(--focus-muted)]">{l}</div>
                <div className="text-lg font-bold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {all.length > 0 && (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "months", label: "לפי שנים וחודשים" },
            { value: "contacts", label: "לפי אנשי קשר" },
          ]}
        />
      )}

      {all.length > 0 && view === "months" ? (
        <SoMonths />
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSpreadsheet}
            title="עוד אין אנשי קשר של הוראות קבע"
            subtitle="ייבא דוח מ-Grow וכל מי שחויב יופיע כאן עם מספר הריצות והרווח ממנו"
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
          <div className="px-3 py-2">
            <Segmented
              value={flt}
              onChange={setFlt}
              options={[
                { value: "all", label: `הכל (${all.length})` },
                { value: "active", label: `פעילות (${activeList.length})` },
                { value: "off", label: `לא פעילות (${all.length - activeList.length})` },
              ]}
            />
          </div>
          {all.length > 8 && (
            <div className="px-3 py-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="חיפוש שם / טלפון / מייל"
                className="h-10 w-full rounded-lg border border-[color:var(--focus-border)] bg-transparent px-3 text-sm"
              />
            </div>
          )}
          {list.map(({ c, s }) => (
            <ContactRow key={c.id} c={c} s={s} />
          ))}
        </Card>
      )}
    </div>
  );
}

function ContactRow({ c, s }: { c: SOContact; s: ReturnType<typeof cStats> }) {
  const db = useDB();
  const nav = useNav();
  const p = db.projects.find((x) => x.id === c.projectId);
  const st = contactState(c);
  const next = nextCharge(c);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm">
      {p ? (
        <ProjectAvatar id={p.id} name={p.name} size={36} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:color-mix(in_oklab,var(--focus-warning)_14%,transparent)] text-[color:var(--focus-warning)]">
          <AlertTriangle className="size-4" />
        </span>
      )}
      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{c.name || c.email || c.phone || "ללא שם"}</span>
          <Badge
            color={st === "active" ? C.ok : st === "attention" ? C.warn : "var(--focus-muted)"}
          >
            {SO_STATE_LABEL[st]}
          </Badge>
          {s.bad > 0 && <Badge color={C.bad}>{s.bad} נכשלו</Badge>}
        </div>
        <div className="mt-0.5 text-xs text-[color:var(--focus-muted)]" dir="auto">
          {c.phone}
          {c.phone && c.email && " · "}
          {c.email}
        </div>
        <div className="mt-0.5 text-xs text-[color:var(--focus-muted)]">
          {s.ok} ריצות{(c.growStart || s.first) && ` · מאז ${fmtDate(c.growStart || s.first)}`}
          {s.last && ` · אחרונה ${fmtDate(s.last)}`}
          {st === "active" &&
            next &&
            ` · חיוב הבא ${c.nextDate ? "" : "משוער "}${fmtDate(next.date)}`}
        </div>
        {st === "attention" && c.lastPay && (
          <div className="mt-0.5 text-xs text-[color:var(--focus-destructive)]">{c.lastPay}</div>
        )}
      </div>
      <div className="text-end">
        <div className="font-bold tabular-nums">{ils(s.net)}</div>
        <div className="text-[11px] text-[color:var(--focus-muted)]">
          נטו · {ils(s.gross)} ברוטו
        </div>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-80">
        <div className="w-28 shrink-0">
          <Select
            value={c.status ?? "auto"}
            onChange={(v) => actions.patchContact(c.id, { status: v as SOContact["status"] })}
            options={["auto", "active", "attention", "cancelled"]}
            labels={{
              auto: "סטטוס: אוטומטי",
              active: "פעילה",
              attention: "נדרש טיפול",
              cancelled: "בוטלה",
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Select
            value={c.projectId}
            onChange={(pid) => actions.linkContact(c.id, pid)}
            options={["", ...db.projects.map((x) => x.id)]}
            labels={{
              "": "קשר לפרויקט…",
              ...Object.fromEntries(db.projects.map((x) => [x.id, x.name])),
            }}
          />
        </div>
        {p ? (
          <button
            onClick={() => nav.go("project", p.id)}
            className="shrink-0 text-xs font-semibold text-[color:var(--focus-muted)] hover:text-[color:var(--focus-primary)]"
          >
            פתח ›
          </button>
        ) : (
          <button
            onClick={() => confirm("למחוק את איש הקשר?") && actions.deleteContact(c.id)}
            className="shrink-0 text-xs text-[color:var(--focus-muted)] hover:text-[color:var(--focus-destructive)]"
          >
            מחק
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ by year / month ------------------------------ */
const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function SoMonths() {
  const db = useDB();
  const entries = allSORuns(db);
  const [openM, setOpenM] = React.useState<Record<string, boolean>>({});
  const years = new Map<string, Map<string, typeof entries>>();
  for (const e of entries) {
    const y = e.date.slice(0, 4);
    const m = e.date.slice(0, 7);
    const ym = years.get(y) ?? new Map();
    ym.set(m, [...(ym.get(m) ?? []), e]);
    years.set(y, ym);
  }
  const sum = (l: typeof entries) => {
    const ok = l.filter((e) => e.ok);
    return {
      n: ok.length,
      bad: l.length - ok.length,
      gross: ok.reduce((s, e) => s + e.sum, 0),
      net: ok.reduce((s, e) => s + e.net, 0),
    };
  };
  const projName = (id: string) => db.projects.find((p) => p.id === id)?.name;
  return (
    <div className="space-y-4">
      {[...years.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([y, months]) => {
          const t = sum([...months.values()].flat());
          return (
            <Card key={y} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--focus-bg2)] px-4 py-3">
                <div className="text-lg font-bold">{y}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <b>{t.n}</b> ריצות
                  </span>
                  <span>
                    ברוטו <b className="tabular-nums">{ils(t.gross)}</b>
                  </span>
                  <span>
                    נטו{" "}
                    <b className="tabular-nums text-[color:var(--focus-success)]">{ils(t.net)}</b>
                  </span>
                </div>
              </div>
              <div className="divide-y divide-[color:var(--focus-border)]">
                {[...months.entries()]
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([m, list]) => {
                    const s = sum(list);
                    const open = !!openM[m];
                    return (
                      <div key={m}>
                        <button
                          onClick={() => setOpenM((o) => ({ ...o, [m]: !o[m] }))}
                          className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-right text-sm hover:bg-[var(--focus-bg2)]"
                        >
                          <span className="w-20 font-semibold">
                            {MONTHS[Number(m.slice(5)) - 1]}
                          </span>
                          <span className="text-[color:var(--focus-muted)]">{s.n} ריצות</span>
                          {s.bad > 0 && <Badge color={C.bad}>{s.bad} נכשלו</Badge>}
                          <span className="ms-auto tabular-nums text-[color:var(--focus-muted)]">
                            ברוטו {ils(s.gross)}
                          </span>
                          <span className="font-bold tabular-nums">נטו {ils(s.net)}</span>
                          <span className="text-[color:var(--focus-muted)]">
                            {open ? "▴" : "▾"}
                          </span>
                        </button>
                        {open && (
                          <ul className="divide-y divide-[color:var(--focus-border)] bg-[var(--focus-bg2)]/50 px-4">
                            {list.map((e) => (
                              <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ background: e.ok ? C.ok : C.bad }}
                                />
                                <span className="w-20 tabular-nums">{fmtDate(e.date)}</span>
                                <span className="min-w-0 flex-1 truncate">
                                  {e.who}
                                  {projName(e.projectId) && (
                                    <span className="text-xs text-[color:var(--focus-muted)]">
                                      {" "}
                                      · {projName(e.projectId)}
                                    </span>
                                  )}
                                </span>
                                <span className="tabular-nums">{ils(e.sum)}</span>
                                <span className="w-20 text-end text-xs tabular-nums text-[color:var(--focus-muted)]">
                                  נטו {ils(e.net)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          );
        })}
    </div>
  );
}
