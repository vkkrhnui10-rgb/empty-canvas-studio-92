import { createFileRoute } from "@tanstack/react-router";
import {
  cleanComment,
  MAX_COMMENTS,
  validNoteId,
  validReviewId,
} from "@/components/focus/reviewcore";
import { publicHttpUrl } from "@/components/focus/sitecheck.server";
import type { ReviewComment } from "@/components/focus/types";

/**
 * Design review — the public side of /r/<id>.
 *
 *   GET  ?r=<id>                          → { url, project, owner, round, comments, approved }
 *   POST ?r=<id>&op=comment  { comment }  → add / edit a note in the current round
 *   POST ?r=<id>&op=delete   { id }       → remove one of the current round's notes
 *   POST ?r=<id>&op=shot&c=<noteId>  (jpeg / png body) → { path } what the client saw
 *   POST ?r=<id>&op=send                  → "I'm done" (lands in grow_events, kind "review")
 *   POST ?r=<id>&op=approve  { name }     → the design is approved (also lands in grow_events)
 *   POST ?r=<id>&op=page     { view, path } → a full-page screenshot when the live site can't be shown
 *
 * Owner only (Authorization: Bearer <access token>):
 *   POST ?op=state  { r }                 → everything, with short-lived URLs for the screenshots
 *   POST ?op=mark   { r, done: {id: bool} } → which notes are fixed (the client sees ✓)
 *   POST ?op=round  { r }                 → start a new round
 *   POST ?op=purge  { r }                 → delete the review's files
 *
 * The review id is a long random string inside the owner's workspace JSON; deleting the review
 * in the app revokes the link. Notes live in a JSON file in the private brief bucket.
 */
const BUCKET = "focus-briefs";
const MAX_SHOT = 4 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
const admin = async (): Promise<Admin> =>
  (await import("@/integrations/supabase/client.server")).supabaseAdmin;

interface Owner {
  userId: string;
  ownerName: string;
  review: { url: string; projectName: string; round: number };
}

interface State {
  round: number;
  comments: ReviewComment[];
  approved?: { name: string; at: number; round: number };
  sentAt?: number;
  pages?: Record<string, string>;
}

