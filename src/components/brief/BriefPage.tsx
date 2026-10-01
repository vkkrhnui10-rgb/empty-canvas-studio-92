/* ============================================================
 * The client's website questionnaire (public page /b/<id>).
 * Seven short steps. Everything autosaves on this device;
 * files upload in the background while the client keeps going.
 * ============================================================ */
import * as React from "react";
import { cleanAnswers, emptyAnswers, GOALS, STYLES } from "@/components/focus/briefcore";
import type { BriefAnswers } from "@/components/focus/types";
import { preparePhoto, readLogo, uploadFile } from "./media";
import { BRIEF_CSS } from "./style";

interface UFile {
  key: string;
  name: string;
  kind: "logo" | "image" | "review";
  size: number;
  type: string;
  status: "up" | "done" | "err";
  prog: number;
  path?: string;
  thumb?: string;
  err?: string;
}
interface Saved {
  answers: BriefAnswers;
  files: UFile[];
  step: number;
  sent?: number;
  palette?: string[];
}
interface Info {
  client: string;
  business: string;
  owner: string;
  status: string;
  answers: BriefAnswers | null;
}

const STEPS = [
  { k: "intro", t: "", h: "" },
  { k: "biz", t: "העסק", h: "כמה מילים על מה שאתם עושים ולמי." },
  { k: "story", t: "אודות", h: "זה הבסיס לעמוד האודות. כתבו חופשי, אנחנו נלטש את הניסוח." },
  { k: "services", t: "שירותים", h: "מה אפשר לקנות או להזמין מכם. שם קצר ומשפט הסבר מספיקים." },
  { k: "look", t: "מראה", h: "אם יש לוגו, נשאב ממנו את הצבעים של האתר." },
  {
    k: "inspo",
    t: "אתרים שאהבתם",
    h: "גם של עסקים מתחומים אחרים. זה עוזר לנו להבין מה מתאים לכם.",
  },
  { k: "photos", t: "תמונות", h: "של העסק, העבודות, הצוות. אנחנו נבחר ונעבד אותן." },
  {
    k: "reviews",
    t: "המלצות",
    h: "מה לקוחות אומרים עליכם. המלצות אמיתיות מגדילות אמון, וזה אחד הדברים שהכי משפיעים באתר.",
  },
  { k: "contact", t: "פרטי התקשרות", h: "מה יופיע באתר כדי שלקוחות יוכלו לפנות אליכם." },
] as const;
const LAST = STEPS.length - 1;

const keyOf = (id: string) => `focus-brief-${id}`;
const rid = () => Math.random().toString(36).slice(2, 10);
const first = (s: string) => s.trim().split(/\s+/)[0] || "";

function load(id: string): Saved | null {
  try {
    const raw = localStorage.getItem(keyOf(id));
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return {
      ...s,
      answers: cleanAnswers(s.answers),
      files: (s.files || []).filter((f) => f.status === "done"),
    };
  } catch {
    return null;
  }
}

