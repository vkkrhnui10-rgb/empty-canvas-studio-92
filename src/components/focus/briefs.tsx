/* ============================================================
 * אפיונים — website questionnaires sent to clients.
 * Create a link → the client answers on /b/<id> → the answers land here
 * with a ready prompt for Claude / ChatGPT and a ZIP of logo + photos.
 * ============================================================ */
import * as React from "react";
import {
  ArrowRight,
  ClipboardCopy,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { briefMarkdown, briefProgress, briefPrompt, emptyAnswers, makeZip } from "./briefcore";
import { WEBHOOK_BASE, useCloud } from "./cloud";
import { actions, getState, useDB } from "./store";
import type { Brief, BriefFile } from "./types";
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from "./ui";
import { useNav } from "./nav";
import { download, timeAgo, waLink } from "./utils";
import { C, LEAD_OPEN } from "./constants";

/* ---------------- links & sharing ---------------- */
const PUBLIC_ORIGIN = new URL(WEBHOOK_BASE).origin;
/** the published site (or a custom domain) — never the editor preview or localhost */
export function briefLink(id: string) {
  let origin = PUBLIC_ORIGIN;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const isPreview =
      h === "localhost" ||
      h.startsWith("127.") ||
      h.includes("lovableproject") ||
      h.startsWith("id-preview");
    if (!isPreview && window.location.protocol === "https:") origin = window.location.origin;
  }
  return `${origin}/b/${id}`;
}
const firstName = (s: string) => s.trim().split(/\s+/)[0] || "";
export const briefMessage = (b: Brief) =>
  `היי${firstName(b.client) ? ` ${firstName(b.client)}` : ""}, כדי שנתחיל לבנות את האתר הכנתי שאלון קצר (בערך 5 דקות).\n` +
  `לא צריך לנסח מושלם — רק לספר על העסק, ולהעלות לוגו ותמונות אם יש.\n${briefLink(b.id)}`;

