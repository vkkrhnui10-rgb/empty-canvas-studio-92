import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getState } from "./store";
import { download, todayStr } from "./utils";

const KEY = "focus-last-backup-at";
const WEEK = 7 * 86400_000;

export const lastBackupAt = (): number => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};

/** download the whole workspace as a JSON file and remember when */
export function downloadBackup() {
  download(
    `focus-backup-${todayStr()}.json`,
    JSON.stringify(getState(), null, 2),
    "application/json",
  );
  try {
    localStorage.setItem(KEY, String(Date.now()));
    localStorage.setItem("focus-last-backup", new Date().toLocaleDateString("he-IL"));
  } catch {
    /* ignore */
  }
}

/** once a week (when the app is open) offer a one-click backup download */
export function useBackupReminder(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      const s = getState();
      if (s.settings.backupReminder === false || !s.projects.length) return;
      const last = lastBackupAt();
      if (last && Date.now() - last < WEEK) return;
      toast("הגיבוי השבועי מוכן", {
        description: last ? "עברו יותר משבוע מהגיבוי האחרון" : "עוד לא הורדת גיבוי",
        duration: 20000,
        action: { label: "הורד גיבוי", onClick: downloadBackup },
      });
    }, 12000);
    return () => clearTimeout(t);
  }, [enabled]);
}

/* ---- cloud snapshots, written weekly by the server monitor (grow_events, kind "backup") ---- */
export interface CloudBackup {
  id: string;
  at: string;
}
export async function listCloudBackups(): Promise<CloudBackup[]> {
  const { data } = await supabase
    .from("grow_events")
    .select("id, received_at")
    .eq("kind", "backup")
    .order("received_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((r) => ({ id: r.id, at: r.received_at }));
}
export async function loadCloudBackup(id: string): Promise<string | null> {
  const { data } = await supabase.from("grow_events").select("payload").eq("id", id).maybeSingle();
  return data ? JSON.stringify(data.payload) : null;
}
