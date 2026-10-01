import type { Priority, SOState, TaskStatus, Repeat, SiteType } from "./types";

export const STATUSES: Record<TaskStatus, string> = {
  inbox: "תיבת משימות",
  todo: "לביצוע",
  today: "מתוכנן להיום",
  doing: "בביצוע",
  waiting: "ממתין ללקוח",
  blocked: "חסום",
  deferred: "נדחה",
  done: "הושלם",
  cancelled: "בוטל",
};
export const PRIORITIES: Record<Priority, string> = {
  low: "נמוכה",
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};
export const PRIORITY_ORDER: Priority[] = ["low", "normal", "high", "urgent"];
export const REPEATS: Record<Repeat, string> = {
  none: "לא חוזרת",
  daily: "כל יום",
  weekly: "כל שבוע",
  monthly: "כל חודש",
};
export const TASK_TYPES = [
  "אפיון",
  "עיצוב",
  "בנייה",
  "תיקון",
  "תוכן",
  "שיחת לקוח",
  "בדיקות",
  "השקה",
  "תחזוקה",
  "אחסון",
  "תשלום",
  "דומיין",
  "אחר",
];
export const PROJ_STATUS = [
  "אפיון",
  "ממתין לחומרים",
  "בבנייה",
  "ממתין ללקוח",
  "תיקונים",
  "בדיקות",
  "לקראת השקה",
  "הושק",
  "תחזוקה",
  "הוקפא",
];
export const SITE_STATE = [
  "בפיתוח",
  "פעיל ותקין",
  "דורש בדיקה",
  "קיימת תקלה",
  "בטיפול",
  "מושבת",
  "לא פעיל",
];
export const SITE_TYPES: SiteType[] = ["אתר WordPress", "אתר AI", "משולב", "אחר"];
export const AI_SYSTEMS = ["Claude", "Lovable", "Base44", "אחר"];
export const SO_STATES: Record<SOState, string> = {
  ok: "פעילה ותקינה",
  none: "עדיין לא הוקמה",
  failed: "חיוב נכשל",
  check: "דורשת בדיקה",
  paused: "הושהתה",
  cancelled: "בוטלה",
};
export const OPEN_STATUSES: TaskStatus[] = [
  "inbox",
  "todo",
  "today",
  "doing",
  "waiting",
  "blocked",
  "deferred",
];
export const ACTIVE_STATUSES: TaskStatus[] = ["inbox", "todo", "today", "doing"];
export const CLOSED_PROJECT = ["הושק", "הוקפא", "תחזוקה"];
/** statuses whose site is not watched — launched sites are exactly the ones to watch */
export const NO_MONITOR = ["הוקפא"];
export const SITE_BAD = ["קיימת תקלה", "מושבת"];
export const SO_STALE_DAYS = 35;
export const WAITING_STALE_DAYS = 7;

/* palette — values live in src/styles.css as --focus-* tokens */
export const C = {
  bg: "var(--focus-background)",
  bg2: "var(--focus-bg2)",
  card: "var(--focus-card)",
  cardHi: "var(--focus-card-hi)",
  line: "var(--focus-border)",
  text: "var(--focus-foreground)",
  sub: "var(--focus-muted)",
  primary: "var(--focus-primary)",
  primaryFg: "var(--focus-primary-foreground)",
  violet: "var(--focus-violet)",
  pink: "var(--focus-pink)",
  teal: "var(--focus-teal)",
  navy: "var(--focus-navy)",
  ok: "var(--focus-success)",
  warn: "var(--focus-warning)",
  bad: "var(--focus-destructive)",
};

export const PRIO_COLOR: Record<Priority, string> = {
  low: C.sub,
  normal: C.text,
  high: C.warn,
  urgent: C.bad,
};
export const STATUS_COLOR: Record<TaskStatus, string> = {
  inbox: C.sub,
  todo: C.sub,
  today: C.violet,
  doing: C.primary,
  waiting: C.pink,
  blocked: C.bad,
  deferred: C.warn,
  done: C.ok,
  cancelled: C.sub,
};
const ACCENTS = [C.primary, C.teal, C.pink, C.warn];
export const accentFor = (id: string) =>
  ACCENTS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % ACCENTS.length];

