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
  TONES,
} from "@/components/focus/briefcore";
import {
  FIELD_DEFS,
  resolveForm,
  type BriefForm,
  type CustomQ,
  type ResolvedForm,
  type StepKey,
} from "@/components/focus/briefform";
import { driveThumb } from "@/components/focus/drive";
import type { BriefAnswers, BriefCustomAnswer } from "@/components/focus/types";
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
  form?: BriefForm;
}

type StepK = "intro" | StepKey;
/** the id the owner's editor uses to show a live preview (no network, nothing saved) */
export const PREVIEW_ID = "preview";

const FIELD_KEYS = FIELD_DEFS.map((d) => d.k);
const short = (t: string, n = 90) => {
  const x = t.trim().replace(/\s+/g, " ");
  return x.length > n ? `${x.slice(0, n - 1)}…` : x;
};

/** what the client filled in each step, in a few short lines, for the review screen */
function reviewLines(
  k: StepK,
  a: BriefAnswers,
  c: { logo: boolean; photos: number; shots: number; F: ResolvedForm },
): string[] {
  const out: string[] = [];
  const add = (field: string, v: string | false | undefined | null) => {
    if (v && (field === "" || c.F.on(field))) out.push(v);
  };
  const n = (x: number, one: string, many: string) => (x === 1 ? one : `${x} ${many}`);
  switch (k) {
    case "biz":
      add(
        "business",
        a.business.trim() && [a.business.trim(), a.industry.trim()].filter(Boolean).join(" · "),
      );
      add("tagline", short(a.tagline));
      add("area", a.area.trim() && `אזור: ${a.area.trim()}`);
      break;
    case "site":
      add("mainAction", a.mainAction && `הכי חשוב: ${a.mainAction}`);
      add(
        "pages",
        a.pages.length > 0 && `${n(a.pages.length, "עמוד אחד", "עמודים")}: ${a.pages.join(", ")}`,
      );
      add("features", a.features.length > 0 && a.features.join(", "));
      add("deadline", a.deadline && `לוח זמנים: ${a.deadline}`);
      break;
    case "story":
      add("about", short(a.about));
      add("highlights", a.highlights.length > 0 && a.highlights.join(", "));
      add("years", a.years.trim() && `${a.years.trim()} שנים בתחום`);
      break;
    case "services": {
      const s = a.services.filter((x) => x.name.trim());
      add("services", s.length > 0 && s.map((x) => x.name.trim()).join(", "));
      const q = a.faq.filter((x) => x.q.trim()).length;
      add("faq", q > 0 && n(q, "שאלה נפוצה אחת", "שאלות נפוצות"));
      break;
    }
    case "look":
      add("logo", c.logo && "לוגו הועלה");
      add(
        "colors",
        a.colorMode === "you"
          ? "צבעים: תבחרו אתם"
          : a.colors.length > 0 && `${a.colors.length} צבעים נבחרו`,
      );
      add("tone", a.tone && `טון: ${a.tone}`);
      break;
    case "inspo": {
      const s = a.sites.filter((x) => x.url.trim()).length;
      add("sites", s > 0 && n(s, "אתר השראה אחד", "אתרי השראה"));
      add("competitors", a.competitors.trim() && `מתחרים: ${short(a.competitors, 60)}`);
      add("avoid", a.avoid.trim() && `לא רוצים: ${short(a.avoid, 60)}`);
      break;
    }
    case "photos":
      add(
        "photos",
        c.photos > 0 ? n(c.photos, "תמונה אחת", "תמונות") : a.noPhotos && "תמונות מקצועיות מתאימות",
      );
      add("photosLink", a.photosLink.trim() && "קישור לתמונות");
      break;
    case "reviews": {
      const t = a.testimonials.filter((x) => x.text.trim()).length;
      add("testimonials", t > 0 && n(t, "המלצה אחת", "המלצות"));
      add("reviewShots", c.shots > 0 && n(c.shots, "צילום מסך של המלצה", "צילומי מסך"));
      add("reviewsLink", a.reviewsLink.trim() && "קישור לביקורות");
      break;
    }
    case "contact":
      add("phone", a.phone.trim());
      add("email", a.email.trim());
      add("domain", a.domain.trim() || (a.domainMode === "need" ? "צריך עזרה עם דומיין" : ""));
      break;
  }
  if (k !== "intro")
    for (const q of c.F.custom(k)) {
      const v = a.custom.find((x) => x.id === q.id)?.value;
      const t = Array.isArray(v) ? v.join(", ") : (v || "").trim();
      if (t) out.push(`${q.label} ${short(t, 60)}`);
    }
  return out;
}

