import * as React from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { actions } from "./store";
import { useCloud } from "./cloud";
import { listCloudBackups, loadCloudBackup, type CloudBackup } from "./backup";
import { Btn } from "./ui";

/** weekly server-side snapshots of the workspace — pick one to restore (undo is offered) */
export function CloudBackups() {
  const cloud = useCloud();
  const [list, setList] = React.useState<CloudBackup[] | null>(null);
  const [busy, setBusy] = React.useState("");
  React.useEffect(() => {
    if (cloud.enabled && cloud.session) void listCloudBackups().then(setList, () => setList([]));
  }, [cloud.enabled, cloud.session]);
  if (!cloud.enabled || !cloud.session) return null;
  return (
    <div className="rounded-xl bg-[var(--focus-bg2)] p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold">
        <History className="size-4" /> גיבויי ענן אוטומטיים
      </div>
      <p className="mb-2 text-xs text-[color:var(--focus-muted)]">
        נשמרים בענן פעם בשבוע (עד 8 אחרונים), גם כשהאפליקציה סגורה.
      </p>
      {list === null ? (
        <div className="text-xs text-[color:var(--focus-muted)]">טוען…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-[color:var(--focus-muted)]">
          עוד אין גיבויים — הראשון ייווצר בלילה הקרוב אחרי הפעלת התזמון.
        </div>
      ) : (
        <ul className="space-y-1">
          {list.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="tabular-nums">
                {new Date(b.at).toLocaleDateString("he-IL")}{" "}
                {new Date(b.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Btn
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "לשחזר את הגיבוי הזה? הנתונים הנוכחיים יוחלפו (אפשר לבטל מיד אחרי).",
                    )
                  )
                    return;
                  setBusy(b.id);
                  const text = await loadCloudBackup(b.id);
                  setBusy("");
                  if (!text) return void toast.error("הגיבוי לא נטען");
                  try {
                    actions.importJSON(text);
                  } catch {
                    toast.error("הגיבוי לא תקין");
                  }
                }}
              >
                {busy === b.id ? "טוען…" : "שחזר"}
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