export const PROJECT_TEMPLATES: Record<
  string,
  { label: string; tasks: [string, string, number][] }
> = {
  wordpress: {
    label: "אתר WordPress חדש",
    tasks: [
      ["אפיון ראשוני מול הלקוח", "אפיון", 60],
      ["איסוף תכנים ותמונות מהלקוח", "תוכן", 30],
      ["התקנת WordPress ותוספים בסיסיים", "בנייה", 45],
      ["עיצוב עמוד הבית", "עיצוב", 180],
      ["בניית שאר העמודים", "בנייה", 240],
      ["התאמה לנייד ובדיקת מהירות", "בדיקות", 60],
      ["חיבור דומיין ו-SSL", "דומיין", 30],
      ["בדיקות לפני השקה", "בדיקות", 45],
      ["השקה ומסירה ללקוח", "השקה", 30],
      ["הקמת הוראת קבע לאחסון", "אחסון", 15],
    ],
  },
  ai: {
    label: "אתר AI חדש (Claude / Lovable)",
    tasks: [
      ["אפיון ראשוני מול הלקוח", "אפיון", 60],
      ["תכנון מבנה העמודים", "אפיון", 30],
      ["בניית העמודים והרכיבים", "בנייה", 180],
      ["חיבור ל-GitHub ודחיפה", "בנייה", 20],
      ["התאמה לנייד", "בדיקות", 45],
      ["חיבור דומיין", "דומיין", 30],
      ["בדיקות לפני השקה", "בדיקות", 30],
      ["השקה ומסירה ללקוח", "השקה", 30],
    ],
  },
  fix: {
    label: "תיקון / עדכון קטן",
    tasks: [
      ["אבחון הבעיה מול הלקוח", "שיחת לקוח", 15],
      ["גיבוי לפני שינוי", "תחזוקה", 10],
      ["ביצוע התיקון", "תיקון", 45],
      ["בדיקה שהכול תקין", "בדיקות", 15],
      ["עדכון הלקוח שהסתיים", "שיחת לקוח", 10],
    ],
  },
};

export const FOCUS_QUOTES = [
  "צעד אחד, עד הסוף",
  "עשייה שקטה ומדויקת",
  "רק המשימה הזאת. עכשיו.",
  "מתחילים קטן, מסיימים גדול",
  "פחות רעש, יותר תוצאה",
];

/* ---------------- leads ---------------- */
export const LEAD_STAGES: { v: import("./types").LeadStage; l: string; c: string }[] = [
  { v: "new", l: "חדש", c: "#5b4fe8" },
  { v: "contacted", l: "בשיחה", c: "#0e9f95" },
  { v: "meeting", l: "פגישה", c: "#7c5cf5" },
  { v: "proposal", l: "הצעת מחיר", c: "#c96a06" },
  { v: "won", l: "נסגר ✓", c: "#138a55" },
  { v: "lost", l: "לא רלוונטי", c: "#8a8fae" },
];
export const LEAD_OPEN: import("./types").LeadStage[] = ["new", "contacted", "meeting", "proposal"];
export const leadStage = (v: string) => LEAD_STAGES.find((x) => x.v === v) ?? LEAD_STAGES[0];
export const LEAD_SOURCES = [
  "וואטסאפ",
  "המלצה",
  "אינסטגרם",
  "פייסבוק",
  "גוגל",
  "טופס באתר",
  "לקוח קיים",
  "אחר",
];
export const LEAD_INTERESTS = [
  "אתר תדמית",
  "חנות אונליין",
  "דף נחיתה",
  "אתר WordPress",
  "אתר AI",
  "שדרוג אתר קיים",
  "אחסון ותחזוקה",
  "אחר",
];

/* WhatsApp message for a failed / missing standing order.
 * placeholders: {שם} {אתר} {סכום} {קישור} {שולח} — a line whose placeholder is empty is dropped */
export const DEFAULT_SO_MSG = `היי {שם},
רציתי לעדכן שהחיוב החודשי על האחסון של {אתר} ({סכום}) לא עבר.
אפשר לעדכן את פרטי הכרטיס בקישור הזה: {קישור}
תודה רבה!
{שולח}`;
