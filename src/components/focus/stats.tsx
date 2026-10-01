import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Clock,
  Globe,
  PieChart as PieIcon,
  Repeat,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { C, NO_MONITOR, PROJ_STATUS, SITE_TYPES, SO_STATES } from "./constants";
import { useDB } from "./store";
import type { Project, SiteType } from "./types";
import { Badge, Card, EmptyState, PageHeader, ProjectAvatar, StatCard } from "./ui";
import { ChartCard, ChartTip, tick } from "./income";
import { estimateStats, profitByType, profitRows } from "./profit";
import { useNav } from "./nav";
import { riskRows } from "./risk";
import { balanceOf, fmtMin, ils, waLink } from "./utils";

const HEB_SHORT = [
  "ינו׳",
  "פבר׳",
  "מרץ",
  "אפר׳",
  "מאי",
  "יוני",
  "יולי",
  "אוג׳",
  "ספט׳",
  "אוק׳",
  "נוב׳",
  "דצמ׳",
];
export const TYPE_COLOR: Record<SiteType, string> = {
  "אתר WordPress": "#3858e9",
  "אתר AI": "#7c5cf5",
  משולב: "#0e9f95",
  אחר: "#9a9dbb",
};
const num = (n: number) => String(n);

type Row = { name: string; value: number; color?: string };

