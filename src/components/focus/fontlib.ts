/**
 * Fonts library — loading previews, copy-ready code, downloads, and my uploaded fonts.
 */
import { supabase } from "@/integrations/supabase/client";
import { makeZip } from "./briefcore";
import type { CatalogFont } from "./fontcatalog";
import { parseFont, type FontInfo } from "./fontparse";
import { actions } from "./store";
import type { MyFont } from "./types";
import { uid } from "./utils";

/* ---------------- catalogue fonts ---------------- */
export const cssFamily = (f: CatalogFont) => `'${f.family}'`;

/** the Google Fonts address for a family (all its weights, or the ones given) */
export function googleCssUrl(f: CatalogFont, weights = f.weights, text = "") {
  const fam = f.family.replace(/ /g, "+");
  const ws = weights.filter((w) => f.weights.includes(w));
  let spec = fam;
  if (f.weights.length > 1 && ws.length) {
    spec = f.italic
      ? `${fam}:ital,wght@${[...ws.map((w) => `0,${w}`), ...ws.map((w) => `1,${w}`)].join(";")}`
      : `${fam}:wght@${ws.join(";")}`;
  }
  return `https://fonts.googleapis.com/css2?family=${spec}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;
}

export const linkTag = (fs: CatalogFont[]) => {
  const fams = fs.map((f) => googleCssUrl(f).split("?")[1].split("&display")[0]).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?${fams}&display=swap" rel="stylesheet">`;
};

export const specimenUrl = (f: CatalogFont) =>
  `https://fonts.google.com/specimen/${f.family.replace(/ /g, "+")}`;

/** load a catalogue family into this page (once) for the previews */
const loaded = new Set<string>();
export function loadCatalogFont(f: CatalogFont, all = false) {
  const key = `${f.id}|${all}`;
  if (typeof document === "undefined" || loaded.has(key)) return;
  loaded.add(key);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  const ws = all ? f.weights : f.weights.filter((w) => w === 400 || w === 700);
  l.href = googleCssUrl(f, ws.length ? ws : f.weights.slice(0, 1));
  document.head.appendChild(l);
}

