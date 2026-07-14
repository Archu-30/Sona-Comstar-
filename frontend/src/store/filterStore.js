import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT = {
  years: [],
  months: [],
  products: [],
  locations: [],
  materials: [],
  dates: [],
  days: [],
  materialSearch: '',
};

export const useFilterStore = create(
  persist(
    (set) => ({
      ...DEFAULT,

      setYears:     (v) => set({ years: v }),
      setMonths:    (v) => set({ months: v }),
      setProducts:  (v) => set({ products: v }),
      setLocations: (v) => set({ locations: v }),
      setMaterials: (v) => set({ materials: v }),
      setDates:     (v) => set({ dates: v }),
      setDays:      (v) => set({ days: v }),
      setMaterialSearch:(v) => set({ materialSearch: v }),

      setFilters: (obj) => set(obj),

      resetAll: () => set(DEFAULT),

      toQueryParams() {
        const s = useFilterStore.getState();
        const p = new URLSearchParams();
        if (s.years.length)      p.set('years',      JSON.stringify(s.years));
        if (s.months.length)     p.set('months',     JSON.stringify(s.months));
        if (s.products.length)   p.set('products',   JSON.stringify(s.products));
        if (s.locations.length)  p.set('locations',  JSON.stringify(s.locations));
        if (s.materials.length)  p.set('materials',  JSON.stringify(s.materials));
        if (s.ageBuckets.length) p.set('ageBuckets', JSON.stringify(s.ageBuckets));
        return p.toString();
      },
    }),
    { name: 'sona-global-filters', version: 1 }
  )
);

export function filtersToParams(filters) {
  const p = {};
  if (filters.years?.length)      p.years      = JSON.stringify(filters.years);
  if (filters.months?.length)     p.months     = JSON.stringify(filters.months);
  if (filters.products?.length)   p.products   = JSON.stringify(filters.products);
  if (filters.locations?.length)  p.locations  = JSON.stringify(filters.locations);
  if (filters.materials?.length)  p.materials  = JSON.stringify(filters.materials);
  if (filters.dates?.length)     p.dates      = JSON.stringify(filters.dates);
  if (filters.days?.length)      p.days       = JSON.stringify(filters.days);
  return p;
}

export function activeFilterCount(filters) {
  return (
    (filters.years?.length || 0) +
    (filters.months?.length || 0) +
    (filters.products?.length || 0) +
    (filters.locations?.length || 0) +
    (filters.materials?.length || 0) +
    (filters.dates?.length || 0) +
    (filters.days?.length || 0)
  );
}
