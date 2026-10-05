// Run: npm test   (uses node:test through tsx — no extra dependencies)
import test from "node:test";
import assert from "node:assert/strict";

(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };

const F = "../src/components/focus";
const { balanceOf, payState } = await import(`${F}/utils.ts`);
const { profitRows, profitByType, minutesByProject, estimateStats, quoteFor } = await import(
  `${F}/profit.ts`
);
const { riskRows } = await import(`${F}/risk.ts`);
const { briefItems } = await import(`${F}/briefdata.ts`);
const { nameKey, samePerson, toDate } = await import(`${F}/growreport.ts`);

const TYPES = ["אתר WordPress", "אתר AI", "משולב", "אחר"];
const DAY = 864e5;
const ymd = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const proj = (id: string, o: any = {}) => ({
  id,
  name: id,
  client: "",
  phone: "",
  url: "",
  status: "בבנייה",
  siteType: "אתר WordPress",
  hosted: false,
  hostPrice: 49,
  soState: "ok",
  soRuns: [],
  notes: [],
  payments: [],
  buildPrice: 0,
  paid: 0,
  payDue: "",
  created: Date.now(),
  soMsgAt: 0,
  ...o,
});
const mkdb = (o: any = {}): any => ({
  projects: [],
  tasks: [],
  sessions: [],
  leads: [],
  soContacts: [],
  settings: { hourlyTarget: 150 },
  ...o,
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
  assert.deepEqual(
    rows.map((r: any) => [r.p.id, r.perHour]),
    [
      ["a", 300],
      ["b", 1000],
    ],
  );
  const t = profitByType(rows, TYPES);
  assert.equal(t.length, 2);
  assert.equal(t[0].perHour, 300);
  const q = quoteFor(db, "אתר WordPress", TYPES);
  assert.equal(q.minPrice, 1500); // 10h × ₪150
  assert.equal(quoteFor(db, "אחר", TYPES).n, 0);
});

test("estimate accuracy needs 3 finished tasks per type", () => {
  const mk = (i: number) => ({
    id: "t" + i,
    projectId: "a",
    status: "done",
    estMin: 60,
    actualMin: 90,
  });
  const db = mkdb({ projects: [proj("a")], tasks: [mk(1), mk(2)] });
  assert.equal(estimateStats(db, TYPES).length, 0);
  db.tasks.push(mk(3));
  assert.equal(estimateStats(db, TYPES)[0].ratio, 1.5);
});

test("risk: two failed charges, long silence, ignores cancelled and fresh clients", () => {
  const old = Date.now() - 400 * DAY;
  const db = mkdb({
    projects: [
      proj("fails", {
        hosted: true,
        created: old,
        soRuns: [
          { id: "1", date: ymd(-40), ok: false, sum: 49 },
          { id: "2", date: ymd(-10), ok: false, sum: 49 },
        ],
      }),
      proj("quiet", { hosted: true, created: old }),
      proj("fresh", { hosted: true }),
      proj("cancelled", { hosted: true, created: old, soState: "cancelled" }),
      proj("nothosted", { created: old }),
    ],
  });
  const r = riskRows(db);
  assert.deepEqual(
    r.map((x: any) => x.p.id),
    ["fails", "quiet"],
  );
  assert.equal(r[0].score, 3);
});

test("risk: a note resets the silence clock", () => {
  const old = Date.now() - 400 * DAY;
  const db = mkdb({
    projects: [
      proj("p", {
        hosted: true,
        created: old,
        notes: [{ id: "n", txt: "x", created: Date.now() - 5 * DAY, pinned: false }],
      }),
    ],
  });
  assert.equal(riskRows(db).length, 0);
});

test("morning brief collects what needs attention, urgent first", () => {
  const db = mkdb({
    projects: [
      proj("down", {
        url: "a.co.il",
        siteCheck: { at: Date.now(), ok: false, status: 0, ms: 1, error: "x" },
      }),
      proj("fail", { hosted: true, soState: "failed" }),
      proj("due", { buildPrice: 1000, paid: 0, payDue: ymd(-3) }),
      proj("frozen", {
        url: "z.co.il",
        status: "הוקפא",
        siteCheck: { at: 1, ok: false, status: 0, ms: 1 },
      }),
    ],
    leads: [{ id: "l", name: "דנה", stage: "proposal", followUp: ymd(0), notes: [], phone: "" }],
    tasks: [{ id: "t", title: "x", status: "todo", due: ymd(-1), projectId: "" }],
  });
  const items = briefItems(db);
  assert.deepEqual(
    items.map((i: any) => i.kind),
    ["site", "charge", "lead", "pay", "tasks"],
  );
  assert.deepEqual(
    items.map((i: any) => i.group),
    ["urgent", "urgent", "today", "today", "today"],
  );
});

test("grow report helpers: names, people and dates", () => {
  assert.equal(nameKey("דנה  כהן"), nameKey("דנה כהן"));
  assert.equal(
    samePerson(
      { name: "x", phone: "050-123-4567", email: "" },
      { name: "y", phone: "+972501234567", email: "" },
    ),
    true,
  );
  assert.equal(toDate("05/09/26"), "2026-09-05");
  assert.equal(toDate("2026-09-05"), "2026-09-05");
});

