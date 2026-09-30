import { createFileRoute } from "@tanstack/react-router";
import { classify, readBody } from "@/components/focus/grow";

/**
 * Grow → FOCUS webhook.
 * URL: https://<site>/api/grow/webhook?key=<personal token from FOCUS settings>
 * The token identifies the FOCUS account; the event is stored and applied by the app.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const Route = createFileRoute("/api/grow/webhook")({
  server: {
    handlers: {
      GET: async () => json({ ok: true, service: "FOCUS Grow webhook" }),
      POST: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("key")?.trim();
        if (!key || !/^[a-f0-9]{24,64}$/i.test(key)) return json({ ok: false }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner, error: ownerErr } = await supabaseAdmin
          .from("focus_state")
          .select("user_id")
          .eq("webhook_token", key)
          .maybeSingle();
        if (ownerErr) {
          console.error("[grow-webhook] lookup failed", ownerErr.message);
          return json({ ok: false }, 500);
        }
        if (!owner) return json({ ok: false }, 401);

        let payload: Record<string, unknown>;
        try {
          payload = await readBody(request);
        } catch {
          return json({ ok: false, error: "bad body" }, 400);
        }

        const { error } = await supabaseAdmin.from("grow_events").insert({
          user_id: owner.user_id,
          kind: classify(payload),
          payload: payload as never,
        });
        if (error) {
          console.error("[grow-webhook] insert failed", error.message);
          return json({ ok: false }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
