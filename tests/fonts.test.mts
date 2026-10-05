// Fonts — reading font files, licence verdicts, the catalogue
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const F = "../src/components/focus";
const { parseFont, sniffFont, licenseVerdict, embeddingNote } = await import(`${F}/fontparse.ts`);
const { CATALOG, PAIRS } = await import(`${F}/fontcatalog.ts`);
const fx = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const inflate = async (d: Uint8Array) => new Uint8Array(inflateSync(d));

test("a WOFF file: names, licence link, weight, Hebrew coverage", async () => {
  const b = fx("heebo-hebrew-400.woff");
  assert.equal(sniffFont(b), "woff");
  const f = await parseFont(b, inflate);
  assert.equal(f.parsed, true);
  assert.equal(f.family, "Heebo");
  assert.equal(f.subfamily, "Regular");
  assert.match(f.version, /^3\.1/);
  assert.match(f.licenseUrl, /sil\.org\/OFL/);
  assert.equal(f.weight, 400);
  assert.equal(f.fsType, 0);
  assert.equal(f.hebrewLetters, 27);
  assert.ok(f.glyphs! > 50);
  assert.equal(licenseVerdict(f.license, f.licenseUrl, f.fsType).level, "ok");
});

test("a restricted, personal-use TTF is flagged", async () => {
  const b = fx("demo-restricted.ttf");
  assert.equal(sniffFont(b), "ttf");
  const f = await parseFont(b);
  assert.equal(f.family, "Demo Sans");
  assert.equal(f.fsType, 2);
  const v = licenseVerdict(f.license, f.licenseUrl, f.fsType);
  assert.equal(v.level, "no");
  assert.ok(v.limits.some((l: string) => /מסחרי/.test(l)));
  assert.ok(v.limits.some((l: string) => /Restricted/.test(l)));
});

test("WOFF2 and junk are recognised but not parsed", async () => {
  assert.equal((await parseFont(new TextEncoder().encode("wOF2xxxxxxxx"))).format, "woff2");
  assert.equal((await parseFont(new TextEncoder().encode("hello"))).format, "unknown");
});

test("licence verdicts", () => {
  assert.equal(licenseVerdict("").level, "check");
  assert.equal(licenseVerdict("Licensed under the Apache License, Version 2.0").level, "ok");
  assert.equal(licenseVerdict("This Font Software is licensed under the SIL Open Font License").level, "ok");
  assert.equal(licenseVerdict("Commercial EULA, see website").level, "check");
  assert.equal(embeddingNote(4)!.bad, true);
  assert.equal(embeddingNote(0)!.bad, false);
});

test("the catalogue is consistent", () => {
  const ids = new Set(CATALOG.map((f: any) => f.id));
  assert.equal(ids.size, CATALOG.length, "unique ids");
  for (const f of CATALOG) {
    assert.ok(f.weights.length > 0, f.id);
    assert.equal(f.license, "OFL-1.1");
    assert.ok(f.special.length > 20, f.id);
  }
  assert.ok(CATALOG.filter((f: any) => f.hebrew).length >= 25);
  for (const p of PAIRS) assert.ok(ids.has(p.head) && ids.has(p.body), `${p.head}+${p.body}`);
});
