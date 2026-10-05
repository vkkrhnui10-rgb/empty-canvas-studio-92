/**
 * The client's design-review page (/r/<id>): the real, live site in a desktop window or a phone,
 * a big "add a note" button, and a list of notes. With feedback.js on the site, a note pins to the
 * element that was clicked and comes with a picture of what the client saw. Without it, the note
 * is placed over the screen (or on a full-page screenshot) instead.
 */
import * as React from "react";
import { sortNotes, VIEW_HE, whereText } from "@/components/focus/reviewcore";
import type { ReviewAnchor, ReviewComment } from "@/components/focus/types";
import { REVIEW_CSS } from "./style";

type View = "desktop" | "mobile";
type Note = ReviewComment & { shotUrl?: string };
interface Info {
  url: string;
  project: string;
  owner: string;
  round: number;
  approved: { name: string; at: number; round: number } | null;
  sentAt: number | null;
}
interface Draft {
  editId?: string;
  pickId?: string;
  mode: Note["mode"];
  view: View;
  path: string;
  anchor?: ReviewAnchor;
  pos?: { x: number; y: number };
  /** undefined = still being taken, null = none */
  shot?: string | null;
  text: string;
}

const SRC = "focus-fb";
const DESK_W = 1280;
const PHONE_W = 390;
const PHONE_H = 844;

const normPath = (p: string) => (p || "/").replace(/\/+$/, "") || "/";
const noteId = () =>
  `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.slice(0, 20);
const fmt = (t: number) =>
  new Date(t).toLocaleDateString("he-IL", { day: "numeric", month: "long" }) +
  " " +
  new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k) || "";
    } catch {
      return "";
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

async function api(id: string, op: string, body?: unknown, raw?: Blob) {
  const r = await fetch(`/api/review?r=${encodeURIComponent(id)}&op=${op}`, {
    method: "POST",
    headers: raw ? { "content-type": raw.type } : { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "משהו השתבש. נסו שוב");
  return j;
}

const dataUrlBlob = (d: string) => {
  const [head, b64] = d.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type });
};

/** cut the area around a point out of the page screenshot and mark the point */
function cropShot(img: HTMLImageElement, x: number, y: number): string | null {
  try {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const cw = Math.min(W, Math.round(W > 900 ? 1100 : W));
    const ch = Math.min(H, Math.round(cw * 0.7));
    const px = (x / 100) * W;
    const py = (y / 100) * H;
    const sx = Math.max(0, Math.min(W - cw, px - cw / 2));
    const sy = Math.max(0, Math.min(H - ch, py - ch / 2));
    const k = Math.min(1, 900 / cw);
    const c = document.createElement("canvas");
    c.width = Math.round(cw * k);
    c.height = Math.round(ch * k);
    const g = c.getContext("2d")!;
    g.drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
    const mx = (px - sx) * k;
    const my = (py - sy) * k;
    g.beginPath();
    g.arc(mx, my, 26, 0, Math.PI * 2);
    g.lineWidth = 7;
    g.strokeStyle = "rgba(255,255,255,.85)";
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = "#e5484d";
    g.stroke();
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return null; // the image wasn't allowed into a canvas
  }
}

/* ---------------- icons ---------------- */
const I = {
  desk: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  phone: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  ),
  pin: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  send: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0m6 6v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  ),
};

/* ---------------- dictation (same as the questionnaire) ---------------- */
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

function NoteText({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [rec, setRec] = React.useState<Rec | null>(null);
  const [live, setLive] = React.useState("");
  const latest = React.useRef(value);
  latest.current = value;
  React.useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight + 2)}px`;
  }, [value, live]);
  React.useEffect(() => () => rec?.stop(), [rec]);
  const can = !!speechCtor();
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
    <div className="rv-ta-w">
      <textarea
        ref={ref}
        className="rv-ta"
        aria-label="מה לשנות כאן?"
        placeholder="מה לשנות כאן? למשל: להגדיל את הכפתור ולשנות לירוק"
        value={live ? `${value}${value && !/\s$/.test(value) ? " " : ""}${live}` : value}
        readOnly={!!rec}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        style={can ? undefined : { paddingLeft: 14 }}
      />
      {can && (
        <button
          type="button"
          className={`rv-mic ${rec ? "on" : ""}`}
          aria-label={rec ? "עצירת ההקלטה" : "הקלטה במקום הקלדה"}
          aria-pressed={!!rec}
          onClick={toggle}
        >
          {rec ? I.stop : I.mic}
        </button>
      )}
    </div>
  );
}

