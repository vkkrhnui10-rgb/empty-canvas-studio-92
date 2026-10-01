import { createFileRoute } from "@tanstack/react-router";
import { probe, publicHttpUrl } from "@/components/focus/sitecheck.server";

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

export const Route = createFileRoute("/api/site-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "")
          .trim();
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

        return json(await probe(url));
      },
    },
  },
});