const copy = async (txt: string, ok = "הועתק") => {
  try {
    await navigator.clipboard.writeText(txt);
    toast.success(ok);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
};

const nameOf = (b: Brief) => b.answers?.business || b.business || b.client || "ללא שם";

/* ---------------- server calls (signed-in owner) ---------------- */
async function authed(op: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("צריך להיות מחובר לענן");
  const r = await fetch(`/api/brief?op=${op}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "שגיאה בשרת");
  return j;
}

/** short-lived URLs for a brief's files (cached while the page is open) */
function useFileUrls(files: BriefFile[] | undefined) {
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [err, setErr] = React.useState("");
  const key = (files || []).map((f) => f.path).join("|");
  React.useEffect(() => {
    if (!key) return;
    let dead = false;
    authed("files", { paths: key.split("|") })
      .then((j: { files: { path: string; url: string }[] }) => {
        if (!dead) setUrls(Object.fromEntries(j.files.map((f) => [f.path, f.url])));
      })
      .catch((e) => !dead && setErr((e as Error).message));
    return () => {
      dead = true;
    };
  }, [key]);
  return { urls, err };
}

async function downloadZip(b: Brief) {
  const files = b.files || [];
  const id = toast.loading(files.length ? `מכין ZIP (${files.length} קבצים)…` : "מכין ZIP…");
  try {
    const signed: Record<string, string> = files.length
      ? Object.fromEntries(
          (
            (await authed("files", { paths: files.map((f) => f.path) })).files as {
              path: string;
              url: string;
            }[]
          ).map((f) => [f.path, f.url]),
        )
      : {};
    const enc = new TextEncoder();
    const out: { name: string; data: Uint8Array }[] = [
      { name: "סיכום-אפיון.md", data: enc.encode(briefPrompt(b)) },
    ];
    let n = 0,
      failed = 0;
    for (const f of files) {
      const url = signed[f.path];
      if (!url) {
        failed++;
        continue;
      }
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error();
        const data = new Uint8Array(await r.arrayBuffer());
        const clean = f.name.replace(/[\\/:*?"<>|]+/g, "_");
        out.push({
          name:
            f.kind === "logo"
              ? `logo/${clean}`
              : `${f.kind === "review" ? "reviews" : "images"}/${String(++n).padStart(2, "0")}-${clean}`,
          data,
        });
        toast.loading(`מוריד קבצים… ${out.length - 1}/${files.length}`, { id });
      } catch {
        failed++;
      }
    }
    const zip = makeZip(out);
    const blob = new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `אפיון-${nameOf(b).replace(/[\\/:*?"<>|]+/g, "_")}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (failed) toast.warning(`ה-ZIP ירד, אבל ${failed} קבצים לא נמצאו`, { id });
    else toast.success("ה-ZIP ירד", { id });
  } catch (e) {
    toast.error((e as Error).message, { id });
  }
}

/* ============================ list ============================ */
export function BriefsView({ openId }: { openId?: string | null }) {
  const db = useDB();
  const cloud = useCloud();
  const nav = useNav();
  const [creating, setCreating] = React.useState(false);
  const open = openId ? db.briefs.find((b) => b.id === openId) : undefined;
  if (open) return <BriefDetail b={open} />;

  const briefs = db.briefs
    .slice()
    .sort((a, b) => (b.submittedAt || b.created) - (a.submittedAt || a.created));
  const fresh = briefs.filter((b) => b.status === "done" && !b.seenAt).length;

  return (
    <div>
      <PageHeader
        title="אפיונים"
        subtitle={
          fresh
            ? `${fresh} ${fresh === 1 ? "אפיון חדש מולא" : "אפיונים חדשים מולאו"}`
            : "שאלון ללקוח: הוא עונה, אתה מקבל סיכום, פרומפט ו-ZIP של התמונות"
        }
        actions={
          <Btn variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            אפיון חדש
          </Btn>
        }
      />
      {!cloud.session && (
        <Card className="mb-4 p-4 text-sm">
          האפיונים עובדים רק כשמחוברים לענן — כך הלקוח יכול לפתוח את הקישור והתשובות מגיעות אליך.
        </Card>
      )}
      {!briefs.length ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="עוד לא שלחת אפיון"
            subtitle="צור קישור, שלח ללקוח בוואטסאפ, וכשהוא מסיים תקבל כאן את כל התשובות, הלוגו והתמונות."
            action={
              <Btn variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                אפיון חדש
              </Btn>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {briefs.map((b) => (
            <BriefCard key={b.id} b={b} onOpen={() => nav.go("briefs", b.id)} />
          ))}
        </div>
      )}
      <NewBriefModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function BriefCard({ b, onOpen }: { b: Brief; onOpen: () => void }) {
  const done = b.status === "done";
  const fresh = done && !b.seenAt;
  const logo = b.files?.find((f) => f.kind === "logo");
  const imgs = b.files?.filter((f) => f.kind === "image").length || 0;
  const colors = b.answers?.colorMode !== "you" ? b.answers?.colors || [] : [];
  return (
    <Card hi={fresh} onClick={onOpen} className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-bold">{nameOf(b)}</div>
          {b.client && b.client !== nameOf(b) && (
            <div className="truncate text-[13px] text-[color:var(--focus-muted)]">{b.client}</div>
          )}
        </div>
        <Badge color={fresh ? C.ok : done ? C.sub : C.warn}>
          {fresh ? "חדש — מולא" : done ? "מולא" : "ממתין ללקוח"}
        </Badge>
      </div>
      {done ? (
        <div className="flex items-center gap-3 text-[13px] text-[color:var(--focus-muted)]">
          {colors.length > 0 && (
            <span className="flex">
              {colors.slice(0, 5).map((c) => (
                <i
                  key={c}
                  className="-ms-1.5 size-5 rounded-full border-2 border-[color:var(--focus-card)] first:ms-0"
                  style={{ background: c }}
                />
              ))}
            </span>
          )}
          <span>{logo ? "יש לוגו" : "בלי לוגו"}</span>
          <span>{imgs ? `${imgs} תמונות` : "בלי תמונות"}</span>
          <span className="ms-auto">{timeAgo(b.submittedAt || b.created)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-[13px] text-[color:var(--focus-muted)]">
          <span>נשלח {timeAgo(b.created)}</span>
          <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Btn
              size="sm"
              variant="ghost"
              icon={Link2}
              onClick={() => copy(briefLink(b.id), "הקישור הועתק")}
            >
              קישור
            </Btn>
          </span>
        </div>
      )}
      {done && (
        <div
          className="h-1 overflow-hidden rounded-full bg-[var(--focus-bg2)]"
          title="כמה מהשאלון מולא"
        >
          <div
            className="h-full rounded-full bg-[var(--focus-primary)]"
            style={{ width: `${Math.round(briefProgress(b.answers) * 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

/* ============================ create ============================ */
export function NewBriefModal({
  open,
  onClose,
  leadId,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: string;
  projectId?: string;
}) {
  const db = useDB();
  const [client, setClient] = React.useState("");
  const [business, setBusiness] = React.useState("");
  const [link, setLink] = React.useState(""); // "lead:<id>" | "project:<id>" | ""
  const [made, setMade] = React.useState<Brief | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setMade(null);
    const l = leadId ? db.leads.find((x) => x.id === leadId) : undefined;
    const p = projectId ? db.projects.find((x) => x.id === projectId) : undefined;
    setClient(l?.name || p?.client || "");
    setBusiness(l?.business || p?.name || "");
    setLink(l ? `lead:${l.id}` : p ? `project:${p.id}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = [
    "",
    ...db.leads
      .filter((l) => LEAD_OPEN.includes(l.stage) || l.id === leadId)
      .map((l) => `lead:${l.id}`),
    ...db.projects
      .filter((p) => p.status === "אפיון" || p.status === "בבנייה" || p.id === projectId)
      .map((p) => `project:${p.id}`),
  ];
  const labels: Record<string, string> = { "": "בלי שיוך" };
  for (const l of db.leads)
    labels[`lead:${l.id}`] = `ליד: ${l.name}${l.business ? ` (${l.business})` : ""}`;
  for (const p of db.projects) labels[`project:${p.id}`] = `פרויקט: ${p.name}`;

  const pick = (v: string) => {
    setLink(v);
    const [kind, id] = v.split(":");
    if (kind === "lead") {
      const l = db.leads.find((x) => x.id === id);
      if (l) {
        if (!client) setClient(l.name);
        if (!business) setBusiness(l.business);
      }
    }
    if (kind === "project") {
      const p = db.projects.find((x) => x.id === id);
      if (p) {
        if (!client) setClient(p.client);
        if (!business) setBusiness(p.name);
      }
    }
  };

  const create = () => {
    const [kind, id] = link.split(":");
    const b = actions.createBrief({
      client,
      business,
      leadId: kind === "lead" ? id : undefined,
      projectId: kind === "project" ? id : undefined,
    });
    setMade(b);
  };

  const phone = (() => {
    if (!made) return "";
    if (made.leadId) return db.leads.find((l) => l.id === made.leadId)?.phone || "";
    if (made.projectId) return db.projects.find((p) => p.id === made.projectId)?.phone || "";
    return "";
  })();

  return (
    <Modal open={open} onClose={onClose} title={made ? "הקישור מוכן" : "אפיון חדש"}>
      {!made ? (
        <div className="space-y-4">
          <Field label="שייך ל־">
            <Select value={link} onChange={pick} options={options} labels={labels} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם הלקוח">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="דנה כהן"
                autoFocus
              />
            </Field>
            <Field label="שם העסק" hint="הלקוח יכול לתקן">
              <Input value={business} onChange={(e) => setBusiness(e.target.value)} />
            </Field>
          </div>
          <Btn
            variant="primary"
            className="w-full"
            disabled={!client.trim() && !business.trim()}
            onClick={create}
          >
            צור קישור
          </Btn>
        </div>
      ) : (
        <ShareBox b={made} phone={phone} onDone={onClose} />
      )}
    </Modal>
  );
}

function ShareBox({ b, phone, onDone }: { b: Brief; phone: string; onDone?: () => void }) {
  const msg = briefMessage(b);
  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-[var(--focus-bg2)] p-2.5">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-[13px]">
          {briefLink(b.id)}
        </code>
        <Btn
          size="sm"
          variant="soft"
          icon={ClipboardCopy}
          onClick={() => copy(briefLink(b.id), "הקישור הועתק")}
        >
          העתק
        </Btn>
      </div>
      <div className="rounded-lg border border-[color:var(--focus-border)] p-3 text-[14px] [overflow-wrap:anywhere] whitespace-pre-line text-[color:var(--focus-muted)]">
        {msg}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn
          variant="primary"
          icon={MessageCircle}
          className="flex-1"
          onClick={() =>
            window.open(
              phone ? waLink(phone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`,
              "_blank",
            )
          }
        >
          שלח בוואטסאפ
        </Btn>
        <Btn variant="outline" icon={ClipboardCopy} onClick={() => copy(msg, "ההודעה הועתקה")}>
          העתק הודעה
        </Btn>
        <Btn
          variant="ghost"
          icon={ExternalLink}
          onClick={() => window.open(briefLink(b.id), "_blank")}
        >
          תצוגה
        </Btn>
      </div>
      {onDone && (
        <Btn variant="ghost" className="w-full" onClick={onDone}>
          סגירה
        </Btn>
      )}
    </div>
  );
}

/* ============================ detail ============================ */
function BriefDetail({ b }: { b: Brief }) {
  const nav = useNav();
  const done = b.status === "done";
  const a = { ...emptyAnswers(), ...(b.answers || {}) };
  const { urls, err } = useFileUrls(done ? b.files : undefined);
  const logo = b.files?.find((f) => f.kind === "logo");
  const imgs = b.files?.filter((f) => f.kind === "image") || [];
  const shots = b.files?.filter((f) => f.kind === "review") || [];
  const reviews = a.testimonials.filter((t) => t.text.trim());

  React.useEffect(() => {
    if (done && !b.seenAt) actions.patchBrief(b.id, { seenAt: Date.now() });
  }, [done, b.id, b.seenAt]);

  const remove = () => {
    const id = b.id;
    actions.deleteBrief(id);
    nav.go("briefs");
    // the files go too, unless the delete was undone
    setTimeout(() => {
      if (!getState().briefs.some((x) => x.id === id)) authed("purge", { b: id }).catch(() => {});
    }, 12000);
  };

  const toProject = () => {
    const pid = actions.briefToProject(b.id);
    if (pid) nav.go("project", pid);
  };

  const phone = b.leadId ? getState().leads.find((l) => l.id === b.leadId)?.phone || "" : "";

  return (
    <div>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
        onClick={() => nav.go("briefs")}
      >
        <ArrowRight className="size-4" /> כל האפיונים
      </button>
      <PageHeader
        title={nameOf(b)}
        subtitle={
          done
            ? `מולא ${timeAgo(b.submittedAt || b.created)}${a.contactName ? ` על ידי ${a.contactName}` : ""}`
            : `נשלח ${timeAgo(b.created)} — ממתין ללקוח`
        }
        actions={
          done ? (
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="primary"
                icon={ClipboardCopy}
                onClick={() => copy(briefPrompt(b), "הפרומפט הועתק — הדבק ב-Claude או ב-ChatGPT")}
              >
                העתק ל-Claude / GPT
              </Btn>
              <Btn variant="outline" icon={Download} onClick={() => downloadZip(b)}>
                הורד ZIP
              </Btn>
            </div>
          ) : undefined
        }
      />

      {!done ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="p-5">
            <h3 className="mb-3 font-bold">שליחה ללקוח</h3>
            <ShareBox b={b} phone={phone} />
          </Card>
          <Card className="space-y-2 p-5 text-sm">
            <p className="text-[color:var(--focus-muted)]">
              כשהלקוח ישלח את השאלון תקבל התראה, והתשובות יופיעו כאן.
            </p>
            <Btn variant="danger" icon={Trash2} className="w-full" onClick={remove}>
              מחק את האפיון (הקישור יפסיק לעבוד)
            </Btn>
          </Card>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Section title="העסק">
              <Row l="במשפט אחד" v={a.tagline} />
              <Row l="קהל יעד" v={a.audience} />
              <Row l="מטרות האתר" v={a.goals.join(" • ")} />
              <Row l="איש קשר" v={a.contactName || b.client} />
            </Section>
            {(a.about.trim() || a.unique.trim()) && (
              <Section title="אודות">
                {a.about.trim() && <p className="whitespace-pre-line">{a.about.trim()}</p>}
                {a.unique.trim() && (
                  <p className="mt-3 whitespace-pre-line">
                    <b>מה מייחד אותם: </b>
                    {a.unique.trim()}
                  </p>
                )}
              </Section>
            )}
            {a.services.some((s) => s.name.trim() || s.desc.trim()) && (
              <Section title="שירותים">
                <ul className="space-y-2">
                  {a.services
                    .filter((s) => s.name.trim() || s.desc.trim())
                    .map((s, i) => (
                      <li key={i}>
                        <b>{s.name || "ללא שם"}</b>
                        {s.desc && (
                          <span className="text-[color:var(--focus-muted)]"> — {s.desc}</span>
                        )}
                      </li>
                    ))}
                </ul>
              </Section>
            )}
            {(a.sites.some((s) => s.url.trim()) || a.avoid.trim()) && (
              <Section title="השראה">
                <ul className="space-y-1.5">
                  {a.sites
                    .filter((s) => s.url.trim())
                    .map((s, i) => (
                      <li key={i}>
                        <a
                          href={/^https?:/i.test(s.url) ? s.url : `https://${s.url}`}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                          className="font-medium text-[color:var(--focus-primary)] underline underline-offset-2"
                        >
                          {s.url}
                        </a>
                        {s.note && (
                          <span className="text-[color:var(--focus-muted)]"> — {s.note}</span>
                        )}
                      </li>
                    ))}
                </ul>
                <Row l="לא רוצים" v={a.avoid} />
              </Section>
            )}
            <Section title={`תמונות${imgs.length ? ` (${imgs.length})` : ""}`}>
              {imgs.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {imgs.map((f) => (
                    <a
                      key={f.path}
                      href={urls[f.path]}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-lg bg-[var(--focus-bg2)]"
                    >
                      {urls[f.path] && (
                        <img
                          src={urls[f.path]}
                          alt={f.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[color:var(--focus-muted)]">
                  {a.noPhotos ? "אין תמונות — ביקשו שנשתמש בתמונות מקצועיות" : "לא הועלו תמונות"}
                </p>
              )}
              {err && <p className="mt-2 text-xs text-[color:var(--focus-destructive)]">{err}</p>}
              <Row l="קישור לתמונות" v={a.photosLink} link />
            </Section>
            {(reviews.length > 0 || shots.length > 0) && (
              <Section title={`המלצות לקוחות (${reviews.length + shots.length})`}>
                {reviews.length > 0 && (
                  <ul className="space-y-3">
                    {reviews.map((t, i) => (
                      <li key={i} className="border-s-2 border-[color:var(--focus-border)] ps-3">
                        <p className="whitespace-pre-line">{t.text}</p>
                        {t.name.trim() && (
                          <p className="mt-0.5 text-[13px] text-[color:var(--focus-muted)]">
                            {t.name}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {shots.length > 0 && (
                  <div
                    className={cn(
                      "grid grid-cols-3 gap-2 sm:grid-cols-4",
                      reviews.length > 0 && "mt-4",
                    )}
                  >
                    {shots.map((f) => (
                      <a
                        key={f.path}
                        href={urls[f.path]}
                        target="_blank"
                        rel="noreferrer"
                        className="aspect-[3/4] overflow-hidden rounded-lg bg-[var(--focus-bg2)]"
                      >
                        {urls[f.path] && (
                          <img
                            src={urls[f.path]}
                            alt={f.name}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </Section>
            )}
            <Section title="פרטי קשר לאתר">
              <Row l="טלפון" v={a.phone} ltr />
              <Row l="וואטסאפ" v={a.whatsapp} ltr />
              <Row l="מייל" v={a.email} ltr />
              <Row l="כתובת" v={a.address} />
              <Row l="שעות" v={a.hours} />
              <Row l="רשתות" v={a.social} />
              <Row l="דומיין" v={a.domain} ltr />
            </Section>
            {a.notes.trim() && (
              <Section title="הערות">
                <p className="whitespace-pre-line">{a.notes}</p>
              </Section>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <Card className="space-y-3 p-4">
              <h3 className="font-bold">מראה</h3>
              {logo && (
                <a
                  href={urls[logo.path]}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-24 place-items-center rounded-lg"
                  style={{
                    background: "repeating-conic-gradient(#eef0eb 0 25%,#fff 0 50%) 0 0/14px 14px",
                  }}
                >
                  {urls[logo.path] && (
                    <img
                      src={urls[logo.path]}
                      alt="לוגו"
                      className="max-h-20 max-w-[85%] object-contain"
                    />
                  )}
                </a>
              )}
              {a.colorMode === "you" ? (
                <p className="text-sm text-[color:var(--focus-muted)]">את הצבעים השאירו לך לבחור</p>
              ) : a.colors.length ? (
                <div className="flex flex-wrap gap-2">
                  {a.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => copy(c, `${c} הועתק`)}
                      className="flex items-center gap-1.5 rounded-full border border-[color:var(--focus-border)] py-1 ps-1 pe-2.5 text-xs font-medium"
                      dir="ltr"
                    >
                      <i className="size-5 rounded-full" style={{ background: c }} />
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
              <Row l="סגנון" v={a.styles.join(" • ")} />
              <Row l="הערות" v={a.styleNote} />
            </Card>
            <Card className="space-y-2 p-4">
              <Btn
                variant="soft"
                icon={FileText}
                className="w-full"
                onClick={() => download(`אפיון-${nameOf(b)}.md`, briefPrompt(b), "text/markdown")}
              >
                הורד סיכום (.md)
              </Btn>
              <Btn
                variant="soft"
                icon={ClipboardCopy}
                className="w-full"
                onClick={() => copy(briefMarkdown(b), "הסיכום הועתק")}
              >
                העתק סיכום בלבד
              </Btn>
              {b.projectId && getState().projects.some((p) => p.id === b.projectId) ? (
                <Btn
                  variant="soft"
                  icon={FolderKanban}
                  className="w-full"
                  onClick={() => nav.go("project", b.projectId)}
                >
                  פתח את הפרויקט
                </Btn>
              ) : (
                <Btn variant="soft" icon={FolderKanban} className="w-full" onClick={toProject}>
                  צור פרויקט מהאפיון
                </Btn>
              )}
              <Btn
                variant="ghost"
                icon={Link2}
                className="w-full"
                onClick={() => copy(briefLink(b.id), "הקישור הועתק")}
              >
                העתק קישור (הלקוח יכול לעדכן)
              </Btn>
              <Btn
                variant="ghost"
                icon={Trash2}
                className="w-full text-[color:var(--focus-destructive)]"
                onClick={remove}
              >
                מחק אפיון וקבצים
              </Btn>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 text-[15px] leading-relaxed">
      <h3 className="mb-3 font-bold">{title}</h3>
      {children}
    </Card>
  );
}

function Row({ l, v, ltr, link }: { l: string; v?: string; ltr?: boolean; link?: boolean }) {
  if (!v?.trim()) return null;
  return (
    <div className="flex gap-2 py-0.5 text-[14px]">
      <span className="w-24 flex-none text-[color:var(--focus-muted)]">{l}</span>
      {link ? (
        <a
          href={v}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="min-w-0 truncate text-[color:var(--focus-primary)] underline"
        >
          {v}
        </a>
      ) : (
        <span className="min-w-0 whitespace-pre-line" dir={ltr ? "ltr" : undefined}>
          {v}
        </span>
      )}
    </div>
  );
}