function Donut({ data }: { data: Row[] }) {
  const d = data.filter((r) => r.value > 0);
  if (!d.length) return <Empty />;
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={d}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="none"
        >
          {d.map((r, i) => (
            <Cell key={r.name} fill={r.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTip fmt={num} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

const PALETTE = ["#5b4fe8", "#0e9f95", "#d6408e", "#c96a06", "#3858e9", "#7c5cf5", "#9a9dbb"];

/** horizontal bars, one per category */
function HBars({
  data,
  fmt = num,
  color = C.primary,
}: {
  data: Row[];
  fmt?: (n: number) => string;
  color?: string;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 4, left: 40, bottom: 0 }}>
        <XAxis type="number" reversed hide />
        <YAxis
          type="category"
          dataKey="name"
          orientation="right"
          width={110}
          tick={{ ...tick, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: "var(--focus-bg2)" }} />
        <Bar dataKey="value" name="כמות" radius={4} barSize={16}>
          {data.map((r) => (
            <Cell key={r.name} fill={r.color ?? color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: number) => fmt(v)}
            style={{ fill: "var(--focus-foreground)", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const Empty = () => (
  <div className="flex h-full items-center justify-center text-sm text-[color:var(--focus-muted)]">
    אין עדיין נתונים
  </div>
);

const count = (items: string[]): Row[] => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

/** hosted customers that look like they are about to leave */
function RiskSection() {
  const db = useDB();
  const nav = useNav();
  const rows = riskRows(db);
  const total = rows.reduce((s, r) => s + r.monthly, 0);
  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold">
        <ShieldAlert className="size-5 text-[color:var(--focus-warning)]" /> לקוחות בסיכון
        <span className="text-xs font-normal text-[color:var(--focus-muted)]">
          חיוב שנכשל פעמיים · 90 יום בלי קשר · מקור שמבטל הרבה
        </span>
      </div>
      {rows.length === 0 ? (
        <Card className="p-4 text-sm" style={{ color: C.ok }}>
          אין כרגע לקוחות עם סימני אזהרה.
        </Card>
      ) : (
        <Card className="divide-y divide-[color:var(--focus-border)] px-2 py-1">
          <div className="px-3 py-2 text-sm text-[color:var(--focus-muted)]">
            {rows.length} לקוחות · <b style={{ color: C.warn }}>{ils(total)}</b> לחודש בסיכון
          </div>
          {rows.map((r) => (
            <div key={r.p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
              <ProjectAvatar id={r.p.id} name={r.p.name} size={34} />
              <button onClick={() => nav.go("project", r.p.id)} className="min-w-32 text-right">
                <div className="font-semibold">{r.p.name}</div>
                <div className="text-xs text-[color:var(--focus-muted)]">{r.p.client || "—"}</div>
              </button>
              <div className="flex min-w-48 flex-1 flex-wrap gap-1.5">
                {r.reasons.map((x) => (
                  <Badge key={x.k} color={x.k === "fail" ? C.bad : C.warn}>
                    {x.txt}
                  </Badge>
                ))}
              </div>
              <span className="w-24 text-end text-sm tabular-nums text-[color:var(--focus-muted)]">
                {ils(r.monthly)}/חודש
              </span>
              {r.p.phone ? (
                <a
                  href={waLink(
                    r.p.phone,
                    `היי ${(r.p.client || r.p.name).split(" ")[0]}, רציתי לבדוק שהכול בסדר עם האתר ושאתה מרוצה. יש משהו שאפשר לשפר?`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#128c4a] px-3 text-xs font-semibold text-white"
                >
                  <MessageCircle className="size-3.5" /> פנה
                </a>
              ) : (
                <span className="w-16 text-xs text-[color:var(--focus-muted)]">אין טלפון</span>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** what each project paid per hour of tracked focus time */
function ProfitSection() {
  const db = useDB();
  const nav = useNav();
  const target = db.settings.hourlyTarget;
  const rows = profitRows(db).sort((a, b) => b.perHour - a.perHour);
  const byType = profitByType(rows, SITE_TYPES);
  const est = estimateStats(db, SITE_TYPES);
  const hours = rows.reduce((s, r) => s + r.hours, 0);
  const price = rows.reduce((s, r) => s + r.price, 0);
  const avg = hours ? Math.round(price / hours) : 0;
  const best = [...byType].sort((a, b) => b.perHour - a.perHour)[0];
  const max = rows[0]?.perHour || 1;

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Clock className="size-5 text-[color:var(--focus-primary)]" /> רווחיות לשעה
        <span className="text-xs font-normal text-[color:var(--focus-muted)]">
          מחיר בנייה ÷ זמן פוקוס שנמדד
        </span>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="עוד אין מספיק נתונים"
            subtitle="צריך פרויקט עם מחיר בנייה ולפחות חצי שעה של טיימר פוקוס על משימות שלו"
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="grid gap-4 lg:col-span-3 sm:grid-cols-3">
            <StatCard
              label="ממוצע לשעה"
              value={ils(avg)}
              icon={Clock}
              color={target && avg < target ? C.warn : C.ok}
              sub={target ? `יעד: ${ils(target)} לשעה` : "קבע תעריף רצוי בהגדרות"}
            />
            <StatCard
              label="שעות שנמדדו"
              value={fmtMin(hours * 60)}
              icon={Activity}
              sub={`${rows.length} פרויקטים`}
            />
            <StatCard
              label="הסוג הכי משתלם"
              value={best ? best.type.replace("אתר ", "") : "—"}
              icon={Sparkles}
              color={best ? TYPE_COLOR[best.type] : undefined}
              sub={best ? `${ils(best.perHour)} לשעה` : undefined}
            />
          </div>

          <ChartCard title="₪ לשעה לפי סוג אתר" sub="סכום מחירים ÷ סכום שעות" h="h-56">
            <HBars
              data={byType.map((t) => ({
                name: t.type.replace("אתר ", ""),
                value: Math.round(t.perHour),
                color: TYPE_COLOR[t.type],
              }))}
              fmt={ils}
            />
          </ChartCard>

          <Card className="p-4 lg:col-span-2">
            <div className="mb-3">
              <div className="font-bold">כל הפרויקטים, מהמשתלם ללא משתלם</div>
              <div className="text-xs text-[color:var(--focus-muted)]">
                {target
                  ? `באדום/כתום: מתחת ל-${ils(target)} לשעה`
                  : "קבע תעריף רצוי בהגדרות כדי לסמן פרויקטים מתחת ליעד"}
              </div>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto pe-1">
              {rows.map((r) => {
                const low = target > 0 && r.perHour < target;
                const col = low ? C.warn : C.ok;
                return (
                  <button
                    key={r.p.id}
                    onClick={() => nav.go("project", r.p.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-right text-sm hover:bg-[var(--focus-bg2)]"
                  >
                    <span className="w-32 shrink-0 truncate font-semibold">{r.p.name}</span>
                    <span className="hidden w-16 shrink-0 text-xs text-[color:var(--focus-muted)] sm:block">
                      {r.p.siteType.replace("אתר ", "")}
                    </span>
                    <span className="relative h-2 min-w-10 flex-1 overflow-hidden rounded-full bg-[var(--focus-bg2)]">
                      <i
                        className="absolute inset-y-0 right-0 rounded-full"
                        style={{
                          width: `${Math.max(4, (r.perHour / max) * 100)}%`,
                          background: col,
                        }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-end text-xs tabular-nums text-[color:var(--focus-muted)]">
                      {fmtMin(r.min)} · {ils(r.price)}
                    </span>
                    <span
                      className="w-20 shrink-0 text-end font-bold tabular-nums"
                      style={{ color: col }}
                    >
                      {ils(r.perHour)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {target > 0 && byType.length > 0 && (
            <Card className="p-4 lg:col-span-3">
              <div className="mb-3 font-bold">מה לתמחר מחדש</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {byType.map((t) => {
                  const avgPrice = Math.round(t.price / t.n);
                  const suggested = Math.round((t.avgHours * target) / 50) * 50;
                  const gap = suggested - avgPrice;
                  return (
                    <div key={t.type} className="rounded-xl bg-[var(--focus-bg2)] p-3 text-sm">
                      <div className="mb-1 font-bold" style={{ color: TYPE_COLOR[t.type] }}>
                        {t.type}
                      </div>
                      <div className="text-xs text-[color:var(--focus-muted)]">
                        בממוצע {fmtMin(t.avgHours * 60)} · מחיר ממוצע {ils(avgPrice)}
                      </div>
                      {(() => {
                        const e = est.find((x) => x.type === t.type);
                        return e && Math.abs(e.ratio - 1) >= 0.1 ? (
                          <div className="mt-1 text-xs text-[color:var(--focus-muted)]">
                            הערכה מול בפועל: לוקח {Math.round(Math.abs(e.ratio - 1) * 100)}%{" "}
                            {e.ratio > 1 ? "יותר" : "פחות"} ממה שהערכת
                          </div>
                        ) : null;
                      })()}
                      <div className="mt-2">
                        כדי להגיע ל-{ils(target)} לשעה:{" "}
                        <b className="tabular-nums">{ils(suggested)}</b>
                      </div>
                      <div
                        className="text-xs font-semibold"
                        style={{ color: gap > 0 ? C.warn : C.ok }}
                      >
                        {gap > 50
                          ? `כדאי להעלות בכ-${ils(gap)}`
                          : gap < -50
                            ? "אתה מעל היעד"
                            : "מתומחר נכון"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[color:var(--focus-muted)]">
                הנתונים מבוססים רק על הזמן שמדדת בטיימר; עבודה שלא נמדדה מנפחת את התוצאה.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export function StatsView() {
  const db = useDB();
  const P = db.projects;
  if (!P.length)
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader title="נתונים" subtitle="תמונה כללית של כל הפרויקטים." />
        <Card>
          <EmptyState
            icon={PieIcon}
            title="עוד אין פרויקטים"
            subtitle="הנתונים יופיעו כשתוסיף פרויקטים"
          />
        </Card>
      </div>
    );

  const watched = P.filter((p) => p.url.trim() && !NO_MONITOR.includes(p.status));
  const up = watched.filter((p) => p.siteCheck?.ok).length;
  const down = watched.filter((p) => p.siteCheck && !p.siteCheck.ok).length;
  const unchecked = watched.length - up - down;
  const hosted = P.filter((p) => p.hosted && !["cancelled", "paused"].includes(p.soState));
  const live = P.filter((p) => ["הושק", "תחזוקה"].includes(p.status));
  const owed = P.reduce((s, p) => s + balanceOf(p), 0);
  const avgBuild = (() => {
    const l = P.filter((p) => p.buildPrice > 0);
    return l.length ? l.reduce((s, p) => s + p.buildPrice, 0) / l.length : 0;
  })();

  const types: Row[] = SITE_TYPES.map((t) => ({
    name: t.replace("אתר ", ""),
    value: P.filter((p) => p.siteType === t).length,
    color: TYPE_COLOR[t],
  }));
  const ai = P.filter((p) => p.siteType === "אתר AI" || p.siteType === "משולב");
  const aiSystems = count(ai.map((p) => p.aiSystem || "לא צוין"));
  const byStatus: Row[] = PROJ_STATUS.map((s) => ({
    name: s,
    value: P.filter((p) => p.status === s).length,
  })).filter((r) => r.value > 0);
  const health: Row[] = [
    { name: "עובד", value: up, color: C.ok },
    { name: "לא עובד", value: down, color: C.bad },
    { name: "טרם נבדק", value: unchecked, color: "#9a9dbb" },
  ];
  const so: Row[] = (Object.keys(SO_STATES) as (keyof typeof SO_STATES)[])
    .map((k) => ({
      name: SO_STATES[k],
      value: P.filter((p) => p.hosted && p.soState === k).length,
      color: k === "ok" ? C.ok : k === "failed" ? C.bad : k === "cancelled" ? "#9a9dbb" : C.warn,
    }))
    .filter((r) => r.value > 0);

  // launches in the last 12 months
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: HEB_SHORT[d.getMonth()],
    };
  });
  const launches = months.map((m) => ({
    label: m.label,
    value: P.filter((p) => (p.launchDate || p.doneDate || "").startsWith(m.key)).length,
  }));
  const anyLaunch = launches.some((l) => l.value > 0);

  const money = (f: (p: Project) => number): Row[] =>
    SITE_TYPES.map((t) => ({
      name: t.replace("אתר ", ""),
      value: Math.round(P.filter((p) => p.siteType === t).reduce((s, p) => s + f(p), 0)),
      color: TYPE_COLOR[t],
    })).filter((r) => r.value > 0);
  const paidByType = money((p) => p.paid || 0);
  const hostByType = money((p) =>
    p.hosted && !["cancelled", "paused"].includes(p.soState) ? p.hostPrice || 0 : 0,
  );

  const perPanel = count(
    P.filter((p) => p.cpanelId).map(
      (p) => db.cpanels.find((c) => c.id === p.cpanelId)?.name ?? "—",
    ),
  );
  const noPanel = P.filter((p) => p.url.trim() && !p.cpanelId).length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="נתונים" subtitle="תמונה כללית של כל הפרויקטים והאתרים." />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="פרויקטים"
          value={String(P.length)}
          icon={Globe}
          sub={`${live.length} אתרים חיים`}
        />
        <StatCard
          label="בריאות אתרים"
          value={`${up}/${watched.length}`}
          icon={Activity}
          color={down ? C.bad : C.ok}
          sub={down ? `${down} לא עובדים` : unchecked ? `${unchecked} טרם נבדקו` : "הכול עובד"}
        />
        <StatCard
          label="אתרים באחסון"
          value={String(hosted.length)}
          icon={Repeat}
          sub={`${ils(hosted.reduce((s, p) => s + (p.hostPrice || 0), 0))} לחודש`}
        />
        <StatCard
          label="יתרה לגבייה"
          value={ils(owed)}
          icon={Wallet}
          color={owed ? C.warn : C.ok}
          sub={avgBuild ? `מחיר בנייה ממוצע ${ils(avgBuild)}` : undefined}
        />
      </div>

      <RiskSection />

      <ProfitSection />

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="סוגי אתרים" sub="WordPress · AI · משולב">
          <Donut data={types} />
        </ChartCard>
        <ChartCard title="מערכות AI" sub={`${ai.length} אתרי AI / משולבים`}>
          <HBars data={aiSystems} color={C.violet} />
        </ChartCard>
        <ChartCard title="בריאות האתרים" sub="לפי הבדיקה האחרונה">
          <Donut data={health} />
        </ChartCard>

        <ChartCard title="פרויקטים לפי סטטוס">
          <HBars data={byStatus} />
        </ChartCard>
        <ChartCard title="הוראות קבע" sub="אתרים באחסון">
          <Donut data={so} />
        </ChartCard>
        <ChartCard
          title="פאנלי cPanel"
          sub={noPanel ? `${noPanel} אתרים בלי פאנל מוגדר` : "כמה אתרים בכל פאנל"}
        >
          <HBars data={perPanel} color={C.teal} />
        </ChartCard>

        <ChartCard title="השקות ב-12 החודשים האחרונים" className="lg:col-span-3">
          {anyLaunch ? (
            <ResponsiveContainer>
              <BarChart data={launches} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--focus-border)" />
                <XAxis dataKey="label" reversed tick={tick} axisLine={false} tickLine={false} />
                <YAxis
                  orientation="right"
                  allowDecimals={false}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<ChartTip fmt={num} />} cursor={{ fill: "var(--focus-bg2)" }} />
                <Bar dataKey="value" name="השקות" fill={C.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="ששולם לפי סוג אתר" sub="בנייה">
          <HBars data={paidByType} fmt={ils} />
        </ChartCard>
        <ChartCard title="הכנסה חודשית מאחסון לפי סוג" sub="מחיר אחסון לחודש">
          <HBars data={hostByType} fmt={ils} />
        </ChartCard>
        <Card className="flex flex-col justify-center gap-2 p-5 text-sm">
          <div className="flex items-center gap-2 font-bold">
            <Sparkles className="size-4 text-[color:var(--focus-primary)]" /> במבט מהיר
          </div>
          <div>
            WordPress: <b>{types[0].value}</b> · AI: <b>{types[1].value}</b> · משולב:{" "}
            <b>{types[2].value}</b>
          </div>
          {aiSystems[0] && (
            <div>
              מערכת ה-AI הפופולרית: <b>{aiSystems[0].name}</b> ({aiSystems[0].value})
            </div>
          )}
          <div>
            פרויקטים עם יתרה פתוחה: <b>{P.filter((p) => balanceOf(p) > 0).length}</b>
          </div>
          <div>
            הוראות קבע שנכשלו: <b>{P.filter((p) => p.hosted && p.soState === "failed").length}</b>
          </div>
        </Card>
      </div>
    </div>
  );
}
