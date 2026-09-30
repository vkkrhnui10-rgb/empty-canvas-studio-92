import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { FloatingContent } from "./focus";
import { getState, useDB } from "./store";

/* ============================================================
 * Floating focus panel.
 * 1) Document Picture-in-Picture (Chrome / Edge 116+): a real OS-level
 *    always-on-top window — stays above WordPress, cPanel, other apps —
 *    while the browser is running. Same JS realm, so it shares the
 *    single store/timer: no second timer, instant two-way sync.
 * 2) Fallback: a draggable in-app panel (floats only inside FOCUS).
 * ============================================================ */

type PipAPI = {
  requestWindow: (o: {
    width: number;
    height: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
  window: Window | null;
};
const pipApi = (): PipAPI | undefined =>
  typeof window !== "undefined"
    ? (window as unknown as { documentPictureInPicture?: PipAPI }).documentPictureInPicture
    : undefined;
export const pipSupported = () => !!pipApi();

function copyStyles(target: Document) {
  [...document.styleSheets].forEach((sheet) => {
    try {
      const css = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      const s = target.createElement("style");
      s.textContent = css;
      target.head.appendChild(s);
    } catch {
      if (sheet.href) {
        const l = target.createElement("link");
        l.rel = "stylesheet";
        l.href = sheet.href;
        target.head.appendChild(l);
      }
    }
  });
}

export function useFloating(openApp: () => void) {
  const [mode, setMode] = React.useState<"closed" | "pip" | "inline">("closed");
  const pipRef = React.useRef<{ win: Window; root: Root } | null>(null);

  const close = React.useCallback(() => {
    if (pipRef.current) {
      pipRef.current.root.unmount();
      pipRef.current.win.close();
      pipRef.current = null;
    }
    setMode("closed");
  }, []);

  const open = React.useCallback(async () => {
    if (pipRef.current) {
      pipRef.current.win.focus();
      return;
    }
    const api = pipApi();
    if (!api) {
      setMode("inline");
      toast(
        "הדפדפן לא תומך בחלון צף מעל כל החלונות — נפתח פאנל בתוך המערכת. ב-Chrome/Edge הוא יצוף מעל כל התוכנות.",
        { duration: 6000 },
      );
      return;
    }
    try {
      const compact = getState().settings.pipCompact;
      const win = await api.requestWindow({ width: 360, height: compact ? 140 : 300 });
      copyStyles(win.document);
      win.document.documentElement.dir = "rtl";
      win.document.documentElement.lang = "he";
      win.document.title = "FOCUS";
      win.document.body.className = "focus-pip-body focus-dark";
      const mount = win.document.createElement("div");
      mount.style.height = "100%";
      win.document.body.appendChild(mount);
      const root = createRoot(mount);
      root.render(
        <FloatingContent
          inPip
          onOpenApp={() => {
            window.focus();
            openApp();
          }}
        />,
      );
      pipRef.current = { win, root };
      win.addEventListener("pagehide", () => {
        root.unmount();
        pipRef.current = null;
        setMode("closed");
      });
      setMode("pip");
    } catch {
      setMode("inline");
    }
  }, [openApp]);

  // resize PiP window when toggling compact
  React.useEffect(() => {
    const i = setInterval(() => {
      const w = pipRef.current?.win;
      if (!w) return;
      const want = getState().settings.pipCompact ? 140 : 300;
      if (Math.abs(w.innerHeight - want) > 40) {
        try {
          w.resizeTo(w.outerWidth, want + (w.outerHeight - w.innerHeight));
        } catch {
          /* resize may be blocked; user can drag */
        }
      }
    }, 500);
    return () => clearInterval(i);
  }, []);

  return { mode, open, close, isOpen: mode !== "closed" };
}

/** in-app fallback panel — draggable, remembers position */
export function InlineFloating({
  onClose,
  onOpenApp,
}: {
  onClose: () => void;
  onOpenApp: () => void;
}) {
  const [pos, setPos] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("focus-float-pos") || "") as { x: number; y: number };
    } catch {
      return { x: 24, y: 24 };
    }
  });
  const compact = useDB().settings.pipCompact;
  const drag = React.useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,a")) return;
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(
      8,
      Math.min(window.innerWidth - 368, drag.current.x + (e.clientX - drag.current.sx)),
    );
    const y = Math.max(
      8,
      Math.min(window.innerHeight - 120, drag.current.y - (e.clientY - drag.current.sy)),
    );
    setPos({ x, y });
  };
  const onUp = () => {
    drag.current = null;
    localStorage.setItem("focus-float-pos", JSON.stringify(pos));
  };
  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className="focus-float-shell fixed z-50 w-[360px] max-w-[calc(100vw-16px)] cursor-grab touch-none overflow-hidden rounded-[20px] active:cursor-grabbing"
      style={{ left: pos.x, bottom: pos.y, height: compact ? 140 : 300 }}
    >
      <FloatingContent onClose={onClose} onOpenApp={onOpenApp} />
    </div>
  );
}
