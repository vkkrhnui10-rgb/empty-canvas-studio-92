// Website brief helpers — zip, logo palette, prompt, input cleaning
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const F = "../src/components/focus";
const {
  makeZip,
  crc32,
  extractPalette,
  fromHex,
  briefPrompt,
  cleanAnswers,
  emptyAnswers,
  accentOf,
  briefId,
} = await import(`${F}/briefcore.ts`);

test("crc32 matches the known value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip opens in a standard unzip, Hebrew names and duplicates kept", () => {
  const enc = new TextEncoder();
  const z = makeZip([
    { name: "אפיון.md", data: enc.encode("# שלום") },
    { name: "images/a.jpg", data: new Uint8Array([1, 2, 3, 4]) },
    { name: "images/a.jpg", data: new Uint8Array([5, 6]) },
  ]);
  const dir = mkdtempSync(join(tmpdir(), "z"));
  const f = join(dir, "t.zip");
  writeFileSync(f, z);
  const out = execFileSync("python3", [
    "-c",
    "import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps([[i.filename,len(z.read(i))] for i in z.infolist()]))",
    f,
  ]).toString();
  assert.deepEqual(JSON.parse(out), [
    ["אפיון.md", 10],
    ["images/a.jpg", 4],
    ["images/a-2.jpg", 2],
  ]);
});

const img = (parts: [string, number][], alphaPart = 0) => {
  const px: number[] = [];
  for (const [hex, n] of parts) {
    const [r, g, b] = fromHex(hex);
    for (let i = 0; i < n; i++) px.push(r, g, b, 255);
  }
  for (let i = 0; i < alphaPart; i++) px.push(0, 0, 0, 0);
  return new Uint8ClampedArray(px);
};
const close = (a: string, b: string) => {
  const [x, y, z] = fromHex(a),
    [p, q, r] = fromHex(b);
  return Math.hypot(x - p, y - q, z - r) < 30;
};

test("logo palette: skips white background and transparency, finds brand colors", () => {
  const pal = extractPalette(
    img(
      [
        ["#ffffff", 6000],
        ["#1e40af", 2500],
        ["#f59e0b", 1200],
        ["#fafafa", 300],
      ],
      3000,
    ),
  );
  assert.ok(pal.length >= 2);
  assert.ok(close(pal[0], "#1e40af"), `first ${pal[0]}`);
  assert.ok(pal.some((c: string) => close(c, "#f59e0b")));
  assert.ok(!pal.some((c: string) => close(c, "#ffffff")));
});

test("logo palette: a black logo keeps black; anti-alias shades merge", () => {
  const pal = extractPalette(
    img([
      ["#000000", 3000],
      ["#101010", 400],
      ["#202020", 200],
      ["#ffffff", 5000],
    ]),
  );
  assert.equal(pal.length, 1);
  assert.equal(accentOf(pal), null);
  assert.equal(accentOf(["#111111", "#e11d48"]), "#e11d48");
});

test("public input is cleaned", () => {
  const a = cleanAnswers({
    business: "x".repeat(9000),
    colors: ["#AABBCC", "red", 5],
    services: [{ name: "a", desc: 3 }],
    hack: 1,
    colorMode: "evil",
  });
  assert.equal(a.business.length, 2000);
  assert.deepEqual(a.colors, ["#AABBCC"]);
  assert.deepEqual(a.services, [{ name: "a", desc: "" }]);
  assert.equal(a.colorMode, "logo");
  assert.ok(!("hack" in a));
});

test("prompt contains what the client wrote and skips empty sections", () => {
  const answers = {
    ...emptyAnswers(),
    business: "פרחי השרון",
    about: "התחלנו ב-2010",
    services: [
      { name: "זרים", desc: "" },
      { name: "", desc: "" },
    ],
    colors: ["#123456"],
    styles: ["חם ומשפחתי"],
  };
  const p = briefPrompt({
    client: "דנה",
    business: "",
    answers,
    files: [{ path: "x", name: "logo.png", kind: "logo", size: 1, type: "image/png" }],
  });
  assert.match(p, /פרחי השרון/);
  assert.match(p, /התחלנו ב-2010/);
  assert.match(p, /\*\*זרים\*\*/);
  assert.match(p, /#123456 \(נלקחו מהלוגו\)/);
  assert.match(p, /logo\.png/);
  assert.doesNotMatch(p, /הערות נוספות/);
});

test("brief ids are long and unique", () => {
  const ids = new Set(Array.from({ length: 200 }, () => briefId()));
  assert.equal(ids.size, 200);
  assert.ok([...ids].every((i) => i.length === 18));
});

test("testimonials: cleaned, and they reach the summary", () => {
  const a = cleanAnswers({
    testimonials: [{ name: "דנה", text: "שירות מעולה" }, { text: 5 }, "x"],
  });
  assert.equal(a.testimonials.length, 3);
  assert.deepEqual(a.testimonials[0], { name: "דנה", text: "שירות מעולה" });
  const p = briefPrompt({
    client: "ע",
    business: "",
    answers: a,
    files: [{ path: "x", name: "w.png", kind: "review", size: 1, type: "image/png" }],
  });
  assert.match(p, /המלצות לקוחות/);
  assert.match(p, /"שירות מעולה" — דנה/);
  assert.match(p, /1 צילומי מסך של המלצות/);
});
