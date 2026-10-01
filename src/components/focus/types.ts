export type TaskStatus =
  "inbox" | "todo" | "today" | "doing" | "waiting" | "blocked" | "deferred" | "done" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Repeat = "none" | "daily" | "weekly" | "monthly";

export interface CheckItem {
  id: string;
  txt: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  projectId: string;
  status: TaskStatus;
  priority: Priority;
  type: string;
  due: string; // yyyy-mm-dd or ""
  estMin: number;
  actualMin: number;
  created: number;
  completedAt?: number;
  checklist: CheckItem[];
  links: string[];
  notes: string;
  blockReason?: string;
  waitingSince?: number;
  deferCount?: number;
  repeat: Repeat;
}

export type SiteType = "אתר AI" | "אתר WordPress" | "משולב" | "אחר";
export type SOState = "ok" | "none" | "failed" | "check" | "paused" | "cancelled";

export interface Note {
  id: string;
  txt: string;
  created: number;
  updated?: number;
  pinned: boolean;
}
export interface Issue {
  id: string;
  title: string;
  created: number;
  resolvedAt?: number;
}
export interface Payment {
  id: string;
  amount: number;
  date: string;
  note: string;
  txCode?: string;
  invoiceUrl?: string;
  /** an invoice was issued for this payment */
  invoiced?: boolean;
  /** a receipt (קבלה) was issued for this payment */
  receipted?: boolean;
}

/** one Grow webhook event as recorded in FOCUS */
export interface GrowEntry {
  id: string; // grow_events.id
  at: number;
  kind: "so_failed" | "so_charge" | "invoice" | "payment";
  name: string;
  phone: string;
  email: string;
  sum: number;
  desc: string;
  error: string;
  txCode: string;
  invoiceUrl: string;
  projectId: string; // "" = not matched yet
  applied: string; // what FOCUS did with it
}

export interface SORun {
  id: string;
  date: string;
  ok: boolean;
  sum: number;
  note: string;
  txCode?: string;
  /** amount transferred to you after fees (from the Grow report) */
  net?: number;
  desc?: string;
}

/** a payer on a Grow standing order — may differ from the project's own contact */
export interface SOContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  projectId: string;
  runs: SORun[];
  created: number;
  /** set by hand when Grow's state differs from what the runs suggest */
  status?: "auto" | "active" | "cancelled" | "attention";
  /** from Grow's standing-orders list */
  growStart?: string; // order creation date
  growCount?: number; // monthly charges so far
  nextDate?: string;
  nextSum?: number;
  growState?: "active" | "cancelled" | "attention";
  lastPay?: string; // last payment status / failure reason
}

export interface SiteCheck {
  at: number;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
  /** when the site was first seen down in the current outage */
  downSince?: number;
  /** why it is down: expired | dns | ssl | timeout | server | http */
  cause?: string;
  /** domain expiry date (ISO) when the lookup found one */
  expires?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  phone: string;
  email: string;
  url: string;
  adminUrl: string;
  status: string;
  siteState: string;
  siteType: SiteType;
  aiSystem: string;
  aiUrl: string;
  cpanelId: string;
  startDate: string;
  launchDate: string;
  buildPrice: number;
  paid: number;
  payDue: string;
  payments: Payment[];
  hosted: boolean;
  hostStart: string;
  hostPrice: number;
  hostPriceNote: string;
  soState: SOState;
  soLastCharge: string;
  soChecked: string;
  soFailedAt: string;
  soFailReason: string;
  /** when the project was finished (auto-set when status becomes "הושק") */
  doneDate: string;
  /** last uptime check of the live site */
  siteCheck?: SiteCheck;
  /** stored screenshot of the homepage (taken once, refreshed on demand / monthly) */
  shot?: { url: string; at: number; via?: string };
  /** when the standing order started */
  soStart: string;
  /** history of standing-order runs */
  soRuns: SORun[];
  /** last card-update link pasted from Grow's email (they change per failed charge) */
  cardUrl: string;
  cardUrlAt: number;
  /** last time a card-update WhatsApp was sent */
  soMsgAt: number;
  notes: Note[];
  issues: Issue[];
  created: number;
}

