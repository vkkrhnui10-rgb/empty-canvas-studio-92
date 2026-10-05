/**
 * Read what's inside a font file (TTF / OTF / WOFF): names, designer, version, licence text,
 * embedding permissions, weights, variable axes, glyph count and whether it really has Hebrew.
 * WOFF2 is compressed with Brotli, which browsers don't expose — for those only the preview works.
 * Pure: give it the bytes, and for WOFF a zlib "inflate" (DecompressionStream in the browser).
 */

export interface FontInfo {
  format: "ttf" | "otf" | "woff" | "woff2" | "unknown";
  /** full details could be read (not for WOFF2) */
  parsed: boolean;
  family: string;
  subfamily: string;
  fullName: string;
  version: string;
  designer: string;
  designerUrl: string;
  vendor: string;
  vendorUrl: string;
  description: string;
  copyright: string;
  trademark: string;
  license: string;
  licenseUrl: string;
  /** OS/2 fsType — the embedding permission bits */
  fsType: number | null;
  weight: number | null;
  italic: boolean;
  variable: boolean;
  axes: { tag: string; min: number; max: number; def: number }[];
  glyphs: number | null;
  /** of the 27 Hebrew letters (incl. final forms) */
  hebrewLetters: number;
  niqqud: boolean;
  shekel: boolean;
  latin: boolean;
  digits: boolean;
}

export type Inflate = (data: Uint8Array) => Promise<Uint8Array>;

const empty = (format: FontInfo["format"]): FontInfo => ({
  format,
  parsed: false,
  family: "",
  subfamily: "",
  fullName: "",
  version: "",
  designer: "",
  designerUrl: "",
  vendor: "",
  vendorUrl: "",
  description: "",
  copyright: "",
  trademark: "",
  license: "",
  licenseUrl: "",
  fsType: null,
  weight: null,
  italic: false,
  variable: false,
  axes: [],
  glyphs: null,
  hebrewLetters: 0,
  niqqud: false,
  shekel: false,
  latin: false,
  digits: false,
});

const tag = (v: DataView, o: number) =>
  String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

export function sniffFont(b: Uint8Array): FontInfo["format"] {
  if (b.length < 4) return "unknown";
  const t = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (t === "wOFF") return "woff";
  if (t === "wOF2") return "woff2";
  if (t === "OTTO") return "otf";
  if ((b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || t === "true") return "ttf";
  return "unknown";
}

/** table tag → bytes */
async function tables(b: Uint8Array, format: FontInfo["format"], inflate?: Inflate) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out = new Map<string, Uint8Array>();
  if (format === "woff") {
    const n = v.getUint16(12);
    for (let i = 0; i < n; i++) {
      const o = 44 + i * 20;
      const t = tag(v, o);
      const off = v.getUint32(o + 4);
      const comp = v.getUint32(o + 8);
      const orig = v.getUint32(o + 12);
      const raw = b.subarray(off, off + comp);
      if (comp < orig) {
        if (!inflate) continue;
        out.set(t, await inflate(raw));
      } else out.set(t, raw);
    }
  } else {
    const n = v.getUint16(4);
    for (let i = 0; i < n; i++) {
      const o = 12 + i * 16;
      const off = v.getUint32(o + 8);
      const len = v.getUint32(o + 12);
      out.set(tag(v, o), b.subarray(off, off + len));
    }
  }
  return out;
}

const view = (t: Uint8Array) => new DataView(t.buffer, t.byteOffset, t.byteLength);

function names(t: Uint8Array): Map<number, string> {
  const v = view(t);
  const count = v.getUint16(2);
  const strOff = v.getUint16(4);
  // best record per name id: Windows English > Windows any > Mac Roman
  const best = new Map<number, { score: number; s: string }>();
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const pid = v.getUint16(o);
    const eid = v.getUint16(o + 2);
    const lid = v.getUint16(o + 4);
    const nid = v.getUint16(o + 6);
    const len = v.getUint16(o + 8);
    const off = strOff + v.getUint16(o + 10);
    if (off + len > t.length) continue;
    let s = "";
    let score = 0;
    if (pid === 3 || pid === 0) {
      for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(v.getUint16(off + k));
      score = pid === 3 && lid === 0x409 ? 3 : pid === 3 ? 2 : 1.5;
      if (pid === 3 && eid !== 1 && eid !== 10) score -= 1;
    } else if (pid === 1 && eid === 0) {
      for (let k = 0; k < len; k++) s += String.fromCharCode(v.getUint8(off + k));
      score = 1;
    } else continue;
    const cur = best.get(nid);
    if (!cur || score > cur.score) best.set(nid, { score, s: s.replace(/\0/g, "").trim() });
  }
  return new Map([...best].map(([k, x]) => [k, x.s]));
}

