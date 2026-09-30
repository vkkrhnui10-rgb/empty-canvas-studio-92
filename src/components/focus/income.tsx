import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleDollarSign, Hammer, Repeat, TrendingUp } from "lucide-react";
import { C } from "./constants";
import { allSORuns, useDB } from "./store";
import type { DB } from "./types";
import { Card, EmptyState, Segmented, StatCard } from "./ui";
import { ils } from "./utils";

const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const SHORT = [
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

export interface IncomeItem {
  date: string; // YYYY-MM-DD
  kind: "build" | "hosting";
  gross: number;
  net: number;
  projectId: string;
}

/** every income event: project build payments + successful standing-order runs */
export function incomeItems(db: DB): IncomeItem[] {
  const out: IncomeItem[] = [];
  for (const p of db.projects)
    for (const pay of p.payments || []) {
      if (!/^\d{4}-\d{2}/.test(pay.date || "") || !(pay.amount > 0)) continue;
      out.push({
        date: pay.date,
        kind: "build",
        gross: pay.amount,
        net: pay.amount,
        projectId: p.id,
      });
    }
  for (const r of allSORuns(db)) {
    if (!r.ok || !/^\d{4}-\d{2}/.test(r.date)) continue;
    out.push({ date: r.date, kind: "hosting", gross: r.sum, net: r.net, projectId: r.projectId });
  }
  return out;
}

const sumBy = (l: IncomeItem[], k: "gross" | "net") => l.reduce((s, e) => s + e[k], 0);
const tick = { fill: "var(--focus-muted)", fontSize: 11 };

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; fill?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div
      dir="rtl"
      className="rounded-lg border border-[color:var(--focus-border)] bg-[var(--focus-card)] px-3 py-2 text-xs shadow-lg"
    >
      {label && <div className="mb-1 font-bold">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}</span>
          <b className="ms-auto ps-3 tabular-nums">{ils(p.value)}</b>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-1 flex border-t border-[color:var(--focus-border)] pt-1 font-bold">
          <span>סה״כ</span>
          <span className="ms-auto tabular-nums">{ils(total)}</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <div className="font-bold">{title}</div>
        {sub && <div className="text-xs text-[color:var(--focus-muted)]">{sub}</div>}
      </div>
      {/* recharts lays out left→right; time runs right→left in Hebrew, so axes are reversed below */}
      <div dir="ltr" className="h-64 w-full">
        {children}
      </div>
    </Card>
  );
}

export function IncomeTab() {
  const db = useDB();
  const items = React.useMemo(() => incomeItems(db), [db]);
  const years = React.useMemo(
    () => [...new Set(items.map((i) => i.date.slice(0, 4)))].sort().reverse(),
    [items],
  );
  const [pick, setPick] = React.useState<string>("");
  const year = years.includes(pick) ? pick : (years[0] ?? "");

  if (!items.length)
    return (
      <Card>
        <EmptyState
          icon={TrendingUp}
          title="עוד אין הכנסות להציג"
          subtitle="תשלומי בנייה והוראות קבע שתזין או תייבא יופיעו כאן בגרפים"
        />
      </Card>
    );

  const yi = items.filter((i) => i.date.startsWith(year));
  const monthly = MONTHS.map((_, m) => {
    const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
    const l = yi.filter((i) => i.date.startsWith(ym));
    return {
      label: SHORT[m],
      full: `${MONTHS[m]} ${year}`,
      build: sumBy(
        l.filter((i) => i.kind === "build"),
        "net",
      ),
      hosting: sumBy(
        l.filter((i) => i.kind === "hosting"),
        "net",
      ),
    };
  });
  // hide future empty months of the current year so the curve doesn't run flat
  const now = new Date();
  const lastM = Number(year) === now.getFullYear() ? now.getMonth() : 11;
  const shown = monthly.slice(0, lastM + 1);
  let run = 0;
  const cumulative = shown.map((m) => ({
    label: m.label,
    total: (run += m.build + m.hosting),
  }));

  const build = sumBy(
    yi.filter((i) => i.kind === "build"),
    "net",
  );
  const hostNet = sumBy(
    yi.filter((i) => i.kind === "hosting"),
    "net",
  );
  const hostGross = sumBy(
    yi.filter((i) => i.kind === "hosting"),
    "gross",
  );
  const total = build + hostNet;
  const activeMonths = shown.filter((m) => m.build + m.hosting > 0).length;
  const best = shown.reduce((a, b) => (b.build + b.hosting > a.build + a.hosting ? b : a));

  const byProject = new Map<string, number>();
  for (const i of yi) byProject.set(i.projectId, (byProject.get(i.projectId) ?? 0) + i.net);
  const top = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, v]) => ({
      name: db.projects.find((p) => p.id === id)?.name ?? "—",
      value: v,
    }));
  const split = [
    { name: "בנייה", value: build, color: C.primary },
    { name: "אחסון (נטו)", value: hostNet, color: C.teal },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-5">
      <Segmented
        value={year}
        onChange={setPick}
        options={years.map((y) => ({ value: y, label: y }))}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`הכנסות ${year}`}
          value={ils(total)}
          icon={CircleDollarSign}
          color={C.ok}
        />
        <StatCard label="מבנייה" value={ils(build)} icon={Hammer} />
        <StatCard
          label="מאחסון (נטו)"
          value={ils(hostNet)}
          icon={Repeat}
          sub={`ברוטו ${ils(hostGross)}`}
        />
        <StatCard
          label="ממוצע לחודש"
          value={ils(activeMonths ? total / activeMonths : 0)}
          icon={TrendingUp}
          sub={
            best.build + best.hosting > 0
              ? `שיא: ${best.full} · ${ils(best.build + best.hosting)}`
              : undefined
          }
        />
      </div>

      <ChartCard title="הכנסה לפי חודש" sub="בנייה + אחסון (נטו)">
        <ResponsiveContainer>
          <BarChart data={shown} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--focus-border)" />
            <XAxis dataKey="label" reversed tick={tick} axisLine={false} tickLine={false} />
            <YAxis
              orientation="right"
              tick={tick}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v))}
            />
            <Tooltip content={<ChartTip />} cursor={{ fill: "var(--focus-bg2)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="build" name="בנייה" stackId="a" fill={C.primary} />
            <Bar
              dataKey="hosting"
              name="אחסון (נטו)"
              stackId="a"
              fill={C.teal}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="הכנסה מצטברת" sub={`מתחילת ${year}`}>
          <ResponsiveContainer>
            <AreaChart data={cumulative} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="incCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b4fe8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5b4fe8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--focus-border)" />
              <XAxis dataKey="label" reversed tick={tick} axisLine={false} tickLine={false} />
              <YAxis
                orientation="right"
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v))}
              />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="מצטבר"
                stroke="#5b4fe8"
                strokeWidth={2.5}
                fill="url(#incCum)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="מאיפה הכסף" sub="חלוקה לפי סוג הכנסה">
          {split.length ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={split}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {split.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </ChartCard>
      </div>

      <ChartCard
        title="הלקוחות שהכניסו הכי הרבה"
        sub={`${year} · עד 8 ראשונים`}
        className="[&>div:last-child]:h-auto"
      >
        <ResponsiveContainer height={Math.max(120, top.length * 34 + 16)}>
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
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
            <Tooltip content={<ChartTip />} cursor={{ fill: "var(--focus-bg2)" }} />
            <Bar dataKey="value" name="הכנסה" fill={C.violet} radius={4} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
