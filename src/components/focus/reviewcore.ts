/**
 * Design review — pure helpers shared by the client page (/r/<id>), the server route
 * (/api/review) and the owner panel. No DOM, no network.
 */
import type { Review, ReviewAnchor, ReviewComment } from "./types";

export const MAX_COMMENTS = 300;
export const MAX_TEXT = 2000;

const str = (v: unknown, n: number) => (typeof v === "string" ? v : "").slice(0, n);
const num = (v: unknown, lo: number, hi: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0;
};

export const validReviewId = (s: unknown): s is string =>
  typeof s === "string" && /^[A-Za-z0-9]{12,40}$/.test(s);
export const validNoteId = (s: unknown): s is string =>
  typeof s === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(s);

export function newReviewId() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return [...a].map((n) => abc[n % abc.length]).join("");
}

export function cleanAnchor(v: unknown): ReviewAnchor | undefined {
  if (!v || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  const sel = str(a.sel, 600);
  if (!sel) return undefined;
  return {
    sel,
    tag: str(a.tag, 20).toLowerCase(),
    text: str(a.text, 160),
    section: str(a.section, 120),
    ox: num(a.ox, 0, 1),
    oy: num(a.oy, 0, 1),
    px: num(a.px, 0, 1e6),
    py: num(a.py, 0, 1e6),
    ph: num(a.ph, 0, 1e6),
    vw: num(a.vw, 0, 1e5),
  };
}

/** what a client may send for one note — anything else is dropped */
export function cleanComment(v: unknown, round: number): ReviewComment | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (!validNoteId(c.id)) return null;
  const text = str(c.text, MAX_TEXT).trim();
  if (!text) return null;
  const mode = c.mode === "overlay" ? "overlay" : c.mode === "shot" ? "shot" : "live";
  const pos =
    c.pos && typeof c.pos === "object"
      ? {
          x: num((c.pos as Record<string, unknown>).x, 0, 100),
          y: num((c.pos as Record<string, unknown>).y, 0, 100),
        }
      : undefined;
  let path = str(c.path, 300) || "/";
  if (!path.startsWith("/")) path = "/" + path;
  return {
    id: c.id,
    round,
    view: c.view === "mobile" ? "mobile" : "desktop",
    path,
    text,
    author: str(c.author, 60).trim(),
    at: Number(c.at) > 0 ? Math.min(Number(c.at), Date.now() + 60_000) : Date.now(),
    mode,
    anchor: mode === "live" ? cleanAnchor(c.anchor) : undefined,
    pos: mode === "live" ? undefined : pos,
    shot: typeof c.shot === "string" ? c.shot.slice(0, 300) : undefined,
  };
}

export const VIEW_HE = { desktop: "מחשב", mobile: "טלפון" } as const;

const TAG_HE: Record<string, string> = {
  a: "הקישור",
  button: "הכפתור",
  img: "התמונה",
  svg: "האייקון",
  video: "הסרטון",
  h1: "הכותרת",
  h2: "הכותרת",
  h3: "הכותרת",
  h4: "הכותרת",
  h5: "הכותרת",
  h6: "הכותרת",
  p: "הפסקה",
  li: "הפריט ברשימה",
  input: "השדה",
  textarea: "השדה",
  select: "השדה",
  form: "הטופס",
  nav: "התפריט",
  header: "הכותרת העליונה",
  footer: "הפוטר",
  section: "הסקשן",
  label: "התווית",
  span: "הטקסט",
  strong: "הטקסט",
  iframe: "המפה / ההטמעה",
};

/** "in the section 'Our services', on the button 'Contact us'" — or a rough position */
export function whereText(c: Pick<ReviewComment, "mode" | "anchor" | "pos">): string {
  const a = c.anchor;
  if (c.mode === "live" && a) {
    const what = TAG_HE[a.tag] || "האלמנט";
    const label = a.text
      ? `${what} "${a.text.length > 60 ? a.text.slice(0, 60) + "…" : a.text}"`
      : what;
    const sec = a.section && a.section !== a.text ? `בסקשן "${a.section}", ` : "";
    return `${sec}${label}`;
  }
  if (c.pos) {
    const side = c.pos.x < 33 ? "בצד שמאל" : c.pos.x > 66 ? "בצד ימין" : "במרכז";
    return c.mode === "shot"
      ? `${side}, בערך ב-${Math.round(c.pos.y)}% מגובה הדף (לפי צילום)`
      : `${side}, בערך ב-${Math.round(c.pos.y)}% מגובה המסך (מיקום משוער)`;
  }
  return "לא צוין מקום";
}

export const sortNotes = (cs: ReviewComment[]) =>
  [...cs].sort((a, b) => a.round - b.round || a.at - b.at);

/** a ready message for Claude: every open note with where it is and what to change */
export function claudePrompt(
  r: Pick<Review, "url" | "round" | "projectName">,
  notes: ReviewComment[],
  opts: { shots?: Record<string, string> } = {},
): string {
  const list = sortNotes(notes);
  const L: string[] = [];
  L.push(
    `באתר ${r.url}${r.projectName ? ` (${r.projectName})` : ""} הלקוח השאיר ${list.length} הערות לתיקון.`,
  );
  L.push(
    "תקן כל אחת מהן. אחרי כל תיקון בדוק אותו גם בתצוגת מחשב וגם בטלפון, ואל תשנה דברים שלא התבקשו.",
  );
  L.push("");
  list.forEach((c, i) => {
    L.push(`${i + 1}. [${VIEW_HE[c.view]} · עמוד ${c.path}]`);
    L.push(`   איפה: ${whereText(c)}`);
    if (c.mode === "live" && c.anchor?.sel) L.push(`   CSS: ${c.anchor.sel}`);
    L.push(`   מה לשנות: ${c.text.replace(/\s*\n\s*/g, " / ")}`);
    if (opts.shots?.[c.id]) L.push(`   צילום של מה שהלקוח ראה: ${opts.shots[c.id]}`);
    L.push("");
  });
  L.push("בסוף, תן רשימה קצרה: מה תוקן בכל סעיף, ומה לא ברור לך.");
  return L.join("\n");
}

/** the line the owner pastes into a site so notes pin to real elements */
export const scriptTag = (origin: string) => `<script src="${origin}/feedback.js" async></script>`;
