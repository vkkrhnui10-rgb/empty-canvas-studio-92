/* ============================================================
 * Website brief — pure helpers shared by the client page,
 * the owner's panel and the server (no DOM, no store).
 * ============================================================ */
import type { Brief, BriefAnswers } from "./types";

export const emptyAnswers = (): BriefAnswers => ({
  contactName: "",
  business: "",
  tagline: "",
  audience: "",
  goals: [],
  about: "",
  unique: "",
  services: [{ name: "", desc: "" }],
  colorMode: "logo",
  colors: [],
  styles: [],
  styleNote: "",
  sites: [{ url: "", note: "" }],
  testimonials: [{ name: "", text: "" }],
  avoid: "",
  noPhotos: false,
  photosLink: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  hours: "",
  social: "",
  domain: "",
  notes: "",
});

/** keep only known fields with the right types (the client page is public input) */
export function cleanAnswers(raw: unknown): BriefAnswers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const base = emptyAnswers();
  const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
  const strs = (v: unknown, n: number, max = 80) =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === "string")
          .slice(0, n)
          .map((x) => x.slice(0, max))
      : [];
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof BriefAnswers)[]) {
    if (typeof base[k] === "string")
      out[k] = str(r[k], k === "about" || k === "notes" ? 8000 : 2000);
  }
  out.goals = strs(r.goals, 12);
  out.styles = strs(r.styles, 12);
  out.colors = strs(r.colors, 8, 9).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  out.colorMode = ["logo", "custom", "you"].includes(r.colorMode as string) ? r.colorMode : "logo";
  out.noPhotos = !!r.noPhotos;
  out.services = (Array.isArray(r.services) ? r.services : [])
    .slice(0, 30)
    .map((s: Record<string, unknown>) => ({ name: str(s?.name, 200), desc: str(s?.desc, 1500) }));
  out.sites = (Array.isArray(r.sites) ? r.sites : [])
    .slice(0, 10)
    .map((s: Record<string, unknown>) => ({ url: str(s?.url, 500), note: str(s?.note, 1000) }));
  out.testimonials = (Array.isArray(r.testimonials) ? r.testimonials : [])
    .slice(0, 30)
    .map((s: Record<string, unknown>) => ({ name: str(s?.name, 200), text: str(s?.text, 3000) }));
  return out as unknown as BriefAnswers;
}

/* ---------------- options shown to the client ---------------- */
export const GOALS = [
  "שיתקשרו / ישאירו פרטים",
  "קביעת תור או פגישה",
  "מכירה אונליין",
  "להציג עבודות / תיק עבודות",
  "תדמית ואמינות",
  "מידע ללקוחות קיימים",
];

export const STYLES: { v: string; d: string; sw: string[] }[] = [
  { v: "מודרני ונקי", d: "הרבה אוויר, קווים חדים", sw: ["#ffffff", "#0f172a", "#3b82f6"] },
  { v: "יוקרתי ואלגנטי", d: "כהה, זהב, טיפוגרפיה עדינה", sw: ["#111111", "#c8a96a", "#f5f0e6"] },
  { v: "חם ומשפחתי", d: "צבעי אדמה, תחושה אישית", sw: ["#fbf3e8", "#c2703d", "#4a3426"] },
  { v: "צבעוני ושמח", d: "אנרגטי, נועז, בולט", sw: ["#ffd23f", "#ee4266", "#3bceac"] },
  { v: "מינימליסטי", d: "מעט אלמנטים, הרבה לבן", sw: ["#fafafa", "#e5e5e5", "#171717"] },
  { v: "מקצועי ורציני", d: "אמין, מסודר, שמרני", sw: ["#0b2545", "#f4f6f8", "#8da9c4"] },
  { v: "טבעי ורגוע", d: "ירוקים, רכות, שלווה", sw: ["#eef3ea", "#6b8f71", "#2f3e2f"] },
  { v: "טכנולוגי וחדשני", d: "כהה, ניאון, עתידני", sw: ["#0a0a1a", "#7c3aed", "#22d3ee"] },
];

