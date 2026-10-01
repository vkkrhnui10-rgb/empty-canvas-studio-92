import * as React from "react";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  Download,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  PictureInPicture2,
  Play,
  Plus,
  Server,
  SkipForward,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Wallet,
  Settings as SettingsIcon,
  Check,
  UserPlus,
  MessageCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { C, DEFAULT_SO_MSG, PRIORITIES, STATUSES } from "./constants";
import { actions, activeTask, getState, newProject, useDB } from "./store";
import { Btn, Card, Field, Input, Kbd, Modal, PageHeader, Select, Textarea } from "./ui";
import { soMessage } from "./billing";
import { AccountCard, GrowConnectCard } from "./growui";
import { download, todayStr } from "./utils";
import { useNav } from "./nav";
import { pipSupported } from "./floating";
import type { View } from "./types";

/* ============================ Settings ============================ */
export function SettingsView() {
  const db = useDB();
  const s = db.settings;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const exportJSON = () =>
    download(
      `focus-backup-${todayStr()}.json`,
      JSON.stringify(getState(), null, 2),
      "application/json",
    );
  const exportCSV = () => {
    const rows = [["כותרת", "פרויקט", "סטטוס", "עדיפות", "יעד", "משוער (דק׳)", "בפועל (דק׳)"]];
    db.tasks.forEach((t) =>
      rows.push([
        t.title,
        db.projects.find((p) => p.id === t.projectId)?.name ?? "",
        STATUSES[t.status],
        PRIORITIES[t.priority],
        t.due,
        String(t.estMin),
        String(t.actualMin),
      ]),
    );
    const prow = [
      ["פרויקט", "לקוח", "טלפון", "אימייל", "אתר", "סטטוס", "מחיר", "שולם", "אחסון", "הוראת קבע"],
    ];
    db.projects.forEach((p) =>
      prow.push([
        p.name,
        p.client,
        p.phone,
        p.email,
        p.url,
        p.status,
        String(p.buildPrice),
        String(p.paid),
        p.hosted ? String(p.hostPrice) : "",
        p.soState,
      ]),
    );
    const csv = (r: string[][]) =>
      "﻿" +
      r.map((x) => x.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`focus-tasks-${todayStr()}.csv`, csv(rows), "text/csv");
    setTimeout(() => download(`focus-projects-${todayStr()}.csv`, csv(prow), "text/csv"), 300);
  };
  const lastBackup =
    typeof window !== "undefined" ? localStorage.getItem("focus-last-backup") : null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8 grid items-start gap-4 xl:grid-cols-2 xl:[&>*:first-child]:col-span-2">
      <PageHeader title="הגדרות" />
      <Card className="space-y-4 p-5">
        <h2 className="text-[17px] font-bold">עבודה ופוקוס</h2>
        <Field label="השם שלך (לברכה בראש המסך)">
          <Input
            value={s.ownerName}
            onChange={(e) => actions.settings({ ownerName: e.target.value })}
            placeholder="לדוגמה: הלל"
            className="max-w-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="שעות עבודה ביום">
            <Input
              type="number"
              min={1}
              max={16}
              value={s.workHours}
              onChange={(e) => actions.settings({ workHours: +e.target.value || 6 })}
            />
          </Field>
          <Field label="בלוק פוקוס (דק׳)">
            <Input
              type="number"
              min={5}
              value={s.defaultFocusMin}
              onChange={(e) => actions.settings({ defaultFocusMin: +e.target.value || 45 })}
            />
          </Field>
          <Field label="הפסקה (דק׳)">
            <Input
              type="number"
              min={1}
              value={s.breakMin}
              onChange={(e) => actions.settings({ breakMin: +e.target.value || 5 })}
            />
          </Field>
          <Field label="תעריף שעתי רצוי (₪)">
            <Input
              type="number"
              min={0}
              value={s.hourlyTarget}
              onChange={(e) => actions.settings({ hourlyTarget: +e.target.value || 0 })}
            />
          </Field>
          <Field label="מחיר אחסון רגיל">
            <Input
              type="number"
              step="0.01"
              value={s.defaultHostPrice}
              onChange={(e) => actions.settings({ defaultHostPrice: +e.target.value || 48.99 })}
            />
          </Field>
        </div>
        <Toggle
          label="מעבר אוטומטי למשימה הבאה"
          hint="אחרי ״בוצע״ הטיימר ממשיך מיד עם המשימה הבאה"
          checked={s.autoStartNext}
          onChange={(v) => actions.settings({ autoStartNext: v })}
        />
        <Toggle
          label="צליל עדין בסוף בלוק"
          checked={s.sound}
          onChange={(v) => actions.settings({ sound: v })}
        />
        <Toggle
          label="התראת מערכת בסוף בלוק"
          hint="מופיעה גם כשאתה בחלון אחר"
          checked={s.notifications}
          onChange={async (v) => {
            if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
              const r = await Notification.requestPermission();
              if (r !== "granted") return;
            }
            actions.settings({ notifications: v });
          }}
        />
        <Field label="בדיקת תקינות אתרים ברקע">
          <Select
            value={s.siteCheckEvery ?? "week"}
            onChange={(v) => actions.settings({ siteCheckEvery: v as typeof s.siteCheckEvery })}
            options={["week", "day", "hour", "10m", "off"]}
            labels={{
              week: "פעם בשבוע",
              day: "פעם ביום",
              hour: "פעם בשעה",
              "10m": "כל 10 דקות",
              off: "כבויה",
            }}
          />
        </Field>
      </Card>

      <AccountCard />
      <GrowConnectCard />
      <BillingMsgCard />

      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <PictureInPicture2 className="size-4" /> פאנל צף
        </h2>
        <p className="text-sm leading-relaxed text-[color:var(--focus-muted)]">
          {pipSupported()
            ? "הדפדפן שלך תומך בחלון צף אמיתי: הפאנל נשאר מעל כל החלונות במחשב — WordPress, cPanel, Claude, כל תוכנה — כל עוד הדפדפן פתוח. הוא חולק את אותו טיימר ונתונים עם המערכת, בלי השהיה."
            : "הדפדפן הזה לא תומך בחלון צף מעל כל החלונות (נתמך ב-Chrome ו-Edge במחשב). כאן הפאנל יצוף רק בתוך המערכת."}
        </p>
        <Toggle
          label="פאנל קומפקטי"
          hint="רק משימה, זמן, השהיה ובוצע"
          checked={s.pipCompact}
          onChange={(v) => actions.settings({ pipCompact: v })}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-[17px] font-bold">גיבוי ונתונים</h2>
        <p className="text-sm text-[color:var(--focus-muted)]">
          הנתונים נשמרים בדפדפן הזה במחשב הזה. גבה מדי פעם — ייצוא JSON הוא גיבוי מלא שאפשר לייבא
          בחזרה.{lastBackup && ` גיבוי אחרון: ${lastBackup}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="primary"
            icon={Download}
            onClick={() => {
              exportJSON();
              localStorage.setItem("focus-last-backup", new Date().toLocaleDateString("he-IL"));
            }}
          >
            גיבוי מלא (JSON)
          </Btn>
          <Btn icon={Upload} onClick={() => fileRef.current?.click()}>
            ייבוא גיבוי
          </Btn>
          <Btn variant="outline" icon={Download} onClick={exportCSV}>
            ייצוא ל-Excel (CSV)
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                actions.importJSON(await f.text());
              } catch {
                alert("הקובץ לא תקין");
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[color:var(--focus-border)] pt-3">
          <Btn size="sm" variant="ghost" icon={Sparkles} onClick={actions.loadDemo}>
            טען נתוני דוגמה
          </Btn>
          <Btn
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => confirm("למחוק את כל הנתונים? (אפשר לבטל מיד אחרי)") && actions.reset()}
          >
            מחיקת כל הנתונים
          </Btn>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-[17px] font-bold">קיצורי מקלדת</h2>
        <ShortcutList />
      </Card>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-[color:var(--focus-muted)]">{hint}</div>}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[var(--focus-primary)]"
      />
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "חיפוש ופקודות"],
  ["N", "משימה חדשה"],
  ["F", "מצב פוקוס"],
  ["P", "פאנל צף"],
  ["G ואז D / T / P", "לוח בקרה / היום / פרויקטים"],
  ["רווח", "הפעל / השהה (במסך פוקוס)"],
  ["Ctrl Enter", "בוצע (במסך פוקוס)"],
  ["?", "הצגת הקיצורים"],
];
export function ShortcutList() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      {SHORTCUTS.map(([k, l]) => (
        <div
          key={k}
          className="flex items-center justify-between rounded-xl bg-[var(--focus-bg2)] px-3 py-2 text-sm"
        >
          <span>{l}</span>
          <span className="flex gap-1">
            {k.split(" ").map((x, i) => (
              <Kbd key={i}>{x}</Kbd>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="קיצורי מקלדת" className="sm:max-w-lg">
      <ShortcutList />
    </Modal>
  );
}

/* ============================ Command palette ============================ */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const db = useDB();
  const nav = useNav();
  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };
  const next = activeTask(db);
  const pages: [View, string, typeof LayoutDashboard][] = [
    ["dashboard", "לוח בקרה", LayoutDashboard],
    ["today", "תכנון היום", CalendarCheck],
    ["focus", "מצב פוקוס", Timer],
    ["weekly", "סיכום שבועי", BarChart3],
    ["inbox", "תיבת משימות", Inbox],
    ["tasks", "כל המשימות", ListTodo],
    ["projects", "פרויקטים", FolderKanban],
    ["leads", "לידים", UserPlus],
    ["cpanels", "פאנלי cPanel", Server],
    ["finances", "כספים", Wallet],
    ["alerts", "התראות", Bell],
    ["settings", "הגדרות", SettingsIcon],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="focus-dialog top-[18%] translate-y-0 overflow-hidden rounded-[24px] p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">חיפוש ופקודות</DialogTitle>
        <DialogDescription className="sr-only">חיפוש משימות, פרויקטים ופקודות</DialogDescription>
        <Command className="focus-command bg-transparent">
          <CommandInput placeholder="חפש משימה, פרויקט, לקוח, דומיין — או פקודה…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>לא נמצא דבר</CommandEmpty>
            <CommandGroup heading="פעולות">
              <CommandItem onSelect={() => run(() => nav.quickAdd())}>
                <Plus />
                משימה חדשה<CommandShortcut>N</CommandShortcut>
              </CommandItem>
              {next && (
                <CommandItem
                  onSelect={() =>
                    run(() => {
                      if (db.timer?.taskId !== next.id) actions.startFocus(next.id);
                      nav.go("focus");
                    })
                  }
                >
                  <Play />
                  התחל פוקוס: {next.title}
                </CommandItem>
              )}
              {next && db.timer && (
                <CommandItem onSelect={() => run(() => actions.skipLater(next.id))}>
                  <SkipForward />
                  דלג למשימה הבאה
                </CommandItem>
              )}
              {next && (
                <CommandItem onSelect={() => run(() => actions.completeTask(next.id))}>
                  <Check />
                  סמן כבוצע: {next.title}
                </CommandItem>
              )}
              <CommandItem onSelect={() => run(nav.openFloating)}>
                <PictureInPicture2 />
                פתח פאנל צף<CommandShortcut>P</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => nav.editProject("new"))}>
                <FolderKanban />
                פרויקט חדש
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="פרויקטים ולקוחות">
              {db.projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.client} ${p.url} ${p.phone}`}
                  onSelect={() => run(() => nav.go("project", p.id))}
                >
                  <FolderKanban />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-[color:var(--focus-muted)]">{p.client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {db.leads.length > 0 && (
              <CommandGroup heading="לידים">
                {db.leads.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`ליד ${l.name} ${l.business} ${l.phone} ${l.id}`}
                    onSelect={() => run(() => nav.go("leads", l.id))}
                  >
                    <UserPlus />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-[color:var(--focus-muted)]">{l.business}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="משימות">
              {db.tasks
                .filter((t) => t.status !== "cancelled")
                .slice(0, 400)
                .map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.title} ${t.id}`}
                    onSelect={() => run(() => nav.openTask(t.id))}
                  >
                    <ListTodo style={{ color: t.status === "done" ? C.ok : undefined }} />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-[color:var(--focus-muted)]">
                      {db.projects.find((p) => p.id === t.projectId)?.name}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="מעבר למסך">
              {pages.map(([v, l, I]) => (
                <CommandItem key={v} onSelect={() => run(() => nav.go(v))}>
                  <I />
                  {l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function BillingMsgCard() {
  const db = useDB();
  const s = db.settings;
  const sample =
    db.projects.find((p) => p.hosted && p.soState === "failed") ??
    db.projects.find((p) => p.hosted) ??
    newProject({ name: "האתר של הלקוח", client: "ישראל", hostPrice: s.defaultHostPrice });
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <MessageCircle className="size-[18px] text-[#128c4a]" />
        הודעת וואטסאפ לעדכון כרטיס
      </h2>
      <p className="text-sm text-[color:var(--focus-muted)]">
        כשהוראת קבע נכשלת — לוחצים על הכפתור הירוק, מדביקים את הקישור מהמייל של Grow, וההודעה נפתחת
        בוואטסאפ מוכנה לשליחה.
      </p>
      <Field
        label="קישור קבוע (לא חובה)"
        hint="Grow שולחים קישור חדש במייל בכל חיוב שנכשל — מדביקים אותו בחלון השליחה. כאן רק אם יש לך דף עדכון קבוע, כגיבוי."
      >
        <Input
          dir="ltr"
          className="text-right"
          value={s.cardUpdateUrl}
          onChange={(e) => actions.settings({ cardUpdateUrl: e.target.value })}
          placeholder="https://pay.grow.link/…"
        />
      </Field>
      <Field
        label="נוסח ההודעה"
        hint={
          <>
            משתנים: {"{שם}"} {"{אתר}"} {"{סכום}"} {"{קישור}"} {"{שולח}"} · שורה עם קישור/שולח ריק לא
            תישלח
          </>
        }
      >
        <Textarea
          rows={6}
          value={s.soMsgTemplate}
          onChange={(e) => actions.settings({ soMsgTemplate: e.target.value })}
        />
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-[color:var(--focus-muted)]">
          <span>תצוגה מקדימה ({sample.name})</span>
          {s.soMsgTemplate !== DEFAULT_SO_MSG && (
            <button
              onClick={() => actions.settings({ soMsgTemplate: DEFAULT_SO_MSG })}
              className="font-semibold text-[color:var(--focus-primary)] hover:underline"
            >
              חזור לנוסח המקורי
            </button>
          )}
        </div>
        <div className="ml-auto max-w-sm rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-[#111b21] shadow-sm">
          {soMessage(sample, s, s.cardUpdateUrl || "https://…")}
        </div>
      </div>
    </Card>
  );
}
