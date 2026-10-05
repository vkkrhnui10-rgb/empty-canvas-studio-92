/**
 * Inspiration — sites and single sections I liked, sorted by category, plus the free fonts library.
 */
import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  Camera,
  Check,
  ClipboardPaste,
  ExternalLink,
  ImagePlus,
  Laptop,
  Lightbulb,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Scissors,
  Search,
  Smartphone,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { C } from "./constants";
import {
  canShoot,
  captureInspo,
  catsOf,
  filterInspo,
  hostOf,
  inspoPrompt,
  normUrl,
  pageMeta,
  SECTION_TYPES,
  SITE_PARTS,
  uploadInspoImg,
  type InspoFilter,
  type ShotKind,
} from "./inspolib";
import { useNav } from "./nav";
import { actions, useDB } from "./store";
import type { Inspo, Project } from "./types";
import {
  Badge,
  Btn,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Textarea,
} from "./ui";
import { CLOSED_PROJECT } from "./constants";
import { uid } from "./utils";

const FontsTab = React.lazy(() => import("./fonts").then((m) => ({ default: m.FontsTab })));

const copy = async (txt: string, ok = "הועתק") => {
  try {
    await navigator.clipboard.writeText(txt);
    toast.success(ok);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
};

/* which pictures are being taken right now (survives leaving the page) */
const busy = new Set<string>();
const busySubs = new Set<() => void>();
const setBusy = (k: string, on: boolean) => {
  if (on) busy.add(k);
  else busy.delete(k);
  busySubs.forEach((f) => f());
};
function useBusy() {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    busySubs.add(force);
    return () => {
      busySubs.delete(force);
    };
  }, []);
  return (k: string) => busy.has(k);
}

/** take a picture of a saved site (queued; quiet on success) */
async function shoot(id: string, url: string, kind: ShotKind, loud = false) {
  const k = `${id}|${kind}`;
  if (busy.has(k)) return;
  setBusy(k, true);
  try {
    const j = await captureInspo(id, url, kind);
    actions.patchInspo(id, { [kind]: { url: j.url, at: j.at } } as Partial<Inspo>);
    if (loud) toast.success(kind === "full" ? "צילום הדף המלא מוכן" : "הצילום מוכן");
  } catch (e) {
    toast.error(`לא הצלחנו לצלם את ${hostOf(url)}: ${(e as Error).message}`);
  } finally {
    setBusy(k, false);
  }
}

const imgOf = (it: Inspo) => it.img?.url || it.shot?.url || it.mshot?.url || "";

