import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';

const API_BASE = 'http://localhost:5000';
const STALE_TIME = 5 * 60 * 1000;

function buildQueryString(module, params, debouncedSearch) {
  const sp = new URLSearchParams();
  sp.set('module', module);
  sp.set('page', String(params.page ?? 1));
  sp.set('pageSize', String(params.pageSize ?? 25));
  if (debouncedSearch) sp.set('search', debouncedSearch);
  if (params.sortField) sp.set('sortField', params.sortField);
  if (params.sortDir) sp.set('sortDir', params.sortDir);
  if (params.filters && Object.keys(params.filters).length > 0) {
    sp.set('filters', JSON.stringify(params.filters));
  }
  return sp.toString();
}

async function fetchData(module, params, debouncedSearch) {
  const qs = buildQueryString(module, params, debouncedSearch);
  const res = await fetch(`${API_BASE}/api/data?${qs}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Failed to fetch ${module} data`);
  }
  return res.json();
}

export function useInventoryData(params = {}) {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery({
    queryKey: [
      'inventory',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () => fetchData('inventory', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useAgeingData(params = {}) {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery({
    queryKey: [
      'ageing',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () => fetchData('ageing', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useImportData(params = {}) {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery({
    queryKey: [
      'git',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () => fetchData('git', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useDashboardSummary(filters = {}) {
  const { year, month } = filters;
  return useQuery({
    queryKey: ['dashboard-summary', year, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year && year !== 'all') params.set('year', year);
      if (month !== undefined && month !== '' && month !== 'all') params.set('month', month);
      const qs = params.toString();
      const url = `${API_BASE}/api/data/summary${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      return res.json();
    },
    staleTime: STALE_TIME,
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: async (params) => {
      const res = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? 'Failed to export data');
      }
      return res.blob();
    },
    onSuccess: (blob, params) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${params.module}-export.${params.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