const JSD = (id: string, file: string) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${id}@5/${file}`;
const RANGES: Record<string, string> = {
  hebrew: "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F",
  latin:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
};

/** all the WOFF2 files (Hebrew + Latin) with a ready fonts.css and the licence, as one ZIP */
export async function downloadCatalogZip(
  f: CatalogFont,
  onStep?: (done: number, of: number) => void,
) {
  const subsets = f.hebrew ? ["hebrew", "latin"] : ["latin"];
  const styles = f.italic ? ["normal", "italic"] : ["normal"];
  const jobs: { name: string; url: string; css?: string }[] = [];
  for (const sub of subsets)
    for (const w of f.weights)
      for (const st of styles) {
        const file = `${f.id}-${sub}-${w}-${st}.woff2`;
        jobs.push({
          name: `fonts/${file}`,
          url: JSD(f.id, `files/${file}`),
          css: `@font-face {\n  font-family: '${f.family}';\n  font-style: ${st};\n  font-weight: ${w};\n  font-display: swap;\n  src: url('./fonts/${file}') format('woff2');\n  unicode-range: ${RANGES[sub]};\n}`,
        });
      }
  const out: { name: string; data: Uint8Array }[] = [];
  const css: string[] = [`/* ${f.family} — SIL Open Font License, see OFL.txt */`];
  let done = 0;
  for (const j of jobs) {
    try {
      const r = await fetch(j.url);
      if (r.ok) {
        out.push({ name: j.name, data: new Uint8Array(await r.arrayBuffer()) });
        if (j.css) css.push(j.css);
      }
    } catch {
      /* skip a missing style */
    }
    onStep?.(++done, jobs.length);
  }
  if (!out.length) throw new Error("ההורדה נכשלה. אפשר להוריד מ-Google Fonts");
  try {
    const r = await fetch(JSD(f.id, "LICENSE"));
    if (r.ok) out.push({ name: "OFL.txt", data: new Uint8Array(await r.arrayBuffer()) });
  } catch {
    /* the CSS header still names the licence */
  }
  const enc = new TextEncoder();
  out.push({ name: "fonts.css", data: enc.encode(css.join("\n\n") + "\n") });
  out.push({
    name: "קרא אותי.txt",
    data: enc.encode(
      `${f.family}\nרישיון: SIL Open Font License — חינם לשימוש מסחרי, כולל אתרים של לקוחות.\n\nשימוש: מעתיקים את התיקייה fonts ואת fonts.css לאתר, מוסיפים <link rel="stylesheet" href="fonts.css">\nומשתמשים ב: font-family: '${f.family}', sans-serif;\n`,
    ),
  });
  saveBlob(
    new Blob([makeZip(out) as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
    `${f.family}.zip`,
  );
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** a ready message for Claude: use these fonts, like this */
export function fontPrompt(
  head: { family: string; url?: string; mine?: boolean },
  body?: { family: string; url?: string; mine?: boolean },
): string {
  const L = [
    `תשתמש בפונט "${head.family}"${body ? " לכותרות" : " בכל האתר"}${body ? ` ובפונט "${body.family}" לטקסט` : ""}.`,
  ];
  const how = (f: { family: string; url?: string; mine?: boolean }) =>
    f.mine
      ? `"${f.family}": קובץ שאני מצרף. תשים אותו בתיקיית fonts ותגדיר @font-face עם font-display: swap.`
      : `"${f.family}": מ-Google Fonts${f.url ? ` (${f.url})` : ""}. עדיף לארח את הקבצים באתר עצמו (fontsource) ולא לטעון מגוגל.`;
  L.push(how(head));
  if (body) L.push(how(body));
  L.push(
    "תגדיר את זה פעם אחת במשתני CSS (למשל --font-head ו---font-body), ותוודא שהעברית מוצגת בפונט ולא בפונט ברירת מחדל.",
  );
  return L.join("\n");
}

/* ---------------- my uploaded fonts ---------------- */
const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

async function token() {
  if (!configured) throw new Error("צריך להיות מחובר לענן");
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("צריך להיות מחובר לענן");
  return t;
}

const inflate = async (d: Uint8Array) => {
  const ds = new DecompressionStream("deflate");
  const out = new Blob([d as Uint8Array<ArrayBuffer>]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
};

export const extOf = (name: string): MyFont["ext"] | null => {
  const e = (name.split(".").pop() || "").toLowerCase();
  return e === "ttf" || e === "otf" || e === "woff" || e === "woff2" ? e : null;
};

/** read, store privately and add to "my fonts"; returns the new font */
export async function uploadFont(file: File): Promise<MyFont> {
  const ext = extOf(file.name);
  if (!ext) throw new Error(`${file.name}: רק TTF, OTF, WOFF או WOFF2`);
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: גדול מדי (עד 20MB)`);
  const buf = new Uint8Array(await file.arrayBuffer());
  const info: FontInfo = await parseFont(buf, inflate);
  const id = uid();
  const t = await token();
  const r = await fetch(`/api/files?op=upload&key=${encodeURIComponent(`fonts/${id}.${ext}`)}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", authorization: `Bearer ${t}` },
    body: buf,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "ההעלאה נכשלה");
  const f: MyFont = {
    id,
    name: file.name,
    ext,
    size: file.size,
    path: j.path,
    info,
    note: "",
    fav: false,
    created: Date.now(),
  };
  // the browser can read WOFF2 even though we can't: at least get the name from it
  try {
    const face = new FontFace(`myfont-${id}`, buf);
    await face.load();
    document.fonts.add(face);
    faces.add(id);
  } catch {
    /* not a usable font */
  }
  actions.addFont(f);
  return f;
}

export async function fontFileUrl(f: MyFont): Promise<string> {
  const t = await token();
  const r = await fetch("/api/files?op=url", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
    body: JSON.stringify({ path: f.path }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error || "הקובץ לא נמצא");
  return j.url;
}

/** make an uploaded font usable in this page as "myfont-<id>" */
const faces = new Set<string>();
const loading = new Map<string, Promise<boolean>>();
export function loadMyFont(f: MyFont): Promise<boolean> {
  if (faces.has(f.id)) return Promise.resolve(true);
  const cur = loading.get(f.id);
  if (cur) return cur;
  const p = (async () => {
    try {
      const url = await fontFileUrl(f);
      const face = new FontFace(`myfont-${f.id}`, `url(${url})`);
      await face.load();
      document.fonts.add(face);
      faces.add(f.id);
      return true;
    } catch {
      return false;
    } finally {
      loading.delete(f.id);
    }
  })();
  loading.set(f.id, p);
  return p;
}

export async function deleteMyFont(f: MyFont) {
  try {
    const t = await token();
    await fetch("/api/files?op=delete", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify({ path: f.path }),
    });
  } catch {
    /* remove from the list anyway */
  }
  actions.deleteFont(f.id);
}

export const myFamily = (f: MyFont) => f.info.family || f.name.replace(/\.[^.]+$/, "");

export const fontFaceCss = (f: MyFont) => {
  const fmt = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" }[f.ext];
  return `@font-face {\n  font-family: '${myFamily(f)}';\n  src: url('./fonts/${f.name}') format('${fmt}');\n  font-weight: ${f.info.weight || 400};\n  font-style: ${f.info.italic ? "italic" : "normal"};\n  font-display: swap;\n}`;
};
