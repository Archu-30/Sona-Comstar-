import { NextRequest, NextResponse } from 'next/server';
import {
  getClosingInventoryFlat,
  getInventoryAgeing,
  getImportGIT,
  getAllData,
} from '@/lib/excel-processor';
import type {
  InventoryItem,
  InventoryAgeingItem,
  ImportGITItem,
} from '@/types';
import { STORAGE_LOCATIONS } from '@/config/constants';

type DataRow = InventoryItem | InventoryAgeingItem | ImportGITItem;

interface ParsedFilters {
  [key: string]: string;
}

function matchesSearch(row: DataRow, search: string): boolean {
  const lowerSearch = search.toLowerCase();
  return Object.values(row).some((val) => {
    if (val === null || val === undefined) return false;
    return String(val).toLowerCase().includes(lowerSearch);
  });
}

function matchesFilters(row: DataRow, filters: ParsedFilters): boolean {
  const record = row as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    const fieldVal = String(record[key] ?? '').toLowerCase();
    if (!fieldVal.includes(value.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function sortData<T extends DataRow>(
  data: T[],
  sortField: string,
  sortDir: string
): T[] {
  if (!sortField) return data;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const aRecord = a as unknown as Record<string, unknown>;
    const bRecord = b as unknown as Record<string, unknown>;
    const aVal = aRecord[sortField];
    const bVal = bRecord[sortField];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir;
    }
    return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
  });
}

function computeSummary(
  module: string,
  data: DataRow[]
): Record<string, number> {
  const summary: Record<string, number> = { count: data.length };

  if (module === 'inventory') {
    const items = data as InventoryItem[];
    summary.totalValue = items.reduce((s, i) => s + i.totalValue, 0);
    summary.totalStock = items.reduce((s, i) => s + i.totalStock, 0);
    summary.materialCount = new Set(items.map((i) => i.material)).size;
  } else if (module === 'ageing') {
    const items = data as InventoryAgeingItem[];
    summary.totalUnrestricted = items.reduce(
      (s, i) => s + i.valueUnrestricted,
      0
    );
    summary.totalBlocked = items.reduce((s, i) => s + i.valueBlocked, 0);
    summary.materialCount = new Set(items.map((i) => i.material)).size;
  } else if (module === 'git') {
    const items = data as ImportGITItem[];
    summary.totalValue = items.reduce((s, i) => s + i.value, 0);
    summary.totalCYValue = items.reduce((s, i) => s + i.cyValue, 0);
    summary.vendorCount = new Set(items.map((i) => i.vendorCode)).size;
  }

  return summary;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const module = searchParams.get('module') ?? 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10))
    );
    const search = searchParams.get('search') ?? '';
    const sortField = searchParams.get('sortField') ?? '';
    const sortDir = searchParams.get('sortDir') ?? 'asc';

    let filters: ParsedFilters = {};
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam) as ParsedFilters;
      } catch {
        // ignore malformed filters
      }
    }

    let rawData: DataRow[];

    switch (module) {
      case 'inventory':
        rawData = getClosingInventoryFlat();
        break;
      case 'ageing': {
        const allowedLocs = new Set<string>(STORAGE_LOCATIONS);
        rawData = getInventoryAgeing().filter(
          (item) => allowedLocs.has(item.storageLocation)
        );
        break;
      }
      case 'git':
        rawData = getImportGIT();
        break;
      case 'all': {
        const all = getAllData();
        rawData = [
          ...all.closingInventory.flatMap((r) => r.items),
          ...all.inventoryAgeing,
          ...all.importGIT,
        ];
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unknown module: ${module}` },
          { status: 400 }
        );
    }

    // Filter
    let filtered = rawData;
    if (search) {
      filtered = filtered.filter((row) => matchesSearch(row, search));
    }
    if (Object.keys(filters).length > 0) {
      filtered = filtered.filter((row) => matchesFilters(row, filters));
    }

    // Sort
    const sorted = sortData(filtered, sortField, sortDir);

    // Summary (on filtered data)
    const summary = computeSummary(module, sorted);

    // Paginate
    const total = sorted.length;
    const startIdx = (page - 1) * pageSize;
    const paginatedData = sorted.slice(startIdx, startIdx + pageSize);

    return NextResponse.json({
      data: paginatedData,
      total,
      page,
      pageSize,
      summary,
    });
  } catch (error) {
    console.error('Data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