/* ---------- gentle checks (never block sending) ---------- */
const checkPhone = (v: string) => {
  const d = v.replace(/\D/g, "").replace(/^972/, "0");
  if (!d) return "";
  if (d.length < 9) return "נראה שחסרות ספרות";
  if (d.length > 10) return "נראה שיש ספרות מיותרות";
  return "";
};
const checkEmail = (v: string) =>
  !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "המייל נראה לא שלם";
const checkUrl = (v: string) =>
  !v.trim() || /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(v.trim())
    ? ""
    : "זה לא נראה כמו כתובת אתר";

/** the owner's wording for each question (context, so every field reads it) */
const FormCtx = React.createContext<ResolvedForm>(resolveForm());

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
  const preview = id === PREVIEW_ID;
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
  const [online, setOnline] = React.useState(true);
  const [welcome, setWelcome] = React.useState(false);
  /** send as soon as the uploads finish */
  const [queued, setQueued] = React.useState(false);
  /** came to a step from the review screen — "continue" goes back there */
  const [fromReview, setFromReview] = React.useState(false);
  const dir = React.useRef<"fwd" | "back">("fwd");
  const headRef = React.useRef<HTMLHeadingElement>(null);
  const raw = React.useRef(new Map<string, Blob>());
  const synced = React.useRef("");
  const pending = React.useRef("");
  const kb = useKeyboardOpen();
  const canSpeak = React.useMemo(() => !!speechCtor(), []);

  // preview: the editor sends the form over postMessage as it changes
  React.useEffect(() => {
    if (!preview) return;
    setInfo({ client: "", business: "", owner: "", status: "sent", answers: null, draft: null });
    setReady(true);
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "focus-brief-form") return;
      setInfo((x) => x && { ...x, form: e.data.form, owner: e.data.owner || "" });
      if (typeof e.data.step === "number") setStep(e.data.step);
    };
    window.addEventListener("message", on);
    window.parent?.postMessage({ type: "focus-brief-ready" }, location.origin);
    return () => window.removeEventListener("message", on);
  }, [preview]);

  const fetchInfo = React.useCallback(() => {
    if (preview) return;
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
        setStep(st);
        const wasSent = local?.sent ?? (j.status === "done" ? Date.now() : undefined);
        setSent(wasSent);
        if (st > 0 && !wasSent) setWelcome(true);
        try {
          history.replaceState({ ...history.state, bfStep: st }, "");
        } catch {
          /* sandboxed */
        }
        synced.current = draftBody(ans, fl, st);
        setReady(true);
      })
      .catch(() => setFail("net"));
  }, [id, preview]);
  React.useEffect(fetchInfo, [fetchInfo]);

  // autosave on this device
  React.useEffect(() => {
    if (!ready || preview) return;
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
  }, [a, files, step, sent, palette, ready, id, preview]);

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
    if (!ready || sent || preview) return;
    const body = draftBody(a, files, step);
    if (body === synced.current) return;
    pending.current = body;
    const t = setTimeout(() => void pushDraft(body), 2500);
    return () => clearTimeout(t);
  }, [a, files, step, ready, sent, preview, pushDraft]);
  React.useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && pending.current)
        void pushDraft(pending.current, true);
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [pushDraft]);

  // the phone's back button / gesture moves between steps instead of leaving the page
  React.useEffect(() => {
    if (preview) return;
    const on = (e: PopStateEvent) => {
      const n = e.state?.bfStep;
      if (typeof n !== "number") return;
      setStep((cur) => {
        dir.current = n < cur ? "back" : "fwd";
        return n;
      });
      setFromReview(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, [preview]);

  React.useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setWelcome(false), 4500);
    return () => clearTimeout(t);
  }, [welcome]);

  // no connection: everything keeps saving on this device and catches up when it's back
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const set = <K extends keyof BriefAnswers>(k: K, v: BriefAnswers[K]) =>
    setA((x) => ({ ...x, [k]: v }));
  const patchFile = (key: string, p: Partial<UFile>) =>
    setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));

  /* ---------- uploads ---------- */
  const startUpload = async (f: UFile, blob: Blob) => {
    if (preview) return patchFile(f.key, { status: "done", prog: 1, path: `preview/${f.key}` });
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
    if (preview) throw new Error("בתצוגה המקדימה לא מייבאים. אצל הלקוח זה יעבוד");
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
  const filesRef = React.useRef(files);
  filesRef.current = files;
  React.useEffect(() => {
    if (!online || !ready) return;
    filesRef.current.filter((f) => f.status === "err").forEach(retry);
    if (pending.current) void pushDraft(pending.current);
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  const removeFile = (key: string) => setFiles((fs) => fs.filter((f) => f.key !== key));

  /* ---------- the owner's form ---------- */
  const F = React.useMemo(() => resolveForm(info?.form), [info?.form]);
  const STEPS: { k: StepK; t: string; h: string }[] = [{ k: "intro", t: "", h: "" }, ...F.steps];
  const LAST = STEPS.length - 1;
  const stepOf = (k: StepK) => STEPS.findIndex((x) => x.k === k);
  const setCustom = (q: CustomQ, value: string | string[]) =>
    setA((x) => {
      const rest = x.custom.filter((c) => c.id !== q.id);
      const c: BriefCustomAnswer = { id: q.id, label: q.label, value };
      const i = x.custom.findIndex((c) => c.id === q.id);
      return { ...x, custom: i < 0 ? [...rest, c] : x.custom.map((y) => (y.id === q.id ? c : y)) };
    });

  /* ---------- navigation ---------- */
  /** the review screen comes after the last step */
  const REVIEW = LAST + 1;
  const go = (n: number, opts: { fromReview?: boolean } = {}) => {
    const to = Math.max(0, Math.min(REVIEW, n));
    dir.current = to < step ? "back" : "fwd";
    setFromReview(!!opts.fromReview);
    setStep(to);
    setWelcome(false);
    if (!preview)
      try {
        history.pushState({ ...history.state, bfStep: to }, "");
      } catch {
        /* sandboxed */
      }
    window.scrollTo({ top: 0 });
  };
  const uploading = files.filter((f) => f.status === "up").length;
  const failed = files.filter((f) => f.status === "err").length;

  // move the screen reader to the new step's title (without opening the phone keyboard)
  React.useEffect(() => {
    if (ready) headRef.current?.focus({ preventScroll: true });
  }, [step, ready]);

  React.useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const submit = async () => {
    setQueued(false);
    if (preview) return setSent(Date.now());
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

  React.useEffect(() => {
    if (queued && !uploading && !sending) void submit();
  }, [queued, uploading]); // eslint-disable-line react-hooks/exhaustive-deps

  const logo = files.find((f) => f.kind === "logo");
  const photos = files.filter((f) => f.kind === "image");
  const shots = files.filter((f) => f.kind === "review");
  const owner = info?.owner?.trim() || "";
  const title = a.business.trim() || info?.business || "";

  /** what's still worth filling before sending — each one jumps to its step */
  const missing: [string, number][] = [];
  const need = (field: string, empty: boolean, label: string, k: StepKey) => {
    if (empty && F.on(field) && stepOf(k) > 0) missing.push([label, stepOf(k)]);
  };
  need("business", !a.business.trim(), "שם העסק", "biz");
  need("mainAction", !a.mainAction && !a.goals.length, "מה הגולש צריך לעשות", "site");
  need("about", !a.about.trim() && !a.tagline.trim(), "כמה מילים על העסק", "story");
  need("services", !a.services.some((s) => s.name.trim()), "שירותים", "services");
  need("logo", !logo, "לוגו", "look");
  need("photos", !photos.length && !a.noPhotos && !a.photosLink.trim(), "תמונות", "photos");
  need("phone", !a.phone.trim() && !a.email.trim(), "טלפון או מייל", "contact");

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
            {(
              [
                ["עמודים", a.pages.length || ""],
                ["שירותים", a.services.filter((s) => s.name.trim()).length || ""],
                ["לוגו", logo ? "הועלה" : ""],
                ["המלצות", a.testimonials.filter((t) => t.text.trim()).length + shots.length || ""],
                ["תמונות", photos.length || (a.noPhotos ? "נשתמש בתמונות מקצועיות" : "")],
              ] as [string, string | number][]
            ).map(([l, v]) => (
              <span key={l} className={v ? "" : "empty"}>
                {l}: <b>{v || "—"}</b>
              </span>
            ))}
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
  if (step > REVIEW) {
    setStep(REVIEW);
    return null;
  }
  const isReview = step === REVIEW;
  const S = STEPS[Math.min(step, LAST)];
  const fieldCount =
    F.steps.reduce((n, s) => n + F.custom(s.k).length, 0) +
    FIELD_KEYS.filter((k) => F.on(k)).length;
  const minutes = Math.max(3, Math.round(fieldCount / 5));
  const missingSteps = new Set(missing.map(([, s]) => s));
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
    <FormCtx.Provider value={F}>
      <div className={`bf ${kb ? "kb" : ""}`}>
        <style>{BRIEF_CSS}</style>
        {preview && <div className="bf-preview">תצוגה מקדימה · שום דבר לא נשמר</div>}
        {!online && !preview && (
          <div className="bf-offline" role="status">
            אין חיבור לאינטרנט. מה שתמלאו נשמר בטלפון, ונמשיך לבד כשהחיבור יחזור.
          </div>
        )}
        <header className="bf-top">
          <div className="bf-top-in">
            <span className="bf-brand">{title || "שאלון לבניית אתר"}</span>
            {step > 0 && !preview && (
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
                  className={i + 1 === step ? "on" : i + 1 < step || isReview ? "past" : ""}
                  aria-label={`${i + 1}. ${s.t}`}
                  aria-current={i + 1 === step ? "step" : undefined}
                  onClick={() => go(i + 1)}
                />
              ))}
            </nav>
          )}
        </header>

        <main className="bf-main" onKeyDown={nextField}>
          {welcome && (
            <div className="bf-toast" role="status">
              <b>ברוכים השבים!</b> ממשיכים מאיפה שעצרתם.
              <button className="bf-link" onClick={() => go(0)}>
                להתחלה
              </button>
            </div>
          )}
          <div className={`bf-step ${dir.current}`} key={step}>
            {step === 0 ? (
              <section className="bf-hero">
                <h1 className="bf-h1">כמה שאלות לפני שמתחילים לבנות את האתר</h1>
                <div className="bf-bubble">
                  {first(a.contactName) ? `היי ${first(a.contactName)}! ` : "היי! "}
                  כאן {owner || "הלל רימון"}. {F.intro}
                </div>
                <p className="bf-hero-p">
                  לא צריך לנסח מושלם. כתבו כמו שהייתם מסבירים לחבר, ואנחנו נלטש. אפשר לדלג על כל
                  שאלה.
                </p>
                <div className="bf-intro-meta">
                  <span>
                    {LAST} שלבים, בערך {minutes} דקות
                  </span>
                  {canSpeak && <span>אפשר להקליט במקום להקליד</span>}
                  <span>נשמר לבד, אפשר להמשיך מכל מכשיר</span>
                </div>
                <img
                  className="bf-mascot"
                  src="/brief/rimon-hello.webp"
                  alt=""
                  width={520}
                  height={621}
                />
              </section>
            ) : isReview ? (
              <Review
                steps={STEPS.slice(1)}
                lines={(k) =>
                  reviewLines(k, a, { logo: !!logo, photos: photos.length, shots: shots.length, F })
                }
                missing={missing}
                missingSteps={missingSteps}
                failed={failed}
                uploading={queued ? 0 : uploading}
                onRetry={() => files.filter((f) => f.status === "err").forEach(retry)}
                onEdit={(n) => go(n, { fromReview: true })}
                headRef={headRef}
              />
            ) : (
              <>
                <p className="bf-kicker">
                  שלב {step} מתוך {LAST}
                </p>
                <h2 className="bf-h2" ref={headRef} tabIndex={-1}>
                  {S.t}
                </h2>
                <p className="bf-hint">{S.h}</p>
                {step === LAST && !fromReview && (
                  <div className="bf-cheer">
                    <img src="/brief/rimon-point.webp" alt="" width={520} height={678} />
                    <span className="bf-bubble">כמעט סיימנו! עוד כמה פרטים ושולחים.</span>
                  </div>
                )}
                <div className="bf-card">
                  {S.k === "biz" && (
                    <>
                      <Fq k="business">
                        <Text
                          value={a.business}
                          onChange={(v) => set("business", v)}
                          placeholder="למשל: גני השרון"
                          autoComplete="organization"
                        />
                      </Fq>
                      <Fq k="contactName" optional>
                        <Text
                          value={a.contactName}
                          onChange={(v) => set("contactName", v)}
                          autoComplete="name"
                        />
                      </Fq>
                      <Fq k="industry">
                        <Text
                          value={a.industry}
                          onChange={(v) => set("industry", v)}
                          placeholder="למשל: גינון, קוסמטיקה, עריכת דין"
                        />
                      </Fq>
                      <Fq k="tagline">
                        <Area
                          value={a.tagline}
                          onChange={(v) => set("tagline", v)}
                          rows={1}
                          placeholder="למשל: גינות מעוצבות לבתים פרטיים בשרון"
                          mic={canSpeak}
                        />
                      </Fq>
                      <Fq k="audience">
                        <Text
                          value={a.audience}
                          onChange={(v) => set("audience", v)}
                          placeholder="למשל: משפחות צעירות, עסקים קטנים"
                        />
                      </Fq>
                      <Fq k="area">
                        <Text
                          value={a.area}
                          onChange={(v) => set("area", v)}
                          placeholder="למשל: השרון והמרכז, כל הארץ, אונליין"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "site" && (
                    <>
                      <Fq k="mainAction">
                        <Chips
                          options={F.options("mainAction")}
                          value={a.mainAction ? [a.mainAction] : []}
                          single
                          onChange={(v) => set("mainAction", v[0] || "")}
                        />
                      </Fq>
                      <Fq k="pages">
                        <Chips
                          options={F.options("pages")}
                          value={a.pages}
                          onChange={(v) => set("pages", v)}
                        />
                      </Fq>
                      <Fq k="features" optional>
                        <Chips
                          options={F.options("features")}
                          value={a.features}
                          onChange={(v) => set("features", v)}
                        />
                      </Fq>
                      <Fq k="currentSite" optional>
                        <Text
                          value={a.currentSite}
                          onChange={(v) => set("currentSite", v)}
                          check={checkUrl}
                          placeholder="www.example.co.il"
                          ltr
                          inputMode="url"
                        />
                      </Fq>
                      {F.on("currentSite") && a.currentSite.trim() && (
                        <Q label="מה לא עובד בו?" optional>
                          <Text
                            value={a.currentNote}
                            onChange={(v) => set("currentNote", v)}
                            placeholder="למשל: נראה מיושן, לא מביא פניות, קשה לעדכן"
                          />
                        </Q>
                      )}
                      <Fq k="deadline">
                        <Chips
                          options={F.options("deadline")}
                          value={a.deadline ? [a.deadline] : []}
                          single
                          onChange={(v) => set("deadline", v[0] || "")}
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "story" && (
                    <>
                      <Fq k="about">
                        <Area
                          value={a.about}
                          onChange={(v) => set("about", v)}
                          rows={6}
                          mic={canSpeak}
                        />
                      </Fq>
                      <Fq k="years" optional>
                        <Text
                          value={a.years}
                          onChange={(v) => set("years", v)}
                          inputMode="numeric"
                          placeholder="למשל: 12"
                          short
                        />
                      </Fq>
                      <Fq k="highlights">
                        <Chips
                          options={F.options("highlights")}
                          value={a.highlights}
                          onChange={(v) => set("highlights", v)}
                        />
                      </Fq>
                      <Fq k="unique" optional>
                        <Area
                          value={a.unique}
                          onChange={(v) => set("unique", v)}
                          rows={2}
                          placeholder="משהו שמתחרים לא יכולים להגיד על עצמם"
                          mic={canSpeak}
                        />
                      </Fq>
                      <Fq k="stats" optional>
                        <Text
                          value={a.stats}
                          onChange={(v) => set("stats", v)}
                          placeholder="למשל: 500 לקוחות, 1,200 גינות, דירוג 4.9 בגוגל"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "services" && (
                    <>
                      <Fq k="services">
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
                                  onChange={(e) =>
                                    listSet("services", i, { price: e.target.value })
                                  }
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
                      </Fq>

                      <Fq k="faq" optional>
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
                      </Fq>
                    </>
                  )}

                  {S.k === "look" && (
                    <>
                      <Fq k="logo" optional>
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
                                  onChange={(e) =>
                                    e.target.files?.[0] && addLogo(e.target.files[0])
                                  }
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
                      </Fq>

                      <Fq k="colors">
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
                      </Fq>

                      <Fq k="tone">
                        <div className="bf-styles">
                          {F.options("tone").map((v) => {
                            const on = a.tone === v;
                            const d = TONES.find((t) => t.v === v)?.d;
                            return (
                              <button
                                key={v}
                                className={`bf-style bf-tone ${on ? "on" : ""}`}
                                aria-pressed={on}
                                onClick={() => set("tone", on ? "" : v)}
                              >
                                <span>
                                  <b>{v}</b>
                                  {d && <small>{d}</small>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </Fq>
                      <Fq k="styleNote" optional>
                        <Text
                          value={a.styleNote}
                          onChange={(v) => set("styleNote", v)}
                          placeholder="למשל: לא אוהב ורוד, רוצה שירגיש כמו בוטיק"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "inspo" && (
                    <>
                      <Fq k="sites" optional>
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
                      </Fq>
                      <Fq k="competitors" optional>
                        <Text
                          value={a.competitors}
                          onChange={(v) => set("competitors", v)}
                          placeholder="למשל: גינות הדר, www.example.co.il"
                        />
                      </Fq>
                      <Fq k="avoid" optional>
                        <Text
                          value={a.avoid}
                          onChange={(v) => set("avoid", v)}
                          placeholder="למשל: אתר עמוס, צבעים כהים"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "photos" && (
                    <>
                      <Fq k="photos" bare>
                        <Drop
                          multiple
                          accept="image/*"
                          onFiles={(f) => addPhotos(f)}
                          title={F.label("photos")}
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
                      </Fq>
                      <Fq k="photosLink" optional>
                        <Text
                          value={a.photosLink}
                          onChange={(v) => set("photosLink", v)}
                          check={checkUrl}
                          placeholder="https://"
                          ltr
                          inputMode="url"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "reviews" && (
                    <>
                      <Fq k="testimonials" bare>
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
                                onChange={(e) =>
                                  listSet("testimonials", i, { name: e.target.value })
                                }
                              />
                              {a.testimonials.length > 1 && (
                                <Del
                                  label="הסרת ההמלצה"
                                  onClick={() => listDel("testimonials", i)}
                                />
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
                      </Fq>
                      <Fq k="reviewShots" optional>
                        <Drop
                          multiple
                          accept="image/*"
                          onFiles={(f) => addPhotos(f, "review")}
                          title="העלאת צילומי מסך"
                          sub="אפשר כמה בבת אחת"
                        />
                        <FilesBtn onFiles={(f) => addPhotos(f, "review")} />
                        <Thumbs list={shots} retry={retry} remove={removeFile} />
                      </Fq>
                      <Fq k="reviewsLink" optional>
                        <Text
                          value={a.reviewsLink}
                          onChange={(v) => set("reviewsLink", v)}
                          check={checkUrl}
                          placeholder="https://"
                          ltr
                          inputMode="url"
                        />
                      </Fq>
                    </>
                  )}

                  {S.k === "contact" && (
                    <>
                      <div className="bf-two">
                        <Fq k="phone">
                          <Text
                            value={a.phone}
                            onChange={(v) => set("phone", v)}
                            check={checkPhone}
                            type="tel"
                            ltr
                            autoComplete="tel"
                          />
                        </Fq>
                        <Fq k="email">
                          <Text
                            value={a.email}
                            onChange={(v) => set("email", v)}
                            check={checkEmail}
                            type="email"
                            ltr
                            autoComplete="email"
                          />
                        </Fq>
                      </div>
                      {F.on("whatsapp") && (
                        <>
                          {F.on("phone") && (
                            <label className="bf-check-row bf-check-tight">
                              <input
                                type="checkbox"
                                checked={a.whatsappSame}
                                onChange={(e) => set("whatsappSame", e.target.checked)}
                              />
                              <span>הוואטסאפ באותו מספר</span>
                            </label>
                          )}
                          {(!a.whatsappSame || !F.on("phone")) && (
                            <Fq k="whatsapp">
                              <Text
                                value={a.whatsapp}
                                onChange={(v) => set("whatsapp", v)}
                                check={checkPhone}
                                type="tel"
                                ltr
                              />
                            </Fq>
                          )}
                        </>
                      )}
                      <Fq k="address" optional>
                        <Text
                          value={a.address}
                          onChange={(v) => set("address", v)}
                          autoComplete="street-address"
                        />
                      </Fq>
                      <Fq k="hours" optional>
                        <Text
                          value={a.hours}
                          onChange={(v) => set("hours", v)}
                          placeholder="א׳–ה׳ 9:00–18:00"
                        />
                      </Fq>
                      <Fq k="social" optional>
                        <Area
                          value={a.social}
                          onChange={(v) => set("social", v)}
                          rows={2}
                          placeholder={"אינסטגרם: @...\nפייסבוק: ..."}
                        />
                      </Fq>
                      <Fq k="domain">
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
                            check={checkUrl}
                            placeholder="www.example.co.il"
                            ltr
                            inputMode="url"
                          />
                        )}
                        {a.domainMode === "need" && (
                          <p className="bf-small">נעזור לבחור ולרכוש דומיין שמתאים לעסק.</p>
                        )}
                      </Fq>
                      <Fq k="notes" optional>
                        <Area
                          value={a.notes}
                          onChange={(v) => set("notes", v)}
                          rows={2}
                          placeholder="מבצעים, עונתיות, דברים שחשוב להדגיש"
                          mic={canSpeak}
                        />
                      </Fq>
                    </>
                  )}

                  {F.custom(S.k as StepKey).map((q) => (
                    <CustomField
                      key={q.id}
                      q={q}
                      value={a.custom.find((c) => c.id === q.id)?.value}
                      onChange={(v) => setCustom(q, v)}
                      mic={canSpeak}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <nav className="bf-nav">
            {isReview ? (
              <button
                className="bf-btn"
                disabled={sending || queued}
                onClick={() => (uploading ? setQueued(true) : void submit())}
              >
                {sending ? "שולח…" : queued ? `שולח אחרי ההעלאה (${uploading})…` : "שליחת התשובות"}
              </button>
            ) : fromReview ? (
              <button className="bf-btn" onClick={() => go(REVIEW)}>
                חזרה לסיכום
              </button>
            ) : (
              <button className="bf-btn" onClick={() => go(step + 1)}>
                {step === 0 ? "התחלה" : step === LAST ? "לסיכום ושליחה" : "המשך"}
              </button>
            )}
            {step > 0 && !fromReview && (
              <button className="bf-back" onClick={() => go(step - 1)}>
                חזרה
              </button>
            )}
          </nav>
          {sendErr && <p className="bf-err">{sendErr}</p>}
        </main>
      </div>
    </FormCtx.Provider>
  );
}

/* ---------------- the review screen ---------------- */
function Review({
  steps,
  lines,
  missing,
  missingSteps,
  failed,
  uploading,
  onRetry,
  onEdit,
  headRef,
}: {
  steps: { k: StepK; t: string }[];
  lines: (k: StepK) => string[];
  missing: [string, number][];
  missingSteps: Set<number>;
  failed: number;
  uploading: number;
  onRetry: () => void;
  onEdit: (step: number) => void;
  headRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      <p className="bf-kicker">לפני ששולחים</p>
      <h2 className="bf-h2" ref={headRef} tabIndex={-1}>
        הכל נראה טוב?
      </h2>
      <p className="bf-hint">עברו רגע על התשובות. אפשר לתקן כל שלב בלחיצה.</p>
      {missing.length > 0 && (
        <div className="bf-missing">
          <b>כדאי להשלים</b>
          <span>אפשר לשלוח גם בלי, אבל זה יעזור לנו לבנות אתר טוב יותר:</span>
          <div>
            {missing.map(([l, s]) => (
              <button key={l} onClick={() => onEdit(s)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      {failed > 0 && (
        <div className="bf-missing bf-bad">
          <b>{failed === 1 ? "קובץ אחד לא עלה" : `${failed} קבצים לא עלו`}</b>
          <div>
            <button onClick={onRetry}>לנסות שוב</button>
          </div>
        </div>
      )}
      {uploading > 0 && (
        <p className="bf-toast">
          {uploading === 1 ? "קובץ אחד עוד עולה" : `${uploading} קבצים עוד עולים`}. אפשר כבר ללחוץ
          שליחה, נשלח ברגע שיסיימו.
        </p>
      )}
      <ol className="bf-review">
        {steps.map((s, i) => {
          const l = lines(s.k);
          return (
            <li key={s.k} className={missingSteps.has(i + 1) ? "need" : ""}>
              <button onClick={() => onEdit(i + 1)} aria-label={`עריכת ${s.t}`}>
                <span className="bf-review-n">{i + 1}</span>
                <span className="bf-review-b">
                  <b>{s.t}</b>
                  {l.length ? (
                    l.map((x, j) => <span key={j}>{x}</span>)
                  ) : (
                    <span className="mut">לא מולא</span>
                  )}
                </span>
                <span className="bf-review-e">עריכה</span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
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
  const id = React.useId();
  return (
    <div className="bf-q" role="group" aria-labelledby={id}>
      <label
        className="bf-q-l"
        id={id}
        onClick={(e) =>
          (e.currentTarget.parentElement?.querySelector(".bf-in") as HTMLElement | null)?.focus()
        }
      >
        {label}
        {optional && <em>{typeof optional === "string" ? optional : "לא חובה"}</em>}
        {hint && <small>{hint}</small>}
      </label>
      <QLabel.Provider value={id}>{children}</QLabel.Provider>
    </div>
  );
}
const QLabel = React.createContext("");

/** a built-in question, as the owner worded it (or nothing, if they hid it) */
function Fq({
  k,
  optional,
  bare,
  children,
}: {
  k: string;
  optional?: boolean;
  /** no title row — the upload box carries the wording */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const F = React.useContext(FormCtx);
  if (!F.on(k)) return null;
  if (bare)
    return (
      <div className="bf-q">
        {F.hint(k) && (
          <p className="bf-small" style={{ margin: "0 0 10px" }}>
            {F.hint(k)}
          </p>
        )}
        {children}
      </div>
    );
  return (
    <Q label={F.label(k)} hint={F.hint(k)} optional={optional}>
      {children}
    </Q>
  );
}

/** a question the owner added */
function CustomField({
  q,
  value,
  onChange,
  mic,
}: {
  q: CustomQ;
  value?: string | string[];
  onChange: (v: string | string[]) => void;
  mic?: boolean;
}) {
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  return (
    <Q label={q.label} hint={q.hint}>
      {q.type === "text" ? (
        <Text value={text} onChange={onChange} />
      ) : q.type === "long" ? (
        <Area value={text} onChange={onChange} rows={3} mic={mic} />
      ) : q.type === "yesno" ? (
        <Chips
          options={["כן", "לא"]}
          value={text ? [text] : []}
          single
          onChange={(v) => onChange(v[0] || "")}
        />
      ) : (
        <Chips
          options={q.options || []}
          value={q.type === "single" ? (text ? [text] : []) : list}
          single={q.type === "single"}
          onChange={(v) => onChange(q.type === "single" ? v[0] || "" : v)}
        />
      )}
    </Q>
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
  check,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ltr?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  short?: boolean;
  /** a gentle note under the field after leaving it (never blocks) */
  check?: (v: string) => string;
}) {
  const labelled = React.useContext(QLabel);
  const [touched, setTouched] = React.useState(false);
  const warn = touched && check ? check(value) : "";
  const input = (
    <input
      aria-labelledby={labelled || undefined}
      aria-invalid={warn ? true : undefined}
      onBlur={() => setTouched(true)}
      className={`bf-in ${short ? "bf-short" : ""} ${warn ? "warn" : ""}`}
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
  if (!check) return input;
  return (
    <>
      {input}
      {warn && (
        <p className="bf-warn" role="status">
          {warn}
        </p>
      )}
    </>
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
  const labelled = React.useContext(QLabel);
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
        aria-labelledby={labelled || undefined}
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
            onClick={() => {
              navigator.vibrate?.(8);
              onChange(
                single ? (on ? [] : [o]) : on ? value.filter((x) => x !== o) : [...value, o],
              );
            }}
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
