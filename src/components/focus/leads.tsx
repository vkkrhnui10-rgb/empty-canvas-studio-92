import * as React from "react";
import {
  CalendarClock,
  FolderKanban,
  KanbanSquare,
  List,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_INTERESTS, LEAD_OPEN, LEAD_SOURCES, LEAD_STAGES, leadStage } from "./constants";
import { actions, newLead, useDB } from "./store";
import type { Lead, LeadNote, LeadStage } from "./types";
import {
  Badge,
  Btn,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProjectAvatar,
  Segmented,
  Select,
  StatCard,
  Textarea,
} from "./ui";
import { useNav } from "./nav";
import { addDays, fmtDate, ils, timeAgo, todayStr, waLink } from "./utils";

const NOTE_KINDS: { v: NonNullable<LeadNote["kind"]>; l: string; i: LucideIcon }[] = [
  { v: "note", l: "הערה", i: MessageSquareText },
  { v: "call", l: "שיחה", i: PhoneCall },
  { v: "whatsapp", l: "וואטסאפ", i: MessageCircle },
  { v: "meeting", l: "פגישה", i: Users },
];
const kindIcon = (k?: LeadNote["kind"]) =>
  NOTE_KINDS.find((x) => x.v === k)?.i ?? MessageSquareText;

function followState(l: Lead) {
  if (!l.followUp || !LEAD_OPEN.includes(l.stage)) return null;
  const t = todayStr();
  if (l.followUp < t)
    return { txt: `באיחור · ${fmtDate(l.followUp)}`, c: "var(--focus-destructive)" };
  if (l.followUp === t) return { txt: "פולואפ היום", c: "var(--focus-warning)" };
  return { txt: fmtDate(l.followUp), c: "var(--focus-muted)" };
}
const lastSaid = (l: Lead) => l.notes.find((n) => n.kind !== "system");

/* ============================ Leads view ============================ */
export function LeadsView({ openId }: { openId?: string | null }) {
  const db = useDB();
  const nav = useNav();
  const [q, setQ] = React.useState("");
  const [mode, setMode] = React.useState<"board" | "list">("board");
  const [adding, setAdding] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<LeadStage | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);

  const leads = db.leads.filter((l) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return [l.name, l.business, l.phone, l.email, l.interest, ...l.notes.map((n) => n.txt)]
      .join(" ")
      .toLowerCase()
      .includes(s);
  });
  const open = db.leads.filter((l) => LEAD_OPEN.includes(l.stage));
  const won = db.leads.filter((l) => l.stage === "won").length;
  const lost = db.leads.filter((l) => l.stage === "lost").length;
  const due = open.filter((l) => l.followUp && l.followUp <= todayStr()).length;
  const pipeline = open.reduce((s, l) => s + (l.budget || 0), 0);
  const closed = leads.filter((l) => !LEAD_OPEN.includes(l.stage));
  const sel = openId ? db.leads.find((l) => l.id === openId) : undefined;
  const close = () => nav.go("leads");
  const openLead = (id: string) => nav.go("leads", id);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="לידים"
        subtitle="מי התעניין, מה הוא אמר, ומתי לחזור אליו."
        actions={
          <Btn variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            ליד חדש
          </Btn>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="לידים פתוחים"
          value={String(open.length)}
          icon={Users}
          sub={`${db.leads.length} סה״כ`}
        />
        <StatCard
          label="שווי פוטנציאלי"
          value={ils(pipeline)}
          icon={TrendingUp}
          color="var(--focus-primary)"
          sub="סכום התקציבים הפתוחים"
        />
        <StatCard
          label="לחזור אליהם"
          value={String(due)}
          icon={CalendarClock}
          color={due ? "var(--focus-warning)" : undefined}
          sub={due ? "פולואפ להיום או באיחור" : "אין פולואפים פתוחים להיום"}
        />
        <StatCard
          label="אחוז סגירה"
          value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"}
          icon={Target}
          color={won ? "var(--focus-success)" : undefined}
          sub={`${won} נסגרו · ${lost} לא רלוונטיים`}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[color:var(--focus-muted)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם, עסק, טלפון או מה שנאמר…"
            className="pr-9"
          />
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "board", label: "לוח", icon: KanbanSquare },
            { value: "list", label: "רשימה", icon: List },
          ]}
        />
      </div>

      {db.leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserPlus}
            title="עוד אין לידים"
            subtitle="כל מי שמתעניין — שם, טלפון ומה הוא אמר. FOCUS יזכיר לך לחזור אליו."
            action={
              <Btn size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                ליד ראשון
              </Btn>
            }
          />
        </Card>
      ) : mode === "board" ? (
        <>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <div className="grid min-w-[880px] grid-cols-4 gap-4">
              {LEAD_STAGES.filter((s) => LEAD_OPEN.includes(s.v)).map((s) => {
                const col = leads.filter((l) => l.stage === s.v);
                const sum = col.reduce((a, l) => a + (l.budget || 0), 0);
                return (
                  <div
                    key={s.v}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverCol(s.v);
                    }}
                    onDragLeave={() => setOverCol((c) => (c === s.v ? null : c))}
                    onDrop={() => {
                      if (dragId) actions.setLeadStage(dragId, s.v);
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "flex min-h-[260px] flex-col rounded-[14px] bg-[var(--focus-bg2)] p-2.5 transition-colors",
                      overCol === s.v &&
                        "bg-[var(--focus-soft)] ring-2 ring-[var(--focus-primary)]/40",
                    )}
                  >
                    <div className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                      <span className="size-2 rounded-full" style={{ background: s.c }} />
                      <span className="text-[14px] font-bold">{s.l}</span>
                      <span className="rounded-full bg-[var(--focus-card)] px-2 text-xs font-semibold text-[color:var(--focus-muted)]">
                        {col.length}
                      </span>
                      {sum > 0 && (
                        <span className="mr-auto text-xs font-semibold tabular-nums text-[color:var(--focus-muted)]">
                          {ils(sum)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {col.map((l) => (
                        <LeadCard
                          key={l.id}
                          l={l}
                          onOpen={() => openLead(l.id)}
                          onDragStart={() => setDragId(l.id)}
                          dragging={dragId === l.id}
                        />
                      ))}
                      {col.length === 0 && (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--focus-border)] p-4 text-center text-xs text-[color:var(--focus-muted)]">
                          גרור לכאן ליד
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {closed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowClosed((v) => !v)}
                className="mb-3 text-sm font-semibold text-[color:var(--focus-primary)] hover:underline"
              >
                {showClosed ? "הסתר" : "הצג"} לידים סגורים ({closed.length})
              </button>
              {showClosed && <LeadTable leads={closed} onOpen={openLead} />}
            </div>
          )}
        </>
      ) : (
        <LeadTable leads={leads} onOpen={openLead} />
      )}

      <NewLeadModal open={adding} onClose={() => setAdding(false)} onCreated={openLead} />
      {sel && <LeadDrawer key={sel.id} l={sel} onClose={close} />}
    </div>
  );
}

