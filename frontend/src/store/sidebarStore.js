import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSidebarStore = create(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setMobileOpen: (open) => set({ isMobileOpen: open }),
    }),
    {
      name: "sona-sidebar",
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
);
