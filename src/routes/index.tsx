import { createFileRoute } from "@tanstack/react-router";

import FocusApp from "@/components/focus/FocusApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FOCUS" },
      {
        name: "description",
        content: "מערכת ההפעלה של העסק — פרויקטים, משימות, אחסון, כספים ופוקוס.",
      },
      { name: "theme-color", content: "#0B1424" },
    ],
  }),
  component: FocusApp,
});
