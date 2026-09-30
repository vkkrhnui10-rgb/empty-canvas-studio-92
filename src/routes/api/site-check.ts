import { createFileRoute } from "@tanstack/react-router";

/**
 * Is a client's site up? POST { url } with the signed-in user's access token
 * (Authorization: Bearer …). Returns { ok, status, ms, error? }.
 * Only public http(s) hosts are checked.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function publicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") && !h.includes(":")) return null; // localhost, bare names
  if (/\.(local|internal|localhost|lan|home|corp)$/.test(h)) return null;
  if (h.includes(":") || h.startsWith("[")) return null; // IPv6 literals
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return null;
    if (a === 169 && b === 254) return null;
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 192 && b === 168) return null;
    if (a === 100 && b >= 64 && b <= 127) return null;
  }
  return u;
}

export const Route = createFileRoute("/api/site-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ ok: false, error: "unauthorized" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !auth?.user) return json({ ok: false, error: "unauthorized" }, 401);

        let raw = "";
        try {
          raw = String(((await request.json()) as { url?: string }).url ?? "").trim();
        } catch {
          return json({ ok: false, error: "bad body" }, 400);
        }
        const url = publicHttpUrl(raw);
        if (!url) return json({ ok: false, error: "כתובת לא תקינה" }, 400);

        const t0 = Date.now();
        try {
          const res = await fetch(url.toString(), {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(9000),
            headers: { "user-agent": "FOCUS-site-check/1.0" },
          });
          void res.body?.cancel();
          return json({
            ok: res.status < 500,
            status: res.status,
            ms: Date.now() - t0,
          });
        } catch (e) {
          const timeout = (e as Error)?.name === "TimeoutError";
          return json({
            ok: false,
            status: 0,
            ms: Date.now() - t0,
            error: timeout ? "לא ענה תוך 9 שניות" : "לא מצליח להתחבר",
          });
        }
      },
    },
  },
});
