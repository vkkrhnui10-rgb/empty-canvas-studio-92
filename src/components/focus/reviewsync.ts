/**
 * Design reviews — the owner's side of the server: pull the client's notes (they become tasks),
 * and tell the server which notes are fixed so the client sees ✓.
 */
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { actions, useDB } from "./store";
import type { DB, Review, ReviewComment } from "./types";

export async function authedReview(op: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("צריך להיות מחובר לענן");
  const r = await fetch(`/api/review?op=${op}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "שגיאה בשרת");
  return j;
}

export const reviewLink = (id: string) =>
  `${typeof location !== "undefined" ? location.origin : ""}/r/${id}`;

/** short-lived picture URLs from the last pull, by note id */
const shotUrls = new Map<string, string>();
const subs = new Set<() => void>();
export const shotUrlOf = (cid: string) => shotUrls.get(cid);
export function useShotUrls() {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);
}

/** fetch the client's notes; new ones become tasks. Returns how many were new. */
export async function pullReview(id: string): Promise<number> {
  const j = await authedReview("state", { r: id });
  const comments = (j.comments || []) as (ReviewComment & { shotUrl?: string })[];
  for (const c of comments) if (c.shotUrl) shotUrls.set(c.id, c.shotUrl);
  subs.forEach((f) => f());
  return actions.mergeReview(id, j, reviewLink(id));
}

export async function newRound(id: string) {
  const j = await authedReview("round", { r: id });
  actions.mergeReview(id, j, reviewLink(id));
}

/** fixed = its task is done (or marked by hand when the task is gone) */
export function isFixed(db: DB, c: ReviewComment) {
  const t = c.taskId ? db.tasks.find((x) => x.id === c.taskId) : undefined;
  return t ? t.status === "done" : !!c.done;
}

function wanted(db: DB, r: Review): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const c of r.comments) out[c.id] = isFixed(db, c);
  return out;
}

/** keep the server's "fixed" marks in step with the tasks (debounced) */
export function useReviewSync(live: boolean) {
  const db = useDB();
  const busy = React.useRef(false);
  React.useEffect(() => {
    if (!live || busy.current) return;
    const todo = db.reviews
      .map((r) => ({ r, want: wanted(db, r) }))
      .filter(({ r, want }) =>
        Object.entries(want).some(([k, v]) => (r.marks?.[k] ?? false) !== v),
      );
    if (!todo.length) return;
    const t = window.setTimeout(async () => {
      busy.current = true;
      try {
        for (const { r, want } of todo) {
          const diff = Object.fromEntries(
            Object.entries(want).filter(([k, v]) => (r.marks?.[k] ?? false) !== v),
          );
          await authedReview("mark", { r: r.id, done: diff });
          actions.patchReview(r.id, { marks: { ...(r.marks || {}), ...diff } });
        }
      } catch {
        /* offline — try again on the next change */
      } finally {
        busy.current = false;
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [db, live]);
}
