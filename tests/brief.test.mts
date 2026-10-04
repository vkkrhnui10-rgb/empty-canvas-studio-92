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
  assert.deepEqual(a.services, [{ name: "a", desc: "", price: "" }]);
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

/* ---------------- questionnaire v2 + Google Drive ---------------- */
const drive = await import(`${F}/drive.ts`);

test("new fields: defaults, cleaning, old briefs keep working", () => {
  const e = emptyAnswers();
  assert.deepEqual(e.pages, ["דף הבית", "אודות", "שירותים", "צור קשר"]);
  assert.equal(e.whatsappSame, true);
  const c = cleanAnswers({
    mainAction: "שישלחו וואטסאפ",
    pages: ["דף הבית", 5, "בלוג / מאמרים"],
    faq: [{ q: "כמה זה עולה?", a: "תלוי" }, null],
    services: [{ name: "גיזום", desc: "", price: "החל מ-250" }],
    whatsappSame: false,
    domainMode: "hack",
  });
  assert.deepEqual(c.pages, ["דף הבית", "בלוג / מאמרים"]);
  assert.equal(c.faq[0].q, "כמה זה עולה?");
  assert.equal(c.faq[1].q, "");
  assert.equal(c.services[0].price, "החל מ-250");
  assert.equal(c.whatsappSame, false);
  assert.equal(c.domainMode, "");
  // a brief filled before this version (no pages key) shows no invented pages
  const old = cleanAnswers({ business: "x", goals: ["מכירה אונליין"] });
  assert.deepEqual(old.goals, ["מכירה אונליין"]);
  assert.equal(old.whatsappSame, true);
});

test("prompt carries the new answers", () => {
  const a = cleanAnswers({
    business: "גני השרון",
    industry: "גינון",
    area: "השרון",
    mainAction: "שיתקשרו אליי",
    pages: ["דף הבית", "גלריה / עבודות"],
    features: ["כפתור וואטסאפ צף"],
    services: [{ name: "תכנון גינה", desc: "", price: "1,500 ₪" }],
    faq: [{ q: "עובדים בשבת?", a: "" }],
    highlights: ["אחריות"],
    stats: "300 גינות",
    tone: "חם ואישי",
    phone: "050-1234567",
    whatsappSame: true,
    domainMode: "need",
  });
  const p = briefPrompt({ client: "דני", business: "", answers: a, files: [] });
  for (const s of [
    "תחום:** גינון",
    "אזור שירות:** השרון",
    "הפעולה העיקרית שהגולש צריך לעשות:** שיתקשרו אליי",
    "גלריה / עבודות",
    "כפתור וואטסאפ צף",
    "**תכנון גינה** (1,500 ₪)",
    "**עובדים בשבת?**",
    "300 גינות",
    "טון כתיבה:** חם ואישי",
    "050-1234567 (כמו הטלפון)",
    "צריך לעזור לבחור",
    "meta description",
  ])
    assert.ok(p.includes(s), `missing: ${s}`);
});

test("drive links: every common share form", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  const cases: [string, unknown][] = [
    [`https://drive.google.com/drive/folders/${id}?usp=sharing`, { type: "folder", id }],
    [`https://drive.google.com/drive/u/1/folders/${id}`, { type: "folder", id }],
    [`drive.google.com/file/d/${id}/view?usp=drive_link`, { type: "file", id }],
    [`https://drive.google.com/open?id=${id}`, { type: "file", id }],
    [`https://drive.google.com/uc?export=download&id=${id}`, { type: "file", id }],
    [`https://drive.google.com/embeddedfolderview?id=${id}#grid`, { type: "folder", id }],
    [`https://docs.google.com/uc?id=${id}`, { type: "file", id }],
    ["https://photos.app.goo.gl/abcdef", null],
    [`https://evil.example/drive/folders/${id}`, null],
    ["not a link", null],
  ];
  for (const [u, want] of cases) assert.deepEqual(drive.parseDriveUrl(u), want, u);
});

test("drive folder page → entries (files and sub-folders, HTML entities decoded)", () => {
  const html = `<html><body><div class="flip-entries">
  <div class="flip-entry" id="entry-1aaaaaaaaaaaaaaaaaaaa" tabindex="0" role="link"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1aaaaaaaaaaaaaaaaaaaa/view?usp=drive_web" target="_blank"><div class="flip-entry-thumb"></div><div class="flip-entry-title">IMG_0001.JPG</div></a></div></div>
  <div class="flip-entry" id="entry-1bbbbbbbbbbbbbbbbbbbb" tabindex="0" role="link"><div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/1bbbbbbbbbbbbbbbbbbbb" target="_blank"><div class="flip-entry-title">עבודות &amp; פרויקטים</div></a></div></div>
  <div class="flip-entry" id="entry-1aaaaaaaaaaaaaaaaaaaa"></div>
  </div></body></html>`;
  assert.deepEqual(drive.parseDriveFolder(html), [
    { id: "1aaaaaaaaaaaaaaaaaaaa", name: "IMG_0001.JPG", folder: false },
    { id: "1bbbbbbbbbbbbbbbbbbbb", name: "עבודות & פרויקטים", folder: true },
  ]);
  assert.deepEqual(drive.parseDriveFolder("<html>sign in</html>"), []);
});

test("drive download helpers: names and file types", () => {
  assert.equal(drive.dispositionName(`attachment; filename="IMG 1.jpg"`), "IMG 1.jpg");
  assert.equal(
    drive.dispositionName(
      `attachment; filename="x.jpg"; filename*=UTF-8''${encodeURIComponent("לוגו.png")}`,
    ),
    "לוגו.png",
  );
  assert.equal(drive.dispositionName(null), "");
  const b = (...x: number[]) => new Uint8Array([...x, ...new Array(16).fill(0)]);
  assert.equal(drive.sniffExt(b(0xff, 0xd8, 0xff)), "jpg");
  assert.equal(drive.sniffExt(b(0x89, 0x50, 0x4e, 0x47)), "png");
  assert.equal(drive.sniffExt(b(0x25, 0x50, 0x44, 0x46)), "pdf");
  assert.equal(
    drive.sniffExt(b(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)),
    "heic",
  );
  assert.equal(drive.sniffExt(new TextEncoder().encode("<!DOCTYPE html><html>")), "html");
  assert.equal(drive.sniffExt(new TextEncoder().encode('<svg xmlns="x"></svg>')), "svg");
});
