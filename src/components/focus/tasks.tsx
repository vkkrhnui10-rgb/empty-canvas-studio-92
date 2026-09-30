import * as React from "react";
import {
  CalendarClock,
  Check,
  Copy,
  CornerDownLeft,
  Flag,
  GripVertical,
  Link2,
  MoreHorizontal,
  Play,
  Plus,
  Repeat as RepeatIcon,
  Sun,
  SunDim,
  Trash2,
  X,
  ExternalLink,
  FolderKanban,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  C,
  PRIORITIES,
  PRIORITY_ORDER,
  PRIO_COLOR,
  REPEATS,
  STATUSES,
  STATUS_COLOR,
  TASK_TYPES,
} from "./constants";
import { actions, findProject, useDB } from "./store";
import type { Task } from "./types";
import {
  Badge,
  Btn,
  Check as CheckBox,
  Drawer,
  Field,
  IconBtn,
  Input,
  Modal,
  Select,
  Textarea,
} from "./ui";
import { fmtDate, fmtMin, isOpen, parseQuick, todayStr } from "./utils";
import { useNav } from "./nav";

export function StatusBadge({ status }: { status: Task["status"] }) {
  return <Badge color={STATUS_COLOR[status]}>{STATUSES[status]}</Badge>;
}

/* ------------------------------ Task row ------------------------------ */
export function TaskRow({
  t,
  selected,
  onSelect,
  draggable,
  onDragStart,
  compact,
  showProject = true,
}: {
  t: Task;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
  showProject?: boolean;
}) {
  const db = useDB();
  const nav = useNav();
  const p = findProject(db, t.projectId);
  const inToday = db.plan.ids.includes(t.id);
  const done = t.status === "done";
  const overdue = t.due && t.due < todayStr() && isOpen(t);
  const checkDone = t.checklist.filter((c) => c.done).length;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--focus-bg2)]",
        selected && "bg-[var(--focus-soft)] hover:bg-[var(--focus-soft)]",
        done && "opacity-60",
      )}
    >
      {draggable && (
        <GripVertical className="size-4 shrink-0 cursor-grab text-[color:var(--focus-border)] group-hover:text-[color:var(--focus-muted)]" />
      )}
      {onSelect && (
        <CheckBox
          checked={!!selected}
          onChange={onSelect}
          className={cn(
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            selected && "opacity-100",
          )}
        />
      )}
      <button
        aria-label={done ? "הושלם" : "סמן כבוצע"}
        onClick={() => !done && actions.completeTask(t.id)}
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all",
          done
            ? "border-[color:var(--focus-success)] bg-[var(--focus-success)]"
            : "border-[color:var(--focus-border)] hover:border-[color:var(--focus-primary)] hover:bg-[var(--focus-primary)]/15",
        )}
      >
        <Check
          className={cn(
            "size-3",
            done
              ? "text-[color:var(--focus-primary-foreground)]"
              : "text-[color:var(--focus-primary)] opacity-0 group-hover:opacity-70",
          )}
          strokeWidth={3}
        />
      </button>

      <button onClick={() => nav.openTask(t.id)} className="min-w-0 flex-1 text-right">
        <div className={cn("truncate text-[14.5px] font-medium", done && "line-through")}>
          {t.title}
        </div>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[color:var(--focus-muted)]">
            {(t.priority === "urgent" || t.priority === "high") && isOpen(t) && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-px font-semibold"
                style={{
                  color: PRIO_COLOR[t.priority],
                  background: `color-mix(in oklab, ${PRIO_COLOR[t.priority]} 12%, transparent)`,
                }}
              >
                <Flag className="size-3" />
                {PRIORITIES[t.priority]}
              </span>
            )}
            {inToday && isOpen(t) && t.status !== "today" && (
              <span className="inline-flex items-center gap-1 text-[color:var(--focus-primary)]">
                <Sun className="size-3" />
                היום
              </span>
            )}
            {showProject && p && (
              <span className="inline-flex items-center gap-1">
                <FolderKanban className="size-3" />
                {p.name}
              </span>
            )}
            {!["todo", "inbox"].includes(t.status) && (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: STATUS_COLOR[t.status] }}
              >
                {t.status === "today" && <Sun className="size-3" />}
                {STATUSES[t.status]}
              </span>
            )}
            {t.due && (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: overdue ? C.bad : undefined }}
              >
                <CalendarClock className="size-3" />
                {fmtDate(t.due)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {fmtMin(t.estMin)}
              {t.actualMin > 0 && ` / ${fmtMin(t.actualMin)}`}
            </span>
            {t.checklist.length > 0 && (
              <span>
                ✓ {checkDone}/{t.checklist.length}
              </span>
            )}
            {t.repeat !== "none" && <RepeatIcon className="size-3" />}
            {t.type !== "אחר" && <span className="text-[color:var(--focus-violet)]">{t.type}</span>}
          </div>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <IconBtn
            icon={Flag}
            label={`עדיפות: ${PRIORITIES[t.priority]} (לחץ לשינוי)`}
            style={{ color: PRIO_COLOR[t.priority] }}
            onClick={() =>
              actions.patchTask(t.id, {
                priority: PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(t.priority) + 1) % 4],
              })
            }
          />
          {isOpen(t) && (
            <IconBtn
              icon={inToday ? SunDim : Sun}
              label={inToday ? "הסר מהיום" : "הוסף להיום"}
              active={inToday}
              onClick={() => (inToday ? actions.removeFromToday(t.id) : actions.toToday([t.id]))}
            />
          )}
          {isOpen(t) && (
            <IconBtn
              icon={Play}
              label="התחל פוקוס"
              onClick={() => {
                actions.startFocus(t.id);
                nav.go("focus");
              }}
            />
          )}
        </div>
        <TaskMenu t={t} />
      </div>
    </div>
  );
}

