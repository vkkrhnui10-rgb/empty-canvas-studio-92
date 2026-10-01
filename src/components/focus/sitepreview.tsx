import * as React from "react";
import { Lock } from "lucide-react";
import { accentFor } from "./constants";
import { normUrl } from "./sitecheck";

const shot = (url: string, n: number) =>
  `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1000&h=680${n ? `&r=${n}` : ""}`;

/** hosts whose screenshot never arrived — don't hammer the service again this session */
const noShot = new Set<string>();
/** hosts whose screenshot already loaded fine this session */
const okShot = new Set<string>();

function hostOf(url: string) {
  try {
    return new URL(normUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * A little browser window showing the opening screen of a project's site.
 * The screenshot comes from a public screenshot service (works even for sites that block iframes);
 * the first request for a site can take a few seconds while it is rendered, so we retry quietly.
 */
export function SitePreview({
  id,
  name,
  url,
  className,
}: {
  id: string;
  name: string;
  url: string;
  className?: string;
}) {
  const host = hostOf(url);
  const accent = accentFor(id);
  const ref = React.useRef<HTMLDivElement>(null);
  const [seen, setSeen] = React.useState(false);
  const [tries, setTries] = React.useState(0);
  const [ready, setReady] = React.useState(() => okShot.has(host));
  const [dead, setDead] = React.useState(() => noShot.has(host));

  React.useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  // while the service is still rendering it answers with a small placeholder — ask again shortly
  React.useEffect(() => {
    if (!seen || ready || dead || tries === 0) return;
    if (tries > 6) {
      noShot.add(host);
      setDead(true);
      return;
    }
    const t = setTimeout(() => setTries((n) => n + 1), 3500);
    return () => clearTimeout(t);
  }, [tries, seen, ready, dead, host]);

  const loading = seen && !ready && !dead;
  const initial =
    name
      .replace(/[^\p{L}\p{N}]/gu, "")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div
      ref={ref}
      aria-hidden
      className={`overflow-hidden rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-card)] shadow-[0_8px_24px_-12px_rgb(22_24_61/0.35)] ${className ?? ""}`}
    >
      {/* window chrome */}
      <div
        dir="ltr"
        className="flex items-center gap-2 border-b border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-2.5 py-1.5"
      >
        <span className="flex gap-1">
          <i className="size-1.5 rounded-full bg-[#ff5f57]" />
          <i className="size-1.5 rounded-full bg-[#febc2e]" />
          <i className="size-1.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-[var(--focus-card)] px-2 py-0.5 text-[10px] text-[color:var(--focus-muted)]">
          <Lock className="size-2.5 shrink-0 opacity-70" />
          <span className="truncate">{host || "—"}</span>
        </span>
        <span className="w-6" />
      </div>
      {/* page */}
      <div className="relative aspect-[1000/620] overflow-hidden bg-white">
        {host && seen && !dead && (
          <img
            key={tries}
            src={shot(normUrl(url), tries)}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover object-top transition-opacity duration-500"
            style={{ opacity: ready ? 1 : 0 }}
            onLoad={(e) => {
              // the real screenshot is 1000px wide; the "still working" placeholder is smaller
              if (e.currentTarget.naturalWidth >= 800) {
                okShot.add(host);
                setReady(true);
              } else setTries((n) => n + 1);
            }}
            onError={() => {
              noShot.add(host);
              setDead(true);
            }}
          />
        )}
        {!ready && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 20%, #fff), color-mix(in oklab, ${accent} 6%, #fff))`,
            }}
          >
            <span
              className="text-3xl font-black tracking-tight"
              style={{ color: accent, opacity: 0.85 }}
            >
              {initial}
            </span>
            <span className="text-[11px] font-medium" style={{ color: accent, opacity: 0.7 }}>
              {!host ? "אין כתובת אתר" : dead ? "אין תצוגה זמינה" : "מכין תצוגה…"}
            </span>
            {loading && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
                <i
                  className="block h-full w-1/3 animate-[focus-slide_1.2s_ease-in-out_infinite] rounded-full"
                  style={{ background: accent }}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