/** which of these code points the font has (cmap formats 4 and 12) */
function covers(t: Uint8Array, cps: number[]): Set<number> {
  const v = view(t);
  const n = v.getUint16(2);
  let sub = -1;
  let fmt = 0;
  for (let i = 0; i < n; i++) {
    const pid = v.getUint16(4 + i * 8);
    const eid = v.getUint16(6 + i * 8);
    const off = v.getUint32(8 + i * 8);
    const f = v.getUint16(off);
    // prefer the full-Unicode table
    if (
      (f === 12 && (pid === 3 || pid === 0)) ||
      (sub < 0 && f === 4 && (pid === 3 || pid === 0))
    ) {
      sub = off;
      fmt = f;
      if (f === 12) break;
    }
    void eid;
  }
  const has = new Set<number>();
  if (sub < 0) return has;
  if (fmt === 12) {
    const groups = v.getUint32(sub + 12);
    for (let g = 0; g < groups; g++) {
      const o = sub + 16 + g * 12;
      const s = v.getUint32(o);
      const e = v.getUint32(o + 4);
      for (const cp of cps) if (cp >= s && cp <= e) has.add(cp);
    }
  } else {
    const segX2 = v.getUint16(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (const cp of cps) {
      for (let k = 0; k < segX2; k += 2) {
        const end = v.getUint16(ends + k);
        if (cp > end) continue;
        const start = v.getUint16(starts + k);
        if (cp < start) break;
        const ro = v.getUint16(ranges + k);
        if (ro === 0) {
          if (((cp + v.getInt16(deltas + k)) & 0xffff) !== 0) has.add(cp);
        } else {
          const gi = v.getUint16(ranges + k + ro + (cp - start) * 2);
          if (gi !== 0) has.add(cp);
        }
        break;
      }
    }
  }
  return has;
}

const HEB = Array.from({ length: 27 }, (_, i) => 0x5d0 + i);
const NIQ = [0x5b0, 0x5b4, 0x5b7, 0x5b8, 0x5bc];
const LAT = [0x41, 0x5a, 0x61, 0x7a, 0x65];
const DIG = [0x30, 0x35, 0x39];

export async function parseFont(
  buf: ArrayBuffer | Uint8Array,
  inflate?: Inflate,
): Promise<FontInfo> {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const format = sniffFont(b);
  const info = empty(format);
  if (format === "unknown" || format === "woff2") return info;
  try {
    const t = await tables(b, format, inflate);
    const name = t.get("name");
    if (name) {
      const n = names(name);
      info.family = n.get(16) || n.get(1) || "";
      info.subfamily = n.get(17) || n.get(2) || "";
      info.fullName = n.get(4) || "";
      info.version = (n.get(5) || "").replace(/^Version\s*/i, "");
      info.copyright = n.get(0) || "";
      info.trademark = n.get(7) || "";
      info.vendor = n.get(8) || "";
      info.designer = n.get(9) || "";
      info.description = n.get(10) || "";
      info.vendorUrl = n.get(11) || "";
      info.designerUrl = n.get(12) || "";
      info.license = n.get(13) || "";
      info.licenseUrl = n.get(14) || "";
    }
    const os2 = t.get("OS/2");
    if (os2 && os2.length >= 64) {
      const v = view(os2);
      info.weight = v.getUint16(4);
      info.fsType = v.getUint16(8);
      info.italic = (v.getUint16(62) & 1) === 1;
    }
    const maxp = t.get("maxp");
    if (maxp && maxp.length >= 6) info.glyphs = view(maxp).getUint16(4);
    const fvar = t.get("fvar");
    if (fvar && fvar.length >= 16) {
      const v = view(fvar);
      const at = v.getUint16(4);
      const count = v.getUint16(8);
      const size = v.getUint16(10);
      info.variable = count > 0;
      for (let i = 0; i < count; i++) {
        const o = at + i * size;
        if (o + 20 > fvar.length) break;
        info.axes.push({
          tag: tag(v, o),
          min: v.getInt32(o + 4) / 65536,
          def: v.getInt32(o + 8) / 65536,
          max: v.getInt32(o + 12) / 65536,
        });
      }
    }
    const cmap = t.get("cmap");
    if (cmap) {
      const has = covers(cmap, [...HEB, ...NIQ, 0x20aa, ...LAT, ...DIG]);
      info.hebrewLetters = HEB.filter((c) => has.has(c)).length;
      info.niqqud = NIQ.every((c) => has.has(c));
      info.shekel = has.has(0x20aa);
      info.latin = LAT.every((c) => has.has(c));
      info.digits = DIG.every((c) => has.has(c));
    }
    info.parsed = true;
  } catch {
    /* a broken or unusual file: keep what we have */
  }
  return info;
}

/* ---------------- what the licence allows ---------------- */
export interface LicenseVerdict {
  /** ok = free for client websites; check = read the terms; no = not for client work */
  level: "ok" | "check" | "no";
  name: string;
  allowed: string[];
  limits: string[];
}

const OFL: LicenseVerdict = {
  level: "ok",
  name: "SIL Open Font License (OFL)",
  allowed: [
    "שימוש מסחרי חופשי: אתרים של לקוחות, לוגואים, דפוס, סרטונים",
    "הטמעה באתר (קבצי הפונט יושבים על השרת)",
    "שינוי הפונט, בתנאי שמשנים לו את השם",
  ],
  limits: [
    "אסור למכור את קובץ הפונט עצמו לבדו",
    "כשמעבירים את קבצי הפונט הלאה, מצרפים את קובץ הרישיון",
  ],
};
const APACHE: LicenseVerdict = {
  level: "ok",
  name: "Apache License 2.0",
  allowed: ["שימוש מסחרי חופשי, כולל אתרים של לקוחות", "הטמעה באתר ושינוי"],
  limits: ["שומרים את הודעת זכויות היוצרים כשמפיצים את הקבצים"],
};

/** a verdict from a catalogue licence id or from the licence text inside a file */
export function licenseVerdict(
  text: string,
  url = "",
  fsType: number | null = null,
): LicenseVerdict {
  const t = `${text} ${url}`.toLowerCase();
  const embed = embeddingNote(fsType);
  const withEmbed = (v: LicenseVerdict): LicenseVerdict =>
    embed && embed.bad
      ? { ...v, level: v.level === "ok" ? "check" : v.level, limits: [...v.limits, embed.text] }
      : v;
  // the strictest wording wins (a "personal use only" line beats a stray OFL link)
  if (/personal use|non-?commercial|not for commercial|demo|trial|for personal/.test(t))
    return {
      level: "no",
      name: "שימוש אישי בלבד",
      allowed: ["ניסיון ושימוש אישי"],
      limits: [
        "אסור לשימוש מסחרי, כולל אתר של לקוח, בלי לקנות רישיון",
        ...(embed ? [embed.text] : []),
      ],
    };
  if (/ofl|open font license|scripts\.sil\.org|openfontlicense/.test(t)) return withEmbed(OFL);
  if (/apache/.test(t)) return withEmbed(APACHE);
  if (/ubuntu font licen/.test(t)) return withEmbed({ ...OFL, name: "Ubuntu Font Licence" });
  if (!t.trim())
    return {
      level: "check",
      name: "לא כתוב רישיון בקובץ",
      allowed: [],
      limits: [
        "אין בקובץ מידע על הרישיון. לפני שימוש באתר של לקוח צריך לבדוק מאיפה הפונט הגיע ומה מותר",
        ...(embed ? [embed.text] : []),
      ],
    };
  return {
    level: "check",
    name: "רישיון מסחרי או מיוחד",
    allowed: [],
    limits: [
      "צריך לקרוא את תנאי הרישיון (למטה). הרבה פונטים בתשלום דורשים רישיון נפרד לאתר (Web license) לפי כמות צפיות",
      ...(embed ? [embed.text] : []),
    ],
  };
}

/** what the OS/2 fsType embedding bits say */
export function embeddingNote(fs: number | null): { text: string; bad: boolean } | null {
  if (fs === null) return null;
  if (fs === 0) return { text: "הקובץ מסומן כמותר להטמעה ללא הגבלה", bad: false };
  if (fs & 0x2)
    return { text: 'הקובץ מסומן "Restricted": אסור להטמיע אותו בלי אישור מהיצרן', bad: true };
  if (fs & 0x4) return { text: "הקובץ מסומן להטמעה לצפייה והדפסה בלבד", bad: true };
  if (fs & 0x8) return { text: "הקובץ מסומן כמותר להטמעה ועריכה", bad: false };
  return null;
}

export const LICENSES: Record<string, LicenseVerdict> = { "OFL-1.1": OFL, "Apache-2.0": APACHE };
