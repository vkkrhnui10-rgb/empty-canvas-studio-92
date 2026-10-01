import * as React from "react";
import {
  Camera,
  ExternalLink,
  Globe,
  ImageUp,
  Monitor,
  RefreshCw,
  Smartphone,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { canCapture, captureShot, uploadShot } from "./shots";
import { cn } from "@/lib/utils";
import { C } from "./constants";
import { actions, projectSO, useDB } from "./store";
import type { Project, SiteCheck } from "./types";
import { Btn, Card, Field, IconBtn, Input, Select } from "./ui";

import { fmtDate, ils, timeAgo } from "./utils";

import { checkSite, normUrl } from "./sitecheck";

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

export function SoRuns({ p }: { p: Project }) {
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
          {so.runs.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
              {(i === 0 || so.runs[i - 1].date.slice(0, 7) !== r.date.slice(0, 7)) && (
                <div className="w-full pt-1 text-xs font-bold text-[color:var(--focus-primary)]">
                  {monthLabel(r.date)} ·{" "}
                  {so.runs.filter((x) => x.ok && x.date.slice(0, 7) === r.date.slice(0, 7)).length}{" "}
                  ריצות
                </div>
              )}
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
export function SiteCard({ p }: { p: Project }) {
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const c: SiteCheck | undefined = p.siteCheck;

  const run = React.useCallback(async () => {
    setBusy(true);
    const r = await checkSite(p.url);
    actions.recordSiteCheck(p.id, r);
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
      <ShotRow p={p} />
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

/** the stored homepage screenshot used on the project cards */
function ShotRow({ p }: { p: Project }) {
  const [busy, setBusy] = React.useState<"" | "shot" | "up">("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!canCapture()) return null;
  const shoot = async () => {
    setBusy("shot");
    const ok = await captureShot(p.id, p.url, true);
    setBusy("");
    if (ok) toast.success("צילום המסך עודכן");
    else toast.error("לא הצלחנו לצלם את האתר — אפשר להעלות צילום מסך משלך");
  };
  const upload = async (f: File) => {
    setBusy("up");
    const err = await uploadShot(p.id, f);
    setBusy("");
    if (err) toast.error(err);
    else toast.success("צילום המסך נשמר");
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[color:var(--focus-border)] pt-3">
      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md border border-[color:var(--focus-border)] bg-[var(--focus-bg2)]">
        {p.shot && <img src={p.shot.url} alt="" className="size-full object-cover object-top" />}
      </div>
      <div className="min-w-0 flex-1 text-xs text-[color:var(--focus-muted)]">
        <div className="font-medium text-[color:var(--focus-foreground)]">תמונת האתר בכרטיס</div>
        {busy === "shot"
          ? "מצלם… (עד חצי דקה)"
          : p.shot
            ? `צולם ${timeAgo(p.shot.at)}${p.shot.via === "upload" ? " · הועלה ידנית" : ""}`
            : "עוד אין צילום"}
      </div>
      <Btn size="sm" variant="soft" icon={Camera} disabled={!!busy} onClick={shoot}>
        צלם מחדש
      </Btn>
      <Btn
        size="sm"
        variant="ghost"
        icon={ImageUp}
        disabled={!!busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy === "up" ? "מעלה…" : "העלה צילום"}
      </Btn>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const HEB_MONTHS = [
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
const monthLabel = (d: string) => `${HEB_MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