/* ============================ page ============================ */
export function InspoView({ openId }: { openId?: string | null }) {
  const db = useDB();
  const nav = useNav();
  const [tab, setTab] = React.useState<"refs" | "fonts">(openId === "fonts" ? "fonts" : "refs");
  const [f, setF] = React.useState<InspoFilter>({
    kind: "all",
    cat: "",
    part: "",
    q: "",
    fav: false,
  });
  const [adding, setAdding] = React.useState<"" | "site" | "section">("");
  const [picking, setPicking] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [editCats, setEditCats] = React.useState(false);
  const cats = catsOf(db.inspoCats);
  const items = filterInspo(db.inspo, f);
  const open = openId && openId !== "fonts" ? db.inspo.find((x) => x.id === openId) : undefined;
  const count = (c: string) => db.inspo.filter((x) => x.category === c).length;
  const partList =
    f.kind === "section"
      ? SECTION_TYPES
      : f.kind === "site"
        ? SITE_PARTS
        : [...new Set([...SITE_PARTS, ...SECTION_TYPES])];
  const usedParts = partList.filter((p) => db.inspo.some((x) => x.parts.includes(p)));

  // paste a screenshot anywhere on the page → new section
  const [pasted, setPasted] = React.useState<Blob | null>(null);
  React.useEffect(() => {
    if (tab !== "refs") return;
    const on = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const file = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (file) {
        setPasted(file);
        setAdding("section");
      }
    };
    window.addEventListener("paste", on);
    return () => window.removeEventListener("paste", on);
  }, [tab]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="השראה"
        subtitle="אתרים, סקשנים ופונטים שאהבתי, מסודרים לפי קטגוריות"
        actions={
          tab === "refs" ? (
            <>
              <Btn variant="primary" icon={Plus} onClick={() => setAdding("site")}>
                אתר
              </Btn>
              <Btn icon={Scissors} onClick={() => setAdding("section")}>
                סקשן
              </Btn>
              <Btn
                variant={picking ? "primary" : "ghost"}
                icon={ListChecks}
                onClick={() => {
                  setPicking((v) => !v);
                  setPicked([]);
                }}
              >
                בחירה ל-Claude
              </Btn>
            </>
          ) : null
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={(v) => {
            setTab(v);
            nav.go("inspo", v === "fonts" ? "fonts" : null);
          }}
          options={[
            {
              value: "refs",
              label: `אתרים וסקשנים${db.inspo.length ? ` (${db.inspo.length})` : ""}`,
            },
            { value: "fonts", label: "פונטים" },
          ]}
        />
      </div>

      {tab === "fonts" ? (
        <React.Suspense fallback={null}>
          <FontsTab />
        </React.Suspense>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented
              value={f.kind}
              onChange={(kind) => setF((x) => ({ ...x, kind, part: "" }))}
              options={[
                { value: "all", label: "הכל" },
                { value: "site", label: "אתרים" },
                { value: "section", label: "סקשנים" },
              ]}
            />
            <button
              onClick={() => setF((x) => ({ ...x, fav: !x.fav }))}
              className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm"
              style={{ borderColor: f.fav ? "#f5a524" : C.line }}
            >
              <Star
                className="size-4"
                style={{ color: "#f5a524", fill: f.fav ? "#f5a524" : "none" }}
              />
              מועדפים
            </button>
            <div className="relative min-w-44 flex-1">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[color:var(--focus-muted)]" />
              <Input
                className="pr-9"
                value={f.q}
                onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
                placeholder="חיפוש"
              />
            </div>
          </div>

          <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip on={!f.cat} onClick={() => setF((x) => ({ ...x, cat: "" }))}>
              כל הקטגוריות
            </Chip>
            {cats.map((c) => (
              <Chip
                key={c}
                on={f.cat === c}
                onClick={() => setF((x) => ({ ...x, cat: x.cat === c ? "" : c }))}
              >
                {c}
                {count(c) ? <span className="opacity-60"> {count(c)}</span> : null}
              </Chip>
            ))}
            <button
              className="flex-none px-2 text-xs font-semibold text-[color:var(--focus-primary)]"
              onClick={() => setEditCats(true)}
            >
              <Pencil className="inline size-3" /> עריכה
            </button>
          </div>
          {usedParts.length > 0 && (
            <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {usedParts.map((p) => (
                <Chip
                  key={p}
                  small
                  on={f.part === p}
                  onClick={() => setF((x) => ({ ...x, part: x.part === p ? "" : p }))}
                >
                  {p}
                </Chip>
              ))}
            </div>
          )}

          {db.inspo.length === 0 ? (
            <Card>
              <EmptyState
                icon={Lightbulb}
                title="עוד אין כאן כלום"
                subtitle="מדביקים קישור לאתר שאהבתם, או צילום מסך של סקשן (אפשר פשוט Ctrl+V בדף הזה)."
                action={
                  <div className="flex gap-2">
                    <Btn variant="primary" icon={Plus} onClick={() => setAdding("site")}>
                      הוספת אתר
                    </Btn>
                    <Btn icon={Scissors} onClick={() => setAdding("section")}>
                      הוספת סקשן
                    </Btn>
                  </div>
                }
              />
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState icon={Search} title="אין התאמות" subtitle="נסו סינון אחר" />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {items.map((it) => (
                <InspoCard
                  key={it.id}
                  it={it}
                  picking={picking}
                  picked={picked.includes(it.id)}
                  onClick={() =>
                    picking
                      ? setPicked((p) =>
                          p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id],
                        )
                      : nav.go("inspo", it.id)
                  }
                />
              ))}
            </div>
          )}

          {picking && (
            <div className="sticky bottom-20 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--focus-navy)] p-3 text-white shadow-xl md:bottom-4">
              <span className="text-sm font-semibold">
                {picked.length ? `נבחרו ${picked.length}` : "בוחרים כרטיסים"}
              </span>
              <span className="flex-1" />
              <Btn
                size="sm"
                variant="primary"
                icon={Bot}
                disabled={!picked.length}
                onClick={() => {
                  const sel = db.inspo.filter((x) => picked.includes(x.id));
                  void copy(inspoPrompt(sel, db.inspo), "הועתק. להדביק ל-Claude");
                }}
              >
                העתקה ל-Claude
              </Btn>
              <Btn size="sm" icon={X} onClick={() => setPicking(false)}>
                סגירה
              </Btn>
            </div>
          )}
        </>
      )}

      <AddDialog
        mode={adding}
        pasted={pasted}
        onClose={() => {
          setAdding("");
          setPasted(null);
        }}
      />
      <CatsDialog open={editCats} onClose={() => setEditCats(false)} />
      <InspoDrawer it={open} onClose={() => nav.go("inspo", null)} />
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
  small,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border transition-colors ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
      style={{
        borderColor: on ? "var(--focus-navy)" : "var(--focus-border)",
        background: on ? "var(--focus-navy)" : "var(--focus-card)",
        color: on ? "#fff" : "var(--focus-foreground)",
      }}
    >
      {children}
    </button>
  );
}

