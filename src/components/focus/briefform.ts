/* ============================================================
 * The questionnaire's shape, editable by the owner.
 * Built-in steps and questions can be hidden, renamed and have
 * their choices changed; the owner can add questions of their own.
 * Pure — shared by the client page, the server and the editor.
 * ============================================================ */
import { ACTIONS, DEADLINES, FEATURES, HIGHLIGHTS, PAGES, TONES } from "./briefcore";

export type StepKey =
  "biz" | "site" | "story" | "services" | "look" | "inspo" | "photos" | "reviews" | "contact";

export const STEP_DEFS: { k: StepKey; t: string; h: string }[] = [
  { k: "biz", t: "העסק", h: "כמה מילים על מה שאתם עושים ולמי." },
  { k: "site", t: "האתר", h: "מה האתר צריך לעשות בשבילכם. מסמנים בלחיצה." },
  { k: "story", t: "אודות", h: "הבסיס לעמוד האודות. כתבו או הקליטו חופשי, אנחנו נלטש." },
  {
    k: "services",
    t: "שירותים",
    h: "מה אפשר לקנות או להזמין מכם. שם קצר ומשפט הסבר מספיקים.",
  },
  { k: "look", t: "מראה", h: "אם יש לוגו, נשאב ממנו את הצבעים של האתר." },
  { k: "inspo", t: "השראה", h: "אתרים שאהבתם, גם מתחומים אחרים, ומה בטוח לא." },
  { k: "photos", t: "תמונות", h: "של העסק, העבודות, הצוות. אנחנו נבחר ונעבד אותן." },
  {
    k: "reviews",
    t: "המלצות",
    h: "מה לקוחות אומרים עליכם. המלצות אמיתיות הן אחד הדברים שהכי משפיעים באתר.",
  },
  { k: "contact", t: "פרטי התקשרות", h: "מה יופיע באתר כדי שלקוחות יוכלו לפנות אליכם." },
];

export interface FieldDef {
  k: string;
  step: StepKey;
  label: string;
  hint?: string;
  /** editable list of choices */
  options?: string[];
  /** can be renamed but not hidden */
  locked?: boolean;
}

