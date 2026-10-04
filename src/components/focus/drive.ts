/* ============================================================
 * Google Drive links — pure helpers (no network) used by the
 * brief server route and by tests.
 * A client pastes a "anyone with the link" share link to a file
 * or a folder; the server copies the images into our storage.
 * ============================================================ */

export type DriveRef = { type: "file" | "folder"; id: string };

const ID = "[A-Za-z0-9_-]{10,}";

/** understand every common form of a Drive share link */
export function parseDriveUrl(raw: string): DriveRef | null {
  const s = (raw || "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (!/(^|\.)drive\.google\.com$|^docs\.google\.com$|^drive\.usercontent\.google\.com$/.test(host))
    return null;
  const p = u.pathname;
  let m = p.match(new RegExp(`/folders/(${ID})`));
  if (m) return { type: "folder", id: m[1] };
  m = p.match(new RegExp(`/file/d/(${ID})`)) || p.match(new RegExp(`/d/(${ID})`));
  if (m) return { type: "file", id: m[1] };
  const q = u.searchParams.get("id");
  if (q && new RegExp(`^${ID}$`).test(q))
    return { type: /folderview|embeddedfolderview/.test(p) ? "folder" : "file", id: q };
  return null;
}

export interface DriveEntry {
  id: string;
  name: string;
  folder: boolean;
}

const unescapeHtml = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/**
 * Entries of a public folder from Drive's "embeddedfolderview" page
 * (works without an API key for folders shared with anyone who has the link).
 */
export function parseDriveFolder(html: string): DriveEntry[] {
  const out: DriveEntry[] = [];
  const seen = new Set<string>();
  const parts = html.split(/<div class="flip-entry"/).slice(1);
  for (const part of parts) {
    const id = part.match(new RegExp(`id="entry-(${ID})"`))?.[1];
    if (!id || seen.has(id)) continue;
    const href = part.match(/href="([^"]+)"/)?.[1] || "";
    const title = part.match(/class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
    seen.add(id);
    out.push({
      id,
      name: unescapeHtml(title.replace(/<[^>]+>/g, "").trim()),
      folder: /\/folders\//.test(href),
    });
  }
  return out;
}

/** the file name from a Content-Disposition header */
export function dispositionName(h: string | null): string {
  if (!h) return "";
  const star = h.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = h.match(/filename\s*=\s*"([^"]*)"/) || h.match(/filename\s*=\s*([^;]+)/);
  return plain ? plain[1].trim() : "";
}

/** file type from the first bytes, for files that arrive without a usable name */
export function sniffExt(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  // ISO media: heic / avif
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/avif/.test(brand)) return "avif";
    if (/hei|mif|heix|hevc/.test(brand)) return "heic";
  }
  const head = new TextDecoder().decode(b.slice(0, 200)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "html";
  return "";
}

export const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/** Drive's public thumbnail (shown on the client page while the copy runs) */
export const driveThumb = (id: string, w = 320) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
