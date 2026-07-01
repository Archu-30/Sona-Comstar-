import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleKey } from '@/types';

interface ModuleFilters {
  search: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  filters: Record<string, string>;
  page: number;
  pageSize: number;
}

const defaultModuleFilters: ModuleFilters = {
  search: '',
  sortField: '',
  sortDir: 'asc',
  filters: {},
  page: 1,
  pageSize: 25,
};

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Navigation
  currentModule: ModuleKey;
  setCurrentModule: (module: ModuleKey) => void;

  // Global search
  globalSearch: string;
  setGlobalSearch: (search: string) => void;

  // Per-module filters
  moduleFilters: Partial<Record<ModuleKey, ModuleFilters>>;
  getModuleFilters: (module: ModuleKey) => ModuleFilters;
  setModuleFilter: (
    module: ModuleKey,
    updates: Partial<ModuleFilters>
  ) => void;
  resetModuleFilters: (module: ModuleKey) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      // Navigation
      currentModule: 'dashboard',
      setCurrentModule: (module) => set({ currentModule: module }),

      // Global search
      globalSearch: '',
      setGlobalSearch: (search) => set({ globalSearch: search }),

      // Per-module filters
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

      // Theme
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
