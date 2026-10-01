import { LEAD_OPEN, NO_MONITOR } from "./constants";
import { riskRows } from "./risk";
import type { Alert, DB, View } from "./types";
import { balanceOf, daysSince, ils, isOpen, todayStr, waLink } from "./utils";

export type BriefKind = "site" | "charge" | "lead" | "pay" | "tasks" | "risk";
export interface BriefItem {
  id: string;
  group: "urgent" | "today";
  kind: BriefKind;
  title: string;
  sub?: string;
  go: { view: View; id?: string };
  /** a ready WhatsApp message (when the person has a phone) */
  wa?: string;
  /** failed charge → the card-update message dialog */
  chargeProjectId?: string;
}

/** everything that needs the owner today, most urgent first */
export function briefItems(db: DB): BriefItem[] {
  const today = todayStr();
  const out: BriefItem[] = [];

  for (const p of db.projects) {
    if (p.url.trim() && p.siteCheck && !p.siteCheck.ok && !NO_MONITOR.includes(p.status))
      out.push({
        id: `site-${p.id}`,
        group: "urgent",
        kind: "site",
        title: `האתר לא עובד: ${p.name}`,
        sub: p.siteCheck.error || "לא עונה",
        go: { view: "project", id: p.id },
      });
  }
  for (const p of db.projects) {
    if (p.hosted && p.soState === "failed")
      out.push({
        id: `charge-${p.id}`,
        group: "urgent",
        kind: "charge",
        title: `חיוב נכשל: ${p.name}`,
        sub: p.soFailReason || (p.soFailedAt ? `מאז ${p.soFailedAt}` : undefined),
        go: { view: "project", id: p.id },
        chargeProjectId: p.id,
      });
  }

  for (const l of db.leads) {
    if (!LEAD_OPEN.includes(l.stage) || !l.followUp || l.followUp > today) continue;
    const late = daysSince(l.followUp);
    out.push({
      id: `lead-${l.id}`,
      group: "today",
      kind: "lead",
      title: `לחזור ל${l.name || "ליד"}`,
      sub: late > 0 ? `באיחור ${late} ימים` : "פולואפ היום",
      go: { view: "leads", id: l.id },
      wa: l.phone ? waLink(l.phone, `היי ${l.name.split(" ")[0]}, `) : undefined,
    });
  }

  for (const p of db.projects) {
    const bal = balanceOf(p);
    if (bal > 0 && p.payDue && p.payDue <= today) {
      const late = daysSince(p.payDue);
      out.push({
        id: `pay-${p.id}`,
        group: "today",
        kind: "pay",
        title: `תשלום לגבייה: ${p.name} · ${ils(bal)}`,
        sub: late > 0 ? `באיחור ${late} ימים` : "מגיע היום",
        go: { view: "project", id: p.id },
        wa: p.phone
          ? waLink(
              p.phone,
              `היי ${(p.client || p.name).split(" ")[0]}, תזכורת קטנה לגבי יתרת התשלום (${ils(bal)}) על האתר. תודה!`,
            )
          : undefined,
      });
    }
  }

  const due = db.tasks.filter((t) => isOpen(t) && t.due && t.due <= today);
  if (due.length) {
    const late = due.filter((t) => t.due < today).length;
    out.push({
      id: "tasks",
      group: "today",
      kind: "tasks",
      title: `${due.length} משימות להיום`,
      sub: late ? `${late} מהן באיחור` : undefined,
      go: { view: "tasks" },
    });
  }

  const risk = riskRows(db);
  if (risk.length)
    out.push({
      id: "risk",
      group: "today",
      kind: "risk",
      title: `${risk.length} לקוחות בסיכון`,
      sub: `${ils(risk.reduce((s, r) => s + r.monthly, 0))} לחודש`,
      go: { view: "stats" },
    });

  return out;
}

/** alerts the morning brief already shows (site down, failed charge, payment due) — not repeated on the dashboard */
export const inBrief = (a: Alert) =>
  a.id.startsWith("site-down-") || a.id.startsWith("so-failed-") || a.id.startsWith("pay-");
