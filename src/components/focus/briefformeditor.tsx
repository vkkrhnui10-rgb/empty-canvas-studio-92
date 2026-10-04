/* ============================================================
 * Questionnaire editor — what the client sees in the brief link.
 * Hide / show steps and questions, reword them, edit the choices,
 * add questions of my own. Live preview on the side.
 * Changes apply to every link right away (also ones already sent).
 * ============================================================ */
import * as React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Eye,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  cleanForm,
  CUSTOM_TYPES,
  DEFAULT_INTRO,
  FIELD_DEFS,
  isCustomized,
  resolveForm,
  STEP_DEFS,
  type BriefForm,
  type CustomQ,
  type CustomType,
  type FieldDef,
  type StepKey,
} from "./briefform";
import { actions, useDB } from "./store";
import { useNav } from "./nav";
import { Btn, Card, Input, PageHeader, Select } from "./ui";

const qid = () => `q${Math.random().toString(36).slice(2, 9)}`;

export function BriefFormEditor() {
  const db = useDB();
  const nav = useNav();
  const [form, setForm] = React.useState<BriefForm>(() => cleanForm(db.briefForm));
  const [open, setOpen] = React.useState<StepKey | null>("biz");
  const [showPreview, setShowPreview] = React.useState(false);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const R = React.useMemo(() => resolveForm(form), [form]);

  // save (debounced — every keystroke would sync the whole workspace)
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => actions.setBriefForm(cleanForm(form)), 600);
    return () => clearTimeout(t);
  }, [form]);

  // live preview
  const previewStep = open ? R.steps.findIndex((s) => s.k === open) + 1 : 0;
  const send = React.useCallback(
    (step?: number) =>
      frame.current?.contentWindow?.postMessage(
        { type: "focus-brief-form", form, owner: db.settings.ownerName, step },
        location.origin,
      ),
    [form, db.settings.ownerName],
  );
  React.useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === "focus-brief-ready") send(previewStep);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [send, previewStep]);
  React.useEffect(() => send(), [send]);
  React.useEffect(() => send(previewStep), [previewStep]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- edits ---------- */
  const patchStep = (k: StepKey, p: Partial<NonNullable<BriefForm["steps"]>[StepKey]>) =>
    setForm((f) => ({ ...f, steps: { ...f.steps, [k]: { ...f.steps?.[k], ...p } } }));
  const patchField = (k: string, p: NonNullable<BriefForm["fields"]>[string]) =>
    setForm((f) => ({ ...f, fields: { ...f.fields, [k]: { ...f.fields?.[k], ...p } } }));
  const patchCustom = (id: string, p: Partial<CustomQ>) =>
    setForm((f) => ({
      ...f,
      custom: (f.custom || []).map((q) => (q.id === id ? { ...q, ...p } : q)),
    }));
  const addCustom = (step: StepKey) =>
    setForm((f) => ({
      ...f,
      custom: [...(f.custom || []), { id: qid(), step, type: "text", label: "" }],
    }));
  const removeCustom = (id: string) =>
    setForm((f) => ({ ...f, custom: (f.custom || []).filter((q) => q.id !== id) }));
  const moveCustom = (id: string, dir: -1 | 1) =>
    setForm((f) => {
      const all = [...(f.custom || [])];
      const i = all.findIndex((q) => q.id === id);
      const same = all
        .map((q, j) => [q, j] as const)
        .filter(([q]) => q.step === all[i].step)
        .map(([, j]) => j);
      const pos = same.indexOf(i);
      const j = same[pos + dir];
      if (j === undefined) return f;
      [all[i], all[j]] = [all[j], all[i]];
      return { ...f, custom: all };
    });

  const visibleQs = (k: StepKey) =>
    FIELD_DEFS.filter((d) => d.step === k && R.on(d.k)).length + R.custom(k).length;

  const reset = () => {
    if (!confirmReset()) return;
    setForm({});
  };

  return (
    <div>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]"
        onClick={() => nav.go("briefs")}
      >
        <ArrowRight className="size-4" /> כל האפיונים
      </button>
      <PageHeader
        title="עריכת השאלון"
        subtitle="מה שתשנה כאן יופיע מיד בכל הקישורים, גם באלה שכבר נשלחו"
        actions={
          <div className="flex gap-2">
            <Btn
              variant="outline"
              icon={Eye}
              className="lg:hidden"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "הסתר תצוגה" : "תצוגה מקדימה"}
            </Btn>
            {isCustomized(form) && (
              <Btn variant="ghost" icon={RotateCcw} onClick={reset}>
                חזרה לשאלון המקורי
              </Btn>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="mb-1 font-bold">הפתיחה</h3>
            <p className="mb-2 text-xs text-[color:var(--focus-muted)]">
              מה כתוב בבועה של הרימון, אחרי "היי! כאן {db.settings.ownerName || "הלל"}."
            </p>
            <textarea
              className="min-h-16 w-full resize-y rounded-lg border border-[color:var(--focus-border)] bg-[var(--focus-card)] px-3 py-2 text-[15px]"
              value={form.intro ?? ""}
              placeholder={DEFAULT_INTRO}
              onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
            />
          </Card>

          {STEP_DEFS.map((s, i) => {
            const st = form.steps?.[s.k] || {};
            const on = !st.off;
            const isOpen = open === s.k;
            return (
              <Card key={s.k} className={cn("overflow-hidden", !on && "opacity-60")}>
                <div className="flex items-center gap-3 p-3 ps-4">
                  <span className="grid size-7 flex-none place-items-center rounded-full bg-[var(--focus-bg2)] text-xs font-bold">
                    {i + 1}
                  </span>
                  <button
                    className="min-w-0 flex-1 text-start"
                    onClick={() => setOpen(isOpen ? null : s.k)}
                  >
                    <span className="block truncate font-bold">{st.title?.trim() || s.t}</span>
                    <span className="block text-xs text-[color:var(--focus-muted)]">
                      {on ? `${visibleQs(s.k)} שאלות` : "מוסתר מהלקוח"}
                    </span>
                  </button>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => patchStep(s.k, { off: !v })}
                    aria-label={`הצגת השלב ${s.t}`}
                  />
                  <button
                    className="grid size-8 place-items-center rounded-md hover:bg-[var(--focus-bg2)]"
                    aria-label={isOpen ? "סגירה" : "פתיחה"}
                    onClick={() => setOpen(isOpen ? null : s.k)}
                  >
                    <ChevronDown className={cn("size-4 transition", isOpen && "rotate-180")} />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-[color:var(--focus-border)] p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={st.title ?? ""}
                        placeholder={s.t}
                        aria-label="כותרת השלב"
                        onChange={(e) => patchStep(s.k, { title: e.target.value })}
                      />
                      <Input
                        value={st.hint ?? ""}
                        placeholder={s.h || "שורת הסבר"}
                        aria-label="שורת ההסבר"
                        onChange={(e) => patchStep(s.k, { hint: e.target.value })}
                      />
                    </div>

                    <ul className="divide-y divide-[color:var(--focus-border)] rounded-lg border border-[color:var(--focus-border)]">
                      {FIELD_DEFS.filter((d) => d.step === s.k).map((d) => (
                        <FieldRow
                          key={d.k}
                          d={d}
                          v={form.fields?.[d.k] || {}}
                          onChange={(p) => patchField(d.k, p)}
                        />
                      ))}
                      {(form.custom || [])
                        .filter((q) => q.step === s.k)
                        .map((q, j, arr) => (
                          <CustomRow
                            key={q.id}
                            q={q}
                            first={j === 0}
                            last={j === arr.length - 1}
                            onChange={(p) => patchCustom(q.id, p)}
                            onRemove={() => removeCustom(q.id)}
                            onMove={(dir) => moveCustom(q.id, dir)}
                          />
                        ))}
                    </ul>
                    <Btn variant="soft" icon={Plus} onClick={() => addCustom(s.k)}>
                      הוספת שאלה לשלב הזה
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className={cn("lg:sticky lg:top-4", !showPreview && "hidden lg:block")}>
          <div className="mx-auto w-[min(100%,390px)] overflow-hidden rounded-[32px] border-[6px] border-[#16183d] bg-white shadow-xl">
            <iframe
              ref={frame}
              title="תצוגה מקדימה של השאלון"
              src="/b/preview"
              className="block h-[min(760px,calc(100vh-120px))] w-full"
            />
          </div>
          <p className="mt-2 text-center text-xs text-[color:var(--focus-muted)]">
            תצוגה מקדימה. פתיחת שלב משמאל מקפיצה אליו
          </p>
        </div>
      </div>
    </div>
  );
}

const confirmReset = () =>
  typeof window === "undefined" ||
  window.confirm("לחזור לשאלון המקורי? כל השינויים והשאלות שהוספת יימחקו.");

/* ---------------- a built-in question ---------------- */
function FieldRow({
  d,
  v,
  onChange,
}: {
  d: FieldDef;
  v: NonNullable<BriefForm["fields"]>[string];
  onChange: (p: NonNullable<BriefForm["fields"]>[string]) => void;
}) {
  const [more, setMore] = React.useState(false);
  const on = d.locked || !v.off;
  const changed = !!(v.label?.trim() || v.hint !== undefined || v.options?.length);
  return (
    <li className={cn("px-3 py-2", !on && "bg-[var(--focus-bg2)]/50")}>
      <div className="flex items-center gap-2.5">
        <Switch
          checked={on}
          disabled={d.locked}
          onCheckedChange={(x) => onChange({ off: !x })}
          aria-label={`הצגת השאלה ${d.label}`}
        />
        <input
          className={cn(
            "min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[14px] outline-none hover:bg-[var(--focus-bg2)] focus:bg-[var(--focus-bg2)]",
            !on && "text-[color:var(--focus-muted)] line-through",
          )}
          value={v.label ?? ""}
          placeholder={d.label}
          aria-label="נוסח השאלה"
          onChange={(e) => onChange({ label: e.target.value })}
        />
        {d.options && on && (
          <span className="hidden text-xs text-[color:var(--focus-muted)] sm:inline">
            {(v.options?.length ? v.options : d.options).length} אפשרויות
          </span>
        )}
        <button
          className={cn(
            "grid size-7 place-items-center rounded-md hover:bg-[var(--focus-bg2)]",
            (more || changed) && "text-[color:var(--focus-primary)]",
          )}
          aria-label="הסבר ואפשרויות"
          onClick={() => setMore((x) => !x)}
        >
          <Settings2 className="size-4" />
        </button>
      </div>
      {more && (
        <div className="mt-2 space-y-2 ps-12">
          <Input
            value={v.hint ?? ""}
            placeholder={d.hint || "שורת הסבר מתחת לשאלה (לא חובה)"}
            aria-label="שורת הסבר"
            onChange={(e) => onChange({ hint: e.target.value })}
          />
          {d.options && (
            <Options
              value={v.options?.length ? v.options : d.options}
              onChange={(o) => onChange({ options: o })}
              onReset={v.options?.length ? () => onChange({ options: undefined }) : undefined}
            />
          )}
          {changed && (
            <button
              className="text-xs text-[color:var(--focus-muted)] underline"
              onClick={() => onChange({ label: undefined, hint: undefined, options: undefined })}
            >
              החזרת הנוסח המקורי
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/* ---------------- a question I added ---------------- */
function CustomRow({
  q,
  first,
  last,
  onChange,
  onRemove,
  onMove,
}: {
  q: CustomQ;
  first: boolean;
  last: boolean;
  onChange: (p: Partial<CustomQ>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const choice = q.type === "single" || q.type === "multi";
  return (
    <li className="space-y-2 bg-[color-mix(in_oklab,var(--focus-primary)_5%,transparent)] px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--focus-primary)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--focus-primary-foreground)]">
          שאלה שלי
        </span>
        <span className="flex-1" />
        <IconMini label="למעלה" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp className="size-3.5" />
        </IconMini>
        <IconMini label="למטה" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown className="size-3.5" />
        </IconMini>
        <IconMini label="מחיקת השאלה" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </IconMini>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <Input
          value={q.label}
          autoFocus={!q.label}
          placeholder="השאלה, למשל: יש לכם מבצע קבוע?"
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <Select
          value={q.type}
          options={Object.keys(CUSTOM_TYPES)}
          labels={CUSTOM_TYPES}
          onChange={(t) =>
            onChange({
              type: t as CustomType,
              options:
                t === "single" || t === "multi"
                  ? q.options?.length
                    ? q.options
                    : ["אפשרות 1", "אפשרות 2"]
                  : undefined,
            })
          }
        />
      </div>
      <Input
        value={q.hint ?? ""}
        placeholder="שורת הסבר (לא חובה)"
        onChange={(e) => onChange({ hint: e.target.value })}
      />
      {choice && <Options value={q.options || []} onChange={(o) => onChange({ options: o })} />}
      {!q.label.trim() && (
        <p className="text-xs text-[color:var(--focus-muted)]">שאלה בלי נוסח לא תוצג ללקוח</p>
      )}
    </li>
  );
}

function IconMini({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-[color:var(--focus-muted)] hover:bg-[var(--focus-bg2)] hover:text-[color:var(--focus-foreground)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ---------------- editing a list of choices ---------------- */
function Options({
  value,
  onChange,
  onReset,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  onReset?: () => void;
}) {
  const [txt, setTxt] = React.useState("");
  const add = () => {
    const t = txt.trim();
    if (!t || value.includes(t) || value.length >= 30) return;
    onChange([...value, t]);
    setTxt("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((o) => (
          <span
            key={o}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--focus-border)] bg-[var(--focus-card)] py-0.5 ps-2.5 pe-1 text-[13px]"
          >
            {o}
            <button
              aria-label={`הסרת ${o}`}
              className="grid size-5 place-items-center rounded-full hover:bg-[var(--focus-bg2)]"
              onClick={() => value.length > 1 && onChange(value.filter((x) => x !== o))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={txt}
          placeholder="אפשרות חדשה + Enter"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Btn variant="soft" icon={Plus} onClick={add} disabled={!txt.trim()}>
          הוספה
        </Btn>
      </div>
      {onReset && (
        <button className="text-xs text-[color:var(--focus-muted)] underline" onClick={onReset}>
          החזרת האפשרויות המקוריות
        </button>
      )}
    </div>
  );
}
