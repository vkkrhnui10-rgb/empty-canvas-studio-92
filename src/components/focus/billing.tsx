import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_SO_MSG } from "./constants";
import { actions, useDB } from "./store";
import type { Project, Settings } from "./types";
import { ils, timeAgo, waLink } from "./utils";

/** fill the card-update template; a line whose {קישור}/{שולח} is empty is dropped */
export function soMessage(p: Project, s: Settings) {
  const vals: Record<string, string> = {
    "{שם}": (p.client || p.name).trim().split(/\s+/)[0] ?? "",
    "{אתר}": p.name,
    "{סכום}": p.hostPrice ? `${ils(p.hostPrice)} לחודש` : "",
    "{קישור}": (p.cardUrl || s.cardUpdateUrl || "").trim(),
    "{שולח}": s.ownerName.trim(),
  };
  return (s.soMsgTemplate || DEFAULT_SO_MSG)
    .split("\n")
    .filter((line) => !["{קישור}", "{שולח}"].some((k) => line.includes(k) && !vals[k]))
    .map((line) => Object.entries(vals).reduce((l, [k, v]) => l.split(k).join(v), line))
    .join("\n")
    .replace(/ ?\(\s*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** one click → WhatsApp with a ready message (name + card-update link) */
export function SoWhatsAppBtn({
  p,
  size = "sm",
  className,
  label = "שלח הודעה לעדכון כרטיס",
}: {
  p: Project;
  size?: "sm" | "md" | "icon";
  className?: string;
  label?: string;
}) {
  const db = useDB();
  const link = p.cardUrl || db.settings.cardUpdateUrl;
  const noPhone = !p.phone.replace(/\D/g, "");
  const title = noPhone
    ? "אין טלפון ללקוח — הוסף אותו בפרטי הפרויקט"
    : !link
      ? "שים לב: לא הוגדר קישור לעדכון כרטיס (הגדרות / לשונית אחסון)"
      : p.soMsgAt
        ? `נשלחה הודעה ${timeAgo(p.soMsgAt)}`
        : "פותח וואטסאפ עם הודעה מוכנה";
  const send = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (noPhone) {
      toast.error("אין מספר טלפון ללקוח — הוסף אותו בפרטי הפרויקט");
      return;
    }
    window.open(waLink(p.phone, soMessage(p, db.settings)), "_blank", "noopener");
    actions.soMessageSent(p.id);
    if (!link) toast("ההודעה נשלחה בלי קישור — כדאי להגדיר קישור לעדכון כרטיס בהגדרות");
  };
  if (size === "icon")
    return (
      <button
        onClick={send}
        title={title}
        aria-label={label}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[#128c4a] transition-colors hover:bg-[#128c4a]/10",
          noPhone && "opacity-40",
          className,
        )}
      >
        <MessageCircle className="size-4" />
      </button>
    );
  return (
    <button
      onClick={send}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#128c4a] font-semibold text-white shadow-sm transition-all hover:bg-[#0f7a40] active:scale-[.98]",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[15px]",
        noPhone && "opacity-50",
        className,
      )}
    >
      <MessageCircle className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </button>
  );
}
