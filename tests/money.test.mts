// Run: npm test   (uses node:test through tsx — no extra dependencies)
import test from "node:test";
import assert from "node:assert/strict";

(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };

const F = "../src/components/focus";
const { balanceOf, payState } = await import(`${F}/utils.ts`);
const { profitRows, profitByType, minutesByProject, estimateStats, quoteFor } = await import(`${F}/profit.ts`);
const { riskRows } = await import(`${F}/risk.ts`);
const { briefItems } = await import(`${F}/briefdata.ts`);
const { nameKey, samePerson, toDate } = await import(`${F}/growreport.ts`);

const TYPES = ["אתר WordPress", "אתר AI", "משולב", "אחר"];
const DAY = 864e5;
const ymd = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const proj = (id: string, o: any = {}) => ({
  id, name: id, client: "", phone: "", url: "", status: "בבנייה", siteType: "אתר WordPress",
  hosted: false, hostPrice: 49, soState: "ok", soRuns: [], notes: [], payments: [],
  buildPrice: 0, paid: 0, payDue: "", created: Date.now(), soMsgAt: 0, ...o,
});
const mkdb = (o: any = {}): any => ({
  projects: [], tasks: [], sessions: [], leads: [], soContacts: [], settings: { hourlyTarget: 150 }, ...o,
});

test("balance never goes negative and payState follows the money", () => {
  assert.equal(balanceOf(proj("a", { buildPrice: 3000, paid: 1000 })), 2000);
  assert.equal(balanceOf(proj("a", { buildPrice: 3000, paid: 4000 })), 0);
  assert.equal(payState(proj("a", { buildPrice: 0 })), "ללא חיוב");
  assert.equal(payState(proj("a", { buildPrice: 100, paid: 100 })), "שולם במלואו");
  assert.equal(payState(proj("a", { buildPrice: 100, paid: 10, payDue: ymd(-2) })), "באיחור");
  assert.equal(payState(proj("a", { buildPrice: 100, paid: 10 })), "שולם חלקית");
  assert.equal(payState(proj("a", { buildPrice: 100 })), "טרם שולם");
});

test("profit: shekels per hour, thresholds, and the higher of tasks/sessions time", () => {
  const db = mkdb({
    projects: [
      proj("a", { buildPrice: 3000 }),
      proj("b", { buildPrice: 1500, siteType: "אתר AI" }),
      proj("c", { buildPrice: 0 }),
      proj("d", { buildPrice: 2000 }),
    ],
    tasks: [
      { projectId: "a", actualMin: 600 },
      { projectId: "b", actualMin: 60 },
      { projectId: "c", actualMin: 100 },
      { projectId: "d", actualMin: 10 },
    ],
    sessions: [{ projectId: "b", min: 90 }],
  });
  assert.equal(minutesByProject(db).get("b"), 90);
  const rows = profitRows(db);
  assert.deepEqual(rows.map((r: any) => [r.p.id, r.perHour]), [["a", 300], ["b", 1000]]);
  const t = profitByType(rows, TYPES);
  assert.equal(t.length, 2);
  assert.equal(t[0].perHour, 300);
  const q = quoteFor(db, "אתר WordPress", TYPES);
  assert.equal(q.minPrice, 1500); // 10h × ₪150
  assert.equal(quoteFor(db, "אחר", TYPES).n, 0);
});

test("estimate accuracy needs 3 finished tasks per type", () => {
  const mk = (i: number) => ({ id: "t" + i, projectId: "a", status: "done", estMin: 60, actualMin: 90 });
  const db = mkdb({ projects: [proj("a")], tasks: [mk(1), mk(2)] });
  assert.equal(estimateStats(db, TYPES).length, 0);
  db.tasks.push(mk(3));
  assert.equal(estimateStats(db, TYPES)[0].ratio, 1.5);
});

