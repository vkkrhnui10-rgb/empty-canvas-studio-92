import { createFileRoute } from "@tanstack/react-router";
import { publicHttpUrl } from "@/components/focus/sitecheck.server";

/**
 * A stored screenshot of a client's homepage — taken once, kept in a public storage bucket,
 * refreshed only when asked (or monthly by the app).
 *
 *   POST { projectId, url }                     → capture through a screenshot service
 *   POST ?op=upload&projectId=…  (image body)   → use my own screenshot instead
 *
 * Both need the signed-in owner's access token. Returns { url, at, via }.
 */
const BUCKET = "focus-shots";
const MAX = 6 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getImage(url: string, timeout = 25000): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: "follow" });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "";
    if (!/^image\/(jpeg|png|webp)/.test(type)) return null; // mshots answers with a GIF while it works
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.length > 12_000 && buf.length < MAX ? buf : null; // tiny = placeholder / blank page
  } catch {
    return null;
  }
}

/** try a few free screenshot services, best first */
async function capture(target: string): Promise<{ img: Uint8Array; via: string } | null> {
  const enc = encodeURIComponent(target);
  // 1. Microlink — real Chrome, waits for the page
  try {
    const r = await fetch(
      `https://api.microlink.io/?url=${enc}&screenshot=true&meta=false&viewport.width=1280&viewport.height=800`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (r.ok) {
      const j = (await r.json()) as { status?: string; data?: { screenshot?: { url?: string } } };
      const u = j.data?.screenshot?.url;
      if (j.status === "success" && u) {
        const img = await getImage(u);
        if (img) return { img, via: "microlink" };
      }
    }
  } catch {
    /* next */
  }
  // 2. thum.io
  const thum = await getImage(
    `https://image.thum.io/get/width/1280/crop/800/noanimate/${target}`,
    30000,
  );
  if (thum) return { img: thum, via: "thum.io" };
  // 3. WordPress mShots — renders in the background, so ask a few times
  for (let i = 0; i < 6; i++) {
    const img = await getImage(`https://s0.wp.com/mshots/v1/${enc}?w=1280&h=800&r=${i}`);
    if (img) return { img, via: "mshots" };
    await sleep(4000);
  }
  return null;
}

const sniff = (b: Uint8Array) =>
  b[0] === 0x89 && b[1] === 0x50
    ? "image/png"
    : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57
      ? "image/webp"
      : "image/jpeg";

export const Route = createFileRoute("/api/site-shot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "")
          .trim();
        if (!token) return json({ error: "unauthorized" }, 401);
        const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
        const { data: auth, error: authErr } = await sb.auth.getUser(token);
        if (authErr || !auth?.user) return json({ error: "unauthorized" }, 401);
        const uid = auth.user.id;

        const q = new URL(request.url).searchParams;
        let projectId = q.get("projectId") || "";
        let img: Uint8Array | null = null;
        let via = "upload";

        if (q.get("op") === "upload") {
          const len = Number(request.headers.get("content-length") || 0);
          if (len > MAX) return json({ error: "התמונה גדולה מדי" }, 413);
          img = new Uint8Array(await request.arrayBuffer());
          if (!img.length || img.length > MAX) return json({ error: "התמונה גדולה מדי" }, 413);
        } else {
          let body: { projectId?: string; url?: string } = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad body" }, 400);
          }
          projectId = String(body.projectId || "");
          const target = publicHttpUrl(String(body.url || "").trim());
          if (!target) return json({ error: "כתובת לא תקינה" }, 400);
          const got = await capture(target.toString());
          if (!got) return json({ error: "לא הצלחנו לצלם את האתר" }, 502);
          img = got.img;
          via = got.via;
        }
        if (!/^[A-Za-z0-9_-]{4,64}$/.test(projectId)) return json({ error: "bad project" }, 400);

        // public bucket — these are screenshots of public websites
        const { data: bucket } = await sb.storage.getBucket(BUCKET);
        if (!bucket) {
          const { error } = await sb.storage.createBucket(BUCKET, { public: true });
          if (error && !/exist/i.test(error.message)) return json({ error: error.message }, 500);
        }
        const path = `${uid}/${projectId}`;
        const { error: upErr } = await sb.storage
          .from(BUCKET)
          .upload(path, img, { contentType: sniff(img), upsert: true, cacheControl: "604800" });
        if (upErr) return json({ error: upErr.message }, 500);
        const at = Date.now();
        const url = `${sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${at}`;
        return json({ url, at, via });
      },
    },
  },
});
