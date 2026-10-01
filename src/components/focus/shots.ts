/* Homepage screenshots: captured once on the server, stored, shown on the project cards */
import { supabase } from "@/integrations/supabase/client";
import { actions, getState } from "./store";

const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const SHOT_MAX_AGE = 30 * 864e5;

async function token() {
  if (!configured) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function save(projectId: string, j: { url: string; at: number; via?: string }) {
  actions.patchProject(projectId, { shot: { url: j.url, at: j.at, via: j.via } });
}

/* one capture at a time — each can take a while and the free services are rate limited */
const failed = new Set<string>();
const inFlight = new Map<string, Promise<boolean>>();
let chain: Promise<unknown> = Promise.resolve();

/** capture the homepage now (queued); resolves true when a new screenshot was stored */
export function captureShot(projectId: string, url: string, force = false): Promise<boolean> {
  const key = `${projectId}|${url}`;
  if (!force && failed.has(key)) return Promise.resolve(false);
  const running = inFlight.get(projectId);
  if (running) return running;
  const job = chain.then(async () => {
    const t = await token();
    if (!t) return false;
    try {
      const r = await fetch("/api/site-shot", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
        body: JSON.stringify({ projectId, url }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || "failed");
      // the project might have been edited meanwhile — only store if the address is the same
      if (getState().projects.find((p) => p.id === projectId)?.url === url) save(projectId, j);
      failed.delete(key);
      return true;
    } catch {
      failed.add(key);
      return false;
    } finally {
      inFlight.delete(projectId);
    }
  });
  chain = job;
  inFlight.set(projectId, job);
  return job;
}

export const canCapture = () => configured;
export const shotFailed = (projectId: string, url: string) => failed.has(`${projectId}|${url}`);

/** my own screenshot instead of the automatic one (shrunk to 1400px JPEG) */
export async function uploadShot(projectId: string, file: File): Promise<string> {
  const t = await token();
  if (!t) return "צריך להיות מחובר לענן";
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1400 / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    blob = (await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85))) || file;
  } catch {
    /* send as is */
  }
  const r = await fetch(`/api/site-shot?op=upload&projectId=${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: { "content-type": blob.type || "image/jpeg", authorization: `Bearer ${t}` },
    body: blob,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) return j.error || "ההעלאה נכשלה";
  save(projectId, j);
  return "";
}
