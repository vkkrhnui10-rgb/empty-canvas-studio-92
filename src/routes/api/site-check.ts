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

/* ---------------------------- why is it down? ---------------------------- */
const SLD = new Set(["co", "org", "net", "ac", "gov", "muni", "k12", "com", "idf"]);
/** registrable domain: example.co.il / example.com */
function registrable(host: string) {
  const l = host.replace(/^www\./, "").split(".");
  if (l.length >= 3 && l[l.length - 1].length === 2 && SLD.has(l[l.length - 2]))
    return l.slice(-3).join(".");
  return l.slice(-2).join(".");
}
const heDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

async function dnsLookup(host: string): Promise<"nxdomain" | "empty" | "ok" | "unknown"> {
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return "unknown";
    const j = (await r.json()) as { Status?: number; Answer?: { type: number }[] };
    if (j.Status === 3) return "nxdomain";
    return j.Answer?.some((a) => a.type === 1 || a.type === 5) ? "ok" : "empty";
  } catch {
    return "unknown";
  }
}

/** registration info from RDAP: missing / expired / registered until… */
async function domainInfo(
  domain: string,
): Promise<{
  state: "missing" | "expired" | "active" | "unknown";
  expires?: string;
  hold?: boolean;
}> {
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      redirect: "follow",
      headers: { accept: "application/rdap+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 404) return { state: "missing" };
    if (!r.ok) return { state: "unknown" };
    const j = (await r.json()) as {
      events?: { eventAction?: string; eventDate?: string }[];
      status?: string[];
    };
    const exp = j.events?.find((e) => e.eventAction === "expiration")?.eventDate;
    const st = (j.status ?? []).join(" ").toLowerCase();
    const hold = /hold|redemption|pending delete|inactive/.test(st);
    if (exp && new Date(exp).getTime() < Date.now())
      return { state: "expired", expires: exp, hold };
    return { state: "active", expires: exp, hold };
  } catch {
    return { state: "unknown" };
  }
}

type Why = { cause: string; error: string; expires?: string };
async function diagnose(url: URL, timedOut: boolean): Promise<Why> {
  const host = url.hostname.replace(/^www\./, "");
  const dns = await dnsLookup(url.hostname);
  if (dns === "nxdomain" || dns === "empty") {
    const info = await domainInfo(registrable(host));
    if (info.state === "missing")
      return { cause: "expired", error: "הדומיין לא רשום יותר — כנראה פג תוקף ושוחרר" };
    if (info.state === "expired")
      return {
        cause: "expired",
        error: `הדומיין פג תוקף${info.expires ? ` ב-${heDate(info.expires)}` : ""} — צריך לחדש אותו`,
        expires: info.expires,
      };
    if (info.hold)
      return {
        cause: "expired",
        error: "הדומיין מושעה אצל הרשם (בד״כ חוב או חידוש שלא שולם)",
        expires: info.expires,
      };
    if (info.state === "active")
      return {
        cause: "dns",
        error: `הדומיין רשום${info.expires ? ` (עד ${heDate(info.expires)})` : ""} אבל אין לו כתובת — בעיית DNS או שרתי שמות`,
        expires: info.expires,
      };
    return {
      cause: "dns",
      error: "הדומיין לא מתורגם לכתובת (DNS) — ייתכן שפג תוקף או שה-DNS שבור",
    };
  }
  if (dns === "ok" && url.protocol === "https:") {
    // does it answer on plain http? then the problem is the certificate
    try {
      const h = new URL(url.toString());
      h.protocol = "http:";
      const r = await fetch(h.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "user-agent": "FOCUS-site-check/1.0" },
      });
      void r.body?.cancel();
      return {
        cause: "ssl",
        error: "בעיית SSL — האתר עונה ב-http אבל לא ב-https (תעודה פגה או לא תקינה)",
      };
    } catch {
      /* not an SSL-only problem */
    }
  }
  if (timedOut) return { cause: "timeout", error: "השרת לא ענה תוך 9 שניות — השרת תקוע או עמוס" };
  return {
    cause: "server",
    error:
      dns === "ok"
        ? "הדומיין תקין אבל השרת לא עונה — בעיה בשרת/אחסון (או שהחשבון הושעה)"
        : "לא מצליח להתחבר לאתר",
  };
}

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
            ...(res.status >= 500
              ? { cause: "http", error: `שגיאת שרת ${res.status} — האתר עונה אבל נשבר` }
              : {}),
          });
        } catch (e) {
          const timeout = (e as Error)?.name === "TimeoutError";
          const why = await diagnose(url, timeout);
          return json({ ok: false, status: 0, ms: Date.now() - t0, ...why });
        }
      },
    },
  },
});
