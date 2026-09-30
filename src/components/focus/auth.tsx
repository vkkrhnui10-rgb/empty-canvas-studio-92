import * as React from "react";
import { Cloud, CloudOff, KeyRound, Loader2, LogIn, Mail, RefreshCw, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { resetPassword, setNewPassword, signIn, signUp, useCloud, type SyncStatus } from "./cloud";
import { Btn, Field, Input, Modal } from "./ui";

/* ------------------------------ login screen ------------------------------ */
export function LoginScreen() {
  const [mode, setMode] = React.useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [info, setInfo] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "in") {
        const m = await signIn(email.trim(), pass);
        if (m) setErr(heb(m));
      } else if (mode === "up") {
        if (pass.length < 8) {
          setErr("סיסמה של 8 תווים לפחות");
          return;
        }
        const r = await signUp(email.trim(), pass);
        if (r.error) setErr(heb(r.error));
        else if (r.needsConfirm) setInfo("שלחנו מייל אימות — לחץ על הקישור שבו ואז התחבר כאן.");
      } else {
        const m = await resetPassword(email.trim());
        if (m) setErr(heb(m));
        else setInfo("אם המייל רשום — נשלח אליו קישור לאיפוס סיסמה.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--focus-background)] px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--focus-navy)] shadow-lg">
            <span className="flex size-7 items-center justify-center rounded-full border-4 border-[#8f86ff]">
              <span className="size-2 rounded-full bg-[#8f86ff]" />
            </span>
          </div>
          <h1 className="text-[26px] font-bold">
            {mode === "up"
              ? "יצירת חשבון FOCUS"
              : mode === "reset"
                ? "איפוס סיסמה"
                : "כניסה ל-FOCUS"}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--focus-muted)]">
            הנתונים שלך שמורים בענן ומסונכרנים בין המחשב לטלפון.
          </p>
        </div>

        <form onSubmit={submit} className="focus-card space-y-4 rounded-[18px] p-6">
          <Field label="מייל">
            <Input
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-right"
            />
          </Field>
          {mode !== "reset" && (
            <Field label="סיסמה">
              <Input
                type="password"
                dir="ltr"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                required
                minLength={mode === "up" ? 8 : undefined}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="text-right"
              />
            </Field>
          )}
          {err && (
            <div className="rounded-lg bg-[color:color-mix(in_oklab,var(--focus-destructive)_10%,transparent)] px-3 py-2 text-sm text-[color:var(--focus-destructive)]">
              {err}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-[var(--focus-soft)] px-3 py-2 text-sm text-[color:var(--focus-primary)]">
              {info}
            </div>
          )}
          <Btn
            type="submit"
            variant="primary"
            className="h-11 w-full"
            disabled={busy}
            icon={busy ? Loader2 : mode === "up" ? UserPlus : mode === "reset" ? Mail : LogIn}
          >
            {mode === "up" ? "יצירת חשבון" : mode === "reset" ? "שלח קישור איפוס" : "כניסה"}
          </Btn>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {mode !== "in" && (
            <button
              onClick={() => setMode("in")}
              className="font-semibold text-[color:var(--focus-primary)] hover:underline"
            >
              יש לי חשבון — כניסה
            </button>
          )}
          {mode !== "up" && (
            <button
              onClick={() => setMode("up")}
              className="font-semibold text-[color:var(--focus-primary)] hover:underline"
            >
              פעם ראשונה? יצירת חשבון
            </button>
          )}
          {mode === "in" && (
            <button
              onClick={() => setMode("reset")}
              className="text-[color:var(--focus-muted)] hover:underline"
            >
              שכחתי סיסמה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Supabase auth messages → Hebrew */
function heb(m: string) {
  const s = m.toLowerCase();
  if (s.includes("invalid login")) return "מייל או סיסמה לא נכונים";
  if (s.includes("email not confirmed")) return "צריך לאשר את המייל — בדוק את תיבת הדואר";
  if (s.includes("already registered") || s.includes("already been registered"))
    return "המייל הזה כבר רשום — נסה להתחבר";
  if (s.includes("password")) return "הסיסמה לא עומדת בדרישות (8 תווים לפחות)";
  if (s.includes("rate")) return "יותר מדי ניסיונות — נסה שוב בעוד דקה";
  if (s.includes("fetch") || s.includes("network")) return "אין חיבור לאינטרנט";
  return m;
}

/* ------------------------- set new password (after reset link) ------------------------- */
export function RecoveryDialog() {
  const cloud = useCloud();
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  return (
    <Modal open={cloud.recovering} onClose={() => undefined} title="סיסמה חדשה">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pass.length < 8) return setErr("8 תווים לפחות");
          const m = await setNewPassword(pass);
          setErr(m ? heb(m) : "");
        }}
        className="space-y-3"
      >
        <Input
          type="password"
          dir="ltr"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="text-right"
          placeholder="לפחות 8 תווים"
        />
        {err && <div className="text-sm text-[color:var(--focus-destructive)]">{err}</div>}
        <Btn type="submit" variant="primary" icon={KeyRound} className="w-full">
          שמור סיסמה
        </Btn>
      </form>
    </Modal>
  );
}

/* ------------------------------ sync badge (top bar) ------------------------------ */
const STATUS: Record<SyncStatus, { l: string; c: string }> = {
  off: { l: "מקומי", c: "#8a8fae" },
  loading: { l: "טוען…", c: "#9087ff" },
  synced: { l: "מסונכרן", c: "#3ddc97" },
  saving: { l: "שומר…", c: "#9087ff" },
  offline: { l: "לא מחובר", c: "#f5a524" },
  error: { l: "שגיאת סנכרון", c: "#ff6b6b" },
};
export function SyncBadge({ className }: { className?: string }) {
  const cloud = useCloud();
  if (!cloud.enabled || !cloud.session) return null;
  const s = STATUS[cloud.status];
  const Icon =
    cloud.status === "offline" || cloud.status === "error"
      ? CloudOff
      : cloud.status === "saving" || cloud.status === "loading"
        ? RefreshCw
        : Cloud;
  return (
    <span
      title={cloud.error || s.l}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white/85",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          (cloud.status === "saving" || cloud.status === "loading") && "animate-spin",
        )}
        style={{ color: s.c }}
      />
      <span className="hidden lg:inline">{s.l}</span>
    </span>
  );
}
