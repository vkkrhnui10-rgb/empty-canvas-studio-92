import { createFileRoute } from "@tanstack/react-router";
import { NO_MONITOR } from "@/components/focus/constants";
import { probe, publicHttpUrl } from "@/components/focus/sitecheck.server";

/**
 * Scheduled site monitor — called by the database's daily cron job (see the
 * 20261001120000_site_monitor migration) with the account's personal key, the same
 * key the Grow webhook uses. It checks the sites that are due, and drops the results into
 * grow_events (kind "site_check"); the app applies them when it is next opened.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const EVERY_MS: Record<string, number> = {
  "10m": 10 * 60_000,
  hour: 3600_000,
  day: 86400_000,
  week: 7 * 86400_000,
};

type P = {
  id?: string;
  name?: string;
  url?: string;
  status?: string;
  siteCheck?: { at?: number; ok?: boolean };
};

async function run(request: Request) {
  const key = new URL(request.url).searchParams.get("key")?.trim();
  if (!key || !/^[a-f0-9]{24,64}$/i.test(key)) return json({ ok: false }, 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("focus_state")
    .select("user_id, data")
    .eq("webhook_token", key)
    .maybeSingle();
  if (error) return json({ ok: false }, 500);
  if (!row) return json({ ok: false }, 401);

  // weekly snapshot of the whole workspace (kept: the 8 newest; marked processed so the app ignores them)
  try {
    const { data: lastBk } = await supabaseAdmin
      .from("grow_events")
      .select("received_at")
      .eq("user_id", row.user_id)
      .eq("kind", "backup")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const hasData = !!row.data && Object.keys(row.data as object).length > 0;
    if (hasData && (!lastBk || Date.now() - Date.parse(lastBk.received_at) > 6.5 * 86400_000)) {
      await supabaseAdmin.from("grow_events").insert({
        user_id: row.user_id,
        kind: "backup",
        payload: row.data as never,
        processed_at: new Date().toISOString(),
      });
      const { data: old } = await supabaseAdmin
        .from("grow_events")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("kind", "backup")
        .order("received_at", { ascending: false })
        .range(8, 60);
      if (old?.length)
        await supabaseAdmin
          .from("grow_events")
          .delete()
          .in(
            "id",
            old.map((o) => o.id),
          );
    }
  } catch (e) {
    console.error("[site-monitor] backup failed", (e as Error).message);
  }

  const data = (row.data ?? {}) as { projects?: P[]; settings?: { siteCheckEvery?: string } };
  const every = data.settings?.siteCheckEvery ?? "week";
  if (every === "off") return json({ ok: true, skipped: "off" });
  const gap = EVERY_MS[every] ?? EVERY_MS.week;

  const due = (data.projects ?? [])
    .filter((p) => p.id && p.url?.trim() && !NO_MONITOR.includes(p.status ?? ""))
    .filter((p) => {
      const last = p.siteCheck?.at ?? 0;
      // a site that is down gets looked at again at least hourly
      const g = p.siteCheck && p.siteCheck.ok === false ? Math.min(gap, EVERY_MS.hour) : gap;
      return Date.now() - last >= g - 5 * 60_000;
    })
    .slice(0, 60);

  const rows: { user_id: string; kind: string; payload: never }[] = [];
  for (let i = 0; i < due.length; i += 5) {
    const batch = due.slice(i, i + 5);
    const res = await Promise.all(
      batch.map(async (p) => {
        const url = publicHttpUrl(p.url ?? "");
        if (!url) return null;
        return { projectId: p.id, name: p.name, at: Date.now(), ...(await probe(url)) };
      }),
    );
    for (const r of res)
      if (r) rows.push({ user_id: row.user_id, kind: "site_check", payload: r as never });
  }
  if (rows.length) {
    const { error: insErr } = await supabaseAdmin.from("grow_events").insert(rows);
    if (insErr) return json({ ok: false }, 500);
  }
  // housekeeping: processed monitor results older than 30 days
  await supabaseAdmin
    .from("grow_events")
    .delete()
    .eq("user_id", row.user_id)
    .eq("kind", "site_check")
    .lt("received_at", new Date(Date.now() - 30 * 86400_000).toISOString());
  return json({ ok: true, checked: rows.length });
}

export const Route = createFileRoute("/api/site-monitor")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