const QUICK = ["להגדיל", "להקטין", "לשנות צבע", "לשנות טקסט", "להחליף תמונה", "להוריד", "לא עובד"];

/* ================================================================== */
export default function ReviewPage({ id }: { id: string }) {
  const [info, setInfo] = React.useState<Info | null>(null);
  const [fail, setFail] = React.useState("");
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [view, setView] = React.useState<View>(() =>
    typeof window !== "undefined" && window.innerWidth < 700 ? "mobile" : "desktop",
  );
  const [path, setPath] = React.useState("/");
  const [frameKey, setFrameKey] = React.useState(0);
  const [live, setLive] = React.useState<"loading" | "live" | "none">("loading");
  const [useShot, setUseShot] = React.useState(false);
  const [shot, setShot] = React.useState<{ url: string; key: string } | null>(null);
  const [shotErr, setShotErr] = React.useState("");
  const [commenting, setCommenting] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [panel, setPanel] = React.useState(false);
  const [focusId, setFocusId] = React.useState("");
  const [showOld, setShowOld] = React.useState(false);
  const [name, setName] = React.useState(() => store.get("rv-name"));
  const [welcome, setWelcome] = React.useState(false);
  const [dialog, setDialog] = React.useState<"" | "send" | "approve">("");
  const [toast, setToast] = React.useState<{ t: string; bad?: boolean } | null>(null);
  const [zoom, setZoom] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState("");
  const [size, setSize] = React.useState({ w: 1000, h: 700 });

  const stageRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const childOrigin = React.useRef("*");
  const pathRef = React.useRef("/");
  const pendingFocus = React.useRef("");
  const awaiting = React.useRef(false);
  const shotImg = React.useRef<HTMLImageElement>(null);
  const draftRef = React.useRef<Draft | null>(null);
  draftRef.current = draft;

  const flash = React.useCallback((t: string, bad = false) => {
    setToast({ t, bad });
    window.setTimeout(() => setToast((x) => (x?.t === t ? null : x)), 2600);
  }, []);

  /* ---------- load ---------- */
  const load = React.useCallback(
    (first = false) =>
      fetch(`/api/review?r=${encodeURIComponent(id)}`)
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(r.status === 404 ? "missing" : "net");
          setInfo({
            url: j.url,
            project: j.project,
            owner: j.owner,
            round: j.round,
            approved: j.approved,
            sentAt: j.sentAt,
          });
          setNotes(j.comments || []);
          if (first) {
            let p = "/";
            try {
              p = new URL(j.url).pathname || "/";
            } catch {
              /* keep / */
            }
            pathRef.current = p;
            setPath(p);
            if (!store.get(`rv-welcome-${id}`)) setWelcome(true);
          }
        })
        .catch((e) => first && setFail((e as Error).message === "missing" ? "missing" : "net")),
    [id],
  );
  React.useEffect(() => {
    void load(true);
    const vis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [load]);

  /* ---------- stage size ---------- */
  React.useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [info]);

  const base = React.useMemo(() => {
    try {
      return info ? new URL(info.url) : null;
    } catch {
      return null;
    }
  }, [info]);
  const src = React.useMemo(
    () => (base ? new URL(pathRef.current || "/", base).toString() : ""),
    // a new frame only when the view changes or a note on another page is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, frameKey, view],
  );

  /* ---------- talk to feedback.js inside the site ---------- */
  const toChild = React.useCallback((m: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ ...m, src: SRC }, childOrigin.current);
  }, []);

  const frameId = `${view}-${frameKey}`;
  React.useEffect(() => {
    setLive("loading");
    childOrigin.current = "*";
  }, [src, frameId]);

  const round = info?.round ?? 1;
  const listed = React.useMemo(() => {
    const cur = notes.filter((n) => n.round === round);
    const old = notes.filter((n) => n.round < round);
    return { cur: sortNotes(cur), old: sortNotes(old).reverse() };
  }, [notes, round]);
  const numOf = React.useMemo(() => {
    const m: Record<string, number> = {};
    listed.cur.forEach((n, i) => (m[n.id] = i + 1));
    sortNotes(listed.old).forEach((n, i) => (m[n.id] = i + 1));
    return m;
  }, [listed]);

  const pinsHere = React.useMemo(
    () =>
      notes.filter(
        (n) =>
          n.view === view && normPath(n.path) === normPath(path) && (n.round === round || showOld),
      ),
    [notes, view, path, round, showOld],
  );

  const sendPins = React.useCallback(
    (clearTemp = false) => {
      toChild({
        type: "pins",
        clearTemp,
        pins: pinsHere
          .filter((n) => n.mode === "live" && n.anchor)
          .map((n) => ({
            id: n.id,
            n: numOf[n.id],
            anchor: n.anchor,
            done: !!n.done,
            old: n.round < round,
            text: n.text,
          })),
      });
    },
    [pinsHere, numOf, round, toChild],
  );
  const sendPinsRef = React.useRef(sendPins);
  sendPinsRef.current = sendPins;
  const commentingRef = React.useRef(commenting);
  commentingRef.current = commenting;

  React.useEffect(() => {
    if (live === "live") sendPins(!draft);
  }, [live, sendPins, draft]);
  React.useEffect(() => {
    if (live === "live") toChild({ type: "mode", on: commenting && !draft });
  }, [live, commenting, draft, toChild]);

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (!m || m.src !== SRC || e.source !== frameRef.current?.contentWindow) return;
      // only the client's own site (with or without www) may talk to us
      const bare = (h: string) => h.replace(/^www\./, "");
      try {
        if (!base || bare(new URL(e.origin).hostname) !== bare(base.hostname)) return;
      } catch {
        return;
      }
      if (m.type === "here") {
        childOrigin.current = e.origin;
        awaiting.current = false;
        toChild({ type: "hello" });
        return;
      }
      if (m.type === "ready" || m.type === "nav") {
        childOrigin.current = e.origin;
        awaiting.current = false;
        const p = String(m.path || "/");
        pathRef.current = p;
        setPath(p);
        setLive("live");
        toChild({ type: "mode", on: commentingRef.current && !draftRef.current });
        setTimeout(() => {
          sendPinsRef.current(true);
          if (pendingFocus.current) {
            toChild({ type: "focus", id: pendingFocus.current });
            pendingFocus.current = "";
          }
        }, 60);
      } else if (m.type === "pick") {
        const v = view;
        setDraft({
          pickId: String(m.pickId),
          mode: "live",
          view: v,
          path: String(m.path || pathRef.current),
          anchor: m.anchor,
          shot: undefined,
          text: "",
        });
        setErr("");
      } else if (m.type === "shot") {
        setDraft((d) =>
          d && d.pickId === m.pickId
            ? { ...d, shot: typeof m.data === "string" ? m.data : null }
            : d,
        );
      } else if (m.type === "pin-click") {
        const id2 = String(m.id);
        setFocusId(id2);
        setPanel(true);
        document
          .getElementById(`rv-n-${id2}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id, toChild, view, base]);

  // after every page load inside the frame, ask feedback.js to answer; no answer → the page
  // doesn't have the line (or the site can't be shown in a frame)
  const onFrameLoad = () => {
    awaiting.current = true;
    window.setTimeout(() => {
      if (!awaiting.current) return;
      // no id or notes in this message: the frame may be showing some other site by now
      frameRef.current?.contentWindow?.postMessage({ src: SRC, type: "hello" }, "*");
    }, 250);
    window.setTimeout(() => {
      if (awaiting.current) setLive("none");
    }, 3500);
  };

  /* ---------- full-page screenshot (fallback) ---------- */
  const shotKey = `${view}|${normPath(path)}`;
  React.useEffect(() => {
    if (!useShot || shot?.key === shotKey) return;
    let dead = false;
    setShotErr("");
    setShot(null);
    api(id, "page", { view, path })
      .then((j) => !dead && setShot({ url: j.url, key: shotKey }))
      .catch((e) => !dead && setShotErr((e as Error).message));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useShot, shotKey, id]);

  const mode: Note["mode"] = useShot ? "shot" : live === "live" ? "live" : "overlay";

  /* ---------- geometry ---------- */
  const narrow = size.w < 520;
  let W: number;
  let H: number;
  let s: number;
  if (view === "desktop") {
    W = Math.max(DESK_W, size.w - 32 > DESK_W ? size.w - 32 : DESK_W);
    s = zoom ? 1 : Math.min(1, (size.w - (narrow ? 16 : 32)) / W);
    H = Math.max(300, (size.h - (narrow ? 10 : 32) - 38) / s);
  } else if (narrow) {
    W = PHONE_W;
    s = Math.min(1.2, (size.w - 16) / PHONE_W);
    H = Math.max(300, (size.h - 10) / s);
  } else {
    W = PHONE_W;
    s = Math.min(1, (size.h - 32 - 24) / PHONE_H);
    H = PHONE_H;
  }
  const canZoom = view === "desktop" && Math.min(1, (size.w - 32) / W) < 0.8;

  /* ---------- picking without feedback.js ---------- */
  const pickOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({
      mode: "overlay",
      view,
      path: pathRef.current,
      pos: {
        x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
        y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
      },
      shot: null,
      text: "",
    });
    setErr("");
  };
  const pickShot = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!commenting || draft) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pos = {
      x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    };
    setDraft({
      mode: "shot",
      view,
      path: pathRef.current,
      pos,
      shot: shotImg.current ? cropShot(shotImg.current, pos.x, pos.y) : null,
      text: "",
    });
    setErr("");
  };

  /* ---------- save / edit / delete ---------- */
  const save = async () => {
    if (!draft || saving) return;
    const text = draft.text.trim();
    if (!text) {
      setErr("כתבו מה לשנות");
      return;
    }
    if (!name.trim()) {
      setErr("רק השם שלכם, כדי שנדע ממי ההערה");
      return;
    }
    store.set("rv-name", name.trim());
    setSaving(true);
    setErr("");
    try {
      const nid = draft.editId || noteId();
      let shotPath: string | undefined;
      if (draft.shot && !draft.editId) {
        try {
          shotPath = (await api(id, `shot&c=${nid}`, undefined, dataUrlBlob(draft.shot))).path;
        } catch {
          shotPath = undefined; // the note matters more than the picture
        }
      }
      const prev = notes.find((n) => n.id === nid);
      const j = await api(id, "comment", {
        comment: {
          id: nid,
          view: draft.view,
          path: draft.path,
          text,
          author: name.trim(),
          at: prev?.at ?? Date.now(),
          mode: draft.mode,
          anchor: draft.anchor,
          pos: draft.pos,
          shot: shotPath ?? prev?.shot,
        },
      });
      const saved: Note = {
        ...j.comment,
        shotUrl: draft.shot && !draft.editId ? draft.shot : prev?.shotUrl,
      };
      setNotes((ns) =>
        ns.some((n) => n.id === nid) ? ns.map((n) => (n.id === nid ? saved : n)) : [...ns, saved],
      );
      setDraft(null);
      flash(draft.editId ? "ההערה עודכנה" : "ההערה נשמרה ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (n: Note) => {
    if (confirmDel !== n.id) {
      setConfirmDel(n.id);
      window.setTimeout(() => setConfirmDel((c) => (c === n.id ? "" : c)), 3000);
      return;
    }
    setConfirmDel("");
    const before = notes;
    setNotes((ns) => ns.filter((x) => x.id !== n.id));
    try {
      await api(id, "delete", { id: n.id });
    } catch (e) {
      setNotes(before);
      flash((e as Error).message, true);
    }
  };
  const edit = (n: Note) => {
    setDraft({
      editId: n.id,
      mode: n.mode,
      view: n.view,
      path: n.path,
      anchor: n.anchor,
      pos: n.pos,
      shot: n.shotUrl ?? null,
      text: n.text,
    });
    setErr("");
    setPanel(false);
  };

  /* ---------- open a note: right view, right page, scroll to it ---------- */
  const open = (n: Note) => {
    setFocusId(n.id);
    if (window.innerWidth < 1000) setPanel(false);
    const samePage = normPath(n.path) === normPath(pathRef.current);
    if (n.view !== view || !samePage) {
      pathRef.current = n.path;
      setPath(n.path);
      pendingFocus.current = n.id;
      if (n.view !== view) setView(n.view);
      else setFrameKey((k) => k + 1);
      return;
    }
    if (mode === "live") toChild({ type: "focus", id: n.id });
    else if (mode === "shot" && n.pos)
      document
        .getElementById(`rv-m-${n.id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  /* ---------- send / approve ---------- */
  const [busy, setBusy] = React.useState(false);
  const finish = async (kind: "send" | "approve") => {
    if (!name.trim()) {
      setErr("רק השם שלכם");
      return;
    }
    store.set("rv-name", name.trim());
    setBusy(true);
    setErr("");
    try {
      const j = await api(id, kind, { name: name.trim() });
      setInfo((i) =>
        i
          ? kind === "approve"
            ? { ...i, approved: { name: name.trim(), at: j.at, round: i.round } }
            : { ...i, sentAt: j.at }
          : i,
      );
      setDialog("");
      setCommenting(false);
      flash(
        kind === "approve"
          ? "תודה! העיצוב אושר ✓"
          : `נשלח! ${info?.owner || "קיבלנו"} יעבור על ההערות`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- render ---------- */
  if (fail)
    return (
      <div className="rv-full" dir="rtl">
        <style>{REVIEW_CSS}</style>
        <div>
          <img
            src="/brief/rimon-sit.webp"
            alt=""
            width={120}
            style={{ margin: "0 auto 12px", display: "block" }}
          />
          <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>
            {fail === "missing" ? "הקישור הזה כבר לא פעיל" : "אין חיבור כרגע"}
          </h1>
          <p style={{ color: "#74737f", margin: 0 }}>
            {fail === "missing"
              ? "בקשו קישור חדש ממי ששלח לכם אותו."
              : "בדקו את האינטרנט ונסו לרענן."}
          </p>
        </div>
      </div>
    );
  if (!info)
    return (
      <div className="rv-full" dir="rtl">
        <style>{REVIEW_CSS}</style>
        <div>
          <div className="rv-spin" />
          טוען את האתר…
        </div>
      </div>
    );

  const host = base?.host.replace(/^www\./, "") || info.url;
  const hereMarks = pinsHere.filter((n) => n.mode === mode && n.pos);
  const curCount = listed.cur.length;

  const frame = (
    <>
      <iframe
        ref={frameRef}
        key={frameId}
        src={src}
        title="האתר"
        className="rv-frame"
        style={{
          width: W,
          height: H,
          transform: `scale(${s})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        onLoad={onFrameLoad}
        allow="autoplay; fullscreen"
      />
      {live === "loading" && (
        <div className="rv-loading">
          <div>
            <div className="rv-spin" />
            טוען את האתר…
          </div>
        </div>
      )}
      {mode === "overlay" && commenting && !draft && (
        <div className="rv-cover" onClick={pickOverlay} aria-label="לחצו על המקום שתרצו לשנות" />
      )}
      {draft?.mode === "overlay" && draft.pos && !draft.editId && (
        <div className="rv-mark new" style={{ left: `${draft.pos.x}%`, top: `${draft.pos.y}%` }}>
          +
        </div>
      )}
    </>
  );

  let stageInner: React.ReactNode;
  if (useShot) {
    const iw = view === "desktop" ? Math.min(size.w - 32, 1440) : Math.min(size.w - 16, 390);
    stageInner = (
      <div className="rv-shotscroll">
        {shotErr ? (
          <div
            className="rv-note"
            style={{ position: "static", transform: "none", margin: "40px auto" }}
          >
            <b>{shotErr}</b>
            <div className="rv-row">
              <button className="rv-btn ghost" onClick={() => setShot(null)}>
                לנסות שוב
              </button>
              <button className="rv-btn ghost" onClick={() => setUseShot(false)}>
                חזרה לאתר החי
              </button>
            </div>
          </div>
        ) : !shot ? (
          <div className="rv-loading" style={{ background: "transparent" }}>
            <div>
              <div className="rv-spin" />
              מצלמים את כל הדף, זה לוקח כחצי דקה…
            </div>
          </div>
        ) : (
          <div
            className="rv-shotwrap"
            style={{
              width: iw,
              cursor: commenting && !draft ? "crosshair" : undefined,
              alignSelf: "flex-start",
            }}
            onClick={pickShot}
          >
            <img ref={shotImg} src={shot.url} alt="צילום של הדף" crossOrigin="anonymous" />
            {hereMarks.map((n) => (
              <button
                key={n.id}
                id={`rv-m-${n.id}`}
                className={`rv-mark ${n.done ? "done" : n.round < round ? "old" : ""}`}
                style={{ left: `${n.pos!.x}%`, top: `${n.pos!.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusId(n.id);
                  setPanel(true);
                }}
              >
                {n.done ? "✓" : numOf[n.id]}
              </button>
            ))}
            {draft?.mode === "shot" && draft.pos && !draft.editId && (
              <div
                className="rv-mark new"
                style={{ left: `${draft.pos.x}%`, top: `${draft.pos.y}%` }}
              >
                +
              </div>
            )}
          </div>
        )}
      </div>
    );
  } else if (view === "desktop") {
    stageInner = (
      <div className="rv-win" style={{ width: W * s, direction: "ltr" }}>
        <div className="rv-bar">
          <i />
          <i />
          <i />
          <div className="rv-url">
            {host}
            {normPath(path) === "/" ? "" : normPath(path)}
          </div>
        </div>
        <div style={{ position: "relative", width: W * s, height: H * s, overflow: "hidden" }}>
          {frame}
        </div>
      </div>
    );
  } else {
    stageInner = (
      <div className={`rv-phone ${narrow ? "flat" : ""}`} style={{ direction: "ltr" }}>
        <div className="rv-screen" style={{ width: W * s, height: H * s }}>
          {frame}
        </div>
      </div>
    );
  }

  const where = draft ? whereText(draft) : "";
  const panelBody = (
    <>
      <div className="rv-ph">
        <h2>ההערות שלכם{curCount ? ` (${curCount})` : ""}</h2>
        <p>
          {round > 1 ? `סבב ${round} · ` : ""}
          לחיצה על הערה מראה איפה היא באתר
        </p>
      </div>
      <div className="rv-list">
        {info.approved && info.approved.round === round && (
          <div className="rv-done">
            ✓ העיצוב אושר על ידי {info.approved.name} · {fmt(info.approved.at)}
          </div>
        )}
        {info.sentAt && !info.approved && (
          <div className="rv-sent">
            ההערות נשלחו ב-{fmt(info.sentAt)}. אפשר להוסיף עוד, ולשלוח שוב.
          </div>
        )}
        {curCount === 0 && (
          <div className="rv-empty">
            <img src="/brief/rimon-point.webp" alt="" />
            עוד אין הערות.
            <br />
            לחצו על <b>הוספת הערה</b> ואז על המקום באתר.
          </div>
        )}
        {listed.cur.map((n) => (
          <NoteRow
            key={n.id}
            n={n}
            num={numOf[n.id]}
            on={focusId === n.id}
            onOpen={() => open(n)}
            onEdit={n.done ? undefined : () => edit(n)}
            onDelete={n.done ? undefined : () => void remove(n)}
            confirmDel={confirmDel === n.id}
          />
        ))}
        {listed.old.length > 0 && (
          <>
            <div className="rv-sec">
              סבבים קודמים ({listed.old.length})
              <button onClick={() => setShowOld((v) => !v)}>{showOld ? "להסתיר" : "להציג"}</button>
            </div>
            {showOld &&
              listed.old.map((n) => (
                <NoteRow
                  key={n.id}
                  n={n}
                  num={numOf[n.id]}
                  old
                  on={focusId === n.id}
                  onOpen={() => open(n)}
                />
              ))}
          </>
        )}
      </div>
      <div className="rv-pf">
        <button className="rv-btn pri" disabled={!curCount} onClick={() => setDialog("send")}>
          {I.send} סיימתי, לשלוח את ההערות
        </button>
        <button className="rv-btn ok" onClick={() => setDialog("approve")}>
          {I.check} הכל מעולה, מאשר/ת את העיצוב
        </button>
      </div>
    </>
  );

  return (
    <div className="rv" dir="rtl">
      <style>{REVIEW_CSS}</style>
      <header className="rv-top">
        <div className="rv-brand">
          <img src="/brief/rimon.webp" alt="" />
          <div style={{ minWidth: 0 }}>
            <b>{info.project || host}</b>
            <span>משוב על העיצוב{info.owner ? ` · ${info.owner}` : ""}</span>
          </div>
        </div>
        <div className="rv-seg" role="tablist" aria-label="תצוגה">
          {(["desktop", "mobile"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? "on" : ""}
              onClick={() => {
                if (v === view) return;
                setDraft(null);
                setView(v);
                setZoom(false);
              }}
            >
              {v === "desktop" ? I.desk : I.phone}
              <em style={{ fontStyle: "normal" }}>{VIEW_HE[v]}</em>
            </button>
          ))}
        </div>
        <button className="rv-count" onClick={() => setPanel(true)} aria-label="ההערות">
          הערות <i>{curCount}</i>
        </button>
      </header>

      <div className="rv-body">
        <div ref={stageRef} className={`rv-stage ${zoom ? "zoom" : ""}`}>
          {stageInner}

          {commenting && !draft && !toast && (
            <div className="rv-hint">
              {mode === "live"
                ? "לחצו על המקום שתרצו לשנות"
                : mode === "shot"
                  ? "לחצו על המקום בצילום"
                  : "לחצו על המקום במסך"}
            </div>
          )}

          {live === "none" && !useShot && !draft && (
            <div className="rv-note" role="status">
              <b>האתר לא נטען כאן כמו שצריך?</b> אפשר לעבור לצילום מלא של הדף ולסמן עליו.
              {commenting && " בינתיים הסימון הוא על המסך כפי שהוא נראה."}
              <div className="rv-row">
                <button className="rv-btn ghost" onClick={() => setUseShot(true)}>
                  מעבר לצילום הדף
                </button>
              </div>
            </div>
          )}
          {useShot && !draft && shot && (
            <div
              className="rv-note"
              style={{
                bottom: "auto",
                top: commenting ? 60 : 12,
                width: "auto",
                padding: "8px 14px",
              }}
            >
              זה צילום של הדף.{" "}
              <button
                style={{ color: "var(--accent)", fontWeight: 700 }}
                onClick={() => setUseShot(false)}
              >
                חזרה לאתר החי
              </button>
            </div>
          )}

          {canZoom && !useShot && (
            <button className="rv-zoom" onClick={() => setZoom((z) => !z)}>
              {zoom ? "התאמה למסך" : "גודל אמיתי"}
            </button>
          )}

          {!info.approved || info.approved.round !== round ? (
            <button
              className={`rv-fab ${commenting ? "on" : ""}`}
              onClick={() => {
                setCommenting((c) => !c);
                setDraft(null);
              }}
              aria-pressed={commenting}
            >
              {commenting ? I.check : I.pin}
              {commenting ? "סיום הוספת הערות" : "הוספת הערה"}
            </button>
          ) : null}
        </div>

        {panel && <div className="rv-scrim" onClick={() => setPanel(false)} />}
        <aside className={`rv-panel ${panel ? "open" : ""}`} aria-label="הערות">
          {panelBody}
        </aside>
      </div>

      {draft && (
        <div className="rv-dlg" role="dialog" aria-label="הערה חדשה">
          <h3>{draft.editId ? "עריכת ההערה" : "מה לשנות כאן?"}</h3>
          <p className="rv-where">
            {I.pin}
            <span>
              {VIEW_HE[draft.view]} · {where}
            </span>
          </p>
          {draft.shot === undefined ? (
            <div className="rv-shot wait">מצלמים את מה שאתם רואים…</div>
          ) : draft.shot ? (
            <img className="rv-shot" src={draft.shot} alt="מה שסומן" />
          ) : null}
          {!draft.editId && (
            <div className="rv-quick">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() =>
                    setDraft((d) =>
                      d ? { ...d, text: d.text ? `${d.text.trimEnd()} ${q}` : q } : d,
                    )
                  }
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <NoteText
            value={draft.text}
            onChange={(t) => setDraft((d) => (d ? { ...d, text: t } : d))}
            onSubmit={() => void save()}
          />
          {!store.get("rv-name") && (
            <>
              <label className="rv-lbl" htmlFor="rv-name">
                השם שלכם
              </label>
              <input
                id="rv-name"
                className="rv-in"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          {err && <p className="rv-err">{err}</p>}
          <div className="rv-row">
            <button className="rv-btn pri" onClick={() => void save()} disabled={saving}>
              {saving ? "שומר…" : "שמירה"}
            </button>
            <button
              className="rv-btn ghost"
              onClick={() => {
                setDraft(null);
                setErr("");
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {dialog && (
        <>
          <div className="rv-scrim" style={{ zIndex: 29 }} onClick={() => setDialog("")} />
          <div className="rv-dlg" role="dialog">
            <h3>{dialog === "approve" ? "לאשר את העיצוב?" : "לשלוח את ההערות?"}</h3>
            <p style={{ margin: "0 0 6px", color: "var(--mut)" }}>
              {dialog === "approve"
                ? curCount
                  ? `האישור יישלח יחד עם ${curCount} ההערות שכתבתם.`
                  : "נעדכן שהעיצוב מאושר ושאפשר להמשיך."
                : `${curCount} הערות יישלחו${info.owner ? ` ל${info.owner}` : ""}. אפשר להמשיך להוסיף גם אחר כך.`}
            </p>
            <label className="rv-lbl" htmlFor="rv-name2">
              השם שלכם
            </label>
            <input
              id="rv-name2"
              className="rv-in"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
            {err && <p className="rv-err">{err}</p>}
            <div className="rv-row">
              <button
                className={`rv-btn ${dialog === "approve" ? "ok" : "pri"}`}
                disabled={busy}
                onClick={() => void finish(dialog)}
              >
                {busy ? "שולח…" : dialog === "approve" ? "מאשר/ת ✓" : "שליחה"}
              </button>
              <button className="rv-btn ghost" onClick={() => setDialog("")}>
                ביטול
              </button>
            </div>
          </div>
        </>
      )}

      {welcome && (
        <div className="rv-welcome">
          <div className="rv-wcard">
            <img src="/brief/rimon-hello.webp" alt="" />
            <h2>זה האתר שלכם</h2>
            <p>מה שאתם רואים כאן הוא האתר עצמו. אפשר לגלול, ללחוץ ולעבור בין דפים.</p>
            <ol className="rv-steps">
              <li>
                <span>1</span>עוברים על האתר, במחשב ובטלפון (הכפתורים למעלה)
              </li>
              <li>
                <span>2</span>לוחצים על <b>הוספת הערה</b> ואז על המקום שרוצים לשנות
              </li>
              <li>
                <span>3</span>כותבים מה לשנות, ובסוף לוחצים <b>שליחה</b>
              </li>
            </ol>
            <button
              className="rv-btn pri"
              style={{ width: "100%" }}
              onClick={() => {
                store.set(`rv-welcome-${id}`, "1");
                setWelcome(false);
              }}
            >
              בואו נתחיל
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`rv-toast ${toast.bad ? "bad" : ""}`} role="status">
          {toast.t}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  n,
  num,
  on,
  old,
  onOpen,
  onEdit,
  onDelete,
  confirmDel,
}: {
  n: Note;
  num: number;
  on: boolean;
  old?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  confirmDel?: boolean;
}) {
  return (
    <div id={`rv-n-${n.id}`} className={`rv-item ${on ? "on" : ""}`}>
      <span className={`rv-num ${n.done ? "done" : old ? "old" : ""}`}>{n.done ? "✓" : num}</span>
      <div className="rv-item-b">
        <button style={{ textAlign: "right", width: "100%" }} onClick={onOpen}>
          <div className="rv-item-t">{n.text}</div>
          <div className="rv-item-w">
            <span className="rv-chip">{VIEW_HE[n.view]}</span>
            {n.path !== "/" && <span>{`\u2066${n.path}\u2069`}</span>}
            {n.done && <span className="rv-chip ok">תוקן</span>}
            {old && !n.done && <span className="rv-chip">בטיפול</span>}
          </div>
        </button>
        {(onEdit || onDelete) && (
          <div className="rv-acts">
            {onEdit && <button onClick={onEdit}>עריכה</button>}
            {onDelete && (
              <button
                onClick={onDelete}
                style={confirmDel ? { color: "#b42318", fontWeight: 700 } : undefined}
              >
                {confirmDel ? "בטוח? ללחוץ שוב" : "מחיקה"}
              </button>
            )}
          </div>
        )}
      </div>
      {n.shotUrl && (
        <button onClick={onOpen} aria-hidden tabIndex={-1}>
          <img className="rv-th" src={n.shotUrl} alt="" />
        </button>
      )}
    </div>
  );
}
