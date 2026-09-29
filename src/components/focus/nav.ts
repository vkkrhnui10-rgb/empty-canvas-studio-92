import { createContext, useContext } from "react";
import type { View } from "./types";

export interface Nav {
  view: View;
  projectId: string | null;
  go: (view: View, projectId?: string | null) => void;
  openTask: (id: string) => void;
  editProject: (id: string | "new") => void;
  quickAdd: (preset?: { projectId?: string; today?: boolean }) => void;
  openPalette: () => void;
  openFloating: () => void;
  floatingOpen: boolean;
}
export const NavCtx = createContext<Nav | null>(null);
export const useNav = () => {
  const n = useContext(NavCtx);
  if (!n) throw new Error("NavCtx missing");
  return n;
};
