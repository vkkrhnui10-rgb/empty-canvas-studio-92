import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NO_MONITOR } from "./constants";
import { actions, getState } from "./store";
import type { SiteCheck } from "./types";

const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const normUrl = (u: string) =>
  /^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`;

/** Ask the server whether the site answers; falls back to a browser-side reachability ping */
export async function checkSite(url: string): Promise<SiteCheck> {
  const at = Date.now();
  if (configured) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const res = await fetch("/api/site-check", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const j = (await res.json()) as Omit<SiteCheck, "at">;
          return {
            at,
            ok: !!j.ok,
            status: j.status ?? 0,
            ms: j.ms ?? 0,
            error: j.error,
            cause: j.cause,
            expires: j.expires,
          };
        }
      }
    } catch {
      /* fall through to the browser check */
    }
  }
  const t0 = Date.now();
  try {
    await fetch(normUrl(url), {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    return { at, ok: true, status: 0, ms: Date.now() - t0 };
  } catch {
    return { at, ok: false, status: 0, ms: Date.now() - t0, error: "לא מצליח להתחבר" };
  }
}

/* ---------------- background monitor: checks every project's site, alerts when one is down ---------------- */
const EVERY_MS = { "10m": 10 * 60_000, hour: 3600_000, day: 86400_000, week: 7 * 86400_000 };

async function checkOnce(url: string): Promise<SiteCheck> {
  const r = await checkSite(url);
  if (r.ok) return r;
  await new Promise((res) => setTimeout(res, 3000)); // one quiet retry before calling it an outage
  return checkSite(url);
}

async function sweep() {
  const every = getState().settings.siteCheckEvery ?? "week";
  if (every === "off") return;
  const gap = EVERY_MS[every];
  if (typeof document !== "undefined" && document.hidden) return;
  for (const p of [...getState().projects]) {
    if (!p.url.trim() || NO_MONITOR.includes(p.status)) continue;
    // a site that is currently down is rechecked at least hourly, so the alert clears once it is back
    const g = p.siteCheck && !p.siteCheck.ok ? Math.min(gap, EVERY_MS.hour) : gap;
    if (Date.now() - (p.siteCheck?.at ?? 0) < g - 30_000) continue;
    const wasUp = p.siteCheck ? p.siteCheck.ok : true;
    const r = await checkOnce(p.url);
    actions.recordSiteCheck(p.id, r);
    if (!r.ok && wasUp) {
      const msg = `האתר לא עובד: ${p.name}${r.error ? ` — ${r.error}` : ""}`;
      toast.error(msg, { duration: 10000 });
      if (
        getState().settings.notifications &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      )
        new Notification("FOCUS", { body: msg });
    }
  }
}

/** call once while the app is open */
export function useSiteMonitor(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(() => void sweep(), 6000);
    const iv = setInterval(() => void sweep(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [enabled]);
}
