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
import { actions, replaceFromRemote, useDB } from "./store";
import type { GrowEntry } from "./types";
import { Badge, Btn, Card, EmptyState, Modal, ProjectAvatar, Select } from "./ui";
import { parseGrowReport, type ReportRow } from "./growreport";
import { readSheet } from "./xlsx";
import { useNav } from "./nav";
import { ils, timeAgo } from "./utils";

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

/* ------------------------------ settings: import a Grow report ------------------------------ */
interface ImportResult {
  added: number;
  dup: number;
  skipped: number;
  ignored: number;
  unmatched: ReportRow[];
}

export function GrowImportCard() {
  const db = useDB();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<ImportResult | null>(null);
  const [open, setOpen] = React.useState(false);

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const { rows, skipped } = parseGrowReport(await readSheet(f));
      if (!rows.length) {
        toast.error("לא נמצאו חיובי הוראת קבע בדוח");
        return;
      }
      const r = actions.importGrowRows(rows);
      setRes({ ...r, skipped });
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "לא הצלחתי לקרוא את הקובץ");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const assign = (r: ReportRow, pid: string) => {
    if (!pid) return;
    actions.importRowTo(r, pid);
    setRes((x) =>
      x ? { ...x, unmatched: x.unmatched.filter((u) => u.key !== r.key), added: x.added + 1 } : x,
    );
  };

  return (
    <Card className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <FileSpreadsheet className="size-[18px] text-[color:var(--focus-primary)]" />
        ייבוא דוח Grow (היסטוריה)
      </h2>
      <p className="text-sm text-[color:var(--focus-muted)]">
        מעלים דוח חודשי מ-Grow (אקסל או CSV). כל חיוב הוראת קבע נרשם בהיסטוריה של הפרויקט המתאים לפי
        טלפון או מייל, ותאריך תחילת ההוראה מתעדכן. אפשר להעלות כמה חודשים, והעלאה כפולה לא תיצור
        כפילויות.
      </p>
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
      <Btn
        variant="primary"
        icon={FileSpreadsheet}
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? "קורא…" : "בחר קובץ דוח"}
      </Btn>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="הדוח יובא"
        description="סיכום הייבוא"
      >
        {res && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--focus-bg2)] p-3">
                <div className="text-2xl font-bold text-[color:var(--focus-success)]">
                  {res.added}
                </div>
                <div className="text-xs text-[color:var(--focus-muted)]">ריצות נוספו</div>
              </div>
              <div className="rounded-xl bg-[var(--focus-bg2)] p-3">
                <div className="text-2xl font-bold">{res.dup}</div>
                <div className="text-xs text-[color:var(--focus-muted)]">כבר היו</div>
              </div>
              <div className="rounded-xl bg-[var(--focus-bg2)] p-3">
                <div
                  className="text-2xl font-bold"
                  style={{ color: res.unmatched.length ? C.warn : undefined }}
                >
                  {res.unmatched.length}
                </div>
                <div className="text-xs text-[color:var(--focus-muted)]">לא זוהו</div>
              </div>
            </div>
            {res.ignored > 0 && (
              <p className="text-xs text-[color:var(--focus-muted)]">
                {res.ignored} חיובים של לקוחות ברשימת ההתעלמות לא נספרו.
              </p>
            )}
            {res.skipped > 0 && (
              <p className="text-xs text-[color:var(--focus-muted)]">
                {res.skipped} שורות אחרות בדוח (זיכויים, עמלות, סיכומים) לא נספרו.
              </p>
            )}
            {res.unmatched.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    לא זוהו לפי טלפון/מייל — שייך, או התעלם (לקוחות שהסתיימו):
                  </div>
                  <Btn
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      actions.ignoreGrowRows(res.unmatched);
                      setRes((x) =>
                        x ? { ...x, ignored: x.ignored + x.unmatched.length, unmatched: [] } : x,
                      );
                    }}
                  >
                    התעלם מכולם
                  </Btn>
                </div>
                <div className="max-h-72 space-y-2 overflow-auto">
                  {res.unmatched.map((r) => (
                    <div
                      key={r.key}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--focus-border)] p-2.5 text-sm"
                    >
                      <div className="min-w-32 flex-1">
                        <div className="font-semibold">{r.name || r.email || r.phone}</div>
                        <div className="text-xs text-[color:var(--focus-muted)]">
                          {r.date} · {ils(r.sum)}
                        </div>
                      </div>
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          actions.ignoreGrowRows([r]);
                          setRes((x) =>
                            x
                              ? {
                                  ...x,
                                  ignored: x.ignored + 1,
                                  unmatched: x.unmatched.filter((u) => u.key !== r.key),
                                }
                              : x,
                          );
                        }}
                      >
                        התעלם
                      </Btn>
                      <div className="w-full sm:w-48">
                        <Select
                          value=""
                          onChange={(pid) => assign(r, pid)}
                          options={["", ...db.projects.map((x) => x.id)]}
                          labels={{
                            "": "שייך לפרויקט…",
                            ...Object.fromEntries(db.projects.map((x) => [x.id, x.name])),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Btn variant="primary" className="w-full" onClick={() => setOpen(false)}>
              סגור
            </Btn>
          </div>
        )}
      </Modal>
    </Card>
  );
}