/* ---------------- colors ---------------- */
const hex2 = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const fromHex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (h: string) => {
  const [r, g, b] = fromHex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** black or white text on top of a color */
export const inkOn = (h: string) => (lum(h) > 0.45 ? "#111827" : "#ffffff");
const sat = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
/** the most "brand-like" color in a palette: saturated, not too light or dark */
export function accentOf(colors: string[]): string | null {
  let best: string | null = null,
    score = -1;
  // earlier = more dominant in the logo, so it gets a head start
  for (const [i, c] of colors.entries()) {
    const [r, g, b] = fromHex(c);
    const L = lum(c);
    const s = sat(r, g, b) * (L > 0.85 ? 0.2 : L < 0.02 ? 0.3 : 1) * (1 - Math.min(i, 4) * 0.12);
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return score > 0.25 ? best : null;
}

/**
 * Dominant colors of a logo from raw RGBA pixels (a small canvas is plenty).
 * Ignores transparency and the white background; near-black stays if it's a real part of the mark.
 */
export function extractPalette(px: ArrayLike<number>, max = 5): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 128) continue;
    const r = px[i],
      g = px[i + 1],
      b = px[i + 2];
    if (r > 238 && g > 238 && b > 238) continue; // background white
    total++;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bk.n++;
    bk.r += r;
    bk.g += g;
    bk.b += b;
    buckets.set(key, bk);
  }
  if (!total) return [];
  const cols = [...buckets.values()]
    .map((k) => ({ n: k.n, r: k.r / k.n, g: k.g / k.n, b: k.b / k.n }))
    .sort((a, b) => b.n - a.n);
  // merge near-identical shades (anti-aliasing produces many)
  const merged: typeof cols = [];
  for (const c of cols) {
    const m = merged.find((x) => Math.hypot(x.r - c.r, x.g - c.g, x.b - c.b) < 60);
    if (m) m.n += c.n;
    else merged.push({ ...c });
  }
  return merged
    .filter((c) => c.n / total > 0.02)
    .map((c) => ({ ...c, w: (c.n / total) * (0.35 + sat(c.r, c.g, c.b)) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, max)
    .map((c) => toHex(c.r, c.g, c.b));
}

/* ---------------- summary / AI prompt ---------------- */
const line = (label: string, v: string | undefined) =>
  v && v.trim() ? `- **${label}:** ${v.trim()}\n` : "";

export function briefMarkdown(b: Pick<Brief, "client" | "business" | "answers" | "files">): string {
  const a = { ...emptyAnswers(), ...(b.answers || {}) };
  const name = a.business || b.business || b.client;
  const files = b.files || [];
  const logo = files.filter((f) => f.kind === "logo");
  const imgs = files.filter((f) => f.kind === "image");
  const reviewShots = files.filter((f) => f.kind === "review");
  const reviews = a.testimonials.filter((t) => t.text.trim());
  const services = a.services.filter((s) => s.name.trim() || s.desc.trim());
  const sites = a.sites.filter((s) => s.url.trim());
  let md = `# אפיון אתר — ${name}\n\n`;
  md += `## העסק\n`;
  md += line("שם העסק", name);
  md += line("איש קשר", a.contactName || b.client);
  md += line("במשפט אחד", a.tagline);
  md += line("קהל היעד", a.audience);
  md += line("מטרות האתר", a.goals.join(", "));
  if (a.about.trim()) md += `\n## אודות (כפי שהלקוח כתב)\n${a.about.trim()}\n`;
  if (a.unique.trim()) md += `\n## מה מייחד אותם\n${a.unique.trim()}\n`;
  if (services.length) {
    md += `\n## שירותים / מוצרים\n`;
    for (const s of services)
      md += `- **${s.name.trim() || "ללא שם"}**${s.desc.trim() ? ` — ${s.desc.trim()}` : ""}\n`;
  }
  md += `\n## מראה ותחושה\n`;
  md += line(
    "צבעים",
    a.colorMode === "you"
      ? "הלקוח משאיר לנו לבחור"
      : a.colors.length
        ? `${a.colors.join(", ")}${a.colorMode === "logo" ? " (נלקחו מהלוגו)" : ""}`
        : "",
  );
  md += line("סגנון", a.styles.join(", "));
  md += line("הערות על הסגנון", a.styleNote);
  md += line(
    "לוגו",
    logo.length ? logo.map((f) => f.name).join(", ") + " (בקובץ ה-ZIP)" : "אין לוגו",
  );
  if (sites.length || a.avoid.trim()) {
    md += `\n## השראה\n`;
    for (const s of sites) md += `- ${s.url.trim()}${s.note.trim() ? ` — ${s.note.trim()}` : ""}\n`;
    md += line("מה לא לעשות", a.avoid);
  }
  md += `\n## תמונות\n`;
  md += imgs.length
    ? `- ${imgs.length} תמונות בקובץ ה-ZIP (תיקיית images)\n`
    : a.noPhotos
      ? "- אין תמונות — להשתמש בתמונות סטוק איכותיות שמתאימות לתחום\n"
      : "- לא הועלו תמונות\n";
  md += line("קישור לתמונות נוספות", a.photosLink);
  if (reviews.length || reviewShots.length) {
    md += `\n## המלצות לקוחות\n`;
    for (const t of reviews)
      md += `- "${t.text.trim()}"${t.name.trim() ? ` — ${t.name.trim()}` : ""}\n`;
    if (reviewShots.length)
      md += `- ${reviewShots.length} צילומי מסך של המלצות בקובץ ה-ZIP (תיקיית reviews)\n`;
  }
  md += `\n## פרטי קשר לאתר\n`;
  md += line("טלפון", a.phone);
  md += line("וואטסאפ", a.whatsapp);
  md += line("מייל", a.email);
  md += line("כתובת", a.address);
  md += line("שעות פעילות", a.hours);
  md += line("רשתות חברתיות", a.social);
  md += line("דומיין", a.domain);
  if (a.notes.trim()) md += `\n## הערות נוספות\n${a.notes.trim()}\n`;
  return md;
}

/** a ready-to-paste prompt for Claude / ChatGPT */
export function briefPrompt(b: Pick<Brief, "client" | "business" | "answers" | "files">): string {
  return `אתה מעצב ומפתח אתרים בכיר וקופירייטר מנוסה בעברית.
לפניך אפיון שהלקוח מילא בעצמו. הוא כתב בחופשיות ולא בנוסח סופי — המשימה שלך:
1. ללטש את כל הטקסטים לשפה שיווקית, קצרה ובגובה העיניים, בלי להמציא עובדות.
2. להציע מבנה עמודים ומבנה לכל עמוד (Hero, אודות, שירותים, המלצות, צור קשר וכו').
3. לכתוב את כל התוכן הסופי לאתר: כותרות, תתי-כותרות, טקסטים וקריאות לפעולה.
4. להגדיר שפה עיצובית: פלטת צבעים (עם קודי HEX), טיפוגרפיה בעברית, ותחושה כללית — לפי הצבעים והסגנון שהלקוח בחר.
האתר בעברית, מימין לשמאל, מותאם קודם כל לנייד.

${briefMarkdown(b)}`;
}

/* ---------------- ZIP (store only — photos are already compressed) ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const used = new Set<string>();
  for (const f of files) {
    // unique names inside the archive
    let name = f.name.replace(/^\/+/, "");
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      let i = 2;
      while (
        used.has(`${dot > 0 ? name.slice(0, dot) : name}-${i}${dot > 0 ? name.slice(dot) : ""}`)
      )
        i++;
      name = `${dot > 0 ? name.slice(0, dot) : name}-${i}${dot > 0 ? name.slice(dot) : ""}`;
    }
    used.add(name);
    const nm = enc.encode(name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 names
    lh.setUint16(8, 0, true); // stored
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nm.length, true);
    lh.setUint16(28, 0, true);
    locals.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, nm.length, true);
    ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array(ch.buffer), nm);
    offset += 30 + nm.length + size;
  }
  const cdSize = centrals.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** a long, unguessable id for the public link */
export function briefId(): string {
  const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

/** how much of the questionnaire is filled (0–1), for the owner's list */
export function briefProgress(a?: BriefAnswers): number {
  if (!a) return 0;
  const checks = [
    a.business,
    a.tagline,
    a.about,
    a.services.some((s) => s.name.trim()),
    a.colorMode === "you" || a.colors.length > 0,
    a.styles.length > 0,
    a.sites.some((s) => s.url.trim()) || a.avoid,
    a.phone || a.email || a.whatsapp,
  ];
  return checks.filter(Boolean).length / checks.length;
}
