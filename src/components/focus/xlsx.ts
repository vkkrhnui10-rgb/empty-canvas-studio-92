/* Tiny .xlsx / .csv reader (no dependencies): returns the first sheet as rows of strings.
 * xlsx = zip of XML; entries are inflated with the browser's DecompressionStream. */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = new Map<string, () => Promise<string>>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    files.set(name, async () => {
      const lnLen = v.getUint16(local + 26, true);
      const leLen = v.getUint16(local + 28, true);
      const start = local + 30 + lnLen + leLen;
      const raw = u8.subarray(start, start + csize);
      const out = method === 0 ? raw : await inflateRaw(raw);
      return dec.decode(out);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const colIndex = (ref: string) => {
  const m = ref.match(/^[A-Z]+/);
  let n = 0;
  for (const ch of m ? m[0] : "A") n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const shared: string[] = [];
  const ss = files.get("xl/sharedStrings.xml");
  if (ss) {
    const doc = xml(await ss());
    for (const si of Array.from(doc.getElementsByTagName("si")))
      shared.push(
        Array.from(si.getElementsByTagName("t"))
          .map((t) => t.textContent ?? "")
          .join(""),
      );
  }
  const sheetName =
    [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0] ?? "";
  if (!sheetName) throw new Error("no sheet");
  const doc = xml(await files.get(sheetName)!());
  const rows: string[][] = [];
  for (const r of Array.from(doc.getElementsByTagName("row"))) {
    const row: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let val = v;
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr")
        val = Array.from(c.getElementsByTagName("t"))
          .map((x) => x.textContent ?? "")
          .join("");
      row[colIndex(c.getAttribute("r") ?? "A1")] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}

function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export async function readSheet(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return readCsv(await file.text());
  return readXlsx(await file.arrayBuffer());
}
