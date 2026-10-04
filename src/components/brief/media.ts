/* Browser-side file handling for the brief page: shrink photos, read logo colors, upload with progress, Drive import */
import { extractPalette } from "@/components/focus/briefcore";

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image"));
    i.src = src;
  });

const canvasOf = (img: CanvasImageSource, w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { c, ctx };
};

const fit = (w: number, h: number, max: number) => {
  const k = Math.min(1, max / Math.max(w, h));
  return [w * k, h * k] as const;
};

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, type, q));

export interface Prepared {
  blob: Blob;
  name: string;
  type: string;
  thumb: string;
}

const IMG_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
/** the "files / Drive" picker allows any file (so phones show Drive) — keep only photos */
export const isPhoto = (f: File) => f.type.startsWith("image/") || IMG_RE.test(f.name);

/** photos: max 2400px JPEG (originals from phones are 4–12MB); unknown formats go as-is */
export async function preparePhoto(file: File): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const [tw, th] = fit(img.naturalWidth, img.naturalHeight, 220);
    const thumb = canvasOf(img, tw, th).c.toDataURL("image/jpeg", 0.72);
    if (file.size < 900_000 && file.type === "image/jpeg")
      return { blob: file, name: file.name, type: file.type, thumb };
    const [w, h] = fit(img.naturalWidth, img.naturalHeight, 2400);
    const { c } = canvasOf(img, w, h);
    const blob = await toBlob(c, "image/jpeg", 0.86);
    if (!blob || blob.size >= file.size)
      return { blob: file, name: file.name, type: file.type, thumb };
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", thumb };
  } catch {
    return {
      blob: file,
      name: file.name,
      type: file.type || "application/octet-stream",
      thumb: "",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** logo: uploaded untouched; we read its colors and keep a small transparent preview */
export async function readLogo(file: Blob): Promise<{ thumb: string; palette: string[] }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w0 = img.naturalWidth || 300,
      h0 = img.naturalHeight || 150;
    const [tw, th] = fit(w0, h0, 320);
    const thumb = canvasOf(img, tw, th).c.toDataURL("image/png");
    const [sw, sh] = fit(w0, h0, 96);
    const { ctx, c } = canvasOf(img, sw, sh);
    const palette = extractPalette(ctx.getImageData(0, 0, c.width, c.height).data);
    return { thumb, palette };
  } catch {
    return { thumb: "", palette: [] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type Kind = "logo" | "image" | "review";

export function uploadFile(
  id: string,
  kind: Kind,
  name: string,
  blob: Blob,
  onProgress: (p: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(
      "POST",
      `/api/brief?b=${encodeURIComponent(id)}&op=upload&kind=${kind}&name=${encodeURIComponent(name)}`,
    );
    x.setRequestHeader("content-type", blob.type || "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      try {
        const j = JSON.parse(x.responseText);
        if (x.status < 300 && j.path) resolve(j.path);
        else reject(new Error(j.error || "ההעלאה נכשלה"));
      } catch {
        reject(new Error("ההעלאה נכשלה"));
      }
    };
    x.onerror = () => reject(new Error("אין חיבור לאינטרנט"));
    x.send(blob);
  });
}

/* ---------------- Google Drive ---------------- */
const post = async (id: string, op: string, body: unknown) => {
  let r: Response;
  try {
    r = await fetch(`/api/brief?b=${encodeURIComponent(id)}&op=${op}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("אין חיבור לאינטרנט");
  }
  return r;
};
const errOf = async (r: Response, fallback: string) =>
  new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || fallback);

/** what's behind a pasted Drive link: one file, or the photos of a shared folder */
export async function driveList(id: string, url: string) {
  const r = await post(id, "drive-list", { url });
  if (!r.ok) throw await errOf(r, "לא הצלחנו לקרוא את הקישור");
  return (await r.json()) as { folder: boolean; items: { id: string; name: string }[] };
}

/** copy one Drive file into the brief's storage */
export async function driveCopy(id: string, fileId: string, kind: Kind, name: string) {
  const r = await post(id, "drive-file", { id: fileId, kind, name });
  if (!r.ok) throw await errOf(r, "ההעתקה מדרייב נכשלה");
  return (await r.json()) as { path: string; name: string; type: string; size: number };
}

/** fetch a Drive file through our server (the logo — so we can read its colors here) */
export async function driveFetch(id: string, fileId: string): Promise<File> {
  const r = await post(id, "drive-file", { id: fileId, kind: "logo", raw: 1 });
  if (!r.ok) throw await errOf(r, "לא הצלחנו להביא את הקובץ מדרייב");
  const name = decodeURIComponent(r.headers.get("x-file-name") || "logo");
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type });
}
