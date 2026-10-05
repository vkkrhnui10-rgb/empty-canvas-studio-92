// Design review — note cleaning, where-text, the message for Claude, notes → tasks
import test from "node:test";
import assert from "node:assert/strict";

const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => (mem[k] = v),
  removeItem: (k: string) => delete mem[k],
};
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };

const F = "../src/components/focus";
const { cleanComment, whereText, claudePrompt, validReviewId, newReviewId, scriptTag } =
  await import(`${F}/reviewcore.ts`);
const store = await import(`${F}/store.ts`);

const anchor = {
  sel: "main > section:nth-of-type(2) > a",
  tag: "a",
  text: "צרו קשר",
  section: "השירותים שלנו",
  ox: 0.5,
  oy: 0.5,
  px: 100,
  py: 900,
  ph: 3000,
  vw: 1280,
};

test("review ids are long, random and valid", () => {
  const a = newReviewId();
  const b = newReviewId();
  assert.equal(a.length, 20);
  assert.notEqual(a, b);
  assert.ok(validReviewId(a));
  assert.ok(!validReviewId("short"));
  assert.ok(!validReviewId("../../etc/passwd/xxxx"));
});

test("cleanComment keeps what a client may send and drops the rest", () => {
  const c = cleanComment(
    {
      id: "n123abc",
      text: "  להגדיל את הכפתור  ",
      view: "mobile",
      path: "about",
      mode: "live",
      anchor: { ...anchor, extra: "x" },
      pos: { x: 5, y: 5 },
      done: true,
      taskId: "evil",
      author: "דנה",
    },
    3,
  );
  assert.equal(c.text, "להגדיל את הכפתור");
  assert.equal(c.round, 3);
  assert.equal(c.view, "mobile");
  assert.equal(c.path, "/about");
  assert.equal(c.anchor.sel, anchor.sel);
  assert.equal(c.anchor.extra, undefined);
  assert.equal(c.pos, undefined, "live notes are anchored, not positioned");
  assert.equal(c.done, undefined, "the client can't mark a note fixed");
  assert.equal(c.taskId, undefined);
  assert.equal(cleanComment({ id: "n123abc", text: "   " }, 1), null);
  assert.equal(cleanComment({ id: "x", text: "hi" }, 1), null, "bad id");
  const o = cleanComment({ id: "n9999", text: "a", mode: "overlay", pos: { x: 140, y: -3 } }, 1);
  assert.deepEqual(o.pos, { x: 100, y: 0 });
  assert.equal(o.anchor, undefined);
});

test("whereText names the element and its section, or a rough place", () => {
  assert.equal(whereText({ mode: "live", anchor }), 'בסקשן "השירותים שלנו", הקישור "צרו קשר"');
  assert.match(whereText({ mode: "overlay", pos: { x: 80, y: 40 } }), /בצד ימין.*40%.*משוער/);
  assert.match(whereText({ mode: "shot", pos: { x: 10, y: 72 } }), /בצד שמאל.*72%.*צילום/);
});

test("the message for Claude lists every note with view, page, place and CSS", () => {
  const notes = [
    { id: "b", round: 1, view: "mobile", path: "/about", text: "התמונה קטנה", author: "", at: 2, mode: "overlay", pos: { x: 50, y: 10 } },
    { id: "a", round: 1, view: "desktop", path: "/", text: "להגדיל\nולשנות לירוק", author: "דנה", at: 1, mode: "live", anchor },
  ];
  const t = claudePrompt({ url: "https://kegavna.co.il", round: 1, projectName: "כגוונא" }, notes, {
    shots: { a: "shots/1.jpg" },
  });
  assert.match(t, /https:\/\/kegavna\.co\.il \(כגוונא\)/);
  assert.match(t, /2 הערות/);
  const i1 = t.indexOf("1. [מחשב · עמוד /]");
  const i2 = t.indexOf("2. [טלפון · עמוד /about]");
  assert.ok(i1 > 0 && i2 > i1, "sorted by time");
  assert.match(t, /CSS: main > section:nth-of-type\(2\) > a/);
  assert.match(t, /מה לשנות: להגדיל \/ ולשנות לירוק/);
  assert.match(t, /shots\/1\.jpg/);
  assert.equal(scriptTag("https://x.app"), '<script src="https://x.app/feedback.js" async></script>');
});

test("notes become tasks once; edits follow; deleted notes drop their open task; fixed follows the task", () => {
  const pid = "p1";
  const r = store.actions.createReview(pid, "https://kegavna.co.il");
  const n1 = { id: "n1aaaa", round: 1, view: "desktop", path: "/", text: "להגדיל", author: "דנה", at: 1, mode: "live", anchor };
  const n2 = { id: "n2bbbb", round: 1, view: "mobile", path: "/", text: "צבע", author: "דנה", at: 2, mode: "overlay", pos: { x: 1, y: 2 } };
  assert.equal(store.actions.mergeReview(r.id, { round: 1, comments: [n1, n2] }, "https://f/r/x"), 2);
  let db = store.getState();
  let tasks = db.tasks.filter((t: any) => t.reviewRef?.r === r.id);
  assert.equal(tasks.length, 2);
  assert.equal(tasks.find((t: any) => t.reviewRef.c === "n1aaaa").title, "תיקון עיצוב: להגדיל");
  assert.equal(tasks[0].projectId, pid);
  assert.deepEqual(tasks[0].links, ["https://f/r/x"]);

  // same notes again → nothing new; an edit updates the task
  assert.equal(
    store.actions.mergeReview(r.id, { round: 1, comments: [{ ...n1, text: "להגדיל מאוד" }, n2] }),
    0,
  );
  db = store.getState();
  assert.equal(
    db.tasks.find((t: any) => t.reviewRef?.c === "n1aaaa").title,
    "תיקון עיצוב: להגדיל מאוד",
  );

  // client deleted n2 → its open task goes away
  store.actions.mergeReview(r.id, { round: 1, comments: [{ ...n1, text: "להגדיל מאוד" }] });
  db = store.getState();
  assert.equal(db.tasks.filter((t: any) => t.reviewRef?.r === r.id).length, 1);

  // fixed by hand → task done
  store.actions.setReviewNoteDone(r.id, "n1aaaa", true);
  db = store.getState();
  assert.equal(db.tasks.find((t: any) => t.reviewRef?.c === "n1aaaa").status, "done");
  const rv = db.reviews.find((x: any) => x.id === r.id);
  assert.equal(rv.comments[0].done, true);
  assert.ok(rv.comments[0].taskId);
});
