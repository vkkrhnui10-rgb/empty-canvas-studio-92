import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Copy, Download, MessageCircle } from "lucide-react";
import { C } from "./constants";
import { useDB } from "./store";
import { Badge, Btn, Card, EmptyState } from "./ui";
import { download, fmtDate, heMonth, ils, todayStr } from "./utils";
import { useNav } from "./nav";
import {
  buildHostReport,
  reportCsv,
  reportMonths,
  reportText,
  stateLabel,
  type RowState,
} from "./hostreport";

const COLOR: Record<RowState, string> = {
  paid: C.ok,
  failed: C.bad,
  missing: C.warn,
  pending: C.sub,
  inactive: C.sub,
};
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${ils(Math.abs(n))}`;

export function HostReportTab() {
  const db = useDB();
  const nav = useNav();
  const today = todayStr();
  const months = React.useMemo(() => reportMonths(db, today), [db, today]);
  const [key, setKey] = React.useState(months[0]);
  const r = React.useMemo(() => buildHostReport(db, key, today), [db, key, today]);
  const [copied, setCopied] = React.useState(false);
  const owed = r.rows.filter((x) => x.state === "failed" || x.state === "missing");
  const groups: RowState[] = ["failed", "missing", "pending", "paid"];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(r));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the WhatsApp button still works */
    }
  };

  if (!db.projects.some((p) => p.hosted))
    return (
      <Card>
        <EmptyState icon={ArrowUpRight} title="אין אתרים מאוחסנים" />
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setKey(m)}
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm"
            style={{
              borderColor: m === key ? C.primary : C.line,
              background: m === key ? C.primary : "transparent",
              color: m === key ? C.primaryFg : C.text,
            }}
          >
            {heMonth(m)} {m.slice(0, 4)}
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-sm text-[color:var(--focus-muted)]">
          זיכוי לבנק ב-{fmtDate(r.payoutDate)}
          {r.open ? " (החודש עוד לא נגמר)" : ""}
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums">{ils(r.payout)}</div>
        <div className="mt-2 text-sm text-[color:var(--focus-muted)]">
          {ils(r.gross)} ברוטו − עמלות על חיובים − {ils(r.fee)} עמלה חודשית
        </div>
        <div className="mt-1 text-sm text-[color:var(--focus-muted)]">
          לפי המחירון היה אמור להיכנס {ils(r.expected)} בחודש
          {r.gross < r.expected ? ` · חסרים ${ils(r.expected - r.gross)}` : ""}
          {owed.length ? ` · ${owed.length} לא שילמו` : ""}
        </div>
        {r.netGuess && (
          <div className="mt-2 text-xs" style={{ color: C.warn }}>
            לחלק מהחיובים אין נתוני עמלה מדוח Grow, אז הסכום לבנק משוער. ייבוא דוח Grow יתקן.
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn size="sm" icon={Copy} onClick={copy}>
            {copied ? "הועתק" : "העתק"}
          </Btn>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(reportText(r))}`}
            target="_blank"
            rel="noreferrer"
          >
            <Btn size="sm" icon={MessageCircle}>
              שלח בוואטסאפ
            </Btn>
          </a>
          <Btn
            size="sm"
            icon={Download}
            onClick={() => download(`אחסון-${r.key}.csv`, reportCsv(r), "text/csv;charset=utf-8")}
          >
            קובץ
          </Btn>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          למה זה שונה מ{heMonth(r.prevKey)}?
          <span
            dir="ltr"
            className="mr-auto tabular-nums"
            style={{ color: r.diff === 0 ? C.sub : r.diff > 0 ? C.ok : C.bad }}
          >
            {r.diff === 0 ? "אותו סכום" : signed(r.diff)}
          </span>
        </div>
        <div className="mb-3 text-xs text-[color:var(--focus-muted)]">
          {ils(r.prevPayout)} ב{heMonth(r.prevKey)} → {ils(r.payout)} ב{heMonth(r.key)}
        </div>
        {r.reasons.length === 0 ? (
          <div className="text-sm text-[color:var(--focus-muted)]">
            לא השתנה כלום: אותם לקוחות ואותם סכומים.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--focus-border)]">
            {r.reasons.map((x, i) => (
              <button
                key={i}
                disabled={!x.projectId}
                onClick={() => x.projectId && nav.go("project", x.projectId)}
                className="flex w-full items-center gap-3 py-2.5 text-right text-sm"
              >
                {x.delta >= 0 ? (
                  <ArrowUpRight className="size-4 shrink-0" style={{ color: C.ok }} />
                ) : (
                  <ArrowDownRight className="size-4 shrink-0" style={{ color: C.bad }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{x.who}</span>
                  <span className="block text-xs text-[color:var(--focus-muted)]">{x.text}</span>
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 tabular-nums"
                  style={{ color: x.delta >= 0 ? C.ok : C.bad }}
                >
                  {signed(x.delta)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {groups.map((s) => {
        const rs = r.rows.filter((x) => x.state === s);
        if (!rs.length) return null;
        return (
          <Card key={s} className="px-2 py-1">
            <div className="flex items-center gap-2 px-3 pt-3 pb-1 text-sm font-semibold">
              <Badge color={COLOR[s]}>{stateLabel(s)}</Badge>
              <span className="text-[color:var(--focus-muted)]">{rs.length}</span>
            </div>
            <div className="divide-y divide-[color:var(--focus-border)]">
              {rs.map((x) => (
                <button
                  key={x.projectId}
                  onClick={() => nav.go("project", x.projectId)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right text-sm hover:bg-[var(--focus-bg2)]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                  {x.note && (
                    <span className="truncate text-xs text-[color:var(--focus-muted)]">
                      {x.note}
                    </span>
                  )}
                  {s === "paid" ? (
                    <>
                      <span className="text-xs text-[color:var(--focus-muted)]">
                        {fmtDate(x.date)}
                      </span>
                      <span className="w-16 text-left tabular-nums">{ils(x.gross)}</span>
                    </>
                  ) : null}
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
