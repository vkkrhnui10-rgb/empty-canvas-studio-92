import { createFileRoute } from "@tanstack/react-router";

/**
 * The owner's private files (for now: uploaded fonts). Private bucket, signed links only —
 * a font's licence may not allow putting the file on a public address.
 *
 *   POST ?op=upload&key=fonts/<id>.<ext>   (raw body) → { path }
 *   POST ?op=url    { path }                          → { url } valid for an hour
 *   POST ?op=delete { path }                          → { ok }
 *
 * All need the signed-in owner's access token; paths are always inside the owner's own folder.
 */
const BUCKET = "focus-briefs";
const MAX = 20 * 1024 * 1024;
const KEY = /^fonts\/[A-Za-z0-9_-]{4,40}\.(ttf|otf|woff|woff2)$/;
const TYPES: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/files")({
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
        const op = q.get("op");

        if (op === "upload") {
          const key = q.get("key") || "";
          if (!KEY.test(key)) return json({ error: "סוג קובץ לא נתמך" }, 415);
          const len = Number(request.headers.get("content-length") || 0);
          if (len > MAX) return json({ error: "הקובץ גדול מדי (עד 20MB)" }, 413);
          const buf = new Uint8Array(await request.arrayBuffer());
          if (!buf.length || buf.length > MAX)
            return json({ error: "הקובץ גדול מדי (עד 20MB)" }, 413);
          const { data: bucket } = await sb.storage.getBucket(BUCKET);
          if (!bucket) {
            const { error } = await sb.storage.createBucket(BUCKET, { public: false });
            if (error && !/exist/i.test(error.message)) return json({ error: error.message }, 500);
          }
          const path = `${uid}/${key}`;
          const ext = key.split(".").pop() || "ttf";
          const { error } = await sb.storage
            .from(BUCKET)
            .upload(path, buf, { contentType: TYPES[ext], upsert: true });
          if (error) return json({ error: error.message }, 500);
          return json({ path });
        }

        let body: { path?: unknown } = {};
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad body" }, 400);
        }
        const path = String(body.path ?? "");
        if (!path.startsWith(`${uid}/`) || !KEY.test(path.slice(uid.length + 1)))
          return json({ error: "bad path" }, 400);

        if (op === "url") {
          const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
          if (error || !data?.signedUrl) return json({ error: error?.message || "not found" }, 404);
          return json({ url: data.signedUrl });
        }
        if (op === "delete") {
          await sb.storage.from(BUCKET).remove([path]);
          return json({ ok: true });
        }
        return json({ error: "unknown op" }, 400);
      },
    },
  },
});