export default function BriefPage({ id }: { id: string }) {
  const [info, setInfo] = React.useState<Info | null>(null);
  const [fail, setFail] = React.useState<"" | "missing" | "net">("");
  const [a, setA] = React.useState<BriefAnswers>(emptyAnswers);
  const [files, setFiles] = React.useState<UFile[]>([]);
  const [palette, setPalette] = React.useState<string[]>([]);
  const [step, setStep] = React.useState(0);
  const [sent, setSent] = React.useState<number | undefined>();
  const [sending, setSending] = React.useState(false);
  const [sendErr, setSendErr] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const raw = React.useRef(new Map<string, Blob>());

  const fetchInfo = React.useCallback(() => {
    setFail("");
    fetch(`/api/brief?b=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) return setFail("missing");
        if (!r.ok) throw new Error();
        const j = (await r.json()) as Info;
        setInfo(j);
        const s = load(id);
        if (s) {
          setA(s.answers);
          setFiles(s.files);
          setStep(Math.min(s.step || 0, LAST));
          setSent(s.sent);
          setPalette(s.palette || []);
        } else {
          const base = j.answers ? cleanAnswers(j.answers) : emptyAnswers();
          if (!base.business) base.business = j.business || "";
          if (!base.contactName) base.contactName = j.client || "";
          setA(base);
          if (j.status === "done") setSent(Date.now());
        }
        setReady(true);
      })
      .catch(() => setFail("net"));
  }, [id]);
  React.useEffect(fetchInfo, [fetchInfo]);

  // autosave on this device
  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        const s: Saved = {
          answers: a,
          files: files.filter((f) => f.status === "done"),
          step,
          sent,
          palette,
        };
        localStorage.setItem(keyOf(id), JSON.stringify(s));
      } catch {
        /* storage full or blocked — the page still works */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [a, files, step, sent, palette, ready, id]);

  const set = <K extends keyof BriefAnswers>(k: K, v: BriefAnswers[K]) =>
    setA((x) => ({ ...x, [k]: v }));
  const patchFile = (key: string, p: Partial<UFile>) =>
    setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));

  /* ---------- uploads ---------- */
  const startUpload = async (f: UFile, blob: Blob) => {
    patchFile(f.key, { status: "up", prog: 0, err: undefined });
    try {
      const path = await uploadFile(id, f.kind, f.name, blob, (p) => patchFile(f.key, { prog: p }));
      patchFile(f.key, { status: "done", prog: 1, path });
    } catch (e) {
      patchFile(f.key, { status: "err", err: (e as Error).message });
    }
  };

  const addLogo = async (file: File) => {
    const { thumb, palette: pal } = await readLogo(file);
    const f: UFile = {
      key: rid(),
      name: file.name,
      kind: "logo",
      size: file.size,
      type: file.type,
      status: "up",
      prog: 0,
      thumb,
    };
    raw.current.set(f.key, file);
    setFiles((fs) => [...fs.filter((x) => x.kind !== "logo"), f]);
    setPalette(pal);
    if (pal.length) setA((x) => (x.colorMode === "logo" ? { ...x, colors: pal } : x));
    void startUpload(f, file);
  };

  const addPhotos = async (list: File[], kind: "image" | "review" = "image") => {
    const queue: [UFile, Blob][] = [];
    for (const file of list.slice(0, 60)) {
      const p = await preparePhoto(file);
      const f: UFile = {
        key: rid(),
        name: p.name,
        kind,
        size: p.blob.size,
        type: p.type,
        status: "up",
        prog: 0,
        thumb: p.thumb,
      };
      raw.current.set(f.key, p.blob);
      setFiles((fs) => [...fs, f]);
      queue.push([f, p.blob]);
    }
    if (kind === "image") set("noPhotos", false);
    let i = 0; // three uploads at a time
    const worker = async () => {
      while (i < queue.length) {
        const [f, b] = queue[i++];
        await startUpload(f, b);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  const retry = (f: UFile) => {
    const b = raw.current.get(f.key);
    if (b) void startUpload(f, b);
  };
  const removeFile = (key: string) => setFiles((fs) => fs.filter((f) => f.key !== key));

  /* ---------- navigation ---------- */
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(LAST, n)));
    window.scrollTo({ top: 0 });
  };
  const uploading = files.filter((f) => f.status === "up").length;

  const submit = async () => {
    setSendErr("");
    setSending(true);
    try {
      const r = await fetch(`/api/brief?b=${encodeURIComponent(id)}&op=submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: a,
          files: files
            .filter((f) => f.status === "done" && f.path)
            .map((f) => ({ path: f.path, name: f.name, kind: f.kind, size: f.size, type: f.type })),
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "השליחה נכשלה");
      setSent(Date.now());
      window.scrollTo({ top: 0 });
    } catch (e) {
      const m = (e as Error).message;
      setSendErr(m === "Failed to fetch" ? "אין חיבור לאינטרנט. נסו שוב." : m);
    } finally {
      setSending(false);
    }
  };

  const logo = files.find((f) => f.kind === "logo");
  const photos = files.filter((f) => f.kind === "image");
  const shots = files.filter((f) => f.kind === "review");
  const owner = info?.owner?.trim() || "";
  const title = a.business.trim() || info?.business || "";

  /* ---------- status screens ---------- */
  if (fail || !ready || !info)
    return (
      <div className="bf">
        <style>{BRIEF_CSS}</style>
        <div className="bf-center">
          {fail && (
            <img
              className="bf-err-mascot"
              src="/brief/rimon.webp"
              alt=""
              width={520}
              height={667}
            />
          )}
          {fail === "missing" ? (
            <>
              <h1 className="bf-h2">הקישור הזה כבר לא פעיל</h1>
              <p className="bf-small">בקשו קישור חדש ממי ששלח לכם אותו.</p>
            </>
          ) : fail === "net" ? (
            <>
              <h1 className="bf-h2">השאלון לא נטען</h1>
              <p className="bf-small" style={{ marginBottom: 20 }}>
                בדקו את החיבור לאינטרנט ונסו שוב.
              </p>
              <button className="bf-btn" onClick={fetchInfo}>
                נסו שוב
              </button>
            </>
          ) : (
            <div className="bf-spin" aria-label="טוען" />
          )}
        </div>
      </div>
    );

  if (sent)
    return (
      <div className="bf">
        <style>{BRIEF_CSS}</style>
        <main className="bf-main bf-step">
          <div className="bf-done-top">
            <img
              className="bf-done-mascot"
              src="/brief/rimon-sit.webp"
              alt=""
              width={520}
              height={646}
            />
            <span className="bf-done-ic" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M5 12.5l4.2 4.2L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <h1 className="bf-h1">
            תודה{first(a.contactName) ? ` ${first(a.contactName)}` : ""}, קיבלנו את התשובות
          </h1>
          <p className="bf-lead">
            {owner ? `${owner} יעבור עליהן ויחזור` : "נעבור עליהן ונחזור"} אליכם עם כיוון ראשון
            לאתר.
          </p>
          <div className="bf-sum">
            <span>
              שירותים: <b>{a.services.filter((s) => s.name.trim()).length || "—"}</b>
            </span>
            <span>
              לוגו: <b>{logo ? "הועלה" : "—"}</b>
            </span>
            <span>
              המלצות:{" "}
              <b>{a.testimonials.filter((t) => t.text.trim()).length + shots.length || "—"}</b>
            </span>
            <span>
              תמונות: <b>{photos.length || (a.noPhotos ? "נשתמש בתמונות מקצועיות" : "—")}</b>
            </span>
          </div>
          <p className="bf-small" style={{ marginTop: 24 }}>
            שכחתם משהו?{" "}
            <button className="bf-link" onClick={() => setSent(undefined)}>
              עדכון התשובות
            </button>
          </p>
        </main>
      </div>
    );

  /* ---------- the form ---------- */
  const S = STEPS[step];
  return (
    <div className="bf">
      <style>{BRIEF_CSS}</style>
      <header className="bf-top">
        <div className="bf-top-in">
          <span className="bf-brand">{title || "שאלון לבניית אתר"}</span>
          {step > 0 && (
            <span className="bf-count">
              שלב {step} מתוך {LAST}
            </span>
          )}
        </div>
        {step > 0 && (
          <div className="bf-bar" aria-hidden>
            <i style={{ width: `${(step / LAST) * 100}%` }} />
          </div>
        )}
      </header>

      <main className="bf-main">
        <div className="bf-step" key={step}>
          {step === 0 ? (
            <>
              <section className="bf-hero">
                <h1 className="bf-h1">כמה שאלות לפני שמתחילים לבנות את האתר</h1>
                <div className="bf-bubble">
                  {first(a.contactName) ? `היי ${first(a.contactName)}! ` : "היי! "}
                  כאן {owner || "הלל רימון"}. מהתשובות שלכם נכתוב את הטקסטים, נבחר צבעים ונעצב את
                  האתר.
                </div>
                <p className="bf-hero-p">
                  לא צריך לנסח מושלם. כתבו כמו שהייתם מסבירים לחבר, ואנחנו נלטש. אפשר לדלג על כל
                  שאלה.
                </p>
                <div className="bf-intro-meta">
                  <span>{LAST} שלבים קצרים</span>
                  <span>בערך 5 דקות</span>
                  <span>נשמר אוטומטית</span>
                </div>
                <img
                  className="bf-mascot"
                  src="/brief/rimon-hello.webp"
                  alt=""
                  width={520}
                  height={621}
                />
              </section>
            </>
          ) : (
            <>
              <h2 className="bf-h2">{S.t}</h2>
              <p className="bf-hint">{S.h}</p>
              {S.k === "contact" && (
                <div className="bf-cheer">
                  <img src="/brief/rimon-point.webp" alt="" width={520} height={678} />
                  <span className="bf-bubble">כמעט סיימנו! עוד כמה פרטים ושולחים.</span>
                </div>
              )}
              <div className="bf-card">
                {S.k === "biz" && (
                  <>
                    <Q label="שם העסק">
                      <input
                        className="bf-in"
                        value={a.business}
                        onChange={(e) => set("business", e.target.value)}
                        placeholder="למשל: גני השרון"
                      />
                    </Q>
                    <Q label="השם שלכם" optional>
                      <input
                        className="bf-in"
                        value={a.contactName}
                        onChange={(e) => set("contactName", e.target.value)}
                      />
                    </Q>
                    <Q label="מה אתם עושים, במשפט אחד" hint="זה יכול להפוך לכותרת הראשית של האתר">
                      <input
                        className="bf-in"
                        value={a.tagline}
                        onChange={(e) => set("tagline", e.target.value)}
                        placeholder="למשל: גינות מעוצבות לבתים פרטיים בשרון"
                      />
                    </Q>
                    <Q label="מי הלקוחות שלכם?">
                      <input
                        className="bf-in"
                        value={a.audience}
                        onChange={(e) => set("audience", e.target.value)}
                        placeholder="למשל: משפחות צעירות, עסקים קטנים"
                      />
                    </Q>
                    <Q label="מה האתר צריך לעשות בשבילכם?" hint="אפשר לבחור כמה">
                      <Options options={GOALS} value={a.goals} onChange={(v) => set("goals", v)} />
                    </Q>
                  </>
                )}

                {S.k === "story" && (
                  <>
                    <Q
                      label="ספרו על העסק"
                      hint="איך התחלתם, כמה זמן אתם בתחום, מה אתם אוהבים בעבודה"
                    >
                      <Area value={a.about} onChange={(v) => set("about", v)} rows={7} />
                    </Q>
                    <Q label="מה מייחד אתכם מאחרים בתחום?">
                      <Area
                        value={a.unique}
                        onChange={(v) => set("unique", v)}
                        rows={3}
                        placeholder="למשל: זמינות, אחריות, יחס אישי"
                      />
                    </Q>
                  </>
                )}

                {S.k === "services" && (
                  <>
                    <div className="bf-group">
                      {a.services.map((s, i) => (
                        <div className="bf-item" key={i}>
                          <input
                            className="bf-in"
                            value={s.name}
                            placeholder="שם השירות"
                            aria-label={`שירות ${i + 1}`}
                            onChange={(e) =>
                              set(
                                "services",
                                a.services.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <Area
                            value={s.desc}
                            rows={2}
                            placeholder="מה זה כולל, למי זה מתאים"
                            onChange={(v) =>
                              set(
                                "services",
                                a.services.map((x, j) => (j === i ? { ...x, desc: v } : x)),
                              )
                            }
                          />
                          {a.services.length > 1 && (
                            <button
                              className="bf-x"
                              aria-label="הסרת השירות"
                              onClick={() =>
                                set(
                                  "services",
                                  a.services.filter((_, j) => j !== i),
                                )
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {a.services.length < 30 && (
                      <button
                        className="bf-add"
                        onClick={() => set("services", [...a.services, { name: "", desc: "" }])}
                      >
                        הוספת שירות
                      </button>
                    )}
                  </>
                )}

                {S.k === "look" && (
                  <>
                    <Q label="לוגו" optional>
                      {logo ? (
                        <div className="bf-logo">
                          <div className="bf-logo-img">
                            {logo.thumb ? <img src={logo.thumb} alt="הלוגו" /> : null}
                          </div>
                          <div className="bf-logo-side">
                            <span className="bf-logo-name">{logo.name}</span>
                            <FileState f={logo} onRetry={() => retry(logo)} />
                            <label className="bf-link">
                              החלפה
                              <input
                                type="file"
                                hidden
                                accept="image/*,.svg,.pdf,.ai,.eps"
                                onChange={(e) => e.target.files?.[0] && addLogo(e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <Drop
                          accept="image/*,.svg,.pdf,.ai,.eps"
                          onFiles={(f) => f[0] && addLogo(f[0])}
                          title="העלאת לוגו"
                          sub="PNG, SVG, JPG או PDF. עדיף הקובץ המקורי מהמעצב"
                        />
                      )}
                    </Q>

                    <Q label="צבעים">
                      <div className="bf-seg" role="radiogroup" aria-label="צבעים">
                        {(
                          [
                            ["logo", "מהלוגו"],
                            ["custom", "אבחר בעצמי"],
                            ["you", "תבחרו אתם"],
                          ] as const
                        ).map(([v, l]) => (
                          <button
                            key={v}
                            role="radio"
                            aria-checked={a.colorMode === v}
                            className={a.colorMode === v ? "on" : ""}
                            onClick={() =>
                              setA((x) => ({
                                ...x,
                                colorMode: v,
                                colors:
                                  v === "logo"
                                    ? palette
                                    : v === "custom"
                                      ? x.colors.length
                                        ? x.colors
                                        : palette
                                      : x.colors,
                              }))
                            }
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      {a.colorMode === "logo" &&
                        (palette.length ? (
                          <>
                            <div className="bf-sws">
                              {palette.map((c) => {
                                const on = a.colors.includes(c);
                                return (
                                  <button
                                    key={c}
                                    className="bf-sw"
                                    aria-pressed={on}
                                    onClick={() =>
                                      set(
                                        "colors",
                                        on ? a.colors.filter((x) => x !== c) : [...a.colors, c],
                                      )
                                    }
                                  >
                                    <span className="bf-sw-c" style={{ background: c }} />
                                    <span dir="ltr">{c}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="bf-small">
                              הצבעים שמצאנו בלוגו. לחיצה על צבע מוציאה אותו.
                            </p>
                          </>
                        ) : (
                          <p className="bf-small">
                            {logo
                              ? "לא הצלחנו לקרוא צבעים מהקובץ הזה. אפשר לבחור בעצמכם או להשאיר לנו."
                              : "אחרי שתעלו לוגו, הצבעים שלו יופיעו כאן."}
                          </p>
                        ))}
                      {a.colorMode === "custom" && (
                        <div className="bf-sws">
                          {a.colors.map((c, i) => (
                            <div key={i} className="bf-sw">
                              <label className="bf-sw-c" style={{ background: c }}>
                                <input
                                  type="color"
                                  value={c}
                                  aria-label={`צבע ${i + 1}`}
                                  onChange={(e) =>
                                    set(
                                      "colors",
                                      a.colors.map((x, j) => (j === i ? e.target.value : x)),
                                    )
                                  }
                                />
                              </label>
                              <button
                                className="bf-sw-x"
                                onClick={() =>
                                  set(
                                    "colors",
                                    a.colors.filter((_, j) => j !== i),
                                  )
                                }
                              >
                                הסרה
                              </button>
                            </div>
                          ))}
                          {a.colors.length < 6 && (
                            <button
                              className="bf-sw-add"
                              aria-label="הוספת צבע"
                              onClick={() => set("colors", [...a.colors, "#3a5bd9"])}
                            >
                              +
                            </button>
                          )}
                        </div>
                      )}
                      {a.colorMode === "you" && (
                        <p className="bf-small">נציע לכם צבעים שמתאימים לתחום ולסגנון.</p>
                      )}
                    </Q>

                    <Q label="איזה סגנון מתאים לכם?" hint="עד 3">
                      <div className="bf-styles">
                        {STYLES.map((s) => {
                          const on = a.styles.includes(s.v);
                          return (
                            <button
                              key={s.v}
                              className={`bf-style ${on ? "on" : ""}`}
                              aria-pressed={on}
                              onClick={() =>
                                set(
                                  "styles",
                                  on
                                    ? a.styles.filter((x) => x !== s.v)
                                    : [...a.styles, s.v].slice(-3),
                                )
                              }
                            >
                              <span className="bf-style-sw" aria-hidden>
                                {s.sw.map((c) => (
                                  <i key={c} style={{ background: c }} />
                                ))}
                              </span>
                              <span>
                                <b>{s.v}</b>
                                <small>{s.d}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </Q>
                    <Q label="עוד משהו על המראה?" optional>
                      <input
                        className="bf-in"
                        value={a.styleNote}
                        onChange={(e) => set("styleNote", e.target.value)}
                        placeholder="למשל: לא אוהב ורוד, רוצה שירגיש כמו בוטיק"
                      />
                    </Q>
                  </>
                )}

                {S.k === "inspo" && (
                  <>
                    <div className="bf-group">
                      {a.sites.map((s, i) => (
                        <div className="bf-item" key={i}>
                          <input
                            className="bf-in"
                            dir="ltr"
                            inputMode="url"
                            value={s.url}
                            placeholder="www.example.co.il"
                            aria-label={`אתר ${i + 1}`}
                            onChange={(e) =>
                              set(
                                "sites",
                                a.sites.map((x, j) =>
                                  j === i ? { ...x, url: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <input
                            className="bf-in"
                            value={s.note}
                            placeholder="מה אהבתם בו?"
                            onChange={(e) =>
                              set(
                                "sites",
                                a.sites.map((x, j) =>
                                  j === i ? { ...x, note: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          {a.sites.length > 1 && (
                            <button
                              className="bf-x"
                              aria-label="הסרת האתר"
                              onClick={() =>
                                set(
                                  "sites",
                                  a.sites.filter((_, j) => j !== i),
                                )
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {a.sites.length < 6 && (
                      <button
                        className="bf-add"
                        onClick={() => set("sites", [...a.sites, { url: "", note: "" }])}
                      >
                        הוספת אתר
                      </button>
                    )}
                    <Q label="משהו שאתם בטוח לא רוצים?" optional>
                      <input
                        className="bf-in"
                        value={a.avoid}
                        onChange={(e) => set("avoid", e.target.value)}
                        placeholder="למשל: אתר עמוס, צבעים כהים"
                      />
                    </Q>
                  </>
                )}

                {S.k === "photos" && (
                  <>
                    <Drop
                      multiple
                      accept="image/*"
                      onFiles={addPhotos}
                      title="העלאת תמונות"
                      sub="אפשר לבחור כמה בבת אחת. התמונות מוקטנות אוטומטית"
                    />
                    <Thumbs list={photos} retry={retry} remove={removeFile} />
                    <label className="bf-check-row">
                      <input
                        type="checkbox"
                        checked={a.noPhotos}
                        onChange={(e) => set("noPhotos", e.target.checked)}
                      />
                      <span>אין לי תמונות כרגע. תשתמשו בתמונות מקצועיות שמתאימות לתחום.</span>
                    </label>
                    <Q label="קישור לתיקייה בדרייב או בגוגל תמונות" optional>
                      <input
                        className="bf-in"
                        dir="ltr"
                        inputMode="url"
                        value={a.photosLink}
                        onChange={(e) => set("photosLink", e.target.value)}
                        placeholder="https://"
                      />
                    </Q>
                  </>
                )}

                {S.k === "reviews" && (
                  <>
                    <div className="bf-group">
                      {a.testimonials.map((t, i) => (
                        <div className="bf-item" key={i}>
                          <Area
                            value={t.text}
                            rows={3}
                            placeholder="מה הלקוח אמר עליכם"
                            onChange={(v) =>
                              set(
                                "testimonials",
                                a.testimonials.map((x, j) => (j === i ? { ...x, text: v } : x)),
                              )
                            }
                          />
                          <input
                            className="bf-in"
                            value={t.name}
                            placeholder="שם הלקוח ותפקיד, אם רוצים (למשל: דנה, בעלת סטודיו)"
                            onChange={(e) =>
                              set(
                                "testimonials",
                                a.testimonials.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          {a.testimonials.length > 1 && (
                            <button
                              className="bf-x"
                              aria-label="הסרת ההמלצה"
                              onClick={() =>
                                set(
                                  "testimonials",
                                  a.testimonials.filter((_, j) => j !== i),
                                )
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {a.testimonials.length < 30 && (
                      <button
                        className="bf-add"
                        onClick={() =>
                          set("testimonials", [...a.testimonials, { name: "", text: "" }])
                        }
                      >
                        הוספת המלצה
                      </button>
                    )}
                    <Q
                      label="או צילומי מסך של המלצות"
                      hint="מוואטסאפ, גוגל, פייסבוק או מייל. אנחנו נעתיק את הטקסט"
                      optional
                    >
                      <Drop
                        multiple
                        accept="image/*"
                        onFiles={(f) => addPhotos(f, "review")}
                        title="העלאת צילומי מסך"
                        sub="אפשר כמה בבת אחת"
                      />
                      <Thumbs list={shots} retry={retry} remove={removeFile} />
                    </Q>
                  </>
                )}

                {S.k === "contact" && (
                  <>
                    <div className="bf-two">
                      <Q label="טלפון">
                        <input
                          className="bf-in"
                          dir="ltr"
                          type="tel"
                          value={a.phone}
                          onChange={(e) => set("phone", e.target.value)}
                        />
                      </Q>
                      <Q label="וואטסאפ" optional="אם שונה">
                        <input
                          className="bf-in"
                          dir="ltr"
                          type="tel"
                          value={a.whatsapp}
                          onChange={(e) => set("whatsapp", e.target.value)}
                        />
                      </Q>
                      <Q label="מייל">
                        <input
                          className="bf-in"
                          dir="ltr"
                          type="email"
                          value={a.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                      </Q>
                      <Q label="כתובת" optional>
                        <input
                          className="bf-in"
                          value={a.address}
                          onChange={(e) => set("address", e.target.value)}
                        />
                      </Q>
                    </div>
                    <Q label="שעות פעילות" optional>
                      <input
                        className="bf-in"
                        value={a.hours}
                        onChange={(e) => set("hours", e.target.value)}
                        placeholder="א׳–ה׳ 9:00–18:00"
                      />
                    </Q>
                    <Q label="רשתות חברתיות" hint="קישורים או שמות עמודים">
                      <Area value={a.social} onChange={(v) => set("social", v)} rows={2} />
                    </Q>
                    <Q label="דומיין קיים" hint="אם אין, נעזור לבחור">
                      <input
                        className="bf-in"
                        dir="ltr"
                        value={a.domain}
                        onChange={(e) => set("domain", e.target.value)}
                        placeholder="www.example.co.il"
                      />
                    </Q>
                    <Q label="עוד משהו שחשוב שנדע?" optional>
                      <Area
                        value={a.notes}
                        onChange={(v) => set("notes", v)}
                        rows={3}
                        placeholder="תאריך יעד, עמודים מיוחדים, מבצעים"
                      />
                    </Q>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <nav className="bf-nav">
          {step < LAST ? (
            <button className="bf-btn" onClick={() => go(step + 1)}>
              {step === 0 ? "התחלה" : "המשך"}
            </button>
          ) : (
            <button className="bf-btn" disabled={sending || uploading > 0} onClick={submit}>
              {uploading > 0 ? `מעלה ${uploading} קבצים…` : sending ? "שולח…" : "שליחת התשובות"}
            </button>
          )}
          {step > 0 && (
            <button className="bf-back" onClick={() => go(step - 1)}>
              חזרה
            </button>
          )}
        </nav>
        {sendErr && <p className="bf-err">{sendErr}</p>}
      </main>
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function Thumbs({
  list,
  retry,
  remove,
}: {
  list: UFile[];
  retry: (f: UFile) => void;
  remove: (key: string) => void;
}) {
  if (!list.length) return null;
  return (
    <div className="bf-thumbs">
      {list.map((f) => (
        <div key={f.key} className={`bf-thumb ${f.status}`}>
          {f.thumb ? <img src={f.thumb} alt="" /> : <span className="bf-thumb-n">{f.name}</span>}
          {f.status === "up" && (
            <span className="bf-thumb-bar">
              <i style={{ width: `${Math.round(f.prog * 100)}%` }} />
            </span>
          )}
          {f.status === "err" && (
            <button className="bf-thumb-err" onClick={() => retry(f)}>
              נכשל, לנסות שוב
            </button>
          )}
          <button className="bf-x" aria-label="הסרה" onClick={() => remove(f.key)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function Q({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean | string;
  children: React.ReactNode;
}) {
  return (
    <div className="bf-q">
      <label className="bf-q-l">
        {label}
        {optional && <em>{typeof optional === "string" ? optional : "לא חובה"}</em>}
        {hint && <small>{hint}</small>}
      </label>
      {children}
    </div>
  );
}

function Area({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="bf-in bf-area"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Options({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="bf-opts">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            className={`bf-opt ${on ? "on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            <span className="bx" aria-hidden />
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Drop({
  onFiles,
  accept,
  multiple,
  title,
  sub,
}: {
  onFiles: (f: File[]) => void;
  accept: string;
  multiple?: boolean;
  title: string;
  sub: string;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <label
      className={`bf-drop ${over ? "over" : ""}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path
          d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <b>{title}</b>
      <span>{sub}</span>
      <input
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FileState({ f, onRetry }: { f: UFile; onRetry: () => void }) {
  if (f.status === "up") return <span className="bf-small">מעלה… {Math.round(f.prog * 100)}%</span>;
  if (f.status === "err")
    return (
      <button className="bf-link bf-err" onClick={onRetry}>
        ההעלאה נכשלה. לנסות שוב
      </button>
    );
  return <span className="bf-small bf-ok">הועלה</span>;
}
