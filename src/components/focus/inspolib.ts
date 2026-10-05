/**
 * Inspiration library — lists, filtering, the message for Claude (pure), and the screenshot calls.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Inspo } from "./types";

export const DEFAULT_CATS = [
  "מסעדות ואוכל",
  "עורכי דין ומשרדים",
  "חנויות",
  "אירועים",
  "אמנות ועיצוב",
  "גינון ונוף",
  "בריאות וטיפול",
  "חינוך והדרכה",
  'נדל"ן',
  "טכנולוגיה",
  "דפי נחיתה",
  "תיק עבודות",
  "אחר",
];

/** what I liked about a whole site */
export const SITE_PARTS = [
  "פתיח",
  "תפריט",
  "צבעים",
  "טיפוגרפיה",
  "הנפשות",
  "תמונות",
  "מבנה הדף",
  "מובייל",
  "טפסים",
  "פוטר",
];

/** what kind of section a saved section is */
export const SECTION_TYPES = [
  "פתיח",
  "תפריט ניווט",
  "שירותים",
  "אודות",
  "המלצות",
  "גלריה",
  "מחירים",
  "שאלות נפוצות",
  "צור קשר וטופס",
  "קריאה לפעולה",
  "פוטר",
  "הנפשה",
  "אחר",
];

export const catsOf = (custom?: string[]) => (custom && custom.length ? custom : DEFAULT_CATS);

export const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const normUrl = (raw: string) => {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export interface InspoFilter {
  kind: "all" | "site" | "section";
  cat: string;
  part: string;
  q: string;
  fav: boolean;
  projectId?: string;
}

export function filterInspo(items: Inspo[], f: InspoFilter): Inspo[] {
  const q = f.q.trim().toLowerCase();
  return items.filter(
    (it) =>
      (f.kind === "all" || it.kind === f.kind) &&
      (!f.cat || it.category === f.cat) &&
      (!f.part || it.parts.includes(f.part)) &&
      (!f.fav || it.fav) &&
      (!f.projectId || (it.projectIds || []).includes(f.projectId)) &&
      (!q ||
        [it.title, it.url, it.note, it.category, ...it.parts].some((s) =>
          (s || "").toLowerCase().includes(q),
        )),
  );
}

/** a ready message for Claude: these are the references, this is what to take from each */
export function inspoPrompt(items: Inspo[], all: Inspo[] = items, forWhat = ""): string {
  const L: string[] = [];
  L.push(
    `${forWhat ? `אני בונה ${forWhat}. ` : ""}אלה אתרים וסקשנים שאני אוהב, לקחת מהם השראה (לא להעתיק אחד לאחד):`,
  );
  L.push("");
  items.forEach((it, i) => {
    const site = it.siteId ? all.find((x) => x.id === it.siteId) : undefined;
    const url = it.url || site?.url || "";
    const name = it.title || site?.title || hostOf(url);
    if (it.kind === "section") {
      L.push(
        `${i + 1}. סקשן ${it.parts[0] ? `"${it.parts.join(", ")}"` : ""} מתוך ${name}${url ? ` (${url})` : ""}`,
      );
      if (it.img?.url) L.push(`   תמונה: ${it.img.url}`);
    } else {
      L.push(`${i + 1}. ${name}${url ? ` (${url})` : ""}`);
      if (it.parts.length) L.push(`   מה לקחת: ${it.parts.join(", ")}`);
    }
    if (it.note.trim()) L.push(`   הערה שלי: ${it.note.trim().replace(/\s*\n\s*/g, " / ")}`);
    L.push("");
  });
  L.push(
    "תסתכל על כל אחד, תגיד לי בקצרה מה בדיוק אתה לוקח ממנו, ואז תבנה בהתאם. שמור על עברית מימין לשמאל ועל מובייל מושלם.",
  );
  return L.join("\n");
}

/* ---------------- screenshots (server) ---------------- */
const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

async function token() {
  if (!configured) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}
export const canShoot = () => configured;

async function call(path: string, body: BodyInit, type: string) {
  const t = await token();
  if (!t) throw new Error("צריך להיות מחובר לענן");
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": type, authorization: `Bearer ${t}` },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "לא הצלחנו");
  return j;
}

export async function pageMeta(url: string): Promise<{ title: string; description: string }> {
  try {
    return await call("/api/site-shot?op=meta", JSON.stringify({ url }), "application/json");
  } catch {
    return { title: "", description: "" };
  }
}

/* one capture at a time — the free services are slow and rate limited */
let chain: Promise<unknown> = Promise.resolve();
export type ShotKind = "shot" | "mshot" | "full";
export function captureInspo(
  id: string,
  url: string,
  kind: ShotKind,
): Promise<{ url: string; at: number }> {
  const job = chain.then(() =>
    call(
      "/api/site-shot",
      JSON.stringify({
        projectId: `inspo-${id}${kind === "shot" ? "" : `-${kind}`}`,
        url,
        width: kind === "mshot" ? 390 : 1280,
        full: kind === "full",
      }),
      "application/json",
    ),
  );
  chain = job.catch(() => undefined);
  return job as Promise<{ url: string; at: number }>;
}

/** my own picture (a pasted / uploaded screenshot, or a part cut out of a page) */
export async function uploadInspoImg(
  key: string,
  blob: Blob,
): Promise<{ url: string; at: number }> {
  let b = blob;
  try {
    const bmp = await createImageBitmap(blob);
    if (bmp.width > 1800 || blob.size > 1.5e6) {
      const k = Math.min(1, 1800 / bmp.width);
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      b = (await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88))) || blob;
    }
  } catch {
    /* send as is */
  }
  return call(
    `/api/site-shot?op=upload&projectId=${encodeURIComponent(key)}`,
    b,
    b.type || "image/jpeg",
  );
}