/* ------------------------------ card ------------------------------ */
function LeadCard({
  l,
  onOpen,
  onDragStart,
  dragging,
}: {
  l: Lead;
  onOpen: () => void;
  onDragStart: () => void;
  dragging: boolean;
}) {
  const fs = followState(l);
  const said = lastSaid(l);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onOpen}
      className={cn(
        "focus-card group cursor-pointer rounded-xl p-3 transition-all hover:-translate-y-px hover:shadow-md",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2.5">
        <ProjectAvatar id={l.id} name={l.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold">{l.name}</div>
          <div className="truncate text-xs text-[color:var(--focus-muted)]">
            {[l.business, l.interest].filter(Boolean).join(" · ") || l.source || "—"}
          </div>
        </div>
        {l.phone && (
          <a
            href={waLink(l.phone)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="וואטסאפ"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#128c4a] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#128c4a]/10 pointer-coarse:opacity-100"
          >
            <MessageCircle className="size-4" />
          </a>
        )}
      </div>
      {said && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-[var(--focus-bg2)] px-2.5 py-1.5 text-[12.5px] leading-snug text-[color:var(--focus-foreground)]/80">
          ״{said.txt}״
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs">
        {l.budget > 0 && <span className="font-bold tabular-nums">{ils(l.budget)}</span>}
        {fs && (
          <span
            className="mr-auto inline-flex items-center gap-1 font-semibold"
            style={{ color: fs.c }}
          >
            <CalendarClock className="size-3" />
            {fs.txt}
          </span>
        )}
        {!fs && (
          <span className="mr-auto text-[color:var(--focus-muted)]">
            {timeAgo(lastSaid(l)?.at ?? l.created)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ table ------------------------------ */
function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="focus-table-head text-right">
            <th className="px-4 py-3 font-semibold">ליד</th>
            <th className="px-3 py-3 font-semibold">שלב</th>
            <th className="px-3 py-3 font-semibold">מקור</th>
            <th className="px-3 py-3 font-semibold">תקציב</th>
            <th className="px-3 py-3 font-semibold">פולואפ</th>
            <th className="px-3 py-3 font-semibold">עדכון אחרון</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--focus-border)]">
          {leads.map((l) => {
            const st = leadStage(l.stage);
            const fs = followState(l);
            return (
              <tr
                key={l.id}
                onClick={() => onOpen(l.id)}
                className="cursor-pointer transition-colors hover:bg-[var(--focus-bg2)]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProjectAvatar id={l.id} name={l.name} size={34} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{l.name}</div>
                      <div className="truncate text-xs text-[color:var(--focus-muted)]">
                        {[l.business, l.interest].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge color={st.c}>{st.l}</Badge>
                </td>
                <td className="px-3 py-3 text-[color:var(--focus-muted)]">{l.source || "—"}</td>
                <td className="px-3 py-3 font-semibold tabular-nums">
                  {l.budget ? ils(l.budget) : "—"}
                </td>
                <td className="px-3 py-3 text-xs font-semibold" style={{ color: fs?.c }}>
                  {fs?.txt ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-[color:var(--focus-muted)]">
                  {timeAgo(l.updated)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="p-8 text-center text-sm text-[color:var(--focus-muted)]">
          לא נמצאו לידים
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ new lead ------------------------------ */
function NewLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [f, setF] = React.useState(() => newLead({ followUp: addDays(todayStr(), 1) }));
  const [said, setSaid] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setF(newLead({ followUp: addDays(todayStr(), 1) }));
      setSaid("");
    }
  }, [open]);
  const set = (p: Partial<Lead>) => setF((x) => ({ ...x, ...p }));
  const save = () => {
    if (!f.name.trim()) return;
    actions.saveLead({ ...f, name: f.name.trim() }, said);
    onClose();
    onCreated(f.id);
  };
  return (
    <Modal open={open} onClose={onClose} title="ליד חדש" className="sm:max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שם *">
            <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="טלפון">
            <Input
              dir="ltr"
              inputMode="tel"
              value={f.phone}
              onChange={(e) => set({ phone: e.target.value })}
              className="text-right"
            />
          </Field>
          <Field label="עסק">
            <Input value={f.business} onChange={(e) => set({ business: e.target.value })} />
          </Field>
          <Field label="מה מעניין אותו">
            <Select
              value={f.interest}
              onChange={(v) => set({ interest: v })}
              options={["", ...LEAD_INTERESTS]}
              labels={{ "": "—" }}
            />
          </Field>
          <Field label="מאיפה הגיע">
            <Select
              value={f.source}
              onChange={(v) => set({ source: v })}
              options={["", ...LEAD_SOURCES]}
              labels={{ "": "—" }}
            />
          </Field>
          <Field label="תקציב משוער (₪)">
            <Input
              type="number"
              inputMode="numeric"
              value={f.budget || ""}
              onChange={(e) => set({ budget: +e.target.value || 0 })}
            />
          </Field>
        </div>
        <Field label="מה הוא אמר?">
          <Textarea
            rows={3}
            value={said}
            onChange={(e) => setSaid(e.target.value)}
            placeholder="מה הוא צריך, מה חשוב לו, לוחות זמנים…"
          />
        </Field>
        <Field label="לחזור אליו">
          <FollowPicker value={f.followUp} onChange={(v) => set({ followUp: v })} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>
            ביטול
          </Btn>
          <Btn type="submit" variant="primary" icon={UserPlus} disabled={!f.name.trim()}>
            הוסף ליד
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

function FollowPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts: [string, number | ""][] = [
    ["היום", 0],
    ["מחר", 1],
    ["עוד 3 ימים", 3],
    ["שבוע", 7],
    ["ללא", ""],
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map(([l, d]) => {
        const v = d === "" ? "" : addDays(todayStr(), d);
        const on = value === v;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "h-8 rounded-full px-3 text-[13px] font-semibold transition-colors",
              on
                ? "bg-[var(--focus-primary)] text-[color:var(--focus-primary-foreground)]"
                : "bg-[var(--focus-bg2)] text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]",
            )}
          >
            {l}
          </button>
        );
      })}
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-auto"
      />
    </div>
  );
}

/* ------------------------------ drawer ------------------------------ */
function LeadDrawer({ l, onClose }: { l: Lead; onClose: () => void }) {
  const nav = useNav();
  const [txt, setTxt] = React.useState("");
  const [kind, setKind] = React.useState<NonNullable<LeadNote["kind"]>>("call");
  const [losing, setLosing] = React.useState<string | null>(null);
  const patch = (p: Partial<Lead>) => actions.patchLead(l.id, p);
  const add = () => {
    if (!txt.trim()) return;
    actions.addLeadNote(l.id, txt, kind);
    setTxt("");
  };
  const st = leadStage(l.stage);

  return (
    <Drawer open onClose={onClose} title={l.name || "ליד"}>
      <div className="space-y-6">
        {/* header */}
        <div className="flex items-center gap-3">
          <ProjectAvatar id={l.id} name={l.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={st.c}>{st.l}</Badge>
              {l.source && (
                <span className="text-xs text-[color:var(--focus-muted)]">מקור: {l.source}</span>
              )}
            </div>
            <div className="mt-1 text-xs text-[color:var(--focus-muted)]">
              נוצר {timeAgo(l.created)} · עודכן {timeAgo(l.updated)}
            </div>
          </div>
        </div>

        {/* contact actions */}
        <div className="grid grid-cols-3 gap-2">
          <ContactBtn href={l.phone ? `tel:${l.phone}` : undefined} icon={Phone} label="חיוג" />
          <ContactBtn
            href={l.phone ? waLink(l.phone, `היי ${l.name.split(" ")[0]}, `) : undefined}
            icon={MessageCircle}
            label="וואטסאפ"
            color="#128c4a"
          />
          <ContactBtn href={l.email ? `mailto:${l.email}` : undefined} icon={Mail} label="מייל" />
        </div>

        {/* stage stepper */}
        <div>
          <div className="mb-2 text-[13px] font-medium text-[color:var(--focus-muted)]">שלב</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STAGES.filter((s) => LEAD_OPEN.includes(s.v)).map((s) => {
              const on = l.stage === s.v;
              return (
                <button
                  key={s.v}
                  onClick={() => actions.setLeadStage(l.id, s.v)}
                  className={cn(
                    "h-8 rounded-full px-3 text-[13px] font-semibold transition-colors",
                    on
                      ? "text-white"
                      : "bg-[var(--focus-bg2)] text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)] disabled:opacity-50",
                  )}
                  style={on ? { background: s.c } : undefined}
                >
                  {s.l}
                </button>
              );
            })}
            {!LEAD_OPEN.includes(l.stage) && <Badge color={st.c}>{st.l}</Badge>}
          </div>
          {l.stage === "lost" && l.lostReason && (
            <div className="mt-2 text-xs text-[color:var(--focus-muted)]">סיבה: {l.lostReason}</div>
          )}
        </div>

        {/* conversation */}
        <div>
          <div className="mb-2 text-[15px] font-bold">מה הוא אמר</div>
          <div className="rounded-[14px] border border-[color:var(--focus-border)] bg-[var(--focus-card)] p-2 focus-within:border-[color:var(--focus-primary)]">
            <Textarea
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={3}
              placeholder="סיכום השיחה: מה הוא צריך, מה הפריע לו, מה סיכמתם…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-wrap items-center gap-1 px-1 pt-1">
              {NOTE_KINDS.map((k) => (
                <button
                  key={k.v}
                  onClick={() => setKind(k.v)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors",
                    kind === k.v
                      ? "bg-[var(--focus-soft)] text-[color:var(--focus-primary)]"
                      : "text-[color:var(--focus-muted)] hover:bg-[var(--focus-bg2)]",
                  )}
                >
                  <k.i className="size-3.5" />
                  {k.l}
                </button>
              ))}
              <Btn
                size="sm"
                variant="primary"
                className="mr-auto"
                onClick={add}
                disabled={!txt.trim()}
              >
                שמור
              </Btn>
            </div>
          </div>

          <ol className="relative mt-4 space-y-3 pr-5 before:absolute before:inset-y-1 before:right-[7px] before:w-px before:bg-[var(--focus-border)]">
            {l.notes.map((n) => {
              const Icon = kindIcon(n.kind);
              const sys = n.kind === "system";
              return (
                <li key={n.id} className="group relative">
                  <span
                    className={cn(
                      "absolute top-1 -right-5 flex size-[15px] items-center justify-center rounded-full ring-4 ring-[var(--focus-card)]",
                      sys ? "bg-[var(--focus-border)]" : "bg-[var(--focus-primary)]",
                    )}
                  >
                    {!sys && <Icon className="size-2.5 text-white" />}
                  </span>
                  {sys ? (
                    <div className="text-xs text-[color:var(--focus-muted)]">
                      {n.txt} · {timeAgo(n.at)}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-[var(--focus-bg2)] px-3 py-2">
                      <div className="mb-0.5 flex items-center gap-2 text-[11.5px] text-[color:var(--focus-muted)]">
                        <span className="font-semibold">
                          {NOTE_KINDS.find((k) => k.v === n.kind)?.l ?? "הערה"}
                        </span>
                        <span>
                          {new Date(n.at).toLocaleDateString("he-IL", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {timeAgo(n.at)}
                        </span>
                        <button
                          aria-label="מחק"
                          onClick={() => actions.deleteLeadNote(l.id, n.id)}
                          className="mr-auto opacity-0 transition-opacity group-hover:opacity-100 hover:text-[color:var(--focus-destructive)]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{n.txt}</div>
                    </div>
                  )}
                </li>
              );
            })}
            {l.notes.length === 0 && (
              <li className="text-sm text-[color:var(--focus-muted)]">עוד לא נרשם כלום.</li>
            )}
          </ol>
        </div>

        {/* follow up */}
        {LEAD_OPEN.includes(l.stage) && (
          <Field label="לחזור אליו">
            <FollowPicker value={l.followUp} onChange={(v) => patch({ followUp: v })} />
          </Field>
        )}

        {/* details */}
        <div>
          <div className="mb-3 text-[15px] font-bold">פרטים</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם">
              <Input value={l.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="עסק">
              <Input value={l.business} onChange={(e) => patch({ business: e.target.value })} />
            </Field>
            <Field label="טלפון">
              <Input
                dir="ltr"
                className="text-right"
                value={l.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </Field>
            <Field label="מייל">
              <Input
                dir="ltr"
                className="text-right"
                value={l.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </Field>
            <Field label="מה מעניין אותו">
              <Select
                value={l.interest}
                onChange={(v) => patch({ interest: v })}
                options={["", ...LEAD_INTERESTS]}
                labels={{ "": "—" }}
              />
            </Field>
            <Field label="מאיפה הגיע">
              <Select
                value={l.source}
                onChange={(v) => patch({ source: v })}
                options={["", ...LEAD_SOURCES]}
                labels={{ "": "—" }}
              />
            </Field>
            <Field label="תקציב משוער (₪)">
              <Input
                type="number"
                value={l.budget || ""}
                onChange={(e) => patch({ budget: +e.target.value || 0 })}
              />
            </Field>
          </div>
        </div>

        {/* outcome */}
        <div className="space-y-2 border-t border-[color:var(--focus-border)] pt-5">
          {l.projectId ? (
            <Btn
              variant="soft"
              icon={FolderKanban}
              className="w-full"
              onClick={() => nav.go("project", l.projectId)}
            >
              פתח את הפרויקט
            </Btn>
          ) : (
            <Btn
              variant="primary"
              icon={FolderKanban}
              className="h-11 w-full"
              onClick={() => {
                const pid = actions.convertLead(l.id);
                if (pid) nav.go("project", pid);
              }}
            >
              נסגר! פתח פרויקט מהליד
            </Btn>
          )}
          {losing === null ? (
            <div className="flex gap-2">
              {l.stage !== "lost" && !l.projectId && (
                <Btn
                  variant="ghost"
                  icon={XCircle}
                  className="flex-1"
                  onClick={() => setLosing("")}
                >
                  לא רלוונטי
                </Btn>
              )}
              {l.stage === "lost" && (
                <Btn
                  variant="ghost"
                  className="flex-1"
                  onClick={() => actions.setLeadStage(l.id, "contacted")}
                >
                  החזר ללידים פתוחים
                </Btn>
              )}
              <Btn
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  actions.deleteLead(l.id);
                  onClose();
                }}
              >
                מחק
              </Btn>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={losing}
                onChange={(e) => setLosing(e.target.value)}
                placeholder="למה? (יקר, בחר מישהו אחר, לא ענה…)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    actions.setLeadStage(l.id, "lost", losing.trim());
                    setLosing(null);
                  }
                }}
              />
              <Btn
                onClick={() => {
                  actions.setLeadStage(l.id, "lost", losing.trim());
                  setLosing(null);
                }}
              >
                סמן
              </Btn>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function ContactBtn({
  href,
  icon: Icon,
  label,
  color,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  color?: string;
}) {
  const cls =
    "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-[color:var(--focus-border)] text-xs font-semibold transition-colors";
  if (!href)
    return (
      <span className={cn(cls, "cursor-not-allowed opacity-40")}>
        <Icon className="size-4" />
        {label}
      </span>
    );
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className={cn(cls, "hover:border-[color:var(--focus-primary)] hover:bg-[var(--focus-soft)]")}
      style={{ color }}
    >
      <Icon className="size-4" />
      {label}
    </a>
  );
}
