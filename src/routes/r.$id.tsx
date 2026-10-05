import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

const ReviewPage = React.lazy(() => import("@/components/review/ReviewPage"));

/** the client's design review — the live site with pinned notes; a public link, no sign-in */
export const Route = createFileRoute("/r/$id")({
  head: () => ({
    meta: [
      { title: "משוב על האתר" },
      { name: "description", content: "עוברים על האתר ומסמנים מה לשנות." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:title", content: "משוב על האתר שלכם" },
      { property: "og:description", content: "עוברים על האתר, לוחצים על מה שרוצים לשנות וכותבים." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: ReviewRoute,
});

function ReviewRoute() {
  const { id } = Route.useParams();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ minHeight: "100vh", background: "#ebe9f2" }} />;
  return (
    <React.Suspense fallback={<div style={{ minHeight: "100vh", background: "#ebe9f2" }} />}>
      <ReviewPage id={id} />
    </React.Suspense>
  );
}