function InspoCard({
  it,
  picking,
  picked,
  onClick,
}: {
  it: Inspo;
  picking: boolean;
  picked: boolean;
  onClick: () => void;
}) {
  const isBusy = useBusy();
  const src = imgOf(it);
  const shooting = isBusy(`${it.id}|shot`);
  return (
    <Card
      className="group overflow-hidden"
      style={picked ? { outline: `3px solid ${C.primary}` } : undefined}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="cursor-pointer"
      >
        <div className="relative aspect-[16/11] overflow-hidden bg-[var(--focus-bg2)]">
          {src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              className={`size-full ${it.kind === "section" ? "object-contain" : "object-cover object-top"} transition-transform duration-300 group-hover:scale-[1.03]`}
            />
          ) : (
            <div className="grid size-full place-items-center text-xs text-[color:var(--focus-muted)]">
              {shooting ? (
                <span className="flex items-center gap-2">
                  <Camera className="size-4 animate-pulse" /> מצלם…
                </span>
              ) : (
                <span dir="ltr">{hostOf(it.url) || "אין תמונה"}</span>
              )}
            </div>
          )}
          {it.kind === "section" && (
            <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
              סקשן
            </span>
          )}
          {picking && (
            <span
              className="absolute top-2 left-2 grid size-7 place-items-center rounded-full border-2 border-white text-white"
              style={{ background: picked ? C.primary : "rgba(0,0,0,.35)" }}
            >
              {picked && <Check className="size-4" />}
            </span>
          )}
          {!picking && (
            <button
              aria-label={it.fav ? "הסרה מהמועדפים" : "הוספה למועדפים"}
              onClick={(e) => {
                e.stopPropagation();
                actions.patchInspo(it.id, { fav: !it.fav });
              }}
              className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-white/90 shadow"
            >
              <Star
                className="size-4"
                style={{ color: "#f5a524", fill: it.fav ? "#f5a524" : "none" }}
              />
            </button>
          )}
        </div>
        <div className="p-3">
          <div className="truncate text-sm font-semibold">
            {it.title || hostOf(it.url) || "סקשן"}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {it.category && <Badge>{it.category}</Badge>}
            {it.parts.slice(0, 2).map((p) => (
              <Badge key={p} color={C.primary}>
                {p}
              </Badge>
            ))}
            {it.parts.length > 2 && <Badge>+{it.parts.length - 2}</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- add ---------------- */
function PartsPicker({
  list,
  value,
  onChange,
}: {
  list: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((p) => (
        <Chip
          key={p}
          small
          on={value.includes(p)}
          onClick={() => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])}
        >
          {p}
        </Chip>
      ))}
    </div>
  );
}

function CatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const db = useDB();
  return (
    <div className="flex flex-wrap gap-1.5">
      {catsOf(db.inspoCats).map((c) => (
        <Chip key={c} small on={value === c} onClick={() => onChange(value === c ? "" : c)}>
          {c}
        </Chip>
      ))}
    </div>
  );
}

