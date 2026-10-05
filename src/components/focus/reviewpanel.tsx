/**
 * Design review — the owner's tab in a project: make the client link, add the one line to the
 * site, see the client's notes (each is also a task), copy them for Claude, start a new round.
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  Check,
  ClipboardCopy,
  Code2,
  Download,
  ExternalLink,
  Laptop,
  Link2,
  MessageSquareText,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Trash2,
} from "lucide-react";
import { makeZip } from "./briefcore";
import { useCloud } from "./cloud";
import { C } from "./constants";
import { claudePrompt, scriptTag, sortNotes, VIEW_HE, whereText } from "./reviewcore";
import {
  authedReview,
  isFixed,
  newRound,
  pullReview,
  reviewLink,
  shotUrlOf,
  useShotUrls,
} from "./reviewsync";
import { actions, useDB } from "./store";
import type { Project, Review, ReviewComment } from "./types";
import { Badge, Btn, Card, EmptyState, Input } from "./ui";
import { timeAgo, waLink } from "./utils";

const copy = async (txt: string, ok = "הועתק") => {
  try {
    await navigator.clipboard.writeText(txt);
    toast.success(ok);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
};

const origin = () => (typeof location !== "undefined" ? location.origin : "");

export function ReviewTab({ p }: { p: Project }) {
  const db = useDB();
  const cloud = useCloud();
  const reviews = db.reviews.filter((r) => r.projectId === p.id);
  const [url, setUrl] = React.useState(p.url || "");

  if (cloud.enabled && !cloud.session)
    return (
      <Card>
        <EmptyState
          icon={Link2}
          title="צריך להיות מחובר לענן"
          subtitle="קישור משוב עובד דרך הענן."
        />
      </Card>
    );

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <ReviewCard key={r.id} r={r} p={p} />
      ))}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <MousePointerClick className="size-5" style={{ color: C.primary }} />
          {reviews.length ? "קישור משוב נוסף" : "משוב על העיצוב מהלקוח"}
        </div>
        <p className="mb-3 text-sm text-[color:var(--focus-muted)]">
          הלקוח רואה את האתר החי במחשב ובטלפון, לוחץ על מקום וכותב מה לשנות. כל הערה נכנסת כמשימה
          כאן.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            dir="ltr"
            className="min-w-60 flex-1"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Btn
            variant="primary"
            icon={Link2}
            disabled={!/^https?:\/\/[^\s.]+\.[^\s]+/.test(url.trim())}
            onClick={() => {
              const r = actions.createReview(p.id, url.trim());
              void copy(reviewLink(r.id), "הקישור ללקוח הועתק");
            }}
          >
            יצירת קישור ללקוח
          </Btn>
        </div>
        {url && !/^https?:\/\//.test(url.trim()) && (
          <p className="mt-2 text-xs" style={{ color: C.warn }}>
            הכתובת צריכה להתחיל ב-https://
          </p>
        )}
      </Card>
    </div>
  );
}

function ReviewCard({ r, p }: { r: Review; p: Project }) {
  const db = useDB();
  useShotUrls();
  const [loading, setLoading] = React.useState(false);
  const [showOld, setShowOld] = React.useState(false);
  const [showLine, setShowLine] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"" | "round" | "delete">("");
  const link = reviewLink(r.id);

  const pull = React.useCallback(
    async (quiet = false) => {
      setLoading(true);
      try {
        const n = await pullReview(r.id);
        if (!quiet) toast.success(n ? `${n} הערות חדשות נוספו כמשימות` : "אין הערות חדשות");
      } catch (e) {
        if (!quiet) toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [r.id],
  );
  React.useEffect(() => {
    void pull(true);
  }, [pull]);

  // is the line on the site, and can the site be shown inside the review page?
  const [site, setSite] = React.useState<{
    installed?: boolean;
    blocks?: boolean;
    why?: string;
    error?: string;
    busy?: boolean;
  }>({});
  const check = React.useCallback(async () => {
    setSite((x) => ({ ...x, busy: true }));
    try {
      const j = await authedReview("check", { url: r.url });
      setSite({ installed: !!j.installed, blocks: !!j.blocks, why: j.why || "" });
    } catch (e) {
      setSite({ error: (e as Error).message });
    }
  }, [r.url]);
  React.useEffect(() => {
    void check();
  }, [check]);

  React.useEffect(() => {
    actions.patchReview(r.id, { seenAt: Date.now() });
  }, [r.id, r.comments.length]);

  const cur = sortNotes(r.comments.filter((c) => c.round === r.round));
  const old = sortNotes(r.comments.filter((c) => c.round < r.round));
  const open = r.comments.filter((c) => !isFixed(db, c));
  const num = (c: ReviewComment) =>
    (c.round === r.round ? cur : old.filter((x) => x.round === c.round)).indexOf(c) + 1;
  const host = (() => {
    try {
      return new URL(r.url).host.replace(/^www\./, "");
    } catch {
      return r.url;
    }
  })();
  const usesLine = site.installed ?? r.comments.some((c) => c.mode === "live");
  const approved = r.approved && r.approved.round === r.round;

  const waMsg = `היי${p.client ? ` ${p.client.split(" ")[0]}` : ""}, האתר מוכן לצפייה 🙂\nבקישור אפשר לראות אותו במחשב ובטלפון, ולסמן כל מה שתרצו לשנות:\n${link}`;

  const zip = async () => {
    const id = toast.loading("מכין את החבילה…");
    try {
      await pullReview(r.id).catch(() => 0);
      const enc = new TextEncoder();
      const files: { name: string; data: Uint8Array }[] = [];
      const shots: Record<string, string> = {};
      let i = 0;
      for (const c of sortNotes(open)) {
        i++;
        const u = shotUrlOf(c.id);
        if (!u) continue;
        try {
          const res = await fetch(u);
          if (!res.ok) continue;
          const name = `shots/${i}.jpg`;
          files.push({ name, data: new Uint8Array(await res.arrayBuffer()) });
          shots[c.id] = name;
        } catch {
          /* skip this picture */
        }
      }
      files.unshift({ name: "prompt.md", data: enc.encode(claudePrompt(r, open, { shots })) });
      const blob = new Blob([makeZip(files) as Uint8Array<ArrayBuffer>], {
        type: "application/zip",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `תיקונים-${(r.projectName || host).replace(/[\\/:*?"<>|]+/g, "_")}-סבב${r.round}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success("החבילה ירדה", { id });
    } catch (e) {
      toast.error((e as Error).message, { id });
    }
  };

  const claudeLine = `תוסיף לאתר את השורה הבאה, ממש לפני </body> בקובץ ה-HTML הראשי (ב-Vite/Lovable זה index.html, ב-Next.js זה app/layout.tsx עם next/script). אל תשנה שום דבר אחר:\n\n${scriptTag(origin())}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <MessageSquareText className="size-5" style={{ color: C.primary }} />
            משוב על העיצוב
            <span className="text-sm font-normal text-[color:var(--focus-muted)]" dir="ltr">
              {host}
            </span>
            <Badge>סבב {r.round}</Badge>
            {approved ? (
              <Badge color={C.ok}>אושר על ידי {r.approved!.name}</Badge>
            ) : r.sentAt ? (
              <Badge color={C.primary}>הלקוח סיים · {timeAgo(r.sentAt)}</Badge>
            ) : cur.length ? (
              <Badge color={C.warn}>הלקוח באמצע</Badge>
            ) : (
              <Badge>עוד אין הערות</Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-[color:var(--focus-muted)]">
            {r.comments.length} הערות · {open.length} פתוחות
            {r.pulledAt ? ` · עודכן ${timeAgo(r.pulledAt)}` : ""}
          </div>
        </div>
        <Btn
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          disabled={loading}
          onClick={() => void pull()}
        >
          רענון
        </Btn>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn
          size="sm"
          variant="primary"
          icon={ClipboardCopy}
          onClick={() => void copy(link, "הקישור ללקוח הועתק")}
        >
          העתקת הקישור ללקוח
        </Btn>
        <a
          href={
            p.phone ? waLink(p.phone, waMsg) : `https://wa.me/?text=${encodeURIComponent(waMsg)}`
          }
          target="_blank"
          rel="noreferrer"
        >
          <Btn size="sm" icon={MessageSquareText}>
            שליחה בוואטסאפ
          </Btn>
        </a>
        <a href={link} target="_blank" rel="noreferrer">
          <Btn size="sm" icon={ExternalLink}>
            לראות כמו הלקוח
          </Btn>
        </a>
        <Btn size="sm" icon={Code2} onClick={() => setShowLine((v) => !v)}>
          {usesLine ? "השורה באתר" : "הוספת השורה לאתר"}
        </Btn>
      </div>

      {site.installed !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {site.installed ? (
            <Badge color={C.ok}>✓ השורה מותקנת באתר, סימון מדויק פעיל</Badge>
          ) : (
            <Badge color={C.warn}>השורה עוד לא באתר: הלקוח יסמן במיקום משוער</Badge>
          )}
          {site.blocks && (
            <Badge color={C.bad}>האתר חוסם הצגה בתוך דף אחר: הלקוח יקבל צילום במקום האתר החי</Badge>
          )}
          <button
            className="text-xs font-semibold text-[color:var(--focus-primary)] underline"
            disabled={site.busy}
            onClick={() => void check()}
          >
            {site.busy ? "בודק…" : "לבדוק שוב"}
          </button>
        </div>
      )}
      {site.blocks && (
        <p className="mt-2 text-xs text-[color:var(--focus-muted)]">
          כדי שהלקוח יראה את האתר החי, צריך לאפשר הצגה בתוך דף של FOCUS ({site.why}). ב-WordPress זה
          בדרך כלל תוסף אבטחה; אפשר לבקש מ-Claude: &quot;לאפשר הצגת האתר בתוך iframe מהכתובת{" "}
          {origin()}&quot;.
        </p>
      )}

      {(showLine || (site.installed === false && !r.comments.length)) && (
        <div className="mt-4 rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] p-4 text-sm">
          <div className="mb-1 font-semibold">סימון מדויק: שורה אחת באתר</div>
          <p className="mb-2 text-[color:var(--focus-muted)]">
            עם השורה, כל הערה נצמדת לאלמנט שהלקוח לחץ עליו ומגיעה עם צילום של מה שראה. בלי השורה
            הלקוח עדיין יכול להעיר, אבל המיקום משוער. השורה לא עושה כלום לגולשים רגילים.
          </p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-[var(--focus-card)] px-3 py-2 text-xs"
            >
              {scriptTag(origin())}
            </code>
            <Btn
              size="sm"
              icon={ClipboardCopy}
              onClick={() => void copy(scriptTag(origin()), "השורה הועתקה")}
            >
              העתקה
            </Btn>
          </div>
          <ul className="mt-3 space-y-1 text-[color:var(--focus-muted)]">
            <li>
              <b className="text-[color:var(--focus-foreground)]">Lovable / React:</b> בקובץ
              index.html, בסוף, לפני סגירת ה-body. הכי קל:{" "}
              <button
                className="font-semibold text-[color:var(--focus-primary)] underline"
                onClick={() => void copy(claudeLine, "הבקשה ל-Claude הועתקה")}
              >
                להעתיק בקשה ל-Claude
              </button>{" "}
              שיוסיף אותה.
            </li>
            <li>
              <b className="text-[color:var(--focus-foreground)]">Next.js:</b> בקובץ app/layout.tsx,
              דרך הרכיב Script. גם כאן אפשר לתת ל-Claude את הבקשה.
            </li>
            <li>
              <b className="text-[color:var(--focus-foreground)]">WordPress:</b> בתוסף החינמי
              WPCode, בהגדרות הכותרת והפוטר, להדביק בשדה של הפוטר ולשמור.
            </li>
          </ul>
        </div>
      )}

      {cur.length > 0 && (
        <div className="mt-5">
          <div className="mb-1 text-sm font-semibold">הערות בסבב הזה</div>
          <div className="divide-y divide-[color:var(--focus-border)]">
            {cur.map((c) => (
              <NoteLine key={c.id} r={r} c={c} n={num(c)} />
            ))}
          </div>
        </div>
      )}
      {old.length > 0 && (
        <div className="mt-4">
          <button
            className="text-sm font-semibold text-[color:var(--focus-muted)]"
            onClick={() => setShowOld((v) => !v)}
          >
            סבבים קודמים ({old.length}) {showOld ? "▴" : "▾"}
          </button>
          {showOld && (
            <div className="divide-y divide-[color:var(--focus-border)]">
              {[...old].reverse().map((c) => (
                <NoteLine key={c.id} r={r} c={c} n={num(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--focus-border)] pt-4">
        <Btn
          size="sm"
          variant="primary"
          icon={Bot}
          disabled={!open.length}
          onClick={() =>
            void copy(claudePrompt(r, open), `${open.length} תיקונים הועתקו. להדביק ל-Claude`)
          }
        >
          העתקה ל-Claude ({open.length})
        </Btn>
        <Btn size="sm" icon={Download} disabled={!open.length} onClick={() => void zip()}>
          חבילה עם צילומים
        </Btn>
        {confirm === "round" ? (
          <Btn
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              setConfirm("");
              newRound(r.id)
                .then(() => toast.success("התחיל סבב חדש. שלחו ללקוח את אותו קישור"))
                .catch((e) => toast.error((e as Error).message));
            }}
          >
            בטוח? סבב חדש
          </Btn>
        ) : (
          <Btn size="sm" icon={RotateCcw} onClick={() => setConfirm("round")}>
            סבב חדש אחרי תיקונים
          </Btn>
        )}
        <span className="flex-1" />
        {confirm === "delete" ? (
          <Btn
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => {
              actions.deleteReview(r.id);
            }}
          >
            למחוק? הקישור יפסיק לעבוד
          </Btn>
        ) : (
          <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirm("delete")}>
            מחיקת הקישור
          </Btn>
        )}
      </div>
    </Card>
  );
}

function NoteLine({ r, c, n }: { r: Review; c: ReviewComment; n: number }) {
  const db = useDB();
  const fixed = isFixed(db, c);
  const shot = shotUrlOf(c.id);
  return (
    <div className="flex items-start gap-3 py-3">
      <button
        aria-label={fixed ? "סמן כלא תוקן" : "סמן כתוקן"}
        onClick={() => actions.setReviewNoteDone(r.id, c.id, !fixed)}
        className="mt-0.5 grid size-7 flex-none place-items-center rounded-full border-2 text-xs font-bold"
        style={{
          borderColor: fixed ? C.ok : C.line,
          background: fixed ? C.ok : "transparent",
          color: fixed ? "#fff" : C.sub,
        }}
        title={fixed ? "תוקן" : "לסמן כתוקן"}
      >
        {fixed ? <Check className="size-4" /> : n}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="whitespace-pre-wrap break-words text-sm"
          style={{ textDecoration: fixed ? "line-through" : undefined, opacity: fixed ? 0.6 : 1 }}
        >
          {c.text}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--focus-muted)]">
          <span className="inline-flex items-center gap-1">
            {c.view === "mobile" ? (
              <Smartphone className="size-3.5" />
            ) : (
              <Laptop className="size-3.5" />
            )}
            {VIEW_HE[c.view]}
          </span>
          {c.path !== "/" && <span>{`\u2066${c.path}\u2069`}</span>}
          <span>· {whereText(c)}</span>
          {c.author && <span>· {c.author}</span>}
          <span>· {timeAgo(c.at)}</span>
          {c.mode !== "live" && (
            <Badge color={C.warn} className="text-[10px]">
              {c.mode === "shot" ? "על צילום" : "מיקום משוער"}
            </Badge>
          )}
        </div>
      </div>
      {shot && (
        <a href={shot} target="_blank" rel="noreferrer" className="flex-none">
          <img
            src={shot}
            alt=""
            className="h-14 w-20 rounded-lg border border-[color:var(--focus-border)] object-cover"
          />
        </a>
      )}
    </div>
  );
}