/** the built-in questions, in the order they appear */
export const FIELD_DEFS: FieldDef[] = [
  { k: "business", step: "biz", label: "שם העסק", locked: true },
  { k: "contactName", step: "biz", label: "השם שלכם" },
  { k: "industry", step: "biz", label: "תחום" },
  {
    k: "tagline",
    step: "biz",
    label: "מה אתם עושים, במשפט אחד",
    hint: "זה יכול להפוך לכותרת הראשית של האתר",
  },
  { k: "audience", step: "biz", label: "מי הלקוחות שלכם?" },
  {
    k: "area",
    step: "biz",
    label: "איפה אתם נותנים שירות?",
    hint: "עוזר להופיע בגוגל כשמחפשים באזור",
  },

  {
    k: "mainAction",
    step: "site",
    label: "מה הכי חשוב שגולש יעשה באתר?",
    hint: "בחרו אחד. סביבו נבנה את האתר",
    options: ACTIONS,
  },
  {
    k: "pages",
    step: "site",
    label: "אילו עמודים צריך?",
    hint: "סימנו את הבסיס, שנו כרצונכם",
    options: PAGES,
  },
  { k: "features", step: "site", label: "משהו מזה יעזור לכם?", options: FEATURES },
  { k: "currentSite", step: "site", label: "יש לכם היום אתר?" },
  { k: "deadline", step: "site", label: "מתי תרצו שהאתר יעלה?", options: DEADLINES },

  {
    k: "about",
    step: "story",
    label: "ספרו על העסק",
    hint: "איך התחלתם, למה דווקא זה, מה אתם אוהבים בעבודה",
  },
  { k: "years", step: "story", label: "כמה שנים אתם בתחום?" },
  {
    k: "highlights",
    step: "story",
    label: "במה אתם חזקים?",
    hint: "אפשר לבחור כמה",
    options: HIGHLIGHTS,
  },
  { k: "unique", step: "story", label: "ומה באמת מייחד אתכם?" },
  {
    k: "stats",
    step: "story",
    label: "מספרים שאפשר להתגאות בהם",
    hint: "יופיעו בגדול באתר",
  },

  { k: "services", step: "services", label: "רשימת השירותים" },
  {
    k: "faq",
    step: "services",
    label: "שאלות שלקוחות שואלים אתכם הרבה",
    hint: "נהפוך אותן לשאלות נפוצות באתר. אפשר בלי תשובה, נשלים יחד",
  },

  { k: "logo", step: "look", label: "לוגו" },
  { k: "colors", step: "look", label: "צבעים" },
  {
    k: "tone",
    step: "look",
    label: "איך האתר ידבר עם הלקוחות?",
    options: TONES.map((t) => t.v),
  },
  { k: "styleNote", step: "look", label: "עוד משהו על המראה?" },

  { k: "sites", step: "inspo", label: "אתרים שאהבתם" },
  {
    k: "competitors",
    step: "inspo",
    label: "מתחרים שכדאי שנכיר",
    hint: "שם או אתר. נדאג שתיראו טוב יותר",
  },
  { k: "avoid", step: "inspo", label: "משהו שאתם בטוח לא רוצים?" },

  { k: "photos", step: "photos", label: "העלאת תמונות" },
  { k: "photosLink", step: "photos", label: "קישור לגוגל תמונות או לכל מקום אחר" },

  { k: "testimonials", step: "reviews", label: "המלצות בכתב" },
  {
    k: "reviewShots",
    step: "reviews",
    label: "או צילומי מסך של המלצות",
    hint: "מוואטסאפ, גוגל, פייסבוק או מייל. אנחנו נעתיק את הטקסט",
  },
  { k: "reviewsLink", step: "reviews", label: "קישור לביקורות שלכם בגוגל או בפייסבוק" },

  { k: "phone", step: "contact", label: "טלפון" },
  { k: "email", step: "contact", label: "מייל" },
  { k: "whatsapp", step: "contact", label: "וואטסאפ" },
  { k: "address", step: "contact", label: "כתובת" },
  { k: "hours", step: "contact", label: "שעות פעילות" },
  { k: "social", step: "contact", label: "רשתות חברתיות", hint: "קישורים או שמות משתמש" },
  { k: "domain", step: "contact", label: "דומיין (כתובת האתר)" },
  { k: "notes", step: "contact", label: "עוד משהו שחשוב שנדע?" },
];

export type CustomType = "text" | "long" | "single" | "multi" | "yesno";
export const CUSTOM_TYPES: Record<CustomType, string> = {
  text: "תשובה קצרה",
  long: "תשובה ארוכה",
  single: "בחירה אחת",
  multi: "בחירה מרובה",
  yesno: "כן / לא",
};

export interface CustomQ {
  id: string;
  step: StepKey;
  type: CustomType;
  label: string;
  hint?: string;
  options?: string[];
}

export interface BriefForm {
  /** the greeting in the intro bubble */
  intro?: string;
  steps?: Partial<Record<StepKey, { off?: boolean; title?: string; hint?: string }>>;
  fields?: Record<string, { off?: boolean; label?: string; hint?: string; options?: string[] }>;
  custom?: CustomQ[];
}

export const DEFAULT_INTRO = "מהתשובות שלכם נכתוב את הטקסטים, נבחר צבעים ונעצב את האתר.";

/* ---------------- reading the form ---------------- */
export interface ResolvedForm {
  intro: string;
  steps: { k: StepKey; t: string; h: string }[];
  on: (k: string) => boolean;
  label: (k: string) => string;
  hint: (k: string) => string | undefined;
  options: (k: string) => string[];
  custom: (step: StepKey) => CustomQ[];
}

const DEF = new Map(FIELD_DEFS.map((f) => [f.k, f]));

