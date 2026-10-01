import * as React from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  Coffee,
  ListTodo,
  MessageCircle,
  Receipt,
  ShieldAlert,
  UserPlus,
  Wallet,
} from "lucide-react";
import { C } from "./constants";
import { briefItems, type BriefItem, type BriefKind } from "./briefdata";
import { SoWhatsAppBtn } from "./billing";
import { findProject, useDB } from "./store";
import { useNav } from "./nav";
import { Card } from "./ui";

const ICON: Record<BriefKind, typeof Activity> = {
  site: Activity,
  charge: Receipt,
  lead: UserPlus,
  pay: Wallet,
  tasks: ListTodo,
  risk: ShieldAlert,
};

/** one card that says what needs the owner today */
export function MorningBrief() {
  const db = useDB();
  const nav = useNav();
  const items = briefItems(db);
  const [all, setAll] = React.useState(false);
  const shown = all ? items : items.slice(0, 7);
  const urgent = items.filter((i) => i.group === "urgent").length;

  if (!items.length)
    return (
      <Card className="flex items-center gap-3 p-4" style={{ borderColor: C.ok }}>
        <CheckCircle2 className="size-5" style={{ color: C.ok }} />
        <div>
          <div className="font-bold">סיכום בוקר — הכול רגוע</div>
          <div className="text-sm text-[color:var(--focus-muted)]">
            אין אתר שנפל, חיוב שנכשל, פולואפ או תשלום שמחכים לך היום.
          </div>
        </div>
      </Card>
    );

  const row = (i: BriefItem) => {
    const Icon = ICON[i.kind];
    const col = i.group === "urgent" ? C.bad : C.warn;
    const p = i.chargeProjectId ? findProject(db, i.chargeProjectId) : undefined;
    return (
      <div key={i.id} className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={() => nav.go(i.go.view, i.go.id ?? null)}
          className="flex min-w-0 flex-1 items-center gap-3 text-right"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ color: col, background: `color-mix(in oklab, ${col} 13%, transparent)` }}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{i.title}</span>
            {i.sub && (
              <span className="block truncate text-xs text-[color:var(--focus-muted)]">
                {i.sub}
              </span>
            )}
          </span>
        </button>
        {p && <SoWhatsAppBtn p={p} size="icon" />}
        {i.wa && (
          <a
            href={i.wa}
            target="_blank"
            rel="noreferrer"
            title="וואטסאפ"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#128c4a] text-white"
          >
            <MessageCircle className="size-4" />
          </a>
        )}
        <ChevronLeft className="size-4 shrink-0 text-[color:var(--focus-muted)]" />
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-[color:var(--focus-border)] px-4 py-3"
        style={{ background: urgent ? `color-mix(in oklab, ${C.bad} 7%, transparent)` : undefined }}
      >
        <Coffee className="size-5 text-[color:var(--focus-primary)]" />
        <div className="text-[17px] font-bold">סיכום בוקר</div>
        <span className="text-sm text-[color:var(--focus-muted)]">
          {items.length} דברים דורשים אותך
          {urgent > 0 && (
            <>
              {" · "}
              <b style={{ color: C.bad }}>{urgent} דחופים</b>
            </>
          )}
        </span>
      </div>
      <div className="divide-y divide-[color:var(--focus-border)]">{shown.map(row)}</div>
      {items.length > 7 && (
        <button
          onClick={() => setAll((v) => !v)}
          className="w-full border-t border-[color:var(--focus-border)] px-4 py-2 text-sm font-semibold text-[color:var(--focus-primary)] hover:bg-[var(--focus-bg2)]"
        >
          {all ? "הצג פחות" : `הצג עוד ${items.length - 7}`}
        </button>
      )}
    </Card>
  );
}

/** once per day, when the app opens, a toast with the count and a jump to the dashboard */
export function useDailyBrief(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(async () => {
      const { getState } = await import("./store");
      const { toast } = await import("sonner");
      const day = new Date().toDateString();
      try {
        if (localStorage.getItem("focus-brief-day") === day) return;
      } catch {
        /* ignore */
      }
      const items = briefItems(getState());
      if (!items.length) return;
      try {
        localStorage.setItem("focus-brief-day", day);
      } catch {
        /* ignore */
      }
      const urgent = items.filter((i) => i.group === "urgent").length;
      toast(`${items.length} דברים דורשים אותך היום${urgent ? ` · ${urgent} דחופים` : ""}`, {
        duration: 12000,
        action: { label: "פתח סיכום", onClick: () => (window.location.hash = "#/dashboard") },
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [enabled]);
}
