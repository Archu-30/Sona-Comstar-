import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API = 'http://localhost:5000';

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: () => axios.get(`${API}/api/filters`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useStorageAgeingReport(params, enabled = true) {
  return useQuery({
    queryKey: ['db-storage-ageing', params],
    queryFn: () =>
      axios.get(`${API}/api/db/storage-ageing`, { params }).then((r) => r.data),
    enabled,
    staleTime: 30000,
    retry: 1,
  });
}

export function useProductAgeingReport(params, enabled = true) {
  return useQuery({
    queryKey: ['db-product-ageing', params],
    queryFn: () =>
      axios.get(`${API}/api/db/product-ageing`, { params }).then((r) => r.data),
    enabled,
    staleTime: 30000,
    retry: 1,
  });
}

export function useClosingInventoryReport(params, enabled = true) {
  return useQuery({
    queryKey: ['db-closing-inventory', params],
    queryFn: () =>
      axios.get(`${API}/api/db/closing-inventory`, { params }).then((r) => r.data),
    enabled,
    staleTime: 30000,
    retry: 1,
  });
}

export function useGitReport(enabled = true) {
  return useQuery({
    queryKey: ['db-git'],
    queryFn: () => axios.get(`${API}/api/db/git`).then((r) => r.data),
    enabled,
    staleTime: 60000,
    retry: 1,
  });
}

export function useInventoryItems(params, enabled = true) {
  return useQuery({
    queryKey: ['db-inventory', params],
    queryFn: () =>
      axios.get(`${API}/api/db/inventory`, { params }).then((r) => r.data),
    enabled,
    staleTime: 30000,
    retry: 1,
  });
}

export function useReportHistory() {
  return useQuery({
    queryKey: ['report-history'],
    queryFn: () => axios.get(`${API}/api/history`).then((r) => r.data),
    staleTime: 10000,
    retry: 1,
  });
}