export function resolveForm(f?: BriefForm | null): ResolvedForm {
  const form = f || {};
  const fields = form.fields || {};
  const custom = (form.custom || []).filter((q) => q.label.trim());
  const stepOn = (k: StepKey) => !form.steps?.[k]?.off;
  const steps = STEP_DEFS.filter((s) => stepOn(s.k)).map((s) => ({
    k: s.k,
    t: form.steps?.[s.k]?.title?.trim() || s.t,
    h: form.steps?.[s.k]?.hint?.trim() || s.h,
  }));
  return {
    intro: form.intro?.trim() || DEFAULT_INTRO,
    steps,
    on: (k) => {
      const d = DEF.get(k);
      if (!d) return false;
      return stepOn(d.step) && (d.locked || !fields[k]?.off);
    },
    label: (k) => fields[k]?.label?.trim() || DEF.get(k)?.label || k,
    hint: (k) => fields[k]?.hint?.trim() || DEF.get(k)?.hint,
    options: (k) => {
      const o = fields[k]?.options;
      return o && o.length ? o : DEF.get(k)?.options || [];
    },
    custom: (step) => (stepOn(step) ? custom.filter((q) => q.step === step) : []),
  };
}

/** keep only known shapes (the form travels through the public API) */
export function cleanForm(raw: unknown): BriefForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const opts = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && !!x.trim())
          .slice(0, 30)
          .map((x) => x.slice(0, 80))
      : undefined;
  const out: BriefForm = {};
  const intro = str(r.intro, 600);
  if (intro) out.intro = intro;
  const steps: BriefForm["steps"] = {};
  const rs = (r.steps || {}) as Record<string, Record<string, unknown>>;
  for (const s of STEP_DEFS) {
    const v = rs[s.k];
    if (!v || typeof v !== "object") continue;
    steps[s.k] = {
      ...(v.off ? { off: true } : {}),
      ...(str(v.title, 60) ? { title: str(v.title, 60) } : {}),
      ...(str(v.hint, 300)?.trim() ? { hint: str(v.hint, 300) } : {}),
    };
  }
  for (const k of Object.keys(steps) as StepKey[])
    if (!Object.keys(steps[k] || {}).length) delete steps[k];
  if (Object.keys(steps).length) out.steps = steps;
  const fields: NonNullable<BriefForm["fields"]> = {};
  const rf = (r.fields || {}) as Record<string, Record<string, unknown>>;
  for (const d of FIELD_DEFS) {
    const v = rf[d.k];
    if (!v || typeof v !== "object") continue;
    const o = d.options ? opts(v.options) : undefined;
    fields[d.k] = {
      ...(v.off && !d.locked ? { off: true } : {}),
      ...(str(v.label, 200) ? { label: str(v.label, 200) } : {}),
      ...(str(v.hint, 300)?.trim() ? { hint: str(v.hint, 300) } : {}),
      ...(o && o.length ? { options: o } : {}),
    };
  }
  for (const k of Object.keys(fields)) if (!Object.keys(fields[k]).length) delete fields[k];
  if (Object.keys(fields).length) out.fields = fields;
  const stepKeys = new Set(STEP_DEFS.map((s) => s.k));
  const custom = (Array.isArray(r.custom) ? r.custom : [])
    .filter(
      (q: Record<string, unknown>) =>
        q &&
        typeof q.id === "string" &&
        /^[A-Za-z0-9_-]{1,40}$/.test(q.id) &&
        stepKeys.has(q.step as StepKey) &&
        (q.type as string) in CUSTOM_TYPES,
    )
    .slice(0, 60)
    .map((q: Record<string, unknown>) => {
      const c: CustomQ = {
        id: q.id as string,
        step: q.step as StepKey,
        type: q.type as CustomType,
        label: str(q.label, 200) || "",
      };
      const h = str(q.hint, 300);
      if (h) c.hint = h;
      const o = opts(q.options);
      if ((c.type === "single" || c.type === "multi") && o) c.options = o;
      return c;
    });
  if (custom.length) out.custom = custom;
  return out;
}

/** is the form different from the built-in one (for the "reset" button) */
export const isCustomized = (f?: BriefForm | null) => !!f && JSON.stringify(cleanForm(f)) !== "{}";
