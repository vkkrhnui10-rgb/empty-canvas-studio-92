import { createFileRoute } from "@tanstack/react-router";
import { publicHttpUrl } from "@/components/focus/sitecheck.server";

/**
 * A stored screenshot of a client's homepage — taken once, kept in a public storage bucket,
 * refreshed only when asked (or monthly by the app).
 *
 *   POST { projectId, url, width?, full? }      → capture through a screenshot service
 *                                                 (width 390 = phone; full = the whole page, top to bottom)
 *   POST ?op=upload&projectId=…  (image body)   → use my own screenshot instead
 *   POST ?op=meta { url }                       → { title, description, color } of a page
 *
 * "projectId" is just the storage key: projects use their id, the inspiration library uses inspo-….
 *
 * Both need the signed-in owner's access token. Returns { url, at, via }.
 */
const BUCKET = "focus-shots";
const MAX = 6 * 1024 * 1024;
const MAX_FULL = 14 * 1024 * 1024;

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
    return buf.length > 12_000 && buf.length < MAX_FULL ? buf : null; // tiny = placeholder / blank page
  } catch {
    return null;
  }
}

/** reveal-on-scroll content is forced visible and animations finish at once, so a full page has no blanks */
const REVEAL_CSS =
  "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition-duration:0s!important;transition-delay:0s!important}[data-aos],.aos-init,.aos-animate,.wow,.reveal,.fade-in,[data-animate],[data-scroll]{opacity:1!important;transform:none!important;visibility:visible!important}";

/** try a few free screenshot services, best first */
async function capture(
  target: string,
  width = 1280,
  full = false,
): Promise<{ img: Uint8Array; via: string } | null> {
  const enc = encodeURIComponent(target);
  const phone = width < 600;
  const height = phone ? 844 : 800;
  // 1. Microlink — real Chrome, waits for the page
  try {
    const q = new URLSearchParams({
      url: target,
      screenshot: "true",
      meta: "false",
      "viewport.width": String(width),
      "viewport.height": String(height),
    });
    if (phone) {
      q.set("viewport.isMobile", "true");
      q.set("viewport.deviceScaleFactor", "2");
    }
    if (full) {
      q.set("screenshot.fullPage", "true");
      q.set("waitForTimeout", "3000");
      q.set("styles", REVEAL_CSS);
    }
    const r = await fetch(`https://api.microlink.io/?${q}`, {
      signal: AbortSignal.timeout(full ? 55000 : 30000),
    });
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
    full
      ? `https://image.thum.io/get/width/${width}/viewportWidth/${width}/fullpage/wait/3/noanimate/${target}`
      : `https://image.thum.io/get/width/${width}/viewportWidth/${width}/crop/${height}/noanimate/${target}`,
    full ? 55000 : 30000,
  );
  if (thum) return { img: thum, via: "thum.io" };
  if (full) return null; // mShots can't do a whole page
  // 3. WordPress mShots — renders in the background, so ask a few times
  for (let i = 0; i < 6; i++) {
    const img = await getImage(
      `https://s0.wp.com/mshots/v1/${enc}?w=${width}&h=${height}&vpw=${width}&vph=${height}&r=${i}`,
    );
    if (img) return { img, via: "mshots" };
    await sleep(4000);
  }
  return null;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** a page's name, description and brand colour, for the inspiration library */
async function pageMeta(url: string) {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "accept-language": "he,en",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    const html = (await r.text()).slice(0, 600_000);
    const meta = (name: string) =>
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
        "i",
      ).exec(html);
    const pick = (m: RegExpExecArray | null) => (m ? decode(m[1] ?? m[2] ?? "") : "");
    const title =
      pick(meta("og:site_name")) ||
      pick(meta("og:title")) ||
      decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || "");
    return {
      title: title.slice(0, 120),
      description: (pick(meta("og:description")) || pick(meta("description"))).slice(0, 300),
      color: pick(meta("theme-color")).slice(0, 30),
    };
  } catch {
    return { title: "", description: "", color: "" };
  }
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
          let body: { projectId?: string; url?: string; width?: number; full?: boolean } = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad body" }, 400);
          }
          projectId = String(body.projectId || "");
          const target = publicHttpUrl(String(body.url || "").trim());
          if (!target) return json({ error: "כתובת לא תקינה" }, 400);
          if (q.get("op") === "meta") return json(await pageMeta(target.toString()));
          const width = Number(body.width) === 390 ? 390 : 1280;
          const got = await capture(target.toString(), width, !!body.full);
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
