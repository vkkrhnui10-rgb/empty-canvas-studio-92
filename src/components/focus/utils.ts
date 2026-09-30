import type { Project, Task, Repeat } from "./types";

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

/** local yyyy-mm-dd (NOT UTC — avoids the "today is yesterday" bug after 21:00 in Israel) */
export const dayKey = (d: Date | number = new Date()) => {
  const x = typeof d === "number" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const todayStr = () => dayKey();
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};
export const daysSince = (key: string) => {
  if (!key) return Infinity;
  const [y, m, d] = key.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  ).getTime();
  return Math.round((now - then) / 86400000);
};
export const nextRepeatDate = (from: string, repeat: Repeat) => {
  const base = from || todayStr();
  if (repeat === "daily") return addDays(base, 1);
  if (repeat === "weekly") return addDays(base, 7);
  if (repeat === "monthly") {
    const [y, m, d] = base.split("-").map(Number);
    return dayKey(new Date(y, m, d));
  }
  return "";
};

export const fmtDate = (key: string) => {
  if (!key) return "";
  if (key === todayStr()) return "היום";
  if (key === addDays(todayStr(), 1)) return "מחר";
  if (key === addDays(todayStr(), -1)) return "אתמול";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
};

const ilsFmt = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export const ils = (n: number) => ilsFmt.format(n || 0);

export const fmtMin = (m: number) => {
  m = Math.round(m || 0);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}:${String(r).padStart(2, "0")} ש׳` : `${h} ש׳`;
};
export const fmtClock = (sec: number) => {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const body = h
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
  return (neg ? "+" : "") + body;
};

export const balanceOf = (p: Project) => Math.max(0, (p.buildPrice || 0) - (p.paid || 0));
export const payState = (p: Project) => {
  const b = balanceOf(p);
  if (!p.buildPrice) return "ללא חיוב";
  if (b <= 0) return "שולם במלואו";
  if (p.payDue && p.payDue < todayStr()) return "באיחור";
  if ((p.paid || 0) > 0) return "שולם חלקית";
  return "טרם שולם";
};

export const isOpen = (t: Task) => t.status !== "done" && t.status !== "cancelled";

/**
 * Quick-add mini syntax (all optional):
 *   !  / !!        → high / urgent priority
 *   #שם            → project whose name contains "שם" (use _ for spaces)
 *   30ד / 2ש / 45m → estimate
 *   היום / מחר     → add to today / due tomorrow
 */
export function parseQuick(input: string, projects: Project[]) {
  let title = input;
  let priority: Task["priority"] | undefined;
  let projectId: string | undefined;
  let estMin: number | undefined;
  let today = false;
  let due: string | undefined;

  title = title.replace(/(^|\s)(!!|!)(?=\s|$)/g, (_m, pre, bang) => {
    priority = bang === "!!" ? "urgent" : "high";
    return pre;
  });
  title = title.replace(/(^|\s)#([^\s]+)/g, (m, pre, name) => {
    const n = String(name).replace(/_/g, " ").toLowerCase();
    const p = projects.find(
      (x) => x.name.toLowerCase().includes(n) || x.client.toLowerCase().includes(n),
    );
    if (p) {
      projectId = p.id;
      return pre;
    }
    return m;
  });
  title = title.replace(
    /(^|\s)(\d+(?:\.\d+)?)\s?(ד|דק|דקות|m|min|ש|שעה|שעות|h)(?=\s|$)/g,
    (_m, pre, num, unit) => {
      const v = parseFloat(num);
      estMin = /^(ש|שעה|שעות|h)$/.test(unit) ? Math.round(v * 60) : Math.round(v);
      return pre;
    },
  );
  title = title.replace(/(^|\s)היום(?=\s|$)/g, (_m, pre) => {
    today = true;
    return pre;
  });
  title = title.replace(/(^|\s)מחר(?=\s|$)/g, (_m, pre) => {
    due = addDays(todayStr(), 1);
    return pre;
  });
  return { title: title.replace(/\s+/g, " ").trim(), priority, projectId, estMin, today, due };
}

export function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** soft two-tone chime via WebAudio — no asset needed */
export function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch {
    /* audio unavailable */
  }
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5
    ? "לילה טוב"
    : h < 12
      ? "בוקר טוב"
      : h < 17
        ? "צהריים טובים"
        : h < 21
          ? "ערב טוב"
          : "לילה טוב";
};