test("risk: two failed charges, long silence, ignores cancelled and fresh clients", () => {
  const old = Date.now() - 400 * DAY;
  const db = mkdb({
    projects: [
      proj("fails", { hosted: true, created: old, soRuns: [
        { id: "1", date: ymd(-40), ok: false, sum: 49 }, { id: "2", date: ymd(-10), ok: false, sum: 49 } ] }),
      proj("quiet", { hosted: true, created: old }),
      proj("fresh", { hosted: true }),
      proj("cancelled", { hosted: true, created: old, soState: "cancelled" }),
      proj("nothosted", { created: old }),
    ],
  });
  const r = riskRows(db);
  assert.deepEqual(r.map((x: any) => x.p.id), ["fails", "quiet"]);
  assert.equal(r[0].score, 3);
});

test("risk: a note resets the silence clock", () => {
  const old = Date.now() - 400 * DAY;
  const db = mkdb({ projects: [proj("p", { hosted: true, created: old, notes: [{ id: "n", txt: "x", created: Date.now() - 5 * DAY, pinned: false }] })] });
  assert.equal(riskRows(db).length, 0);
});

test("morning brief collects what needs attention, urgent first", () => {
  const db = mkdb({
    projects: [
      proj("down", { url: "a.co.il", siteCheck: { at: Date.now(), ok: false, status: 0, ms: 1, error: "x" } }),
      proj("fail", { hosted: true, soState: "failed" }),
      proj("due", { buildPrice: 1000, paid: 0, payDue: ymd(-3) }),
      proj("frozen", { url: "z.co.il", status: "הוקפא", siteCheck: { at: 1, ok: false, status: 0, ms: 1 } }),
    ],
    leads: [{ id: "l", name: "דנה", stage: "proposal", followUp: ymd(0), notes: [], phone: "" }],
    tasks: [{ id: "t", title: "x", status: "todo", due: ymd(-1), projectId: "" }],
  });
  const items = briefItems(db);
  assert.deepEqual(items.map((i: any) => i.kind), ["site", "charge", "lead", "pay", "tasks"]);
  assert.deepEqual(items.map((i: any) => i.group), ["urgent", "urgent", "today", "today", "today"]);
});

test("grow report helpers: names, people and dates", () => {
  assert.equal(nameKey("דנה  כהן"), nameKey("דנה כהן"));
  assert.equal(samePerson({ name: "x", phone: "050-123-4567", email: "" }, { name: "y", phone: "+972501234567", email: "" }), true);
  assert.equal(toDate("05/09/26"), "2026-09-05");
  assert.equal(toDate("2026-09-05"), "2026-09-05");
});

test("hosting: what was really paid in the last month vs the price list", async () => {
  const { hostingPaid } = await import(`${F}/store.ts`);
  const day = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
  const run = (d: string, ok: boolean, sum: number, net?: number) => ({ id: d + sum, date: d, ok, sum, note: "", net });
  const db: any = {
    projects: [
      proj("a", { hosted: true, hostPrice: 49, soRuns: [run(day(5), true, 49, 47.5), run(day(40), true, 49)] }),
      proj("b", { hosted: true, hostPrice: 39, soRuns: [run(day(3), false, 39)] }),
      proj("c", { hosted: true, hostPrice: 59, soState: "cancelled" }),
      proj("d", { hosted: false }),
    ],
    soContacts: [{ id: "x", projectId: "", name: "בלי שיוך", runs: [run(day(10), true, 30)] }],
  };
  const h = hostingPaid(db);
  assert.equal(h.paid, 79); // 49 + unassigned payer 30; the failed run and the old one don't count
  assert.equal(h.net, 77.5);
  assert.equal(h.expected, 88); // a + b (c cancelled)
  assert.deepEqual(h.missing.map((p: any) => p.id), ["b"]);
  assert.equal(h.hasData, true);
  assert.equal(hostingPaid({ projects: [proj("e", { hosted: true, hostPrice: 49 })], soContacts: [] } as any).hasData, false);
});
