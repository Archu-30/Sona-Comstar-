'use client';

import {
  useQuery,
  useMutation,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  InventoryItem,
  InventoryAgeingItem,
  ImportGITItem,
  DataResponse,
} from '@/types';
import { useDebounce } from '@/hooks/use-debounce';

// --- Types ---

export interface DataQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string>;
  enabled?: boolean;
}

export interface DashboardSummary {
  inventory: {
    totalValue: number;
    totalStock: number;
    materialCount: number;
    momChange: number;
    topMaterialsByValue: {
      material: string;
      description: string;
      totalValue: number;
    }[];
    inventoryByType: {
      type: string;
      count: number;
      totalValue: number;
      totalStock: number;
      percentage: number;
    }[];
    periodSummaries: {
      period: string;
      totalValue: number;
      totalStock: number;
      materialCount: number;
      momValueChange: number;
      momQuantityChange: number;
    }[];
  };
  ageing: {
    totalItems: number;
    totalUnrestrictedValue: number;
    deadStockValue: number;
    deadStockCount: number;
    slowMovingValue: number;
    avgInventoryAge: number;
    buckets: {
      bucket: string;
      count: number;
      totalValue: number;
      totalQuantity: number;
      materialCount: number;
      avgAge: number;
      percentage: number;
    }[];
    storageLocationAgeing: {
      storageLocation: string;
      totalValue: number;
      totalQuantity: number;
      materialCount: number;
      avgAge: number;
    }[];
  };
  importStats: {
    totalImportValue: number;
    totalCYValue: number;
    vendorCount: number;
    itemCount: number;
    currencyBreakdown: {
      currency: string;
      totalValue: number;
      count: number;
    }[];
    importByProduct: {
      product: string;
      totalValue: number;
      totalCYValue: number;
      count: number;
    }[];
    gitAgeingBuckets: {
      bucket: string;
      count: number;
      totalValue: number;
      totalQuantity: number;
      invoiceCount: number;
    }[];
    criticalGitCount: number;
  };
  stockValueScatter: {
    material: string;
    description: string;
    stock: number;
    value: number;
  }[];
  aiInsights: {
    id: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    category: 'trend' | 'risk' | 'recommendation' | 'opportunity';
    metric?: string;
    value?: string;
  }[];
}

interface ExportParams {
  module: 'inventory' | 'ageing' | 'git';
  format: 'xlsx' | 'csv';
  filters?: Record<string, string>;
  search?: string;
}

// --- Fetch helpers ---

const STALE_TIME = 5 * 60 * 1000;

function buildQueryString(
  module: string,
  params: DataQueryParams,
  debouncedSearch: string
): string {
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

async function fetchData<T>(
  module: string,
  params: DataQueryParams,
  debouncedSearch: string
): Promise<DataResponse<T>> {
  const qs = buildQueryString(module, params, debouncedSearch);
  const res = await fetch(`/api/data?${qs}`);
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorBody?.error ?? `Failed to fetch ${module} data`);
  }
  return res.json() as Promise<DataResponse<T>>;
}

// --- Hooks ---

export function useInventoryData(
  params: DataQueryParams = {}
): UseQueryResult<DataResponse<InventoryItem>> {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery<DataResponse<InventoryItem>>({
    queryKey: [
      'inventory',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () =>
      fetchData<InventoryItem>('inventory', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useAgeingData(
  params: DataQueryParams = {}
): UseQueryResult<DataResponse<InventoryAgeingItem>> {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery<DataResponse<InventoryAgeingItem>>({
    queryKey: [
      'ageing',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () =>
      fetchData<InventoryAgeingItem>('ageing', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useImportData(
  params: DataQueryParams = {}
): UseQueryResult<DataResponse<ImportGITItem>> {
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  return useQuery<DataResponse<ImportGITItem>>({
    queryKey: [
      'git',
      params.page,
      params.pageSize,
      debouncedSearch,
      params.sortField,
      params.sortDir,
      params.filters,
    ],
    queryFn: () =>
      fetchData<ImportGITItem>('git', params, debouncedSearch),
    staleTime: STALE_TIME,
    enabled: params.enabled !== false,
  });
}

export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await fetch('/api/data/summary');
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      return res.json() as Promise<DashboardSummary>;
    },
    staleTime: STALE_TIME,
  });
}

export function useExportData(): UseMutationResult<
  Blob,
  Error,
  ExportParams
> {
  return useMutation<Blob, Error, ExportParams>({
    mutationFn: async (params: ExportParams) => {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
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
