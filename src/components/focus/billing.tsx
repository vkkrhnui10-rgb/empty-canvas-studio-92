import * as React from "react";
import { ClipboardPaste, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_SO_MSG } from "./constants";
import { actions, useDB } from "./store";
import type { Project, Settings } from "./types";
import { Btn, Modal, Textarea } from "./ui";
import { ils, timeAgo, waLink } from "./utils";

/** fill the card-update template; a line whose {קישור}/{שולח} is empty is dropped */
export function soMessage(p: Project, s: Settings, link?: string) {
  const vals: Record<string, string> = {
    "{שם}": (p.client || p.name).trim().split(/\s+/)[0] ?? "",
    "{אתר}": p.name,
    "{סכום}": p.hostPrice ? `${ils(p.hostPrice)} לחודש` : "",
    "{קישור}": (link ?? s.cardUpdateUrl ?? "").trim(),
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

/** pull the first URL out of whatever was pasted (a bare link or the whole Grow email) */
export function extractLink(text: string) {
  const m = text.match(/https?:\/\/[^\s<>"'״׳)\]]+/i);
  return m ? m[0].replace(/[.,;:!?]+$/, "") : "";
}

const LINK_FRESH_DAYS = 10;

/**
 * Card-update flow. Grow sends a NEW update link by email on every failed charge,
 * so each send asks for the current link (paste the link or the whole email),
 * previews the message, then opens WhatsApp.
 */
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
  const [open, setOpen] = React.useState(false);
  const noPhone = !p.phone.replace(/\D/g, "");
  const title = noPhone
    ? "אין טלפון ללקוח — הוסף אותו בפרטי הפרויקט"
    : p.soMsgAt
      ? `נשלחה הודעה ${timeAgo(p.soMsgAt)}`
      : "הדבק את הקישור מהמייל ושלח בוואטסאפ";
  const click = () => {
    if (noPhone) {
      toast.error("אין מספר טלפון ללקוח — הוסף אותו בפרטי הפרויקט");
      return;
    }
    setOpen(true);
  };
  return (
    // stop clicks (incl. ones bubbling out of the dialog portal) from reaching clickable rows
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      {size === "icon" ? (
        <button
          onClick={click}
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
      ) : (
        <button
          onClick={click}
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
      )}
      {open && <SendCardDialog p={p} onClose={() => setOpen(false)} />}
    </span>
  );
}

function SendCardDialog({ p, onClose }: { p: Project; onClose: () => void }) {
  const db = useDB();
  const fresh = p.cardUrl && p.cardUrlAt && Date.now() - p.cardUrlAt < LINK_FRESH_DAYS * 86400000;
  const [raw, setRaw] = React.useState(fresh ? p.cardUrl : "");
  const link = extractLink(raw) || db.settings.cardUpdateUrl.trim();
  const fromEmail = !!extractLink(raw);
  const msg = soMessage(p, db.settings, link);

  const pasteClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!extractLink(t)) toast.error("בלוח אין קישור — העתק את הקישור מהמייל ונסה שוב");
      setRaw(t);
    } catch {
      toast("הדפדפן חסם גישה ללוח — הדבק ידנית (Ctrl+V)");
    }
  };
  const send = () => {
    window.open(waLink(p.phone, msg), "_blank", "noopener");
    actions.soMessageSent(p.id, fromEmail ? extractLink(raw) : undefined);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`עדכון כרטיס — ${p.client || p.name}`}
      description="Grow שולחים קישור חדש בכל חיוב שנכשל. הדבק אותו כאן (אפשר להדביק את כל המייל)."
      className="sm:max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Textarea
            autoFocus
            rows={2}
            dir="auto"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="הדבק כאן את הקישור לעדכון כרטיס מהמייל…"
            className="font-mono text-[13px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="soft" icon={ClipboardPaste} onClick={pasteClipboard}>
              הדבק מהלוח
            </Btn>
            {fromEmail ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-[color:var(--focus-success)]">
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate" dir="ltr">
                  {extractLink(raw)}
                </span>
              </span>
            ) : raw.trim() ? (
              <span className="text-xs font-semibold text-[color:var(--focus-destructive)]">
                לא נמצא קישור בטקסט
              </span>
            ) : db.settings.cardUpdateUrl ? (
              <span className="text-xs text-[color:var(--focus-muted)]">
                בלי הדבקה — יישלח הקישור הקבוע מההגדרות
              </span>
            ) : (
              <span className="text-xs text-[color:var(--focus-warning)]">
                בלי קישור — ההודעה תישלח בלי שורת הקישור
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#efeae2] p-3">
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-[#111b21] shadow-sm">
            {msg}
          </div>
          <div className="mt-1.5 text-[11px] text-[#667781]" dir="ltr">
            → {p.phone}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>
            ביטול
          </Btn>
          <button
            onClick={send}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#128c4a] px-5 text-[15px] font-bold text-white shadow-sm transition-all hover:bg-[#0f7a40] active:scale-[.98]"
          >
            <MessageCircle className="size-4" />
            פתח בוואטסאפ
          </button>
        </div>
      </div>
    </Modal>
  );
}