function AddDialog({
  mode,
  pasted,
  onClose,
}: {
  mode: "" | "site" | "section";
  pasted: Blob | null;
  onClose: () => void;
}) {
  const db = useDB();
  const nav = useNav();
  const [kind, setKind] = React.useState<"site" | "section">("site");
  const [url, setUrl] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [parts, setParts] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [img, setImg] = React.useState<Blob | null>(null);
  const [siteId, setSiteId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const preview = React.useMemo(() => (img ? URL.createObjectURL(img) : ""), [img]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  React.useEffect(() => {
    if (!mode) return;
    setKind(mode);
    setUrl("");
    setCat("");
    setParts([]);
    setNote("");
    setSiteId("");
    setImg(pasted);
  }, [mode, pasted]);

  const sites = db.inspo.filter((x) => x.kind === "site");
  const site = sites.find((x) => x.id === siteId);
  const dupe =
    kind === "site" &&
    url &&
    db.inspo.find((x) => x.kind === "site" && hostOf(x.url) === hostOf(normUrl(url)));

  const save = async () => {
    if (kind === "site") {
      const u = normUrl(url);
      if (!/^https?:\/\/[^\s.]+\.[^\s]+/.test(u)) return toast.error("צריך כתובת של אתר");
      const it = actions.addInspo({
        kind: "site",
        url: u,
        title: hostOf(u),
        category: cat,
        parts,
        note,
      });
      onClose();
      if (!canShoot()) {
        toast("נשמר. צילומים עובדים רק כשמחוברים לענן");
        return;
      }
      toast.success("נשמר. מצלם את האתר ברקע");
      void pageMeta(u).then((m) => m.title && actions.patchInspo(it.id, { title: m.title }));
      void shoot(it.id, u, "shot").then(() => shoot(it.id, u, "mshot"));
      return;
    }
    if (!img) return toast.error("צריך תמונה של הסקשן");
    setSaving(true);
    try {
      // the picture first: a section without its picture is useless
      const id = uid();
      const j = await uploadInspoImg(`inspo-sec-${id}`, img);
      const it = actions.addInspo({
        id,
        kind: "section",
        url: url ? normUrl(url) : site?.url || "",
        title: site?.title || (url ? hostOf(normUrl(url)) : ""),
        category: cat || site?.category || "",
        parts,
        note,
        siteId: site?.id,
        img: { url: j.url, at: j.at },
      });
      toast.success("הסקשן נשמר");
      onClose();
      nav.go("inspo", it.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      title={kind === "site" ? "אתר שאהבתי" : "סקשן שאהבתי"}
      className="sm:max-w-lg"
    >
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "site", label: "אתר שלם" },
            { value: "section", label: "סקשן" },
          ]}
        />
        {kind === "section" && (
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
                if (file) setImg(file);
              }}
              onPaste={(e) => {
                const file = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
                if (file) setImg(file);
              }}
              className="grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-[color:var(--focus-border)] bg-[var(--focus-bg2)] text-center text-sm text-[color:var(--focus-muted)]"
            >
              {preview ? (
                <img src={preview} alt="" className="max-h-64 w-full object-contain" />
              ) : (
                <div className="p-4">
                  <ImagePlus className="mx-auto mb-2 size-7" />
                  מדביקים צילום מסך (Ctrl+V), גוררים לכאן, או לוחצים לבחירת תמונה
                  <div className="mt-1 text-xs">
                    אפשר גם לחתוך סקשן מאתר שמור: פותחים את האתר ולוחצים "חיתוך סקשן"
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImg(file);
                e.target.value = "";
              }}
            />
            <div className="mt-2 flex gap-2">
              <Btn
                size="sm"
                icon={ClipboardPaste}
                onClick={async () => {
                  try {
                    const its = await navigator.clipboard.read();
                    for (const i of its) {
                      const t = i.types.find((x) => x.startsWith("image/"));
                      if (t) return setImg(await i.getType(t));
                    }
                    toast("אין תמונה בלוח");
                  } catch {
                    toast("לחצו Ctrl+V בתוך המסגרת");
                  }
                }}
              >
                הדבקה מהלוח
              </Btn>
            </div>
          </div>
        )}
        <div>
          <div className="mb-1 text-sm font-semibold">
            {kind === "site" ? "כתובת האתר" : "מאיזה אתר (לא חובה)"}
          </div>
          {kind === "section" && sites.length > 0 && (
            <select
              className="mb-2 h-10 w-full rounded-lg border border-[color:var(--focus-border)] bg-[var(--focus-card)] px-3 text-sm"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">לא מאתר שמור</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || hostOf(s.url)}
                </option>
              ))}
            </select>
          )}
          {!siteId && (
            <Input
              dir="ltr"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus={kind === "site"}
            />
          )}
          {dupe && (
            <p className="mt-1 text-xs" style={{ color: C.warn }}>
              האתר הזה כבר שמור ({dupe.title || hostOf(dupe.url)})
            </p>
          )}
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">קטגוריה</div>
          <CatPicker value={cat} onChange={setCat} />
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">
            {kind === "site" ? "מה אהבתי" : "איזה סקשן זה"}
          </div>
          <PartsPicker
            list={kind === "site" ? SITE_PARTS : SECTION_TYPES}
            value={parts}
            onChange={setParts}
          />
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה: מה בדיוק אהבתי, לאיזה לקוח זה מתאים…"
        />
        <div className="flex gap-2">
          <Btn variant="primary" className="flex-1" disabled={saving} onClick={() => void save()}>
            {saving ? "שומר…" : "שמירה"}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            ביטול
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CatsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB();
  const [txt, setTxt] = React.useState("");
  React.useEffect(() => {
    if (open) setTxt(catsOf(db.inspoCats).join("\n"));
  }, [open, db.inspoCats]);
  return (
    <Modal open={open} onClose={onClose} title="הקטגוריות שלי" description="קטגוריה בכל שורה">
      <Textarea rows={12} value={txt} onChange={(e) => setTxt(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Btn
          variant="primary"
          onClick={() => {
            const list = [
              ...new Set(
                txt
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ];
            actions.setInspoCats(list);
            onClose();
          }}
        >
          שמירה
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            actions.setInspoCats([]);
            onClose();
          }}
        >
          חזרה לברירת המחדל
        </Btn>
      </div>
    </Modal>
  );
}

