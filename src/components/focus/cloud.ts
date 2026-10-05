/* ============================================================
 * FOCUS ⇄ Lovable Cloud (Supabase)
 * - The whole workspace lives in one row per user: focus_state.data (JSON).
 * - localStorage stays as an offline cache; local edits are pushed
 *   (debounced) and other devices get them through realtime.
 * - Grow webhook events arrive in grow_events and are applied here.
 * ============================================================ */
import { useSyncExternalStore } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { actions, getState, hasLocalData, onLocalChange, replaceFromRemote } from "./store";

export type SyncStatus = "off" | "loading" | "synced" | "saving" | "offline" | "error";

interface CloudState {
  enabled: boolean;
  ready: boolean; // auth state known
  session: Session | null;
  status: SyncStatus;
  webhookToken: string;
  lastSync: number;
  error: string;
  recovering: boolean; // arrived from a "reset password" email
}

const configured =
  typeof import.meta !== "undefined" &&
  !!import.meta.env?.VITE_SUPABASE_URL &&
  !!import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

let cs: CloudState = {
  enabled: configured,
  ready: !configured,
  session: null,
  status: configured ? "loading" : "off",
  webhookToken: "",
  lastSync: 0,
  error: "",
  recovering: false,
};
const subs = new Set<() => void>();
const setCs = (p: Partial<CloudState>) => {
  cs = { ...cs, ...p };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const useCloud = () =>
  useSyncExternalStore(
    subscribe,
    () => cs,
    () => cs,
  );
export const getCloud = () => cs;

/* a stable id for this browser, so we ignore our own realtime echoes */
const DEVICE = (() => {
  if (typeof window === "undefined") return "ssr";
  try {
    let d = localStorage.getItem("focus-device");
    if (!d) {
      d = Math.random().toString(36).slice(2, 10);
      localStorage.setItem("focus-device", d);
    }
    return d;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
})();

let started = false;
let userId = "";
let channel: RealtimeChannel | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let unhookLocal: (() => void) | undefined;
let pending = false;

/** call once on app start */
export function startCloud() {
  if (!configured || started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => handleSession(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") setCs({ recovering: true });
    if ((session?.user.id ?? "") !== userId) handleSession(session);
    else setCs({ session });
  });
  window.addEventListener("online", () => pending && flush());
  window.addEventListener("beforeunload", () => {
    if (pending) void flush();
  });
}

async function handleSession(session: Session | null) {
  teardown();
  setCs({ session, ready: true });
  if (!session) {
    userId = "";
    setCs({ status: "off" });
    return;
  }
  userId = session.user.id;
  setCs({ status: "loading", error: "" });
  try {
    await pullOrSeed();
    listen();
    await drainGrow();
    unhookLocal = onLocalChange(() => schedule());
    setCs({ status: "synced", lastSync: Date.now() });
  } catch (e) {
    setCs({
      status: navigator.onLine ? "error" : "offline",
      error: String((e as Error)?.message ?? e),
    });
  }
}

function teardown() {
  unhookLocal?.();
  unhookLocal = undefined;
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  clearTimeout(saveTimer);
}

/** first load: cloud wins; an empty cloud gets this browser's data */
async function pullOrSeed() {
  const { data, error } = await supabase
    .from("focus_state")
    .select("data, webhook_token, device")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const remote = data?.data as Record<string, unknown> | null | undefined;
  const remoteHasData =
    !!remote &&
    ["projects", "tasks", "leads", "cpanels"].some(
      (k) => Array.isArray(remote[k]) && (remote[k] as unknown[]).length > 0,
    );

  if (data && remoteHasData) {
    // keep a safety copy of whatever this browser had before switching to the cloud copy
    if (hasLocalData() && localStorage.getItem("focus-cloud-user") !== userId) {
      try {
        localStorage.setItem("focus-db-local-backup", JSON.stringify(getState()));
      } catch {
        /* quota */
      }
    }
    replaceFromRemote(remote);
    setCs({ webhookToken: data.webhook_token });
  } else {
    const { data: row, error: upErr } = await supabase
      .from("focus_state")
      .upsert(
        {
          user_id: userId,
          data: getState() as never,
          device: DEVICE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("webhook_token")
      .single();
    if (upErr) throw upErr;
    setCs({ webhookToken: row.webhook_token });
  }
  localStorage.setItem("focus-cloud-user", userId);
}

function schedule() {
  if (!userId) return;
  pending = true;
  setCs({ status: "saving" });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 900);
}

async function flush() {
  if (!userId) return;
  clearTimeout(saveTimer);
  const snapshot = getState();
  const { error } = await supabase
    .from("focus_state")
    .update({ data: snapshot as never, device: DEVICE, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    setCs({ status: navigator.onLine ? "error" : "offline", error: error.message });
    // retry later
    saveTimer = setTimeout(flush, 15_000);
    return;
  }
  // more edits may have landed while saving
  if (getState() === snapshot) {
    pending = false;
    setCs({ status: "synced", lastSync: Date.now(), error: "" });
  } else schedule();
}

function listen() {
  channel = supabase
    .channel(`focus-${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "focus_state", filter: `user_id=eq.${userId}` },
      (msg) => {
        const row = msg.new as { data?: unknown; device?: string };
        if (!row || row.device === DEVICE || pending) return;
        replaceFromRemote(row.data);
        setCs({ lastSync: Date.now() });
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "grow_events", filter: `user_id=eq.${userId}` },
      () => void drainGrow(),
    )
    .subscribe();
}

/** a result from the scheduled server-side site monitor */
function applySiteCheck(pl: Record<string, unknown>) {
  const id = String(pl.projectId ?? "");
  const p = getState().projects.find((x) => x.id === id);
  if (!p) return;
  if (p.siteCheck && p.siteCheck.at >= Number(pl.at)) return; // we already have something newer
  const wasUp = p.siteCheck ? p.siteCheck.ok : true;
  actions.recordSiteCheck(id, {
    at: Number(pl.at) || Date.now(),
    ok: !!pl.ok,
    status: Number(pl.status) || 0,
    ms: Number(pl.ms) || 0,
    error: pl.error ? String(pl.error) : undefined,
    cause: pl.cause ? String(pl.cause) : undefined,
    expires: pl.expires ? String(pl.expires) : undefined,
  });
  if (!pl.ok && wasUp)
    toast.error(`האתר לא עובד: ${p.name}${pl.error ? ` — ${String(pl.error)}` : ""}`, {
      duration: 10000,
    });
}

/** a client finished the website questionnaire */
function applyBriefEvent(pl: Record<string, unknown>) {
  const b = actions.applyBrief(pl);
  if (!b) return;
  const who = b.answers?.business || b.business || b.client;
  toast.success(`${who} מילא/ה את שאלון האפיון`, {
    duration: 12000,
    action: { label: "פתח", onClick: () => (window.location.hash = `#/briefs/${b.id}`) },
  });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted")
      new Notification("אפיון חדש מולא", { body: who });
  } catch {
    /* ignore */
  }
}

/** a client sent design notes / approved the design */
function applyReviewEvent(pl: Record<string, unknown>) {
  const id = String(pl.reviewId ?? "");
  const r = getState().reviews.find((x) => x.id === id);
  if (!r) return;
  const approved = pl.type === "approved";
  const who = String(pl.name || "") || r.projectName;
  void import("./reviewsync").then((m) => m.pullReview(id)).catch(() => undefined);
  const msg = approved
    ? `${who} אישר/ה את העיצוב של ${r.projectName}`
    : `${who} שלח/ה ${Number(pl.count) || ""} הערות על ${r.projectName}`.replace("  ", " ");
  toast.success(msg, {
    duration: 12000,
    action: { label: "פתח", onClick: () => (window.location.hash = `#/project/${r.projectId}`) },
  });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted")
      new Notification(approved ? "העיצוב אושר" : "הערות חדשות על העיצוב", { body: msg });
  } catch {
    /* ignore */
  }
}

let draining = false;
/** apply any Grow events that haven't been processed yet */
export async function drainGrow() {
  if (!userId || draining) return;
  draining = true;
  try {
    const { data, error } = await supabase
      .from("grow_events")
      .select("id, kind, payload, received_at")
      .eq("user_id", userId)
      .is("processed_at", null)
      .order("received_at", { ascending: true })
      .limit(100);
    if (error || !data?.length) return;
    for (const ev of data) {
      if (ev.kind === "site_check") applySiteCheck(ev.payload as Record<string, unknown>);
      else if (ev.kind === "brief") applyBriefEvent(ev.payload as Record<string, unknown>);
      else if (ev.kind === "review") applyReviewEvent(ev.payload as Record<string, unknown>);
      else actions.applyGrow(ev);
    }
    await supabase
      .from("grow_events")
      .update({ processed_at: new Date().toISOString() })
      .in(
        "id",
        data.map((e) => e.id),
      );
  } finally {
    draining = false;
  }
}

/** replace the personal key (used in the Grow webhook URL and by the server monitor) */
export async function rotateWebhookToken(): Promise<string> {
  if (!userId) return "לא מחובר";
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("focus_state")
    .update({ webhook_token: token })
    .eq("user_id", userId);
  if (error) return error.message;
  setCs({ webhookToken: token });
  return "";
}

/* ---------------- auth actions ---------------- */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? "";
}
export async function signInWithGoogle() {
  const { lovable } = await import("@/integrations/lovable/index");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) return String(result.error);
  return "";
}
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { error: error.message, needsConfirm: false };
  return { error: "", needsConfirm: !data.session };
}
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  return error?.message ?? "";
}
export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) setCs({ recovering: false });
  return error?.message ?? "";
}
export async function signOut() {
  if (pending) await flush();
  await supabase.auth.signOut();
}
export async function syncNow() {
  if (pending) await flush();
  await drainGrow();
}

/** where Grow should send events (the published Lovable site hosts the server route) */
export const WEBHOOK_BASE = "https://empty-canvas-studio-92.lovable.app/api/grow/webhook";