test("hosting: follows Grow — month's net minus the operational fee, paid on the 10th of the next month", async () => {
  const { hostingPaid } = await import(`${F}/store.ts`);
  const run = (d: string, ok: boolean, sum: number, net?: number) => ({
    id: d + sum + Math.random(),
    date: d,
    ok,
    sum,
    note: "",
    net,
  });
  const db: any = {
    settings: { growPayoutDay: 10, growMonthlyFee: 19.94 },
    projects: [
      proj("a", {
        hosted: true,
        hostPrice: 48.99,
        soRuns: [
          run("2026-08-28", true, 48.99, 47),
          run("2026-09-28", true, 48.99, 47),
          run("2026-10-01", true, 48.99, 47),
        ],
      }),
      proj("b", {
        hosted: true,
        hostPrice: 74.99,
        soRuns: [run("2026-09-28", true, 74.99, 72.57)],
      }),
      proj("c", {
        hosted: true,
        hostPrice: 48.99,
        soRuns: [run("2026-09-15", true, 48.99, 47), run("2026-09-20", false, 48.99)],
      }),
      proj("d", { hosted: true, hostPrice: 17, soRuns: [run("2026-08-29", false, 17)] }),
      proj("e", { hosted: true, hostPrice: 59, soState: "cancelled" }),
    ],
    soContacts: [],
  };
  // 2 October: the next credit is September's money, on 10 October
  const h = hostingPaid(db, "2026-10-02");
  assert.equal(h.next.key, "2026-09");
  assert.equal(h.next.date, "2026-10-10");
  assert.equal(h.next.partial, false);
  assert.equal(h.next.runs, 3);
  assert.equal(h.next.gross, 172.97);
  assert.equal(h.next.net, 166.57);
  assert.equal(h.next.amount, 146.63); // 166.57 − 19.94
  assert.equal(h.thisMonth.gross, 48.99);
  assert.equal(h.expected, 189.97); // a + b + c + d (e cancelled)
  assert.deepEqual(
    h.missing.map((p: any) => p.id),
    ["d"],
  );
  // after the payout day the next credit is this month so far, on 10 November
  const later = hostingPaid(db, "2026-10-15");
  assert.equal(later.next.key, "2026-10");
  assert.equal(later.next.date, "2026-11-10");
  assert.equal(later.next.partial, true);
  assert.equal(later.next.amount, 27.06); // 47 − 19.94
  assert.equal(
    hostingPaid({ settings: {}, projects: [proj("x", { hosted: true })], soContacts: [] } as any)
      .hasData,
    false,
  );
});

/* ---------- monthly hosting report ---------- */
const { buildHostReport, reportMonths, reportText } = await import(`${F}/hostreport.ts`);
const run = (id: string, date: string, sum: number, o: any = {}) => ({
  id,
  date,
  ok: true,
  sum,
  note: "",
  ...o,
});

test("hostreport: paid / failed / missing and the payout", () => {
  const db = mkdb({
    settings: { hourlyTarget: 150, growPayoutDay: 10, growMonthlyFee: 20 },
    projects: [
      proj("a", { hosted: true, soRuns: [run("a1", "2026-09-03", 49, { net: 47 })] }),
      proj("b", { hosted: true, soState: "failed", soRuns: [run("b1", "2026-09-04", 49, { ok: false, note: "כרטיס נדחה" })] }),
      proj("c", { hosted: true, soRuns: [run("c0", "2026-08-05", 49, { net: 47 })] }),
      proj("d", { hosted: true, soState: "cancelled", soRuns: [] }),
    ],
  });
  const r = buildHostReport(db, "2026-09", "2026-10-05");
  const by = Object.fromEntries(r.rows.map((x: any) => [x.projectId, x]));
  assert.equal(by.a.state, "paid");
  assert.equal(by.b.state, "failed");
  assert.equal(by.b.note, "כרטיס נדחה");
  assert.equal(by.c.state, "missing");
  assert.equal(by.d, undefined);
  assert.equal(r.gross, 49);
  assert.equal(r.payout, 27); // 47 net − 20 fee
  assert.equal(r.payoutDate, "2026-10-10");
  assert.equal(r.open, false);
});

test("hostreport: the reasons add up exactly to the difference from last month", () => {
  const db = mkdb({
    settings: { hourlyTarget: 150, growPayoutDay: 10, growMonthlyFee: 20 },
    projects: [
      proj("a", { hosted: true, soRuns: [run("a1", "2026-08-03", 49, { net: 47 }), run("a2", "2026-09-03", 49, { net: 47 })] }),
      proj("b", { hosted: true, soState: "failed", soRuns: [run("b1", "2026-08-04", 49, { net: 47 }), run("b2", "2026-09-04", 49, { ok: false, note: "x" })] }),
      proj("c", { hosted: true, soRuns: [run("c1", "2026-09-06", 100, { net: 96 })] }),
      proj("e", { hosted: true, soRuns: [run("e1", "2026-08-07", 60, { net: 58 }), run("e2", "2026-09-07", 90, { net: 87 })] }),
    ],
  });
  const r = buildHostReport(db, "2026-09", "2026-10-05");
  const kinds = r.reasons.map((x: any) => x.kind).sort();
  assert.ok(kinds.includes("new") && kinds.includes("failed") && kinds.includes("price"));
  const sum = r.reasons.reduce((s: number, x: any) => s + x.delta, 0);
  assert.ok(Math.abs(sum - r.diff) < 0.011, `${sum} vs ${r.diff}`);
  assert.equal(r.prevGross, 158);
  assert.ok(reportText(r).includes("מה השתנה"));
});

test("hostreport: current month is open, later-charged clients are pending, no net means a flag", () => {
  const db = mkdb({
    projects: [
      proj("a", { hosted: true, soRuns: [run("a0", "2026-09-20", 49)] }),
    ],
  });
  const r = buildHostReport(db, "2026-10", "2026-10-05");
  assert.equal(r.open, true);
  assert.equal(r.rows[0].state, "pending");
  const prev = buildHostReport(db, "2026-09", "2026-10-05");
  assert.equal(prev.netGuess, true);
  assert.deepEqual(reportMonths(db, "2026-10-05"), ["2026-10", "2026-09"]);
});