/* ---------------- details ---------------- */
function InspoDrawer({ it, onClose }: { it?: Inspo; onClose: () => void }) {
  const db = useDB();
  const nav = useNav();
  const isBusy = useBusy();
  const [view, setView] = React.useState<"shot" | "mshot" | "full">("shot");
  const [cutting, setCutting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  React.useEffect(() => {
    setView("shot");
    setCutting(false);
    setConfirmDel(false);
  }, [it?.id]);
  if (!it)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const site = it.siteId ? db.inspo.find((x) => x.id === it.siteId) : undefined;
  const sections = db.inspo.filter((x) => x.siteId === it.id);
  const projects = db.projects.filter(
    (p) => !CLOSED_PROJECT.includes(p.status) || (it.projectIds || []).includes(p.id),
  );
  const pic = it.kind === "section" ? it.img : it[view];
  const patch = (x: Partial<Inspo>) => actions.patchInspo(it.id, x);

  return (
    <Drawer open onClose={onClose} title={it.title || hostOf(it.url) || "סקשן"}>
      {it.kind === "site" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              setCutting(false);
            }}
            options={[
              { value: "shot", label: "מחשב", icon: Laptop },
              { value: "mshot", label: "טלפון", icon: Smartphone },
              { value: "full", label: "כל הדף" },
            ]}
          />
          {view === "full" && it.full && (
            <Btn
              size="sm"
              variant={cutting ? "primary" : "soft"}
              icon={Scissors}
              onClick={() => setCutting((v) => !v)}
            >
              {cutting ? "ביטול חיתוך" : "חיתוך סקשן"}
            </Btn>
          )}
        </div>
      )}

      {it.kind === "site" && view === "full" && cutting && it.full ? (
        <Cutter site={it} onDone={() => setCutting(false)} />
      ) : pic ? (
        <div
          className={`overflow-auto rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] ${view === "full" ? "max-h-[70vh]" : ""}`}
        >
          <img
            src={pic.url}
            alt=""
            className={`block w-full ${view === "mshot" ? "mx-auto max-w-[300px]" : ""}`}
          />
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[color:var(--focus-border)] p-4 text-center text-sm text-[color:var(--focus-muted)]">
          {isBusy(`${it.id}|${view}`) ? (
            <span className="flex items-center gap-2">
              <Camera className="size-4 animate-pulse" /> מצלם, זה לוקח עד דקה…
            </span>
          ) : it.url && canShoot() ? (
            <Btn icon={Camera} onClick={() => void shoot(it.id, it.url, view, true)}>
              {view === "full" ? "לצלם את כל הדף" : view === "mshot" ? "לצלם בטלפון" : "לצלם"}
            </Btn>
          ) : (
            "אין תמונה"
          )}
        </div>
      )}
      {it.kind === "site" && pic && !cutting && (
        <button
          className="mt-1 text-xs text-[color:var(--focus-muted)] underline"
          disabled={isBusy(`${it.id}|${view}`)}
          onClick={() => void shoot(it.id, it.url, view, true)}
        >
          {isBusy(`${it.id}|${view}`) ? "מצלם…" : "לצלם מחדש"}
        </button>
      )}
      {it.kind === "site" && view === "full" && it.full && !cutting && (
        <p className="mt-1 text-xs text-[color:var(--focus-muted)]">
          רוצים לשמור רק חלק מהדף? לוחצים "חיתוך סקשן" ומסמנים אותו.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(it.url || site?.url) && (
            <a href={it.url || site?.url} target="_blank" rel="noreferrer">
              <Btn size="sm" icon={ExternalLink}>
                פתיחת האתר
              </Btn>
            </a>
          )}
          <Btn
            size="sm"
            variant="primary"
            icon={Bot}
            onClick={() => void copy(inspoPrompt([it], db.inspo), "הועתק. להדביק ל-Claude")}
          >
            העתקה ל-Claude
          </Btn>
          <Btn size="sm" icon={Star} onClick={() => patch({ fav: !it.fav })}>
            {it.fav ? "במועדפים" : "למועדפים"}
          </Btn>
        </div>
        {site && (
          <button
            className="text-sm text-[color:var(--focus-primary)] underline"
            onClick={() => nav.go("inspo", site.id)}
          >
            מתוך: {site.title || hostOf(site.url)}
          </button>
        )}

        <div>
          <div className="mb-1 text-sm font-semibold">שם</div>
          <Input value={it.title} onChange={(e) => patch({ title: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">קטגוריה</div>
          <CatPicker value={it.category} onChange={(category) => patch({ category })} />
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">
            {it.kind === "site" ? "מה אהבתי" : "איזה סקשן"}
          </div>
          <PartsPicker
            list={it.kind === "site" ? SITE_PARTS : SECTION_TYPES}
            value={it.parts}
            onChange={(parts) => patch({ parts })}
          />
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">הערה</div>
          <Textarea
            value={it.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="מה בדיוק אהבתי…"
          />
        </div>
        {projects.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-semibold">
              <Link2 className="size-4" /> השראה לפרויקט
            </div>
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => {
                const on = (it.projectIds || []).includes(p.id);
                return (
                  <Chip
                    key={p.id}
                    small
                    on={on}
                    onClick={() =>
                      patch({
                        projectIds: on
                          ? (it.projectIds || []).filter((x) => x !== p.id)
                          : [...(it.projectIds || []), p.id],
                      })
                    }
                  >
                    {p.name}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}

        {sections.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">סקשנים מהאתר הזה</div>
            <div className="grid grid-cols-2 gap-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => nav.go("inspo", s.id)}
                  className="overflow-hidden rounded-lg border border-[color:var(--focus-border)] text-right"
                >
                  {s.img && (
                    <img src={s.img.url} alt="" className="h-24 w-full object-cover object-top" />
                  )}
                  <div className="truncate p-1.5 text-xs">{s.parts.join(", ") || "סקשן"}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[color:var(--focus-border)] pt-3">
          {confirmDel ? (
            <Btn
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => {
                actions.deleteInspo(it.id);
                onClose();
              }}
            >
              למחוק{sections.length ? ` (כולל ${sections.length} סקשנים)` : ""}?
            </Btn>
          ) : (
            <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDel(true)}>
              מחיקה
            </Btn>
          )}
        </div>
      </div>
    </Drawer>
  );
}

/** mark a band on the full-page picture and save it as a section */
function Cutter({ site, onDone }: { site: Inspo; onDone: () => void }) {
  const nav = useNav();
  const box = React.useRef<HTMLDivElement>(null);
  const img = React.useRef<HTMLImageElement>(null);
  const [a, setA] = React.useState<number | null>(null);
  const [b, setB] = React.useState<number | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [type, setType] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const y = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  };
  const top = a !== null && b !== null ? Math.min(a, b) : null;
  const bottom = a !== null && b !== null ? Math.max(a, b) : null;

  const save = async () => {
    if (top === null || bottom === null || bottom - top < 0.01 || !img.current) return;
    setSaving(true);
    try {
      // load a CORS-clean copy (the one on screen may not be allowed into a canvas)
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = site.full!.url + (site.full!.url.includes("?") ? "&" : "?") + "cut=1";
      await im.decode();
      const W = im.naturalWidth;
      const H = im.naturalHeight;
      const sy = Math.round(top * H);
      const sh = Math.max(20, Math.round((bottom - top) * H));
      const c = document.createElement("canvas");
      const k = Math.min(1, 1600 / W);
      c.width = Math.round(W * k);
      c.height = Math.round(sh * k);
      c.getContext("2d")!.drawImage(im, 0, sy, W, sh, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error("החיתוך נכשל");
      const id = uid();
      const j = await uploadInspoImg(`inspo-sec-${id}`, blob);
      const it = actions.addInspo({
        id,
        kind: "section",
        url: site.url,
        title: site.title,
        category: site.category,
        parts: type,
        note: "",
        siteId: site.id,
        img: { url: j.url, at: j.at },
      });
      toast.success("הסקשן נשמר");
      onDone();
      nav.go("inspo", it.id);
    } catch (e) {
      toast.error(
        /tainted|insecure|security/i.test(String(e))
          ? "הדפדפן לא מאפשר לחתוך את התמונה הזו. אפשר לצלם מסך ולהדביק כסקשן"
          : (e as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-sm text-[color:var(--focus-muted)]">
        גוררים על התמונה מתחילת הסקשן ועד סופו.
      </p>
      <div className="max-h-[60vh] overflow-auto rounded-xl border border-[color:var(--focus-border)]">
        <div
          ref={box}
          className="relative cursor-crosshair touch-none select-none"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setA(y(e));
            setB(y(e));
            setDrag(true);
          }}
          onPointerMove={(e) => drag && setB(y(e))}
          onPointerUp={() => setDrag(false)}
        >
          <img
            ref={img}
            src={site.full!.url}
            alt=""
            className="pointer-events-none block w-full"
            draggable={false}
          />
          {top !== null && bottom !== null && (
            <>
              <div
                className="absolute inset-x-0 top-0 bg-black/45"
                style={{ height: `${top * 100}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-black/45"
                style={{ height: `${(1 - bottom) * 100}%` }}
              />
              <div
                className="absolute inset-x-0 border-y-2"
                style={{
                  top: `${top * 100}%`,
                  height: `${(bottom - top) * 100}%`,
                  borderColor: C.primary,
                }}
              />
            </>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-sm font-semibold">איזה סקשן זה</div>
        <PartsPicker list={SECTION_TYPES} value={type} onChange={setType} />
      </div>
      <div className="mt-3 flex gap-2">
        <Btn
          variant="primary"
          icon={Scissors}
          disabled={saving || top === null || (bottom ?? 0) - (top ?? 0) < 0.01}
          onClick={() => void save()}
        >
          {saving ? "שומר…" : "שמירת הסקשן"}
        </Btn>
        <Btn variant="ghost" onClick={onDone}>
          ביטול
        </Btn>
      </div>
    </div>
  );
}

/* ---------------- in a project: the references picked for it ---------------- */
export function InspoForProject({ p }: { p: Project }) {
  const db = useDB();
  const nav = useNav();
  const items = db.inspo.filter((x) => (x.projectIds || []).includes(p.id));
  if (!items.length) return null;
  return (
    <Card className="mt-3 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="size-4" style={{ color: C.primary }} />
        <span className="font-semibold">השראה לפרויקט</span>
        <span className="text-sm text-[color:var(--focus-muted)]">{items.length}</span>
        <span className="flex-1" />
        <Btn
          size="sm"
          icon={Bot}
          onClick={() =>
            void copy(inspoPrompt(items, db.inspo, `אתר ל${p.name}`), "הועתק. להדביק ל-Claude")
          }
        >
          העתקה ל-Claude
        </Btn>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => nav.go("inspo", it.id)}
            className="w-36 flex-none overflow-hidden rounded-lg border border-[color:var(--focus-border)] text-right"
          >
            {imgOf(it) ? (
              <img src={imgOf(it)} alt="" className="h-20 w-full object-cover object-top" />
            ) : (
              <div className="h-20 bg-[var(--focus-bg2)]" />
            )}
            <div className="truncate p-1.5 text-xs">{it.title || hostOf(it.url)}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