export function TaskMenu({ t }: { t: Task }) {
  const db = useDB();
  const nav = useNav();
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button
          aria-label="פעולות"
          className="inline-flex size-9 items-center justify-center rounded-xl text-[color:var(--focus-muted)] hover:bg-[var(--focus-card-hi)] hover:text-[color:var(--focus-foreground)]"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="focus-popover min-w-48">
        <DropdownMenuItem onClick={() => nav.openTask(t.id)}>עריכה</DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.duplicate(t.id)}>
          <Copy className="size-4" /> שכפול
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.followUp(t.id)}>
          <CornerDownLeft className="size-4" /> משימת המשך
        </DropdownMenuItem>
        {t.projectId && (
          <DropdownMenuItem onClick={() => nav.go("project", t.projectId)}>
            פתח פרויקט
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {(["todo", "waiting", "blocked"] as const).map((s) => (
          <DropdownMenuItem key={s} onClick={() => actions.patchTask(t.id, { status: s })}>
            סמן: {STATUSES[s]}
          </DropdownMenuItem>
        ))}
        {db.projects.length > 0 && <DropdownMenuSeparator />}
        {db.projects.slice(0, 8).map((p) =>
          p.id === t.projectId ? null : (
            <DropdownMenuItem
              key={p.id}
              onClick={() => actions.patchTask(t.id, { projectId: p.id })}
            >
              העבר ל: {p.name}
            </DropdownMenuItem>
          ),
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[color:var(--focus-destructive)]"
          onClick={() => actions.deleteTasks([t.id])}
        >
          <Trash2 className="size-4" /> מחיקה
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------ Checklist ------------------------------ */
export function Checklist({ t }: { t: Task }) {
  const [v, setV] = React.useState("");
  const list = t.checklist;
  const set = (checklist: Task["checklist"]) => actions.patchTask(t.id, { checklist });
  const add = () => {
    if (!v.trim()) return;
    set([...list, { id: Math.random().toString(36).slice(2), txt: v.trim(), done: false }]);
    setV("");
  };
  return (
    <div className="space-y-1">
      {list.map((c) => (
        <div
          key={c.id}
          className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--focus-bg2)]"
        >
          <CheckBox
            checked={c.done}
            onChange={(done) => set(list.map((x) => (x.id === c.id ? { ...x, done } : x)))}
            label={
              <span className={cn(c.done && "text-[color:var(--focus-muted)] line-through")}>
                {c.txt}
              </span>
            }
            className="flex-1"
          />
          <button
            aria-label="הסר"
            onClick={() => set(list.filter((x) => x.id !== c.id))}
            className="opacity-0 transition-opacity group-hover:opacity-60"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="הוסף שלב… (Enter)"
          className="h-9 text-sm"
        />
        <IconBtn icon={Plus} label="הוסף שלב" onClick={add} />
      </div>
    </div>
  );
}

/* ------------------------------ Quick add ------------------------------ */
export function QuickAddDialog({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: { projectId?: string; today?: boolean };
}) {
  const db = useDB();
  const [v, setV] = React.useState("");
  const [keepOpen, setKeepOpen] = React.useState(false);
  const parsed = parseQuick(v, db.projects);
  const presetProject = findProject(db, preset?.projectId);
  React.useEffect(() => {
    if (open) setV("");
  }, [open]);

  const submit = () => {
    if (!parsed.title) return;
    const t = actions.addTask(
      {
        title: parsed.title,
        projectId: parsed.projectId ?? preset?.projectId ?? "",
        priority: parsed.priority ?? "normal",
        estMin: parsed.estMin ?? 30,
        due: parsed.due ?? "",
        status: parsed.projectId || preset?.projectId ? "todo" : "inbox",
      },
      { today: parsed.today || preset?.today },
    );
    setV("");
    if (!keepOpen) onClose();
    return t;
  };
  const p = findProject(db, parsed.projectId) ?? presetProject;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="משימה חדשה"
      description="רק שם — את השאר אפשר להשלים אחר כך."
    >
      <div className="space-y-3">
        <Input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="לדוגמה: תיקון באנר #כגוונא !! 30ד היום"
          className="h-12 text-base"
        />
        <div className="flex min-h-6 flex-wrap gap-1.5">
          {p && <Badge color={C.violet}>{p.name}</Badge>}
          {parsed.priority && (
            <Badge color={PRIO_COLOR[parsed.priority]}>{PRIORITIES[parsed.priority]}</Badge>
          )}
          {parsed.estMin && <Badge>{fmtMin(parsed.estMin)}</Badge>}
          {(parsed.today || preset?.today) && <Badge color={C.primary}>להיום</Badge>}
          {parsed.due && <Badge color={C.warn}>יעד: {fmtDate(parsed.due)}</Badge>}
          {!v && (
            <span className="text-xs text-[color:var(--focus-muted)]">
              קיצורים: <b>#פרויקט</b> · <b>!</b>/<b>!!</b> עדיפות · <b>30ד</b>/<b>2ש</b> זמן ·{" "}
              <b>היום</b> / <b>מחר</b>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <CheckBox
            checked={keepOpen}
            onChange={setKeepOpen}
            label={
              <span className="text-xs text-[color:var(--focus-muted)]">להוסיף עוד אחרי זו</span>
            }
          />
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>
              ביטול
            </Btn>
            <Btn variant="primary" icon={Plus} onClick={submit} disabled={!parsed.title}>
              הוסף
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Task drawer ------------------------------ */
export function TaskDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDB();
  const nav = useNav();
  const t = db.tasks.find((x) => x.id === id);
  const [link, setLink] = React.useState("");
  if (!t)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const patch = (p: Partial<Task>) => actions.patchTask(t.id, p);
  const projectLabels = {
    "": "— ללא פרויקט —",
    ...Object.fromEntries(db.projects.map((p) => [p.id, p.name])),
  };

  return (
    <Drawer open={!!id} onClose={onClose} title="פרטי משימה">
      <div className="space-y-5">
        <Input
          value={t.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-12 text-lg font-semibold"
          aria-label="כותרת"
        />
        <div className="flex flex-wrap gap-2">
          {isOpen(t) && (
            <Btn
              variant="primary"
              size="sm"
              icon={Play}
              onClick={() => {
                actions.startFocus(t.id);
                onClose();
                nav.go("focus");
              }}
            >
              התחל פוקוס
            </Btn>
          )}
          {isOpen(t) && (
            <Btn
              size="sm"
              icon={Check}
              onClick={() => {
                actions.completeTask(t.id);
                onClose();
              }}
            >
              בוצע
            </Btn>
          )}
          {isOpen(t) &&
            (db.plan.ids.includes(t.id) ? (
              <Btn
                size="sm"
                variant="outline"
                icon={SunDim}
                onClick={() => actions.removeFromToday(t.id)}
              >
                הסר מהיום
              </Btn>
            ) : (
              <Btn size="sm" variant="outline" icon={Sun} onClick={() => actions.toToday([t.id])}>
                הוסף להיום
              </Btn>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="פרויקט" className="col-span-2">
            <Select
              value={t.projectId}
              onChange={(v) => patch({ projectId: v })}
              options={["", ...db.projects.map((p) => p.id)]}
              labels={projectLabels}
            />
          </Field>
          <Field label="סטטוס">
            <Select
              value={t.status}
              onChange={(v) => patch({ status: v as Task["status"] })}
              options={Object.keys(STATUSES)}
              labels={STATUSES}
            />
          </Field>
          <Field label="עדיפות">
            <Select
              value={t.priority}
              onChange={(v) => patch({ priority: v as Task["priority"] })}
              options={PRIORITY_ORDER}
              labels={PRIORITIES}
            />
          </Field>
          <Field label="סוג">
            <Select value={t.type} onChange={(v) => patch({ type: v })} options={TASK_TYPES} />
          </Field>
          <Field label="תאריך יעד">
            <Input type="date" value={t.due} onChange={(e) => patch({ due: e.target.value })} />
          </Field>
          <Field label="זמן משוער (דק׳)">
            <Input
              type="number"
              min={0}
              step={5}
              value={t.estMin}
              onChange={(e) => patch({ estMin: Math.max(0, +e.target.value || 0) })}
            />
          </Field>
          <Field label="חזרה">
            <Select
              value={t.repeat}
              onChange={(v) => patch({ repeat: v as Task["repeat"] })}
              options={Object.keys(REPEATS)}
              labels={REPEATS}
            />
          </Field>
        </div>
        {t.status === "blocked" && (
          <Field label="סיבת חסימה">
            <Input
              value={t.blockReason ?? ""}
              onChange={(e) => patch({ blockReason: e.target.value })}
              placeholder="מה חוסם?"
            />
          </Field>
        )}
        <Field label="תיאור">
          <Textarea
            value={t.desc}
            onChange={(e) => patch({ desc: e.target.value })}
            placeholder="מה בדיוק צריך לעשות?"
          />
        </Field>
        <Field label="צ׳קליסט">
          <Checklist t={t} />
        </Field>
        <Field label="קישורים">
          <div className="space-y-1.5">
            {t.links.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-[var(--focus-bg2)] px-3 py-1.5 text-sm"
              >
                <Link2 className="size-3.5 shrink-0 text-[color:var(--focus-muted)]" />
                <a
                  href={l}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="flex-1 truncate text-left text-[color:var(--focus-primary)] hover:underline"
                >
                  {l}
                </a>
                <button
                  aria-label="הסר קישור"
                  onClick={() => patch({ links: t.links.filter((_, j) => j !== i) })}
                >
                  <X className="size-3.5 opacity-60" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                dir="ltr"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && link.trim()) {
                    patch({ links: [...t.links, link.trim()] });
                    setLink("");
                  }
                }}
              />
              <IconBtn
                icon={Plus}
                label="הוסף קישור"
                onClick={() => {
                  if (link.trim()) {
                    patch({ links: [...t.links, link.trim()] });
                    setLink("");
                  }
                }}
              />
            </div>
          </div>
        </Field>
        <Field label="הערות">
          <Textarea
            value={t.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="הערות פנימיות"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--focus-border)] pt-4 text-xs text-[color:var(--focus-muted)]">
          <span>
            נוצרה {new Date(t.created).toLocaleDateString("he-IL")} · עבדת {fmtMin(t.actualMin)}
            {t.completedAt && ` · הושלמה ${new Date(t.completedAt).toLocaleDateString("he-IL")}`}
          </span>
          <div className="flex gap-1.5">
            <Btn size="sm" variant="ghost" icon={Copy} onClick={() => actions.duplicate(t.id)}>
              שכפול
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              icon={CornerDownLeft}
              onClick={() => actions.followUp(t.id)}
            >
              המשך
            </Btn>
            <Btn
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => {
                actions.deleteTasks([t.id]);
                onClose();
              }}
            >
              מחק
            </Btn>
          </div>
        </div>
        {t.projectId && (
          <button
            className="inline-flex items-center gap-1 text-sm text-[color:var(--focus-primary)] hover:underline"
            onClick={() => {
              onClose();
              nav.go("project", t.projectId);
            }}
          >
            <ExternalLink className="size-3.5" /> לעמוד הפרויקט
          </button>
        )}
      </div>
    </Drawer>
  );
}
