/**
 * Fonts tab of the inspiration page: strong free fonts (Hebrew first) and fonts I uploaded,
 * with a live preview, details, what's special, the licence in plain words, and downloads.
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  Search,
  Star,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { C } from "./constants";
import { CATALOG, FONT_CATS, PAIRS, type CatalogFont, type FontCat } from "./fontcatalog";
import {
  cssFamily,
  deleteMyFont,
  downloadCatalogZip,
  fontFaceCss,
  fontFileUrl,
  fontPrompt,
  googleCssUrl,
  linkTag,
  loadCatalogFont,
  loadMyFont,
  myFamily,
  specimenUrl,
  uploadFont,
} from "./fontlib";
import { embeddingNote, LICENSES, licenseVerdict, type LicenseVerdict } from "./fontparse";
import { actions, useDB } from "./store";
import type { MyFont } from "./types";
import { Badge, Btn, Card, Drawer, EmptyState, Input, Segmented, Textarea } from "./ui";

const copy = async (txt: string, ok = "הועתק") => {
  try {
    await navigator.clipboard.writeText(txt);
    toast.success(ok);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
};

const SAMPLE = "הלל בונה אתרים מהירים ויפים · Fast & beautiful 2026";
const USE_HE = { כותרות: "לכותרות", טקסט: "לטקסט", שניהם: "לכותרות ולטקסט" } as const;
const CAT_HE = Object.fromEntries(FONT_CATS.map((c) => [c.v, c.l])) as Record<FontCat, string>;
const WEIGHT_HE: Record<number, string> = {
  100: "דק מאוד",
  200: "דק",
  300: "קל",
  400: "רגיל",
  500: "בינוני",
  600: "חצי עבה",
  700: "עבה",
  800: "עבה מאוד",
  900: "שחור",
};
const kb = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`;

type Filter = "all" | FontCat | "fav" | "mine";
type Sel = { kind: "cat"; f: CatalogFont } | { kind: "mine"; f: MyFont } | null;

/** load the font when its card scrolls into view */
function useVisible<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null);
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || vis) return;
    if (typeof IntersectionObserver === "undefined") return setVis(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVis(true), {
      rootMargin: "300px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [vis]);
  return [ref, vis];
}

function LicenseBadge({ v }: { v: LicenseVerdict }) {
  return v.level === "ok" ? (
    <Badge color={C.ok}>חינם לשימוש מסחרי</Badge>
  ) : v.level === "no" ? (
    <Badge color={C.bad}>אישי בלבד</Badge>
  ) : (
    <Badge color={C.warn}>לבדוק רישיון</Badge>
  );
}

export function FontsTab() {
  const db = useDB();
  const [text, setText] = React.useState(SAMPLE);
  const [size, setSize] = React.useState(34);
  const [heOnly, setHeOnly] = React.useState(true);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<Sel>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const list = CATALOG.filter(
    (f) =>
      (!heOnly || f.hebrew) &&
      (filter === "all" ||
        (filter === "fav"
          ? db.fontFavs.includes(f.id)
          : filter === "mine"
            ? false
            : f.cat === filter)) &&
      (!q || `${f.family} ${f.special}`.toLowerCase().includes(q.toLowerCase())),
  );
  const mine = db.fonts.filter(
    (f) =>
      (filter === "all" || filter === "mine" || (filter === "fav" && f.fav)) &&
      (!q || `${myFamily(f)} ${f.name} ${f.note}`.toLowerCase().includes(q.toLowerCase())),
  );

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    let last: MyFont | null = null;
    for (const file of Array.from(files)) {
      try {
        last = await uploadFont(file);
        toast.success(`${file.name} נוסף`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setBusy(false);
    if (last) {
      setFilter("mine");
      setSel({ kind: "mine", f: last });
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="min-w-56 flex-1 text-base"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="כתבו כאן טקסט לתצוגה"
            aria-label="טקסט לתצוגה"
          />
          <label className="flex items-center gap-2 text-sm text-[color:var(--focus-muted)]">
            גודל
            <input
              type="range"
              min={18}
              max={96}
              value={size}
              onChange={(e) => setSize(+e.target.value)}
              className="w-28 accent-[var(--focus-primary)]"
            />
          </label>
          <Btn
            variant="primary"
            icon={Upload}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "מעלה…" : "העלאת פונט"}
          </Btn>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept=".ttf,.otf,.woff,.woff2"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "הכל" },
              ...FONT_CATS.map((c) => ({ value: c.v as Filter, label: c.l })),
              { value: "fav", label: "מועדפים" },
              {
                value: "mine",
                label: `הפונטים שלי${db.fonts.length ? ` (${db.fonts.length})` : ""}`,
              },
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={heOnly} onChange={(e) => setHeOnly(e.target.checked)} />
            רק עם עברית
          </label>
          <div className="relative min-w-40 flex-1">
            <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[color:var(--focus-muted)]" />
            <Input
              className="pr-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש פונט"
            />
          </div>
        </div>
      </Card>

      {filter === "all" && !q && (
        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold">זוגות שעובדים טוב: כותרת וטקסט</div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {PAIRS.filter((p) => !heOnly || CATALOG.find((f) => f.id === p.head)?.hebrew).map(
              (p) => (
                <PairCard key={p.head + p.body} head={p.head} body={p.body} why={p.why} />
              ),
            )}
          </div>
        </div>
      )}

      {(filter === "mine" || mine.length > 0) && (
        <>
          {filter !== "mine" && mine.length > 0 && (
            <div className="mb-2 text-sm font-semibold">הפונטים שלי</div>
          )}
          {mine.length === 0 ? (
            <Card className="mb-5">
              <EmptyState
                icon={Upload}
                title="עוד לא העלית פונטים"
                subtitle="גוררים לכאן קובץ TTF / OTF / WOFF / WOFF2, או לוחצים על העלאת פונט. רואים תצוגה, פרטים ומה הרישיון מתיר."
                action={
                  <Btn variant="primary" icon={Upload} onClick={() => fileRef.current?.click()}>
                    העלאת פונט
                  </Btn>
                }
              />
            </Card>
          ) : (
            <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {mine.map((f) => (
                <MyCard
                  key={f.id}
                  f={f}
                  text={text}
                  size={size}
                  onOpen={() => setSel({ kind: "mine", f })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {filter !== "mine" &&
        (list.length === 0 ? (
          <Card>
            <EmptyState icon={Type} title="לא נמצאו פונטים" subtitle="נסו סינון אחר" />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((f) => (
              <FontCard
                key={f.id}
                f={f}
                text={text}
                size={size}
                fav={db.fontFavs.includes(f.id)}
                onOpen={() => setSel({ kind: "cat", f })}
              />
            ))}
          </div>
        ))}

      <p className="mt-6 text-xs text-[color:var(--focus-muted)]">
        כל הפונטים ברשימה חינמיים ברישיון SIL Open Font License, כולל לשימוש מסחרי באתרים של לקוחות.
        הקבצים להורדה מגיעים מ-Fontsource (עותק של Google Fonts).
      </p>

      <FontDrawer sel={sel} text={text} onClose={() => setSel(null)} />
    </div>
  );
}

function PairCard({ head, body, why }: { head: string; body: string; why: string }) {
  const h = CATALOG.find((f) => f.id === head)!;
  const b = CATALOG.find((f) => f.id === body)!;
  const [ref, vis] = useVisible<HTMLDivElement>();
  React.useEffect(() => {
    if (!vis) return;
    loadCatalogFont(h);
    loadCatalogFont(b);
  }, [vis, h, b]);
  const he = h.hebrew && b.hebrew;
  return (
    <div
      ref={ref}
      className="w-64 flex-none rounded-2xl border border-[color:var(--focus-border)] bg-[var(--focus-card)] p-4"
    >
      <div
        style={{
          fontFamily: `${cssFamily(h)}, sans-serif`,
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {he ? "כותרת שמושכת את העין" : "A headline that pops"}
      </div>
      <div
        className="mt-1 text-[color:var(--focus-muted)]"
        style={{ fontFamily: `${cssFamily(b)}, sans-serif`, fontSize: 14.5, lineHeight: 1.5 }}
      >
        {he
          ? "וזה טקסט רגיל שנעים לקרוא גם כשהוא ארוך, בטלפון ובמחשב."
          : "And body text that stays easy to read, on any screen."}
      </div>
      <div className="mt-3 text-xs text-[color:var(--focus-muted)]">
        {h.family} + {b.family}
      </div>
      <div className="mt-1 text-xs">{why}</div>
      <div className="mt-3 flex gap-2">
        <Btn
          size="sm"
          icon={Bot}
          onClick={() =>
            void copy(
              fontPrompt(
                { family: h.family, url: specimenUrl(h) },
                { family: b.family, url: specimenUrl(b) },
              ) + `\n\nטעינה:\n${linkTag([h, b])}`,
              "הועתק. להדביק ל-Claude",
            )
          }
        >
          ל-Claude
        </Btn>
        <Btn
          size="sm"
          icon={ClipboardCopy}
          onClick={() => void copy(linkTag([h, b]), "שורות הטעינה הועתקו")}
        >
          קוד
        </Btn>
      </div>
    </div>
  );
}

function FontCard({
  f,
  text,
  size,
  fav,
  onOpen,
}: {
  f: CatalogFont;
  text: string;
  size: number;
  fav: boolean;
  onOpen: () => void;
}) {
  const [ref, vis] = useVisible<HTMLDivElement>();
  React.useEffect(() => {
    if (vis) loadCatalogFont(f);
  }, [vis, f]);
  return (
    <Card className="overflow-hidden">
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="cursor-pointer p-4"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold" dir="ltr" style={{ textAlign: "right" }}>
              {f.family}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge>{CAT_HE[f.cat]}</Badge>
              {f.hebrew ? <Badge color={C.ok}>עברית</Badge> : <Badge>אנגלית בלבד</Badge>}
              <Badge>{f.weights.length === 1 ? "משקל אחד" : `${f.weights.length} משקלים`}</Badge>
            </div>
          </div>
          <button
            aria-label={fav ? "הסרה מהמועדפים" : "הוספה למועדפים"}
            onClick={(e) => {
              e.stopPropagation();
              actions.toggleFontFav(f.id);
            }}
            className="p-1"
          >
            <Star
              className="size-5"
              style={{ color: fav ? "#f5a524" : C.sub, fill: fav ? "#f5a524" : "none" }}
            />
          </button>
        </div>
        <div
          className="mt-3 break-words"
          style={{
            fontFamily: `${cssFamily(f)}, ${f.cat === "serif" ? "serif" : "sans-serif"}`,
            fontSize: size,
            lineHeight: 1.25,
            minHeight: size * 1.3,
            fontWeight: f.weights.includes(700) && size >= 30 ? 700 : 400,
          }}
        >
          {text || SAMPLE}
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-[color:var(--focus-muted)]">{f.special}</p>
      </div>
    </Card>
  );
}

function MyCard({
  f,
  text,
  size,
  onOpen,
}: {
  f: MyFont;
  text: string;
  size: number;
  onOpen: () => void;
}) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let dead = false;
    void loadMyFont(f).then((ok) => !dead && setReady(ok));
    return () => {
      dead = true;
    };
  }, [f]);
  const v = licenseVerdict(f.info.license, f.info.licenseUrl, f.info.fsType);
  const heb = f.info.hebrewLetters;
  return (
    <Card className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="cursor-pointer p-4"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{myFamily(f)}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge color={C.primary}>שלי</Badge>
              {f.info.parsed &&
                (heb >= 27 ? (
                  <Badge color={C.ok}>עברית</Badge>
                ) : (
                  <Badge>{heb ? "עברית חלקית" : "בלי עברית"}</Badge>
                ))}
              {f.info.parsed && <LicenseBadge v={v} />}
              <Badge>{f.ext.toUpperCase()}</Badge>
            </div>
          </div>
          {f.fav && <Star className="size-5" style={{ color: "#f5a524", fill: "#f5a524" }} />}
        </div>
        <div
          className="mt-3 break-words"
          style={{
            fontFamily: ready ? `'myfont-${f.id}', sans-serif` : "inherit",
            fontSize: size,
            lineHeight: 1.25,
            minHeight: size * 1.3,
            opacity: ready ? 1 : 0.35,
          }}
        >
          {text || SAMPLE}
        </div>
        <p className="mt-2 truncate text-xs text-[color:var(--focus-muted)]">
          {f.name} · {kb(f.size)}
        </p>
      </div>
    </Card>
  );
}

/* ---------------- details ---------------- */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v === "" || v === null || v === undefined) return null;
  return (
    <div className="flex gap-3 border-b border-[color:var(--focus-border)] py-2 text-sm last:border-0">
      <div className="w-28 flex-none text-[color:var(--focus-muted)]">{k}</div>
      <div className="min-w-0 flex-1 break-words">{v}</div>
    </div>
  );
}

function LicenseBox({ v, raw, url }: { v: LicenseVerdict; raw?: string; url?: string }) {
  const color = v.level === "ok" ? C.ok : v.level === "no" ? C.bad : C.warn;
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: color }}>
      <div className="mb-2 flex items-center gap-2 font-semibold" style={{ color }}>
        {v.level === "ok"
          ? "✓ מותר לשימוש באתרים של לקוחות"
          : v.level === "no"
            ? "✗ לא לשימוש מסחרי"
            : "! צריך לבדוק את הרישיון"}
      </div>
      <div className="mb-2 text-sm">רישיון: {v.name}</div>
      {v.allowed.length > 0 && (
        <ul className="mb-2 space-y-1 text-sm">
          {v.allowed.map((a) => (
            <li key={a} className="flex gap-2">
              <Check className="mt-0.5 size-4 flex-none" style={{ color: C.ok }} />
              {a}
            </li>
          ))}
        </ul>
      )}
      {v.limits.length > 0 && (
        <ul className="space-y-1 text-sm">
          {v.limits.map((a) => (
            <li key={a} className="flex gap-2">
              <X
                className="mt-0.5 size-4 flex-none"
                style={{ color: v.level === "ok" ? C.warn : C.bad }}
              />
              {a}
            </li>
          ))}
        </ul>
      )}
      {raw && (
        <details className="mt-3 text-xs text-[color:var(--focus-muted)]">
          <summary className="cursor-pointer">הנוסח המלא מתוך הקובץ</summary>
          <p className="mt-2 whitespace-pre-wrap" dir="auto">
            {raw}
          </p>
        </details>
      )}
      {url && (
        <a
          className="mt-2 inline-flex items-center gap-1 text-xs underline"
          href={/^https?:/.test(url) ? url : `https://${url}`}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
        >
          {url} <ExternalLink className="size-3" />
        </a>
      )}
      <p className="mt-3 text-xs text-[color:var(--focus-muted)]">
        זה סיכום ולא ייעוץ משפטי. בפונט בתשלום, הנוסח של היצרן הוא הקובע.
      </p>
    </div>
  );
}

const ALPHA = [
  "אבגדהוזחטיכלמנסעפצקרשת ךםןףץ",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789 ₪ ! ? , . ( ) %",
  "שָׁלוֹם, בְּרוּכִים הַבָּאִים",
];

function FontDrawer({ sel, text, onClose }: { sel: Sel; text: string; onClose: () => void }) {
  const db = useDB();
  const [size, setSize] = React.useState(44);
  const [pairWith, setPairWith] = React.useState("");
  const [dl, setDl] = React.useState("");
  const f = sel?.f;
  React.useEffect(() => {
    const p = CATALOG.find((x) => x.id === pairWith);
    if (p) loadCatalogFont(p);
  }, [pairWith]);
  React.useEffect(() => {
    if (sel?.kind === "cat") loadCatalogFont(sel.f, true);
    if (sel?.kind === "mine") void loadMyFont(sel.f);
    setPairWith("");
  }, [sel]);
  if (!sel || !f)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );

  const isCat = sel.kind === "cat";
  const family = isCat ? (f as CatalogFont).family : myFamily(f as MyFont);
  const ff = isCat
    ? `${cssFamily(f as CatalogFont)}, sans-serif`
    : `'myfont-${(f as MyFont).id}', sans-serif`;
  const weights = isCat ? (f as CatalogFont).weights : [(f as MyFont).info.weight || 400];
  const mf = sel.kind === "mine" ? sel.f : null;
  const cf = sel.kind === "cat" ? sel.f : null;
  const info = mf?.info;
  const verdict = cf
    ? LICENSES[cf.license]
    : licenseVerdict(info!.license, info!.licenseUrl, info!.fsType);
  const fav = cf ? db.fontFavs.includes(cf.id) : !!mf?.fav;
  const pair = CATALOG.find((x) => x.id === pairWith);
  const suggested = cf
    ? PAIRS.filter((p) => p.head === cf.id || p.body === cf.id).map((p) =>
        p.head === cf.id ? p.body : p.head,
      )
    : [];

  const zip = async () => {
    if (!cf) return;
    setDl("מתחיל…");
    try {
      await downloadCatalogZip(cf, (d, of) => setDl(`${d}/${of}`));
      toast.success("הקבצים ירדו");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDl("");
    }
  };
  const downloadMine = async () => {
    if (!mf) return;
    try {
      const u = await fontFileUrl(mf);
      const a = document.createElement("a");
      a.href = u;
      a.download = mf.name;
      a.target = "_blank";
      a.click();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const claude = () => {
    const me = cf ? { family, url: specimenUrl(cf) } : { family, mine: true };
    const other = pair ? { family: pair.family, url: specimenUrl(pair) } : undefined;
    const extra = cf
      ? `\n\nטעינה:\n${linkTag(pair ? [cf, pair] : [cf])}`
      : mf
        ? `\n\n${fontFaceCss(mf)}`
        : "";
    void copy(fontPrompt(me, other) + extra, "הועתק. להדביק ל-Claude");
  };

  const heLetters = info?.hebrewLetters ?? 0;
  const special = cf ? cf.special : info?.description || "";

  return (
    <Drawer open onClose={onClose} title={family}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {cf && <Badge>{CAT_HE[cf.cat]}</Badge>}
        {cf && <Badge>{USE_HE[cf.use]}</Badge>}
        <LicenseBadge v={verdict} />
        <button
          className="mr-auto inline-flex items-center gap-1 text-sm"
          onClick={() =>
            cf ? actions.toggleFontFav(cf.id) : mf && actions.patchFont(mf.id, { fav: !mf.fav })
          }
        >
          <Star
            className="size-4"
            style={{ color: fav ? "#f5a524" : C.sub, fill: fav ? "#f5a524" : "none" }}
          />
          {fav ? "במועדפים" : "למועדפים"}
        </button>
      </div>

      <div className="rounded-xl border border-[color:var(--focus-border)] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--focus-muted)]">
          גודל
          <input
            type="range"
            min={16}
            max={110}
            value={size}
            onChange={(e) => setSize(+e.target.value)}
            className="w-32 accent-[var(--focus-primary)]"
          />
        </div>
        <div style={{ fontFamily: ff, fontSize: size, lineHeight: 1.2, wordBreak: "break-word" }}>
          {text || SAMPLE}
        </div>
        {pair && (
          <p
            className="mt-3"
            style={{ fontFamily: `${cssFamily(pair)}, sans-serif`, fontSize: 16, lineHeight: 1.6 }}
          >
            {pair.hebrew
              ? "וככה נראה טקסט רגיל לידה, בפונט שבחרת לגוף הטקסט. נעים לקריאה גם בפסקאות ארוכות."
              : "This is how body text looks next to it, in the font you picked for paragraphs."}
          </p>
        )}
      </div>

      {weights.length > 1 && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-semibold">כל המשקלים</div>
          {weights.map((w) => (
            <div
              key={w}
              className="flex items-baseline gap-3 border-b border-[color:var(--focus-border)] py-1.5 last:border-0"
            >
              <span className="w-24 flex-none text-xs text-[color:var(--focus-muted)]">
                {w} · {WEIGHT_HE[w] || ""}
              </span>
              <span className="truncate" style={{ fontFamily: ff, fontWeight: w, fontSize: 22 }}>
                {cf?.hebrew === false ? "Beautiful websites" : "אתרים יפים ומהירים"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-4 space-y-1 rounded-xl bg-[var(--focus-bg2)] p-3"
        style={{ fontFamily: ff, fontSize: 20, lineHeight: 1.5 }}
      >
        {ALPHA.filter((l, i) => (cf ? cf.hebrew || (i > 0 && i < 4) : true)).map((l) => (
          <div key={l} style={{ wordBreak: "break-all" }}>
            {l}
          </div>
        ))}
      </div>

      {special && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-semibold">
            {cf ? "מה המיוחד בו" : "תיאור מתוך הקובץ"}
          </div>
          <p className="text-sm leading-relaxed" dir="auto">
            {special}
          </p>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold">פרטים</div>
        {cf ? (
          <>
            <Row k="מעצב" v={cf.designer} />
            <Row k="סוג" v={CAT_HE[cf.cat]} />
            <Row k="מתאים" v={USE_HE[cf.use]} />
            <Row k="משקלים" v={cf.weights.map((w) => `${w}`).join(", ")} />
            <Row k="נטוי" v={cf.italic ? "יש" : "אין"} />
            <Row k="שפות" v={cf.hebrew ? "עברית ואנגלית" : "אנגלית (בלי עברית)"} />
            <Row k="קבצים" v="WOFF2, עברית ולטינית בנפרד (נטען רק מה שצריך)" />
          </>
        ) : (
          info && (
            <>
              {!info.parsed && (
                <p className="mb-2 text-xs" style={{ color: C.warn }}>
                  {mf!.ext === "woff2"
                    ? "בקובץ WOFF2 אי אפשר לקרוא את הפרטים מתוך הדפדפן. התצוגה עובדת; לפרטים המלאים ולרישיון העלו את אותו פונט כ-TTF או OTF."
                    : "לא הצלחנו לקרוא את הפרטים מהקובץ."}
                </p>
              )}
              <Row k="שם" v={info.fullName || info.family} />
              <Row k="סגנון" v={info.subfamily} />
              <Row k="מעצב" v={info.designer} />
              <Row k="יצרן" v={info.vendor} />
              <Row k="גרסה" v={info.version} />
              <Row
                k="משקל"
                v={
                  info.weight
                    ? `${info.weight} · ${WEIGHT_HE[Math.round(info.weight / 100) * 100] || ""}`
                    : ""
                }
              />
              <Row
                k="פונט משתנה"
                v={
                  info.variable
                    ? `כן: ${info.axes.map((a) => `${a.tag} ${a.min}–${a.max}`).join(", ")}`
                    : info.parsed
                      ? "לא"
                      : ""
                }
              />
              <Row
                k="עברית"
                v={
                  info.parsed
                    ? heLetters >= 27
                      ? `מלאה${info.niqqud ? ", כולל ניקוד" : ", בלי ניקוד"}${info.shekel ? ", עם ₪" : ""}`
                      : heLetters
                        ? `חלקית (${heLetters} מתוך 27 אותיות)`
                        : "אין"
                    : ""
                }
              />
              <Row k="אנגלית" v={info.parsed ? (info.latin ? "יש" : "אין") : ""} />
              <Row k="גליפים" v={info.glyphs ?? ""} />
              <Row k="הטמעה" v={embeddingNote(info.fsType)?.text || ""} />
              <Row k="קובץ" v={`${mf!.name} · ${mf!.ext.toUpperCase()} · ${kb(mf!.size)}`} />
              <Row k="זכויות" v={info.copyright} />
              <Row k="סימן מסחרי" v={info.trademark} />
            </>
          )
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold">רישיון: מה מותר</div>
        <LicenseBox v={verdict} raw={info?.license} url={info?.licenseUrl} />
      </div>

      {cf && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-semibold">לשלב עם פונט לטקסט</div>
          <select
            className="h-10 w-full rounded-lg border border-[color:var(--focus-border)] bg-[var(--focus-card)] px-3"
            value={pairWith}
            onChange={(e) => setPairWith(e.target.value)}
          >
            <option value="">בלי שילוב</option>
            {suggested.length > 0 && (
              <optgroup label="מומלצים">
                {suggested.map((id) => (
                  <option key={id} value={id}>
                    {CATALOG.find((x) => x.id === id)!.family}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="כל הפונטים">
              {CATALOG.filter(
                (x) => x.id !== cf.id && x.use !== "כותרות" && (!cf.hebrew || x.hebrew),
              ).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.family}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {mf && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-semibold">הערה</div>
          <Textarea
            value={mf.note}
            onChange={(e) => actions.patchFont(mf.id, { note: e.target.value })}
            placeholder="מאיפה הפונט, לאיזה לקוח, כמה עלה…"
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Btn variant="primary" icon={Bot} onClick={claude}>
          העתקה ל-Claude
        </Btn>
        {cf ? (
          <>
            <Btn icon={Download} disabled={!!dl} onClick={() => void zip()}>
              {dl ? `מוריד ${dl}` : "הורדת הקבצים (ZIP)"}
            </Btn>
            <Btn
              icon={ClipboardCopy}
              onClick={() => void copy(linkTag(pair ? [cf, pair] : [cf]), "שורות הטעינה הועתקו")}
            >
              שורת טעינה
            </Btn>
            <Btn
              icon={ClipboardCopy}
              onClick={() =>
                void copy(
                  `@import url('${googleCssUrl(cf)}');\nfont-family: ${cssFamily(cf)}, ${cf.cat === "serif" ? "serif" : "sans-serif"};`,
                  "ה-CSS הועתק",
                )
              }
            >
              CSS
            </Btn>
            <a href={specimenUrl(cf)} target="_blank" rel="noreferrer">
              <Btn icon={ExternalLink}>Google Fonts</Btn>
            </a>
          </>
        ) : (
          mf && (
            <>
              <Btn icon={Download} onClick={() => void downloadMine()}>
                הורדת הקובץ
              </Btn>
              <Btn
                icon={ClipboardCopy}
                onClick={() => void copy(fontFaceCss(mf), "ה-@font-face הועתק")}
              >
                @font-face
              </Btn>
              <Btn
                variant="ghost"
                icon={Trash2}
                onClick={() => {
                  void deleteMyFont(mf);
                  onClose();
                }}
              >
                מחיקה
              </Btn>
            </>
          )
        )}
      </div>
    </Drawer>
  );
}