async function findOwner(sb: Admin, id: string): Promise<Owner | null> {
  const { data, error } = await sb
    .from("focus_state")
    .select("user_id, reviews:data->reviews, owner:data->settings->>ownerName")
    .filter("data->reviews", "cs", JSON.stringify([{ id }]))
    .limit(1);
  if (error || !data?.length) return null;
  const row = data[0];
  const r = (Array.isArray(row.reviews) ? row.reviews : []).find(
    (x: Record<string, unknown>) => x?.id === id,
  );
  if (!r) return null;
  return {
    userId: row.user_id,
    ownerName: row.owner || "",
    review: {
      url: String(r.url || ""),
      projectName: String(r.projectName || ""),
      round: Math.max(1, Number(r.round) || 1),
    },
  };
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

const dir = (uid: string, r: string) => `${uid}/reviews/${r}`;
const statePath = (uid: string, r: string) => `${dir(uid, r)}/state.json`;

async function loadState(sb: Admin, uid: string, r: string, round = 1): Promise<State> {
  try {
    const { data } = await sb.storage.from(BUCKET).download(statePath(uid, r));
    if (data) {
      const s = JSON.parse(await data.text()) as State;
      if (s && Array.isArray(s.comments)) return { ...s, round: Math.max(1, Number(s.round) || 1) };
    }
  } catch {
    /* first use */
  }
  return { round, comments: [] };
}

async function saveState(sb: Admin, uid: string, r: string, s: State) {
  await ensureBucket(sb);
  const { error } = await sb.storage.from(BUCKET).upload(statePath(uid, r), JSON.stringify(s), {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

/** short-lived URLs for the screenshots in a list of notes */
async function shotUrls(sb: Admin, notes: ReviewComment[]): Promise<Record<string, string>> {
  const paths = notes.map((c) => c.shot).filter((p): p is string => !!p);
  if (!paths.length) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600 * 6);
  return Object.fromEntries(
    (data || [])
      .filter((d: { signedUrl?: string }) => d.signedUrl)
      .map((d: { path: string; signedUrl: string }) => [d.path, d.signedUrl]),
  );
}

const body = async (request: Request, max = 20_000): Promise<Record<string, unknown> | null> => {
  const raw = await request.text();
  if (raw.length > max) return null;
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

/* ---------------- full-page screenshot (fallback when the site can't be framed) ---------------- */
async function getImage(url: string, timeout = 40000): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: "follow" });
    if (!r.ok) return null;
    if (!/^image\/(jpeg|png|webp)/.test(r.headers.get("content-type") || "")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.length > 12_000 && buf.length < 15 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

/** reveal-on-scroll content is forced visible and animations finish instantly, so nothing is blank */
const REVEAL_CSS =
  "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition-duration:0s!important;transition-delay:0s!important}[data-aos],.aos-init,.aos-animate,.wow,.reveal,.fade-in,[data-animate],[data-scroll]{opacity:1!important;transform:none!important;visibility:visible!important}";

async function fullPage(
  target: string,
  width: number,
): Promise<{ img: Uint8Array; via: string } | null> {
  const mobile = width < 600;
  try {
    const params = new URLSearchParams({
      url: target,
      screenshot: "true",
      meta: "false",
      "screenshot.fullPage": "true",
      "screenshot.type": "jpeg",
      "viewport.width": String(width),
      "viewport.height": mobile ? "844" : "900",
      "viewport.deviceScaleFactor": mobile ? "2" : "1",
      "viewport.isMobile": String(mobile),
      waitForTimeout: "3000",
      styles: REVEAL_CSS,
    });
    const r = await fetch(`https://api.microlink.io/?${params}`, {
      signal: AbortSignal.timeout(55000),
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
  const thum = await getImage(
    `https://image.thum.io/get/width/${width}/viewportWidth/${width}/fullpage/wait/3/noanimate/${target}`,
    55000,
  );
  if (thum) return { img: thum, via: "thum.io" };
  return null;
}

export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const r = new URL(request.url).searchParams.get("r");
        if (!validReviewId(r)) return json({ error: "not found" }, 404);
        const sb = await admin();
        const o = await findOwner(sb, r);
        if (!o) return json({ error: "הקישור כבר לא פעיל" }, 404);
        const s = await loadState(sb, o.userId, r, o.review.round);
        const urls = await shotUrls(sb, s.comments);
        return json({
          url: o.review.url,
          project: o.review.projectName,
          owner: o.ownerName,
          round: s.round,
          approved: s.approved ?? null,
          sentAt: s.sentAt ?? null,
          comments: s.comments.map((c) => ({ ...c, shotUrl: c.shot ? urls[c.shot] : undefined })),
        });
      },

      POST: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const op = q.get("op");
        const sb = await admin();

        /* ---------- owner-only ---------- */
        if (op === "check") {
          // is the line on the site, and does the site let itself be shown inside the review page?
          const uid = await authUser(sb, request);
          if (!uid) return json({ error: "unauthorized" }, 401);
          const b = await body(request);
          const target = publicHttpUrl(String(b?.url ?? ""));
          if (!target) return json({ error: "כתובת לא תקינה" }, 400);
          const me = new URL(request.url).origin;
          try {
            const r = await fetch(target, {
              headers: {
                "user-agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
              },
              redirect: "follow",
              signal: AbortSignal.timeout(15000),
            });
            const html = (await r.text()).slice(0, 2_000_000);
            const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
            const csp = r.headers.get("content-security-policy") || "";
            const fa = /frame-ancestors([^;]*)/i.exec(csp)?.[1]?.trim() || "";
            const blocks =
              /deny|sameorigin/.test(xfo) ||
              (!!fa && !/(^|\s)\*(\s|$)/.test(fa) && !fa.includes(new URL(me).host));
            return json({
              status: r.status,
              installed: /\/feedback\.js/.test(html),
              blocks,
              why: blocks ? (xfo ? `X-Frame-Options: ${xfo}` : `frame-ancestors ${fa}`) : "",
            });
          } catch {
            return json({ error: "האתר לא ענה" }, 502);
          }
        }

        if (op === "state" || op === "mark" || op === "round" || op === "purge") {
          const uid = await authUser(sb, request);
          if (!uid) return json({ error: "unauthorized" }, 401);
          const b = await body(request);
          const r = b?.r;
          if (!validReviewId(r)) return json({ error: "bad id" }, 400);

          if (op === "purge") {
            const all: string[] = [statePath(uid, r)];
            for (const sub of ["shots", "pages"]) {
              const { data } = await sb.storage
                .from(BUCKET)
                .list(`${dir(uid, r)}/${sub}`, { limit: 1000 });
              for (const f of data || []) all.push(`${dir(uid, r)}/${sub}/${f.name}`);
            }
            await sb.storage.from(BUCKET).remove(all);
            return json({ removed: all.length });
          }

          const s = await loadState(sb, uid, r);
          if (op === "mark") {
            const done = (b?.done && typeof b.done === "object" ? b.done : {}) as Record<
              string,
              unknown
            >;
            for (const c of s.comments) if (c.id in done) c.done = !!done[c.id];
            await saveState(sb, uid, r, s);
          } else if (op === "round") {
            s.round += 1;
            s.sentAt = undefined;
            await saveState(sb, uid, r, s);
          }
          const urls = await shotUrls(sb, s.comments);
          return json({
            round: s.round,
            approved: s.approved ?? null,
            sentAt: s.sentAt ?? null,
            comments: s.comments.map((c) => ({
              ...c,
              shotUrl: c.shot ? urls[c.shot] : undefined,
            })),
          });
        }

        /* ---------- public (the client) ---------- */
        const r = q.get("r");
        if (!validReviewId(r)) return json({ error: "not found" }, 404);
        const o = await findOwner(sb, r);
        if (!o) return json({ error: "הקישור כבר לא פעיל" }, 404);
        const uid = o.userId;

        if (op === "shot") {
          const c = q.get("c");
          if (!validNoteId(c)) return json({ error: "bad id" }, 400);
          const len = Number(request.headers.get("content-length") || 0);
          if (len > MAX_SHOT) return json({ error: "too big" }, 413);
          const buf = new Uint8Array(await request.arrayBuffer());
          if (!buf.length || buf.length > MAX_SHOT) return json({ error: "too big" }, 413);
          const png = buf[0] === 0x89 && buf[1] === 0x50;
          const jpg = buf[0] === 0xff && buf[1] === 0xd8;
          if (!png && !jpg) return json({ error: "not an image" }, 415);
          await ensureBucket(sb);
          const { data: existing } = await sb.storage
            .from(BUCKET)
            .list(`${dir(uid, r)}/shots`, { limit: 1000 });
          if ((existing?.length || 0) >= MAX_COMMENTS + 50)
            return json({ error: "יותר מדי צילומים" }, 429);
          const path = `${dir(uid, r)}/shots/${c}.${png ? "png" : "jpg"}`;
          const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
            contentType: png ? "image/png" : "image/jpeg",
            upsert: true,
          });
          if (error) return json({ error: error.message }, 500);
          return json({ path });
        }

        if (op === "page") {
          const b = await body(request);
          const view = b?.view === "mobile" ? "mobile" : "desktop";
          const base = publicHttpUrl(o.review.url);
          if (!base) return json({ error: "כתובת האתר לא תקינה" }, 400);
          let target = base;
          const p = typeof b?.path === "string" ? b.path : "";
          if (p && p.startsWith("/") && !p.startsWith("//")) {
            try {
              target = new URL(p, base);
            } catch {
              target = base;
            }
          }
          if (target.origin !== base.origin) target = base;
          const s = await loadState(sb, uid, r, o.review.round);
          const key = `${view}|${target.pathname}|${s.round}`;
          let path = s.pages?.[key];
          if (!path || b?.fresh) {
            const got = await fullPage(target.toString(), view === "mobile" ? 390 : 1440);
            if (!got) return json({ error: "לא הצלחנו לצלם את האתר כרגע. נסו שוב בעוד דקה" }, 502);
            await ensureBucket(sb);
            path = `${dir(uid, r)}/pages/${view}-${s.round}-${Date.now().toString(36)}.jpg`;
            const { error } = await sb.storage
              .from(BUCKET)
              .upload(path, got.img, { contentType: "image/jpeg", upsert: true });
            if (error) return json({ error: error.message }, 500);
            s.pages = { ...(s.pages || {}), [key]: path };
            await saveState(sb, uid, r, s);
          }
          const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600 * 6);
          return json({ url: data?.signedUrl ?? null, path: target.pathname });
        }

        const b = await body(request);
        if (!b) return json({ error: "bad body" }, 400);
        const s = await loadState(sb, uid, r, o.review.round);

        if (op === "comment") {
          const c = cleanComment(b.comment, s.round);
          if (!c) return json({ error: "ההערה ריקה" }, 400);
          if (c.shot && !c.shot.startsWith(`${dir(uid, r)}/shots/`)) c.shot = undefined;
          const i = s.comments.findIndex((x) => x.id === c.id);
          if (i >= 0) {
            const old = s.comments[i];
            if (old.round !== s.round || old.done)
              return json({ error: "אי אפשר לערוך הערה מסבב קודם" }, 409);
            s.comments[i] = { ...old, ...c, shot: c.shot || old.shot, at: old.at };
          } else {
            if (s.comments.length >= MAX_COMMENTS) return json({ error: "יותר מדי הערות" }, 429);
            s.comments.push(c);
          }
          await saveState(sb, uid, r, s);
          return json({ ok: true, comment: s.comments.find((x) => x.id === c.id) });
        }

        if (op === "delete") {
          const id = b.id;
          const c = s.comments.find((x) => x.id === id);
          if (!c) return json({ ok: true });
          if (c.round !== s.round || c.done)
            return json({ error: "אי אפשר למחוק הערה מסבב קודם" }, 409);
          s.comments = s.comments.filter((x) => x.id !== id);
          if (c.shot) await sb.storage.from(BUCKET).remove([c.shot]);
          await saveState(sb, uid, r, s);
          return json({ ok: true });
        }

        if (op === "send" || op === "approve") {
          const name = String(b.name ?? "")
            .trim()
            .slice(0, 60);
          if (op === "approve" && !name) return json({ error: "חסר שם" }, 400);
          const at = Date.now();
          if (op === "approve") s.approved = { name, at, round: s.round };
          else s.sentAt = at;
          await saveState(sb, uid, r, s);
          const open = s.comments.filter((c) => c.round === s.round).length;
          const { error } = await sb.from("grow_events").insert({
            user_id: uid,
            kind: "review",
            payload: {
              reviewId: r,
              type: op === "approve" ? "approved" : "sent",
              name,
              count: open,
              at,
            },
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, at });
        }

        return json({ error: "unknown op" }, 400);
      },
    },
  },
});
