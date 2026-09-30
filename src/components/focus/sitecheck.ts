import { supabase } from "@/integrations/supabase/client";
import type { SiteCheck } from "./types";

const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const normUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`);

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
          return { at, ok: !!j.ok, status: j.status ?? 0, ms: j.ms ?? 0, error: j.error };
        }
      }
    } catch {
      /* fall through to the browser check */
    }
  }
  const t0 = Date.now();
  try {
    await fetch(normUrl(url), { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(9000) });
    return { at, ok: true, status: 0, ms: Date.now() - t0 };
  } catch {
    return { at, ok: false, status: 0, ms: Date.now() - t0, error: "לא מצליח להתחבר" };
  }
}