export type LeadStage = "new" | "contacted" | "meeting" | "proposal" | "won" | "lost";
export interface LeadNote {
  id: string;
  txt: string;
  at: number;
  kind?: "note" | "call" | "whatsapp" | "meeting" | "system";
}
export interface Lead {
  id: string;
  name: string;
  business: string;
  phone: string;
  email: string;
  source: string;
  interest: string;
  budget: number;
  stage: LeadStage;
  followUp: string; // yyyy-mm-dd or ""
  notes: LeadNote[];
  lostReason: string;
  projectId: string;
  created: number;
  updated: number;
}

export interface Cpanel {
  id: string;
  name: string;
  url: string;
  host: string;
  notes: string;
}

export type TimerMode = "work" | "break";
export interface TimerState {
  taskId: string | null;
  mode: TimerMode;
  startedAt: number;
  plannedMin: number;
  pausedTotal: number;
  pausedAt: number | null;
}

export interface Session {
  taskId: string;
  projectId: string;
  min: number;
  at: number;
}

export interface Activity {
  id: string;
  projectId: string;
  txt: string;
  at: number;
}

export interface Settings {
  workHours: number;
  defaultHostPrice: number;
  /** desired hourly rate (₪) — used to flag under-priced projects and suggest prices */
  hourlyTarget: number;
  /** remind me once a week to download a backup file */
  backupReminder?: boolean;
  defaultFocusMin: number;
  breakMin: number;
  sound: boolean;
  notifications: boolean;
  autoStartNext: boolean;
  projectsView: "cards" | "list" | "kanban";
  /** show a browser-window preview of each site on the project cards */
  projectsPreview: boolean;
  /** how often the background monitor checks every site */
  siteCheckEvery: "10m" | "hour" | "day" | "week" | "off";
  taskFilter: string;
  sidebarCollapsed: boolean;
  pipCompact: boolean;
  ownerName: string;
  cardUpdateUrl: string;
  soMsgTemplate: string;
}

/* ---------------- website brief (questionnaire sent to a client) ---------------- */
export interface BriefService {
  name: string;
  desc: string;
}
export interface BriefTestimonial {
  name: string;
  text: string;
}
export interface BriefSite {
  url: string;
  note: string;
}
export interface BriefFile {
  path: string;
  name: string;
  kind: "logo" | "image" | "review";
  size: number;
  type: string;
}
export interface BriefAnswers {
  contactName: string;
  business: string;
  tagline: string;
  audience: string;
  goals: string[];
  about: string;
  unique: string;
  services: BriefService[];
  colorMode: "logo" | "custom" | "you";
  colors: string[];
  styles: string[];
  styleNote: string;
  sites: BriefSite[];
  testimonials: BriefTestimonial[];
  avoid: string;
  noPhotos: boolean;
  photosLink: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  social: string;
  domain: string;
  notes: string;
}
export interface Brief {
  /** long random id — also the secret in the client's link */
  id: string;
  client: string;
  business: string;
  leadId?: string;
  projectId?: string;
  created: number;
  status: "sent" | "done";
  submittedAt?: number;
  /** when I opened the filled brief (unseen ones show in the morning brief) */
  seenAt?: number;
  answers?: BriefAnswers;
  files?: BriefFile[];
}

export interface DB {
  version: number;
  tasks: Task[];
  projects: Project[];
  cpanels: Cpanel[];
  leads: Lead[];
  briefs: Brief[];
  growLog: GrowEntry[];
  soContacts: SOContact[];
  plan: { date: string; ids: string[]; closed: boolean };
  timer: TimerState | null;
  sessions: Session[];
  activity: Activity[];
  /** alert id -> timestamp until which it is hidden (Infinity-like = handled) */
  dismissed: Record<string, number>;
  settings: Settings;
}

export type View =
  | "dashboard"
  | "today"
  | "focus"
  | "weekly"
  | "stats"
  | "inbox"
  | "tasks"
  | "projects"
  | "project"
  | "cpanels"
  | "leads"
  | "briefs"
  | "finances"
  | "alerts"
  | "settings";

export interface Alert {
  id: string;
  txt: string;
  projectId?: string;
  taskId?: string;
  leadId?: string;
  sev: "bad" | "warn";
  kind: string;
}
