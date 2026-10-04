/* ============================================================
 * The client's website questionnaire (public page /b/<id>).
 * Nine short steps, mostly taps. Everything autosaves on this
 * device and on the server (continue on any device); files upload
 * in the background — from the phone, from files / Drive, or by
 * pasting a Google Drive link.
 * ============================================================ */
import * as React from "react";
import {
  ACTIONS,
  cleanAnswers,
  DEADLINES,
  emptyAnswers,
  FEATURES,
  HIGHLIGHTS,
  PAGES,
  STYLES,
  TONES,
} from "@/components/focus/briefcore";
import { driveThumb } from "@/components/focus/drive";
import type { BriefAnswers } from "@/components/focus/types";
import {
  driveCopy,
  driveFetch,
  driveList,
  isPhoto,
  preparePhoto,
  readLogo,
  uploadFile,
  type Kind,
} from "./media";
import { BRIEF_CSS } from "./style";

interface UFile {
  key: string;
  name: string;
  kind: Kind;
  size: number;
  type: string;
  status: "up" | "done" | "err";
  prog: number;
  path?: string;
  thumb?: string;
  err?: string;
  /** Google Drive file id, when it came from a Drive link */
  drive?: string;
}
interface Saved {
  answers: BriefAnswers;
  files: UFile[];
  step: number;
  sent?: number;
  palette?: string[];
  at?: number;
}
interface ServerDraft {
  at: number;
  step: number;
  answers: BriefAnswers;
  files: Omit<UFile, "key" | "status" | "prog">[];
}
interface Info {
  client: string;
  business: string;
  owner: string;
  status: string;
  answers: BriefAnswers | null;
  draft: ServerDraft | null;
}

const STEPS = [
  { k: "intro", t: "", h: "" },
  { k: "biz", t: "העסק", h: "כמה מילים על מה שאתם עושים ולמי." },
  { k: "site", t: "האתר", h: "מה האתר צריך לעשות בשבילכם. מסמנים בלחיצה." },
  { k: "story", t: "אודות", h: "הבסיס לעמוד האודות. כתבו או הקליטו חופשי, אנחנו נלטש." },
  { k: "services", t: "שירותים", h: "מה אפשר לקנות או להזמין מכם. שם קצר ומשפט הסבר מספיקים." },
  { k: "look", t: "מראה", h: "אם יש לוגו, נשאב ממנו את הצבעים של האתר." },
  { k: "inspo", t: "השראה", h: "אתרים שאהבתם, גם מתחומים אחרים, ומה בטוח לא." },
  { k: "photos", t: "תמונות", h: "של העסק, העבודות, הצוות. אנחנו נבחר ונעבד אותן." },
  {
    k: "reviews",
    t: "המלצות",
    h: "מה לקוחות אומרים עליכם. המלצות אמיתיות הן אחד הדברים שהכי משפיעים באתר.",
  },
  { k: "contact", t: "פרטי התקשרות", h: "מה יופיע באתר כדי שלקוחות יוכלו לפנות אליכם." },
] as const;
const LAST = STEPS.length - 1;
const stepOf = (k: (typeof STEPS)[number]["k"]) => STEPS.findIndex((s) => s.k === k);

const keyOf = (id: string) => `focus-brief-${id}`;
const rid = () => Math.random().toString(36).slice(2, 10);
const first = (s: string) => s.trim().split(/\s+/)[0] || "";

function load(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(keyOf(id));
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return {
      ...s,
      answers: cleanAnswers(s.answers),
      files: (s.files || []).filter((f) => f.status === "done"),
    };
  } catch {
    return null;
  }
}

const draftBody = (a: BriefAnswers, files: UFile[], step: number) =>
  JSON.stringify({
    answers: a,
    step,
    files: files
      .filter((f) => f.status === "done" && f.path)
      .map((f) => ({
        path: f.path,
        name: f.name,
        kind: f.kind,
        size: f.size,
        type: f.type,
        drive: f.drive,
      })),
  });

/* ---------- phone helpers ---------- */
/** the on-screen keyboard is open (the fixed bottom bar would cover the field) */
function useKeyboardOpen() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", on);
    return () => vv.removeEventListener("resize", on);
  }, []);
  return open;
}

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const speechCtor = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition || w.webkitSpeechRecognition) as new () => Rec) || null;
};

/** Enter in a one-line field moves to the next field instead of doing nothing */
const nextField = (e: React.KeyboardEvent<HTMLElement>) => {
  const t = e.target as HTMLElement;
  if (e.key !== "Enter" || t.tagName !== "INPUT") return;
  const type = (t as HTMLInputElement).type;
  if (type === "checkbox" || type === "radio" || type === "file") return;
  e.preventDefault();
  const all = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("input.bf-in, textarea.bf-in"),
  );
  const next = all[all.indexOf(t) + 1];
  if (next) next.focus();
  else t.blur();
};

