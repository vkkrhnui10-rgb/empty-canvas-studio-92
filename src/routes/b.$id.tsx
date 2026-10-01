import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

const BriefPage = React.lazy(() => import("@/components/brief/BriefPage"));

/** the client's website questionnaire — a public link, no sign-in */
export const Route = createFileRoute("/b/$id")({
  head: () => ({
    meta: [
      { title: "שאלון אפיון לאתר" },
      { name: "description", content: "כמה שאלות קצרות כדי שנוכל לבנות לכם את האתר." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#f1f2ed" },
      { property: "og:title", content: "שאלון אפיון לאתר" },
      { property: "og:description", content: "כמה שאלות קצרות, בערך 5 דקות." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: BriefRoute,
});

function BriefRoute() {
  const { id } = Route.useParams();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ minHeight: "100vh", background: "#f1f2ed" }} />;
  return (
    <React.Suspense fallback={<div style={{ minHeight: "100vh", background: "#f1f2ed" }} />}>
      <BriefPage id={id} />
    </React.Suspense>
  );
}
