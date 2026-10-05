// Inspiration library — filtering and the message for Claude
import test from "node:test";
import assert from "node:assert/strict";

(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
const { filterInspo, inspoPrompt, normUrl, hostOf, catsOf, DEFAULT_CATS } = await import(
  "../src/components/focus/inspolib.ts"
);

const it = (o: any) => ({ url: "", title: "", category: "", parts: [], note: "", fav: false, created: 1, ...o });
const items = [
  it({ id: "a", kind: "site", url: "https://www.rest.co.il", title: "מסעדה", category: "מסעדות ואוכל", parts: ["תפריט"], fav: true, projectIds: ["p1"] }),
  it({ id: "b", kind: "section", siteId: "a", category: "מסעדות ואוכל", parts: ["המלצות"], img: { url: "https://x/img.jpg", at: 1 }, note: "כרטיסים\nעם תמונות" }),
  it({ id: "c", kind: "site", url: "https://law.co.il", category: "עורכי דין ומשרדים", parts: ["טיפוגרפיה"] }),
];
const all = { kind: "all", cat: "", part: "", q: "", fav: false };

test("filters combine: kind, category, part, favourites, search, project", () => {
  assert.equal(filterInspo(items, all).length, 3);
  assert.deepEqual(filterInspo(items, { ...all, kind: "section" }).map((x: any) => x.id), ["b"]);
  assert.deepEqual(filterInspo(items, { ...all, cat: "מסעדות ואוכל" }).map((x: any) => x.id), ["a", "b"]);
  assert.deepEqual(filterInspo(items, { ...all, part: "טיפוגרפיה" }).map((x: any) => x.id), ["c"]);
  assert.deepEqual(filterInspo(items, { ...all, fav: true }).map((x: any) => x.id), ["a"]);
  assert.deepEqual(filterInspo(items, { ...all, q: "LAW" }).map((x: any) => x.id), ["c"]);
  assert.deepEqual(filterInspo(items, { ...all, projectId: "p1" }).map((x: any) => x.id), ["a"]);
});

test("the message for Claude names each reference and what to take", () => {
  const t = inspoPrompt(items, items, "אתר למסעדה");
  assert.match(t, /^אני בונה אתר למסעדה\./);
  assert.match(t, /1\. מסעדה \(https:\/\/www\.rest\.co\.il\)\n {3}מה לקחת: תפריט/);
  assert.match(t, /2\. סקשן "המלצות" מתוך מסעדה \(https:\/\/www\.rest\.co\.il\)\n {3}תמונה: https:\/\/x\/img\.jpg/);
  assert.match(t, /הערה שלי: כרטיסים \/ עם תמונות/);
  assert.match(t, /3\. law\.co\.il/);
});

test("small helpers", () => {
  assert.equal(normUrl("kegavna.co.il"), "https://kegavna.co.il");
  assert.equal(normUrl("http://a.b"), "http://a.b");
  assert.equal(hostOf("https://www.a.co.il/x"), "a.co.il");
  assert.equal(catsOf([]), DEFAULT_CATS);
  assert.deepEqual(catsOf(["א"]), ["א"]);
});