export default function BriefPage({ id }: { id: string }) {
  const [info, setInfo] = React.useState<Info | null>(null);
  const [fail, setFail] = React.useState<"" | "missing" | "net">("");
  const [a, setA] = React.useState<BriefAnswers>(emptyAnswers);
  const [files, setFiles] = React.useState<UFile[]>([]);
  const [palette, setPalette] = React.useState<string[]>([]);
  const [step, setStep] = React.useState(0);
  const [sent, setSent] = React.useState<number | undefined>();
  const [sending, setSending] = React.useState(false);
  const [sendErr, setSendErr] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [saved, setSaved] = React.useState<"" | "saving" | "saved">("");
  const raw = React.useRef(new Map<string, Blob>());
  const synced = React.useRef("");
  const pending = React.useRef("");
  const kb = useKeyboardOpen();
  const canSpeak = React.useMemo(() => !!speechCtor(), []);

  const fetchInfo = React.useCallback(() => {
    setFail("");
    fetch(`/api/brief?b=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) return setFail("missing");
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Info;
        setInfo(j);
        const local = load(id);
        const server = j.draft && j.draft.answers ? j.draft : null;
        let ans: BriefAnswers, fl: UFile[], st: number;
        if (server && (!local || server.at > (local.at || 0))) {
          // newer on the server — they started on another device
          ans = cleanAnswers(server.answers);
          fl = (server.files || []).map((f) => ({
            ...f,
            key: rid(),
            status: "done" as const,
            prog: 1,
            thumb:
              local?.files.find((x) => x.path === f.path)?.thumb ||
              (f.drive ? driveThumb(f.drive) : undefined),
          }));
          st = server.step || 0;
          setPalette(local?.palette || []);
        } else if (local) {
          ans = local.answers;
          fl = local.files;
          st = local.step || 0;
          setPalette(local.palette || []);
        } else {
          ans = j.answers ? cleanAnswers(j.answers) : emptyAnswers();
          if (!ans.business) ans.business = j.business || "";
          if (!ans.contactName) ans.contactName = j.client || "";
          fl = [];
          st = 0;
        }
        setA(ans);
        setFiles(fl);
        setStep(Math.min(st, LAST));
        setSent(local?.sent ?? (j.status === "done" ? Date.now() : undefined));
        synced.current = draftBody(ans, fl, Math.min(st, LAST));
        setReady(true);
      })
      .catch(() => setFail("net"));
  }, [id]);
  React.useEffect(fetchInfo, [fetchInfo]);

  // autosave on this device
  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        const s: Saved = {
          answers: a,
          files: files.filter((f) => f.status === "done"),
          step,
          sent,
          palette,
          at: Date.now(),
        };
        localStorage.setItem(keyOf(id), JSON.stringify(s));
      } catch {
        /* storage full or blocked — the page still works */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [a, files, step, sent, palette, ready, id]);

  // …and on the server, so the link opens with the answers on any device
  const pushDraft = React.useCallback(
    (body: string, keepalive = false) => {
      setSaved("saving");
      return fetch(`/api/brief?b=${encodeURIComponent(id)}&op=draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: keepalive && body.length < 60_000,
      })
        .then((r) => {
          if (r.ok) {
            synced.current = body;
            if (pending.current === body) pending.current = "";
            setSaved("saved");
          } else setSaved("");
        })
        .catch(() => setSaved(""));
    },
    [id],
  );
  React.useEffect(() => {
    if (!ready || sent) return;
    const body = draftBody(a, files, step);
    if (body === synced.current) return;
    pending.current = body;
    const t = setTimeout(() => void pushDraft(body), 2500);
    return () => clearTimeout(t);
  }, [a, files, step, ready, sent, pushDraft]);
  React.useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && pending.current)
        void pushDraft(pending.current, true);
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [pushDraft]);

  const set = <K extends keyof BriefAnswers>(k: K, v: BriefAnswers[K]) =>
    setA((x) => ({ ...x, [k]: v }));
  const patchFile = (key: string, p: Partial<UFile>) =>
    setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));

  /* ---------- uploads ---------- */
  const startUpload = async (f: UFile, blob: Blob) => {
    patchFile(f.key, { status: "up", prog: 0, err: undefined });
    try {
      const path = await uploadFile(id, f.kind, f.name, blob, (p) => patchFile(f.key, { prog: p }));
      patchFile(f.key, { status: "done", prog: 1, path });
    } catch (e) {
      patchFile(f.key, { status: "err", err: (e as Error).message });
    }
  };

  const addLogo = async (file: File) => {
    const { thumb, palette: pal } = await readLogo(file);
    const f: UFile = {
      key: rid(),
      name: file.name,
      kind: "logo",
      size: file.size,
      type: file.type,
      status: "up",
      prog: 0,
      thumb,
    };
    raw.current.set(f.key, file);
    setFiles((fs) => [...fs.filter((x) => x.kind !== "logo"), f]);
    setPalette(pal);
    if (pal.length) setA((x) => (x.colorMode === "logo" ? { ...x, colors: pal } : x));
    void startUpload(f, file);
  };

  const runQueue = async <T,>(items: T[], work: (t: T) => Promise<void>, n = 3) => {
    let i = 0;
    const worker = async () => {
      while (i < items.length) await work(items[i++]);
    };
    await Promise.all(Array.from({ length: n }, worker));
  };

  const addPhotos = async (list: File[], kind: "image" | "review" = "image") => {
    const ok = list.filter(isPhoto);
    const skipped = list.length - ok.length;
    if (skipped) {
      setSendErr(`${skipped} קבצים שאינם תמונה דולגו`);
      setTimeout(() => setSendErr(""), 5000);
    }
    const queue: [UFile, Blob][] = [];
    for (const file of ok.slice(0, 60)) {
      const p = await preparePhoto(file);
      const f: UFile = {
        key: rid(),
        name: p.name,
        kind,
        size: p.blob.size,
        type: p.type,
        status: "up",
        prog: 0,
        thumb: p.thumb,
      };
      raw.current.set(f.key, p.blob);
      setFiles((fs) => [...fs, f]);
      queue.push([f, p.blob]);
    }
    if (kind === "image" && ok.length) set("noPhotos", false);
    await runQueue(queue, ([f, b]) => startUpload(f, b));
  };

  /* ---------- Google Drive ---------- */
  const copyFromDrive = async (f: UFile) => {
    patchFile(f.key, { status: "up", prog: 0.35, err: undefined });
    try {
      const r = await driveCopy(id, f.drive!, f.kind, f.name);
      patchFile(f.key, {
        status: "done",
        prog: 1,
        path: r.path,
        name: r.name,
        type: r.type,
        size: r.size,
      });
    } catch (e) {
      patchFile(f.key, { status: "err", err: (e as Error).message });
    }
  };

  /** returns how many files were found */
  const importDrive = async (url: string, kind: Kind): Promise<number> => {
    const { items } = await driveList(id, url);
    if (kind === "logo") {
      await addLogo(await driveFetch(id, items[0].id));
      return 1;
    }
    const have = new Set(files.map((f) => f.drive).filter(Boolean));
    const fresh = items.filter((it) => !have.has(it.id)).slice(0, 60);
    const list: UFile[] = fresh.map((it) => ({
      key: rid(),
      name: it.name || "תמונה מדרייב",
      kind,
      size: 0,
      type: "",
      status: "up",
      prog: 0.1,
      thumb: driveThumb(it.id),
      drive: it.id,
    }));
    setFiles((fs) => [...fs, ...list]);
    if (kind === "image" && list.length) set("noPhotos", false);
    void runQueue(list, copyFromDrive);
    return items.length;
  };

  const retry = (f: UFile) => {
    if (f.drive) return void copyFromDrive(f);
    const b = raw.current.get(f.key);
    if (b) void startUpload(f, b);
  };
  const removeFile = (key: string) => setFiles((fs) => fs.filter((f) => f.key !== key));

  /* ---------- navigation ---------- */
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(LAST, n)));
    window.scrollTo({ top: 0 });
  };
  const uploading = files.filter((f) => f.status === "up").length;

  const submit = async () => {
    setSendErr("");
    setSending(true);
    try {
      const r = await fetch(`/api/brief?b=${encodeURIComponent(id)}&op=submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: a,
          files: files
            .filter((f) => f.status === "done" && f.path)
            .map((f) => ({ path: f.path, name: f.name, kind: f.kind, size: f.size, type: f.type })),
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "השליחה נכשלה");
      void pushDraft(draftBody(a, files, step));
      setSent(Date.now());
      window.scrollTo({ top: 0 });
    } catch (e) {
      const m = (e as Error).message;
      setSendErr(m === "Failed to fetch" ? "אין חיבור לאינטרנט. נסו שוב." : m);
    } finally {
      setSending(false);
    }
  };

  const logo = files.find((f) => f.kind === "logo");
  const photos = files.filter((f) => f.kind === "image");
  const shots = files.filter((f) => f.kind === "review");
  const owner = info?.owner?.trim() || "";
  const title = a.business.trim() || info?.business || "";

  /** what's still worth filling before sending — each one jumps to its step */
  const missing: [string, number][] = [];
  if (!a.business.trim()) missing.push(["שם העסק", stepOf("biz")]);
  if (!a.mainAction && !a.goals.length) missing.push(["מה הגולש צריך לעשות", stepOf("site")]);
  if (!a.about.trim() && !a.tagline.trim()) missing.push(["כמה מילים על העסק", stepOf("story")]);
  if (!a.services.some((s) => s.name.trim())) missing.push(["שירותים", stepOf("services")]);
  if (!logo && !a.styles.length) missing.push(["לוגו או סגנון", stepOf("look")]);
  if (!photos.length && !a.noPhotos && !a.photosLink.trim())
    missing.push(["תמונות", stepOf("photos")]);
  if (!a.phone.trim() && !a.email.trim()) missing.push(["טלפון או מייל", stepOf("contact")]);

  /* ---------- status screens ---------- */
  if (fail || !ready || !info)
    return (
      <div className="bf">
        <style>{BRIEF_CSS}</style>
        <div className="bf-center">
          {fail && (
            <img
              className="bf-err-mascot"
              src="/brief/rimon.webp"
              alt=""
              width={520}
              height={667}
            />
          )}
          {fail === "missing" ? (
            <>
              <h1 className="bf-h2">הקישור הזה כבר לא פעיל</h1>
              <p className="bf-small">בקשו קישור חדש ממי ששלח לכם אותו.</p>
            </>
          ) : fail === "net" ? (
            <>
              <h1 className="bf-h2">השאלון לא נטען</h1>
              <p className="bf-small" style={{ marginBottom: 20 }}>
                בדקו את החיבור לאינטרנט ונסו שוב.
              </p>
              <button className="bf-btn" onClick={fetchInfo}>
                נסו שוב
              </button>
            </>
          ) : (
            <div className="bf-spin" aria-label="טוען" />
          )}
        </div>
      </div>
    );

  if (sent)
    return (
      <div className="bf">
        <style>{BRIEF_CSS}</style>
        <main className="bf-main bf-step">
          <div className="bf-done-top">
            <img
              className="bf-done-mascot"
              src="/brief/rimon-sit.webp"
              alt=""
              width={520}
              height={646}
            />
            <span className="bf-done-ic" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M5 12.5l4.2 4.2L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <h1 className="bf-h1">
            תודה{first(a.contactName) ? ` ${first(a.contactName)}` : ""}, קיבלנו את התשובות
          </h1>
          <p className="bf-lead">
            {owner ? `${owner} יעבור עליהן ויחזור` : "נעבור עליהן ונחזור"} אליכם עם כיוון ראשון
            לאתר.
          </p>
          <div className="bf-sum">
            <span>
              עמודים: <b>{a.pages.length || "—"}</b>
            </span>
            <span>
              שירותים: <b>{a.services.filter((s) => s.name.trim()).length || "—"}</b>
            </span>
            <span>
              לוגו: <b>{logo ? "הועלה" : "—"}</b>
            </span>
            <span>
              המלצות:{" "}
              <b>{a.testimonials.filter((t) => t.text.trim()).length + shots.length || "—"}</b>
            </span>
            <span>
              תמונות: <b>{photos.length || (a.noPhotos ? "נשתמש בתמונות מקצועיות" : "—")}</b>
            </span>
          </div>
          <p className="bf-small" style={{ marginTop: 24 }}>
            שכחתם משהו?{" "}
            <button className="bf-link" onClick={() => setSent(undefined)}>
              עדכון התשובות
            </button>
          </p>
        </main>
      </div>
    );

  /* ---------- the form ---------- */
  const S = STEPS[step];
  const listSet = <K extends "services" | "sites" | "testimonials" | "faq">(
    k: K,
    i: number,
    p: Partial<BriefAnswers[K][number]>,
  ) =>
    set(
      k,
      (a[k] as BriefAnswers[K][number][]).map((x, j) =>
        j === i ? { ...x, ...p } : x,
      ) as BriefAnswers[K],
    );
  const listDel = (k: "services" | "sites" | "testimonials" | "faq", i: number) =>
    set(k, (a[k] as unknown[]).filter((_, j) => j !== i) as never);

  return (
    <div className={`bf ${kb ? "kb" : ""}`}>
      <style>{BRIEF_CSS}</style>
      <header className="bf-top">
        <div className="bf-top-in">
          <span className="bf-brand">{title || "שאלון לבניית אתר"}</span>
          {step > 0 && (
            <span className={`bf-saved ${saved}`} aria-live="polite">
              {saved === "saving" ? "שומר…" : "נשמר"}
            </span>
          )}
        </div>
        {step > 0 && (
          <nav className="bf-steps" aria-label="שלבים">
            {STEPS.slice(1).map((s, i) => (
              <button
                key={s.k}
                className={i + 1 === step ? "on" : i + 1 < step ? "past" : ""}
                aria-label={`${i + 1}. ${s.t}`}
                aria-current={i + 1 === step ? "step" : undefined}
                onClick={() => go(i + 1)}
              />
            ))}
          </nav>
        )}
      </header>

      <main className="bf-main" onKeyDown={nextField}>
        <div className="bf-step" key={step}>
          {step === 0 ? (
            <section className="bf-hero">
              <h1 className="bf-h1">כמה שאלות לפני שמתחילים לבנות את האתר</h1>
              <div className="bf-bubble">
                {first(a.contactName) ? `היי ${first(a.contactName)}! ` : "היי! "}
                כאן {owner || "הלל רימון"}. מהתשובות שלכם נכתוב את הטקסטים, נבחר צבעים ונעצב את
                האתר.
              </div>
              <p className="bf-hero-p">
                לא צריך לנסח מושלם. כתבו כמו שהייתם מסבירים לחבר, ואנחנו נלטש. אפשר לדלג על כל שאלה.
              </p>
              <div className="bf-intro-meta">
                <span>{LAST} שלבים קצרים</span>
                <span>בערך 7 דקות</span>
                {canSpeak && <span>אפשר להקליט במקום להקליד</span>}
                <span>נשמר. אפשר להמשיך מכל מכשיר</span>
              </div>
              <img
                className="bf-mascot"
                src="/brief/rimon-hello.webp"
                alt=""
                width={520}
                height={621}
              />
            </section>
          ) : (
            <>
              <p className="bf-kicker">
                שלב {step} מתוך {LAST}
              </p>
              <h2 className="bf-h2">{S.t}</h2>
              <p className="bf-hint">{S.h}</p>
              {S.k === "contact" && (
                <div className="bf-cheer">
                  <img src="/brief/rimon-point.webp" alt="" width={520} height={678} />
                  <span className="bf-bubble">כמעט סיימנו! עוד כמה פרטים ושולחים.</span>
                </div>
              )}
              <div className="bf-card">
                {S.k === "biz" && (
                  <>
                    <Q label="שם העסק">
                      <Text
                        value={a.business}
                        onChange={(v) => set("business", v)}
                        placeholder="למשל: גני השרון"
                        autoComplete="organization"
                      />
                    </Q>
                    <Q label="השם שלכם" optional>
                      <Text
                        value={a.contactName}
                        onChange={(v) => set("contactName", v)}
                        autoComplete="name"
                      />
                    </Q>
                    <Q label="תחום">
                      <Text
                        value={a.industry}
                        onChange={(v) => set("industry", v)}
                        placeholder="למשל: גינון, קוסמטיקה, עריכת דין"
                      />
                    </Q>
                    <Q label="מה אתם עושים, במשפט אחד" hint="זה יכול להפוך לכותרת הראשית של האתר">
                      <Area
                        value={a.tagline}
                        onChange={(v) => set("tagline", v)}
                        rows={1}
                        placeholder="למשל: גינות מעוצבות לבתים פרטיים בשרון"
                        mic={canSpeak}
                      />
                    </Q>
                    <Q label="מי הלקוחות שלכם?">
                      <Text
                        value={a.audience}
                        onChange={(v) => set("audience", v)}
                        placeholder="למשל: משפחות צעירות, עסקים קטנים"
                      />
                    </Q>
                    <Q label="איפה אתם נותנים שירות?" hint="עוזר להופיע בגוגל כשמחפשים באזור">
                      <Text
                        value={a.area}
                        onChange={(v) => set("area", v)}
                        placeholder="למשל: השרון והמרכז, כל הארץ, אונליין"
                      />
                    </Q>
                  </>
                )}

                {S.k === "site" && (
                  <>
                    <Q label="מה הכי חשוב שגולש יעשה באתר?" hint="בחרו אחד. סביבו נבנה את האתר">
                      <Chips
                        options={ACTIONS}
                        value={a.mainAction ? [a.mainAction] : []}
                        single
                        onChange={(v) => set("mainAction", v[0] || "")}
                      />
                    </Q>
                    <Q label="אילו עמודים צריך?" hint="סימנו את הבסיס, שנו כרצונכם">
                      <Chips options={PAGES} value={a.pages} onChange={(v) => set("pages", v)} />
                    </Q>
                    <Q label="משהו מזה יעזור לכם?" optional>
                      <Chips
                        options={FEATURES}
                        value={a.features}
                        onChange={(v) => set("features", v)}
                      />
                    </Q>
                    <Q label="יש לכם היום אתר?" optional>
                      <Text
                        value={a.currentSite}
                        onChange={(v) => set("currentSite", v)}
                        placeholder="www.example.co.il"
                        ltr
                        inputMode="url"
                      />
                    </Q>
                    {a.currentSite.trim() && (
                      <Q label="מה לא עובד בו?" optional>
                        <Text
                          value={a.currentNote}
                          onChange={(v) => set("currentNote", v)}
                          placeholder="למשל: נראה מיושן, לא מביא פניות, קשה לעדכן"
                        />
                      </Q>
                    )}
                    <Q label="מתי תרצו שהאתר יעלה?">
                      <Chips
                        options={DEADLINES}
                        value={a.deadline ? [a.deadline] : []}
                        single
                        onChange={(v) => set("deadline", v[0] || "")}
                      />
                    </Q>
                  </>
                )}

                {S.k === "story" && (
                  <>
                    <Q label="ספרו על העסק" hint="איך התחלתם, למה דווקא זה, מה אתם אוהבים בעבודה">
                      <Area
                        value={a.about}
                        onChange={(v) => set("about", v)}
                        rows={6}
                        mic={canSpeak}
                      />
                    </Q>
                    <Q label="כמה שנים אתם בתחום?" optional>
                      <Text
                        value={a.years}
                        onChange={(v) => set("years", v)}
                        inputMode="numeric"
                        placeholder="למשל: 12"
                        short
                      />
                    </Q>
                    <Q label="במה אתם חזקים?" hint="אפשר לבחור כמה">
                      <Chips
                        options={HIGHLIGHTS}
                        value={a.highlights}
                        onChange={(v) => set("highlights", v)}
                      />
                    </Q>
                    <Q label="ומה באמת מייחד אתכם?" optional>
                      <Area
                        value={a.unique}
                        onChange={(v) => set("unique", v)}
                        rows={2}
                        placeholder="משהו שמתחרים לא יכולים להגיד על עצמם"
                        mic={canSpeak}
                      />
                    </Q>
                    <Q label="מספרים שאפשר להתגאות בהם" optional hint="יופיעו בגדול באתר">
                      <Text
                        value={a.stats}
                        onChange={(v) => set("stats", v)}
                        placeholder="למשל: 500 לקוחות, 1,200 גינות, דירוג 4.9 בגוגל"
                      />
                    </Q>
                  </>
                )}

                {S.k === "services" && (
                  <>
                    <div className="bf-group">
                      {a.services.map((s, i) => (
                        <div className="bf-item" key={i}>
                          <div className="bf-row">
                            <input
                              className="bf-in"
                              value={s.name}
                              placeholder="שם השירות"
                              aria-label={`שירות ${i + 1}`}
                              enterKeyHint="next"
                              onChange={(e) => listSet("services", i, { name: e.target.value })}
                            />
                            <input
                              className="bf-in bf-price"
                              value={s.price || ""}
                              placeholder="מחיר"
                              aria-label="מחיר (לא חובה)"
                              enterKeyHint="next"
                              onChange={(e) => listSet("services", i, { price: e.target.value })}
                            />
                          </div>
                          <Area
                            value={s.desc}
                            rows={2}
                            placeholder="מה זה כולל, למי זה מתאים"
                            onChange={(v) => listSet("services", i, { desc: v })}
                            mic={canSpeak}
                          />
                          {a.services.length > 1 && (
                            <Del label="הסרת השירות" onClick={() => listDel("services", i)} />
                          )}
                        </div>
                      ))}
                    </div>
                    {a.services.length < 30 && (
                      <button
                        className="bf-add"
                        onClick={() =>
                          set("services", [...a.services, { name: "", desc: "", price: "" }])
                        }
                      >
                        הוספת שירות
                      </button>
                    )}
                    <p className="bf-small" style={{ margin: "-12px 0 22px" }}>
                      מחיר לא חובה. אפשר גם "החל מ-" או "לפי הצעת מחיר".
                    </p>

                    <Q
                      label="שאלות שלקוחות שואלים אתכם הרבה"
                      hint="נהפוך אותן לשאלות נפוצות באתר. אפשר בלי תשובה, נשלים יחד"
                      optional
                    >
                      <div className="bf-group">
                        {a.faq.map((f, i) => (
                          <div className="bf-item" key={i}>
                            <input
                              className="bf-in"
                              value={f.q}
                              placeholder="למשל: כמה זמן לוקחת עבודה?"
                              aria-label={`שאלה ${i + 1}`}
                              enterKeyHint="next"
                              onChange={(e) => listSet("faq", i, { q: e.target.value })}
                            />
                            {f.q.trim() && (
                              <Area
                                value={f.a}
                                rows={1}
                                placeholder="התשובה בקצרה"
                                onChange={(v) => listSet("faq", i, { a: v })}
                                mic={canSpeak}
                              />
                            )}
                            {a.faq.length > 1 && (
                              <Del label="הסרת השאלה" onClick={() => listDel("faq", i)} />
                            )}
                          </div>
                        ))}
                      </div>
                      {a.faq.length < 30 && (
                        <button
                          className="bf-add"
                          onClick={() => set("faq", [...a.faq, { q: "", a: "" }])}
                        >
                          הוספת שאלה
                        </button>
                      )}
                    </Q>
                  </>
                )}

                {S.k === "look" && (
                  <>
                    <Q label="לוגו" optional>
                      {logo ? (
                        <div className="bf-logo">
                          <div className="bf-logo-img">
                            {logo.thumb ? <img src={logo.thumb} alt="הלוגו" /> : null}
                          </div>
                          <div className="bf-logo-side">
                            <span className="bf-logo-name">{logo.name}</span>
                            <FileState f={logo} onRetry={() => retry(logo)} />
                            <label className="bf-link">
                              החלפה
                              <input
                                type="file"
                                hidden
                                accept="image/*,.svg,.pdf,.ai,.eps"
                                onChange={(e) => e.target.files?.[0] && addLogo(e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Drop
                            accept="image/*,.svg,.pdf,.ai,.eps"
                            onFiles={(f) => f[0] && addLogo(f[0])}
                            title="העלאת לוגו"
                            sub="PNG, SVG, JPG או PDF. עדיף הקובץ המקורי מהמעצב"
                          />
                          <DriveLink
                            label="הלוגו בגוגל דרייב? הדביקו קישור"
                            onImport={(u) => importDrive(u, "logo")}
                          />
                        </>
                      )}
                    </Q>

                    <Q label="צבעים">
                      <div className="bf-seg" role="radiogroup" aria-label="צבעים">
                        {(
                          [
                            ["logo", "מהלוגו"],
                            ["custom", "אבחר בעצמי"],
                            ["you", "תבחרו אתם"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            role="radio"
                            aria-checked={a.colorMode === v}
                            className={a.colorMode === v ? "on" : ""}
                            onClick={() =>
                              setA((x) => ({
                                ...x,
                                colorMode: v,
                                colors:
                                  v === "logo"
                                    ? palette.length
                                      ? palette
                                      : x.colors
                                    : v === "custom"
                                      ? x.colors.length
                                        ? x.colors
                                        : palette
                                      : x.colors,
                              }))
                            }
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      {a.colorMode === "logo" &&
                        (palette.length ? (
                          <>
                            <div className="bf-sws">
                              {palette.map((c) => {
                                const on = a.colors.includes(c);
                                return (
                                  <button
                                    key={c}
                                    className="bf-sw"
                                    aria-pressed={on}
                                    onClick={() =>
                                      set(
                                        "colors",
                                        on ? a.colors.filter((x) => x !== c) : [...a.colors, c],
                                      )
                                    }
                                  >
                                    <span className="bf-sw-c" style={{ background: c }} />
                                    <span dir="ltr">{c}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="bf-small">
                              הצבעים שמצאנו בלוגו. לחיצה על צבע מוציאה אותו.
                            </p>
                          </>
                        ) : (
                          <p className="bf-small">
                            {logo
                              ? "לא הצלחנו לקרוא צבעים מהקובץ הזה. אפשר לבחור בעצמכם או להשאיר לנו."
                              : "אחרי שתעלו לוגו, הצבעים שלו יופיעו כאן."}
                          </p>
                        ))}
                      {a.colorMode === "custom" && (
                        <div className="bf-sws">
                          {a.colors.map((c, i) => (
                            <div key={i} className="bf-sw">
                              <label className="bf-sw-c" style={{ background: c }}>
                                <input
                                  type="color"
                                  value={c}
                                  aria-label={`צבע ${i + 1}`}
                                  onChange={(e) =>
                                    set(
                                      "colors",
                                      a.colors.map((x, j) => (j === i ? e.target.value : x)),
                                    )
                                  }
                                />
                              </label>
                              <button
                                className="bf-sw-x"
                                onClick={() =>
                                  set(
                                    "colors",
                                    a.colors.filter((_, j) => j !== i),
                                  )
                                }
                              >
                                הסרה
                              </button>
                            </div>
                          ))}
                          {a.colors.length < 6 && (
                            <button
                              className="bf-sw-add"
                              aria-label="הוספת צבע"
                              onClick={() => set("colors", [...a.colors, "#3a5bd9"])}
                            >
                              +
                            </button>
                          )}
                        </div>
                      )}
                      {a.colorMode === "you" && (
                        <p className="bf-small">נציע לכם צבעים שמתאימים לתחום ולסגנון.</p>
                      )}
                    </Q>

                    <Q label="איזה סגנון מתאים לכם?" hint="עד 3">
                      <div className="bf-styles">
                        {STYLES.map((s) => {
                          const on = a.styles.includes(s.v);
                          return (
                            <button
                              key={s.v}
                              className={`bf-style ${on ? "on" : ""}`}
                              aria-pressed={on}
                              onClick={() =>
                                set(
                                  "styles",
                                  on
                                    ? a.styles.filter((x) => x !== s.v)
                                    : [...a.styles, s.v].slice(-3),
                                )
                              }
                            >
                              <span className="bf-style-sw" aria-hidden>
                                {s.sw.map((c) => (
                                  <i key={c} style={{ background: c }} />
                                ))}
                              </span>
                              <span>
                                <b>{s.v}</b>
                                <small>{s.d}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </Q>
                    <Q label="איך האתר ידבר עם הלקוחות?">
                      <div className="bf-styles">
                        {TONES.map((t) => {
                          const on = a.tone === t.v;
                          return (
                            <button
                              key={t.v}
                              className={`bf-style bf-tone ${on ? "on" : ""}`}
                              aria-pressed={on}
                              onClick={() => set("tone", on ? "" : t.v)}
                            >
                              <span>
                                <b>{t.v}</b>
                                <small>{t.d}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </Q>
                    <Q label="עוד משהו על המראה?" optional>
                      <Text
                        value={a.styleNote}
                        onChange={(v) => set("styleNote", v)}
                        placeholder="למשל: לא אוהב ורוד, רוצה שירגיש כמו בוטיק"
                      />
                    </Q>
                  </>
                )}

                {S.k === "inspo" && (
                  <>
                    <Q label="אתרים שאהבתם" optional>
                      <div className="bf-group">
                        {a.sites.map((s, i) => (
                          <div className="bf-item" key={i}>
                            <input
                              className="bf-in"
                              dir="ltr"
                              inputMode="url"
                              enterKeyHint="next"
                              autoCapitalize="none"
                              value={s.url}
                              placeholder="www.example.co.il"
                              aria-label={`אתר ${i + 1}`}
                              onChange={(e) => listSet("sites", i, { url: e.target.value })}
                            />
                            <input
                              className="bf-in"
                              value={s.note}
                              enterKeyHint="next"
                              placeholder="מה אהבתם בו?"
                              onChange={(e) => listSet("sites", i, { note: e.target.value })}
                            />
                            {a.sites.length > 1 && (
                              <Del label="הסרת האתר" onClick={() => listDel("sites", i)} />
                            )}
                          </div>
                        ))}
                      </div>
                      {a.sites.length < 6 && (
                        <button
                          className="bf-add"
                          onClick={() => set("sites", [...a.sites, { url: "", note: "" }])}
                        >
                          הוספת אתר
                        </button>
                      )}
                    </Q>
                    <Q label="מתחרים שכדאי שנכיר" optional hint="שם או אתר. נדאג שתיראו טוב יותר">
                      <Text
                        value={a.competitors}
                        onChange={(v) => set("competitors", v)}
                        placeholder="למשל: גינות הדר, www.example.co.il"
                      />
                    </Q>
                    <Q label="משהו שאתם בטוח לא רוצים?" optional>
                      <Text
                        value={a.avoid}
                        onChange={(v) => set("avoid", v)}
                        placeholder="למשל: אתר עמוס, צבעים כהים"
                      />
                    </Q>
                  </>
                )}

                {S.k === "photos" && (
                  <>
                    <Drop
                      multiple
                      accept="image/*"
                      onFiles={(f) => addPhotos(f)}
                      title="העלאת תמונות"
                      sub="אפשר לבחור כמה בבת אחת. התמונות מוקטנות אוטומטית"
                    />
                    <FilesBtn onFiles={(f) => addPhotos(f)} />
                    <DriveLink
                      label="או הדביקו קישור לתיקייה בגוגל דרייב"
                      onImport={(u) => importDrive(u, "image")}
                    />
                    <Thumbs list={photos} retry={retry} remove={removeFile} />
                    <label className="bf-check-row">
                      <input
                        type="checkbox"
                        checked={a.noPhotos}
                        onChange={(e) => set("noPhotos", e.target.checked)}
                      />
                      <span>אין לי תמונות כרגע. תשתמשו בתמונות מקצועיות שמתאימות לתחום.</span>
                    </label>
                    <Q label="קישור לגוגל תמונות או לכל מקום אחר" optional>
                      <Text
                        value={a.photosLink}
                        onChange={(v) => set("photosLink", v)}
                        placeholder="https://"
                        ltr
                        inputMode="url"
                      />
                    </Q>
                  </>
                )}

                {S.k === "reviews" && (
                  <>
                    <div className="bf-group">
                      {a.testimonials.map((t, i) => (
                        <div className="bf-item" key={i}>
                          <Area
                            value={t.text}
                            rows={3}
                            placeholder="מה הלקוח אמר עליכם"
                            onChange={(v) => listSet("testimonials", i, { text: v })}
                          />
                          <input
                            className="bf-in"
                            value={t.name}
                            enterKeyHint="next"
                            placeholder="שם הלקוח, ואם רוצים גם תפקיד"
                            onChange={(e) => listSet("testimonials", i, { name: e.target.value })}
                          />
                          {a.testimonials.length > 1 && (
                            <Del label="הסרת ההמלצה" onClick={() => listDel("testimonials", i)} />
                          )}
                        </div>
                      ))}
                    </div>
                    {a.testimonials.length < 30 && (
                      <button
                        className="bf-add"
                        onClick={() =>
                          set("testimonials", [...a.testimonials, { name: "", text: "" }])
                        }
                      >
                        הוספת המלצה
                      </button>
                    )}
                    <Q
                      label="או צילומי מסך של המלצות"
                      hint="מוואטסאפ, גוגל, פייסבוק או מייל. אנחנו נעתיק את הטקסט"
                      optional
                    >
                      <Drop
                        multiple
                        accept="image/*"
                        onFiles={(f) => addPhotos(f, "review")}
                        title="העלאת צילומי מסך"
                        sub="אפשר כמה בבת אחת"
                      />
                      <FilesBtn onFiles={(f) => addPhotos(f, "review")} />
                      <Thumbs list={shots} retry={retry} remove={removeFile} />
                    </Q>
                    <Q label="קישור לביקורות שלכם בגוגל או בפייסבוק" optional>
                      <Text
                        value={a.reviewsLink}
                        onChange={(v) => set("reviewsLink", v)}
                        placeholder="https://"
                        ltr
                        inputMode="url"
                      />
                    </Q>
                  </>
                )}

                {S.k === "contact" && (
                  <>
                    <div className="bf-two">
                      <Q label="טלפון">
                        <Text
                          value={a.phone}
                          onChange={(v) => set("phone", v)}
                          type="tel"
                          ltr
                          autoComplete="tel"
                        />
                      </Q>
                      <Q label="מייל">
                        <Text
                          value={a.email}
                          onChange={(v) => set("email", v)}
                          type="email"
                          ltr
                          autoComplete="email"
                        />
                      </Q>
                    </div>
                    <label className="bf-check-row bf-check-tight">
                      <input
                        type="checkbox"
                        checked={a.whatsappSame}
                        onChange={(e) => set("whatsappSame", e.target.checked)}
                      />
                      <span>הוואטסאפ באותו מספר</span>
                    </label>
                    {!a.whatsappSame && (
                      <Q label="וואטסאפ">
                        <Text
                          value={a.whatsapp}
                          onChange={(v) => set("whatsapp", v)}
                          type="tel"
                          ltr
                        />
                      </Q>
                    )}
                    <Q label="כתובת" optional>
                      <Text
                        value={a.address}
                        onChange={(v) => set("address", v)}
                        autoComplete="street-address"
                      />
                    </Q>
                    <Q label="שעות פעילות" optional>
                      <Text
                        value={a.hours}
                        onChange={(v) => set("hours", v)}
                        placeholder="א׳–ה׳ 9:00–18:00"
                      />
                    </Q>
                    <Q label="רשתות חברתיות" hint="קישורים או שמות משתמש" optional>
                      <Area
                        value={a.social}
                        onChange={(v) => set("social", v)}
                        rows={2}
                        placeholder={"אינסטגרם: @...\nפייסבוק: ..."}
                      />
                    </Q>
                    <Q label="דומיין (כתובת האתר)">
                      <div className="bf-seg" role="radiogroup" aria-label="דומיין">
                        {(
                          [
                            ["have", "יש לי"],
                            ["need", "אין לי עדיין"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            role="radio"
                            aria-checked={a.domainMode === v}
                            className={a.domainMode === v ? "on" : ""}
                            onClick={() => set("domainMode", a.domainMode === v ? "" : v)}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      {a.domainMode === "have" && (
                        <Text
                          value={a.domain}
                          onChange={(v) => set("domain", v)}
                          placeholder="www.example.co.il"
                          ltr
                          inputMode="url"
                        />
                      )}
                      {a.domainMode === "need" && (
                        <p className="bf-small">נעזור לבחור ולרכוש דומיין שמתאים לעסק.</p>
                      )}
                    </Q>
                    <Q label="עוד משהו שחשוב שנדע?" optional>
                      <Area
                        value={a.notes}
                        onChange={(v) => set("notes", v)}
                        rows={2}
                        placeholder="מבצעים, עונתיות, דברים שחשוב להדגיש"
                        mic={canSpeak}
                      />
                    </Q>
                  </>
                )}
              </div>

              {step === LAST && missing.length > 0 && (
                <div className="bf-missing">
                  <b>כדאי להשלים</b>
                  <span>אפשר לשלוח גם בלי, אבל זה יעזור לנו לבנות אתר טוב יותר:</span>
                  <div>
                    {missing.map(([l, s]) => (
                      <button key={l} onClick={() => go(s)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <nav className="bf-nav">
          {step < LAST ? (
            <button className="bf-btn" onClick={() => go(step + 1)}>
              {step === 0 ? "התחלה" : "המשך"}
            </button>
          ) : (
            <button className="bf-btn" disabled={sending || uploading > 0} onClick={submit}>
              {uploading > 0 ? `מעלה ${uploading} קבצים…` : sending ? "שולח…" : "שליחת התשובות"}
            </button>
          )}
          {step > 0 && (
            <button className="bf-back" onClick={() => go(step - 1)}>
              חזרה
            </button>
          )}
        </nav>
        {sendErr && <p className="bf-err">{sendErr}</p>}
      </main>
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function Thumbs({
  list,
  retry,
  remove,
}: {
  list: UFile[];
  retry: (f: UFile) => void;
  remove: (key: string) => void;
}) {
  if (!list.length) return null;
  const up = list.filter((f) => f.status === "up").length;
  const bad = list.filter((f) => f.status === "err");
  return (
    <>
      <p className="bf-small bf-thumbs-head">
        {list.length - up - bad.length} הועלו
        {up > 0 && ` · ${up} בדרך`}
        {bad.length > 0 && ` · ${bad.length} נכשלו`}
        {bad.length > 1 && (
          <>
            {" "}
            <button className="bf-link" onClick={() => bad.forEach(retry)}>
              לנסות שוב את כולן
            </button>
          </>
        )}
      </p>
      <div className="bf-thumbs">
        {list.map((f) => (
          <div key={f.key} className={`bf-thumb ${f.status}`} title={f.err || f.name}>
            {f.thumb ? (
              <img src={f.thumb} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="bf-thumb-n">{f.name}</span>
            )}
            {f.status === "up" && (
              <span className="bf-thumb-bar">
                <i style={{ width: `${Math.round(f.prog * 100)}%` }} />
              </span>
            )}
            {f.status === "err" && (
              <button className="bf-thumb-err" onClick={() => retry(f)}>
                נכשל, שוב
              </button>
            )}
            <button className="bf-x" aria-label="הסרה" onClick={() => remove(f.key)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Q({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean | string;
  children: React.ReactNode;
}) {
  return (
    <div className="bf-q">
      <label className="bf-q-l">
        {label}
        {optional && <em>{typeof optional === "string" ? optional : "לא חובה"}</em>}
        {hint && <small>{hint}</small>}
      </label>
      {children}
    </div>
  );
}

function Text({
  value,
  onChange,
  placeholder,
  ltr,
  type = "text",
  inputMode,
  autoComplete,
  short,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ltr?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  short?: boolean;
}) {
  return (
    <input
      className={`bf-in ${short ? "bf-short" : ""}`}
      value={value}
      type={type}
      dir={ltr ? "ltr" : undefined}
      inputMode={inputMode}
      autoComplete={autoComplete || "off"}
      autoCapitalize={ltr ? "none" : undefined}
      enterKeyHint="next"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Area({
  value,
  onChange,
  rows = 3,
  placeholder,
  mic,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mic?: boolean;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [rec, setRec] = React.useState<Rec | null>(null);
  const [live, setLive] = React.useState("");
  const latest = React.useRef(value);
  latest.current = value;
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, live]);
  React.useEffect(() => () => rec?.stop(), [rec]);

  const toggle = () => {
    if (rec) return rec.stop();
    const C = speechCtor();
    if (!C) return;
    const r = new C();
    r.lang = "he-IL";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript.trim();
        if (!t) continue;
        if (res.isFinal) {
          const cur = latest.current;
          const next = cur + (cur && !/\s$/.test(cur) ? " " : "") + t;
          latest.current = next;
          onChange(next);
        } else interim += t + " ";
      }
      setLive(interim.trim());
    };
    r.onend = r.onerror = () => {
      setRec(null);
      setLive("");
    };
    try {
      r.start();
      setRec(r);
    } catch {
      /* mic blocked */
    }
  };

  return (
    <div className={`bf-area-w ${mic ? "has-mic" : ""}`}>
      <textarea
        ref={ref}
        className="bf-in bf-area"
        rows={rows}
        value={live ? `${value}${value && !/\s$/.test(value) ? " " : ""}${live}` : value}
        placeholder={placeholder}
        readOnly={!!rec}
        onChange={(e) => onChange(e.target.value)}
      />
      {mic && (
        <button
          type="button"
          className={`bf-mic ${rec ? "on" : ""}`}
          aria-label={rec ? "עצירת ההקלטה" : "הקלטה במקום הקלדה"}
          aria-pressed={!!rec}
          onClick={toggle}
        >
          {rec ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0m6 6v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      )}
      {rec && <span className="bf-mic-tip">מקשיב… דברו חופשי, לחיצה לעצירה</span>}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
  single,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  return (
    <div className="bf-chips" role={single ? "radiogroup" : "group"}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`bf-chip ${on ? "on" : ""}`}
            role={single ? "radio" : undefined}
            aria-checked={single ? on : undefined}
            aria-pressed={single ? undefined : on}
            onClick={() =>
              onChange(single ? (on ? [] : [o]) : on ? value.filter((x) => x !== o) : [...value, o])
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Del({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="bf-x" aria-label={label} onClick={onClick}>
      ×
    </button>
  );
}

function Drop({
  onFiles,
  accept,
  multiple,
  title,
  sub,
}: {
  onFiles: (f: File[]) => void;
  accept: string;
  multiple?: boolean;
  title: string;
  sub: string;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <label
      className={`bf-drop ${over ? "over" : ""}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <b>{title}</b>
      <span>{sub}</span>
      <input
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

/**
 * Phones show only the gallery for image/* pickers. Allowing any file opens the system file
 * picker instead, where Google Drive, iCloud and Downloads appear. Non-photos are skipped.
 */
function FilesBtn({ onFiles }: { onFiles: (f: File[]) => void }) {
  return (
    <label className="bf-alt">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      בחירה מהקבצים או מגוגל דרייב
      <input
        type="file"
        hidden
        multiple
        accept="image/*,.heic,.heif,application/octet-stream"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function DriveLink({
  label,
  onImport,
}: {
  label: string;
  onImport: (url: string) => Promise<number>;
}) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; t: string } | null>(null);
  const go = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const n = await onImport(url.trim());
      setMsg({ ok: true, t: n > 1 ? `נמצאו ${n} תמונות. מעתיקים אותן…` : "הקובץ בדרך" });
      setUrl("");
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {
      /* no clipboard permission — they can paste by hand */
    }
  };
  if (!open)
    return (
      <button className="bf-alt" onClick={() => setOpen(true)}>
        <DriveIcon />
        {label}
      </button>
    );
  return (
    <div className="bf-drive">
      <div className="bf-drive-head">
        <DriveIcon />
        <b>ייבוא מגוגל דרייב</b>
      </div>
      <p className="bf-small" style={{ margin: "0 0 10px" }}>
        בדרייב: לחיצה על <b>שיתוף</b> ← "כל מי שיש לו את הקישור" ← <b>העתקת קישור</b>. אפשר קישור
        לתיקייה שלמה או לקובץ.
      </p>
      <div className="bf-drive-row">
        <input
          className="bf-in"
          dir="ltr"
          inputMode="url"
          autoCapitalize="none"
          enterKeyHint="go"
          value={url}
          placeholder="https://drive.google.com/…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void go();
            }
          }}
        />
        {url.trim() ? (
          <button className="bf-btn bf-btn-sm" disabled={busy} onClick={go}>
            {busy ? "בודק…" : "ייבוא"}
          </button>
        ) : (
          <button className="bf-back bf-btn-sm" onClick={paste}>
            הדבקה
          </button>
        )}
      </div>
      {msg && <p className={msg.ok ? "bf-small bf-ok" : "bf-err"}>{msg.t}</p>}
    </div>
  );
}

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M8.2 3h7.6l6 10.4-3.8 6.6H6L2.2 13.4 8.2 3z" fill="none" />
      <path d="M8.2 3l-6 10.4L6 20l6-10.4L8.2 3z" fill="#0f9d58" />
      <path d="M15.8 3H8.2L12 9.6h7.6L15.8 3z" fill="#f4b400" />
      <path d="M6 20h12l3.8-6.6H9.8L6 20z" fill="#4285f4" />
    </svg>
  );
}

function FileState({ f, onRetry }: { f: UFile; onRetry: () => void }) {
  if (f.status === "up") return <span className="bf-small">מעלה… {Math.round(f.prog * 100)}%</span>;
  if (f.status === "err")
    return (
      <button className="bf-link bf-err" onClick={onRetry}>
        ההעלאה נכשלה. לנסות שוב
      </button>
    );
  return <span className="bf-small bf-ok">הועלה</span>;
}
