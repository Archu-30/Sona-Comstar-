import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultModuleFilters = {
  search: '',
  sortField: '',
  sortDir: 'asc',
  filters: {},
  page: 1,
  pageSize: 25,
};

export const useAppStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      currentModule: 'dashboard',
      setCurrentModule: (module) => set({ currentModule: module }),

      globalSearch: '',
      setGlobalSearch: (search) => set({ globalSearch: search }),

      moduleFilters: {},
      getModuleFilters: (module) => {
        return get().moduleFilters[module] ?? { ...defaultModuleFilters };
      },
      setModuleFilter: (module, updates) =>
        set((state) => ({
          moduleFilters: {
            ...state.moduleFilters,
            [module]: {
              ...(state.moduleFilters[module] ?? { ...defaultModuleFilters }),
              ...updates,
            },
          },
        })),
      resetModuleFilters: (module) =>
        set((state) => ({
          moduleFilters: {
            ...state.moduleFilters,
            [module]: { ...defaultModuleFilters },
          },
        })),

      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'sona-app-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        currentModule: state.currentModule,
      }),
    }
  )
);
