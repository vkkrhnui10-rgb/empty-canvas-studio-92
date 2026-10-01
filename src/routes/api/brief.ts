import { createFileRoute } from "@tanstack/react-router";
import { cleanAnswers } from "@/components/focus/briefcore";

/**
 * Website brief (questionnaire) — the public side of /b/<id>.
 *
 *   GET  ?b=<id>                         → { client, business, owner, status, answers? }
 *   POST ?b=<id>&op=upload&kind=logo|image&name=…   (raw file body) → { path }
 *   POST ?b=<id>&op=submit  { answers, files }      → lands in grow_events (kind "brief")
 *
 * Owner only (Authorization: Bearer <access token>):
 *   POST ?op=files  { paths }   → short-lived signed URLs for the panel / ZIP
 *   POST ?op=purge  { b }       → delete a brief's files
 *
 * The brief id is a long random string that lives inside the owner's workspace JSON;
 * deleting the brief in the app revokes the link. Files go to a private storage bucket
 * that is created on first use.
 */
const BUCKET = "focus-briefs";
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 80;
const LOGO_EXT = ["png", "jpg", "jpeg", "svg", "webp", "gif", "pdf", "ai", "eps", "psd", "heic"];
const IMG_EXT = ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif", "avif"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const validId = (s: string | null): s is string => !!s && /^[A-Za-z0-9]{12,40}$/.test(s);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
const admin = async (): Promise<Admin> =>
  (await import("@/integrations/supabase/client.server")).supabaseAdmin;

interface Owner {
  userId: string;
  ownerName: string;
  brief: Record<string, unknown>;
}

/** which workspace holds this brief id */
async function findOwner(sb: Admin, id: string): Promise<Owner | null> {
  const { data, error } = await sb
    .from("focus_state")
    .select("user_id, briefs:data->briefs, owner:data->settings->>ownerName")
    .filter("data->briefs", "cs", JSON.stringify([{ id }]))
    .limit(1);
  if (error || !data?.length) return null;
  const row = data[0];
  const brief = (Array.isArray(row.briefs) ? row.briefs : []).find(
    (b: Record<string, unknown>) => b?.id === id,
  );
  if (!brief) return null;
  return { userId: row.user_id, ownerName: row.owner || "", brief };
}

let bucketReady = false;
async function ensureBucket(sb: Admin) {
  if (bucketReady) return;
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: false });
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  }
  bucketReady = true;
}

async function authUser(sb: Admin, request: Request): Promise<string | null> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data?.user ? null : data.user.id;
}

const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase().slice(0, 5);

export const Route = createFileRoute("/api/brief")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const b = new URL(request.url).searchParams.get("b");
        if (!validId(b)) return json({ error: "not found" }, 404);
        const sb = await admin();
        const o = await findOwner(sb, b);
        if (!o) return json({ error: "not found" }, 404);
        return json({
          client: o.brief.client ?? "",
          business: o.brief.business ?? "",
          owner: o.ownerName,
          status: o.brief.status ?? "sent",
          answers: o.brief.answers ?? null,
          files: o.brief.files ?? [],
        });
      },

      POST: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const op = q.get("op");
        const sb = await admin();

        /* ---------- owner-only ---------- */
        if (op === "files" || op === "purge") {
          const uid = await authUser(sb, request);
          if (!uid) return json({ error: "unauthorized" }, 401);
          let body: { paths?: unknown; b?: unknown } = {};
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad body" }, 400);
          }
          if (op === "files") {
            const paths = (Array.isArray(body.paths) ? body.paths : [])
              .filter((p): p is string => typeof p === "string" && p.startsWith(`${uid}/`))
              .slice(0, 200);
            if (!paths.length) return json({ files: [] });
            const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
            if (error) return json({ error: error.message }, 500);
            return json({
              files: (data || []).map((d: { path: string; signedUrl: string }) => ({
                path: d.path,
                url: d.signedUrl,
              })),
            });
          }
          const bid = String(body.b ?? "");
          if (!validId(bid)) return json({ error: "bad id" }, 400);
          const all: string[] = [];
          for (const kind of ["logo", "image"]) {
            const { data } = await sb.storage
              .from(BUCKET)
              .list(`${uid}/${bid}/${kind}`, { limit: 200 });
            for (const f of data || []) all.push(`${uid}/${bid}/${kind}/${f.name}`);
          }
          if (all.length) await sb.storage.from(BUCKET).remove(all);
          return json({ removed: all.length });
        }

        /* ---------- public (the client) ---------- */
        const b = q.get("b");
        if (!validId(b)) return json({ error: "not found" }, 404);
        const o = await findOwner(sb, b);
        if (!o) return json({ error: "הקישור כבר לא פעיל" }, 404);

        if (op === "upload") {
          const kind = q.get("kind") === "logo" ? "logo" : "image";
          const name = (q.get("name") || "file").slice(0, 120);
          const ext = extOf(name);
          if (!(kind === "logo" ? LOGO_EXT : IMG_EXT).includes(ext))
            return json({ error: "סוג קובץ לא נתמך" }, 415);
          const len = Number(request.headers.get("content-length") || 0);
          if (len > MAX_FILE) return json({ error: "הקובץ גדול מדי (עד 25MB)" }, 413);
          const buf = new Uint8Array(await request.arrayBuffer());
          if (!buf.length || buf.length > MAX_FILE)
            return json({ error: "הקובץ גדול מדי (עד 25MB)" }, 413);
          await ensureBucket(sb);
          const dir = `${o.userId}/${b}/${kind}`;
          const { data: existing } = await sb.storage.from(BUCKET).list(dir, { limit: 200 });
          if ((existing?.length || 0) >= MAX_FILES)
            return json({ error: "הגעת למספר הקבצים המקסימלי" }, 429);
          const path = `${dir}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
          const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
            contentType: request.headers.get("content-type") || "application/octet-stream",
            upsert: false,
          });
          if (error) return json({ error: error.message }, 500);
          return json({ path });
        }

        if (op === "submit") {
          const raw = await request.text();
          if (raw.length > 300_000) return json({ error: "too big" }, 413);
          let body: { answers?: unknown; files?: unknown } = {};
          try {
            body = JSON.parse(raw);
          } catch {
            return json({ error: "bad body" }, 400);
          }
          const prefix = `${o.userId}/${b}/`;
          const files = (Array.isArray(body.files) ? body.files : [])
            .filter(
              (f: Record<string, unknown>) =>
                f && typeof f.path === "string" && f.path.startsWith(prefix),
            )
            .slice(0, MAX_FILES * 2)
            .map((f: Record<string, unknown>) => ({
              path: String(f.path),
              name: String(f.name ?? "file").slice(0, 120),
              kind: f.kind === "logo" ? "logo" : "image",
              size: Number(f.size) || 0,
              type: String(f.type ?? "").slice(0, 60),
            }));
          const { error } = await sb.from("grow_events").insert({
            user_id: o.userId,
            kind: "brief",
            payload: { briefId: b, answers: cleanAnswers(body.answers), files, at: Date.now() },
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        return json({ error: "unknown op" }, 400);
      },
    },
  },
});
