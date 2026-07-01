import type { InventoryItem, InventoryAgeingItem, ImportGITItem } from '@/types';

const DEAD_STOCK_THRESHOLD_DAYS = 180;
const SLOW_MOVING_THRESHOLD_DAYS = 90;

// ─── Inventory Calculations ───

export function calculateInventoryValue(items: InventoryItem[]): number {
  return items.reduce((sum, item) => sum + item.totalValue, 0);
}

export function calculateStockQuantity(items: InventoryItem[]): number {
  return items.reduce((sum, item) => sum + item.totalStock, 0);
}

export function calculateUniqueMaterials(items: InventoryItem[]): number {
  return new Set(items.map((i) => i.material)).size;
}

export function calculateAvgUnitCost(items: InventoryItem[]): number {
  const totalValue = calculateInventoryValue(items);
  const totalStock = calculateStockQuantity(items);
  return totalStock > 0 ? totalValue / totalStock : 0;
}

export interface InventoryByTypeResult {
  type: string;
  count: number;
  totalValue: number;
  totalStock: number;
  percentage: number;
}

export function calculateInventoryByType(
  items: InventoryItem[]
): InventoryByTypeResult[] {
  const totalValue = calculateInventoryValue(items);
  const map = new Map<string, { count: number; totalValue: number; totalStock: number }>();
  for (const item of items) {
    const type = item.type || 'Unknown';
    const existing = map.get(type);
    if (existing) {
      existing.count++;
      existing.totalValue += item.totalValue;
      existing.totalStock += item.totalStock;
    } else {
      map.set(type, { count: 1, totalValue: item.totalValue, totalStock: item.totalStock });
    }
  }
  return Array.from(map.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    totalValue: Math.round(data.totalValue * 100) / 100,
    totalStock: data.totalStock,
    percentage: totalValue > 0 ? Math.round((data.totalValue / totalValue) * 10000) / 100 : 0,
  }));
}

export interface TopMaterialResult {
  material: string;
  description: string;
  totalValue: number;
}

export function calculateTopMaterials(
  items: InventoryItem[],
  count = 10
): TopMaterialResult[] {
  const map = new Map<string, { description: string; totalValue: number }>();
  for (const item of items) {
    const existing = map.get(item.material);
    if (existing) {
      existing.totalValue += item.totalValue;
    } else {
      map.set(item.material, {
        description: item.description,
        totalValue: item.totalValue,
      });
    }
  }
  return Array.from(map.entries())
    .map(([material, data]) => ({
      material,
      description: data.description,
      totalValue: Math.round(data.totalValue * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, count);
}

// ─── Month-over-Month ───

export function calculateMoM(
  currentValue: number,
  previousValue: number
): number {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

// ─── Ageing Calculations (using GR Issue Date) ───

export interface AgeingBucketResult {
  bucket: string;
  count: number;
  totalValue: number;
  totalQuantity: number;
  materialCount: number;
  avgAge: number;
  percentage: number;
}

export function calculateInventoryAge(grIssueDateMs: number): number {
  if (!grIssueDateMs || grIssueDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - grIssueDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getAgeBucket(days: number): string {
  if (days <= 0) return 'Unknown';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  return 'Above 365 Days';
}

const BUCKET_ORDER = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181-365 Days',
  'Above 365 Days',
  'Unknown',
];

export function calculateAgeing(
  items: InventoryAgeingItem[]
): AgeingBucketResult[] {
  const totalValue = items.reduce((s, i) => s + i.valueUnrestricted, 0);
  const buckets: Record<string, { count: number; totalValue: number; totalQuantity: number; materials: Set<string>; totalAge: number }> = {};

  for (const bucket of BUCKET_ORDER) {
    buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, materials: new Set(), totalAge: 0 };
  }

  for (const item of items) {
    const ageDays = item.grIssueDate > 0
      ? calculateInventoryAge(item.grIssueDate)
      : (item.agingDateOfReceipt ?? 0);
    const bucket = getAgeBucket(ageDays);

    if (!buckets[bucket]) {
      buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, materials: new Set(), totalAge: 0 };
    }

    buckets[bucket].count++;
    buckets[bucket].totalValue += item.valueUnrestricted;
    buckets[bucket].totalQuantity += item.unrestricted;
    buckets[bucket].materials.add(item.material);
    buckets[bucket].totalAge += ageDays;
  }

  return BUCKET_ORDER
    .filter((bucket) => buckets[bucket])
    .map((bucket) => {
      const data = buckets[bucket];
      return {
        bucket,
        count: data.count,
        totalValue: Math.round(data.totalValue * 100) / 100,
        totalQuantity: data.totalQuantity,
        materialCount: data.materials.size,
        avgAge: data.count > 0 ? Math.round(data.totalAge / data.count) : 0,
        percentage: totalValue > 0 ? Math.round((data.totalValue / totalValue) * 10000) / 100 : 0,
      };
    });
}

export function calculateAverageInventoryAge(items: InventoryAgeingItem[]): number {
  if (items.length === 0) return 0;
  let totalAge = 0;
  let count = 0;
  for (const item of items) {
    const ageDays = item.grIssueDate > 0
      ? calculateInventoryAge(item.grIssueDate)
      : (item.agingDateOfReceipt ?? 0);
    if (ageDays > 0) {
      totalAge += ageDays;
      count++;
    }
  }
  return count > 0 ? Math.round(totalAge / count) : 0;
}

// ─── Ageing by Storage Location ───

export interface StorageLocationAgeing {
  storageLocation: string;
  totalValue: number;
  totalQuantity: number;
  materialCount: number;
  avgAge: number;
}

export function calculateStorageLocationAgeing(
  items: InventoryAgeingItem[]
): StorageLocationAgeing[] {
  const map = new Map<string, { totalValue: number; totalQuantity: number; materials: Set<string>; totalAge: number; count: number }>();

  for (const item of items) {
    const loc = item.storageLocation || 'Unknown';
    const ageDays = item.grIssueDate > 0
      ? calculateInventoryAge(item.grIssueDate)
      : (item.agingDateOfReceipt ?? 0);

    const existing = map.get(loc);
    if (existing) {
      existing.totalValue += item.valueUnrestricted;
      existing.totalQuantity += item.unrestricted;
      existing.materials.add(item.material);
      existing.totalAge += ageDays;
      existing.count++;
    } else {
      map.set(loc, {
        totalValue: item.valueUnrestricted,
        totalQuantity: item.unrestricted,
        materials: new Set([item.material]),
        totalAge: ageDays,
        count: 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([storageLocation, data]) => ({
      storageLocation,
      totalValue: Math.round(data.totalValue * 100) / 100,
      totalQuantity: data.totalQuantity,
      materialCount: data.materials.size,
      avgAge: data.count > 0 ? Math.round(data.totalAge / data.count) : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// ─── Dead Stock & Slow Moving ───

export function calculateDeadStock(items: InventoryAgeingItem[]): number {
  return items
    .filter((i) => {
      const ageDays = i.grIssueDate > 0
        ? calculateInventoryAge(i.grIssueDate)
        : (i.agingDateOfReceipt ?? 0);
      return ageDays > DEAD_STOCK_THRESHOLD_DAYS;
    })
    .reduce((sum, i) => sum + i.valueUnrestricted, 0);
}

export function calculateDeadStockCount(items: InventoryAgeingItem[]): number {
  return new Set(
    items
      .filter((i) => {
        const ageDays = i.grIssueDate > 0
          ? calculateInventoryAge(i.grIssueDate)
          : (i.agingDateOfReceipt ?? 0);
        return ageDays > DEAD_STOCK_THRESHOLD_DAYS;
      })
      .map((i) => i.material)
  ).size;
}

export function calculateSlowMovingValue(items: InventoryAgeingItem[]): number {
  return items
    .filter((i) => {
      const ageDays = i.grIssueDate > 0
        ? calculateInventoryAge(i.grIssueDate)
        : (i.agingDateOfReceipt ?? 0);
      return ageDays > SLOW_MOVING_THRESHOLD_DAYS && ageDays <= DEAD_STOCK_THRESHOLD_DAYS;
    })
    .reduce((sum, i) => sum + i.valueUnrestricted, 0);
}

// ─── Import GIT Calculations ───

export function calculateImportValue(items: ImportGITItem[]): number {
  return items.reduce((sum, i) => sum + i.value, 0);
}

export function calculateImportCYValue(items: ImportGITItem[]): number {
  return items.reduce((sum, i) => sum + i.cyValue, 0);
}

export function calculateGitAge(invoiceDateMs: number): number {
  if (!invoiceDateMs || invoiceDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - invoiceDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export interface GitAgeingBucket {
  bucket: string;
  count: number;
  totalValue: number;
  totalQuantity: number;
  invoiceCount: number;
}

const GIT_BUCKET_ORDER = ['0-30 Days', '31-60 Days', '61-90 Days', 'Above 90 Days'];

export function getGitAgeBucket(days: number): string {
  if (days <= 0) return '0-30 Days';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  return 'Above 90 Days';
}

export function calculateGitAgeing(items: ImportGITItem[]): GitAgeingBucket[] {
  const buckets: Record<string, { count: number; totalValue: number; totalQuantity: number; invoices: Set<string> }> = {};

  for (const bucket of GIT_BUCKET_ORDER) {
    buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, invoices: new Set() };
  }

  for (const item of items) {
    const ageDays = calculateGitAge(item.invoiceDate);
    const bucket = getGitAgeBucket(ageDays);

    buckets[bucket].count++;
    buckets[bucket].totalValue += item.value;
    buckets[bucket].totalQuantity += item.qty;
    buckets[bucket].invoices.add(item.invoiceNumber);
  }

  return GIT_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: buckets[bucket].count,
    totalValue: Math.round(buckets[bucket].totalValue * 100) / 100,
    totalQuantity: buckets[bucket].totalQuantity,
    invoiceCount: buckets[bucket].invoices.size,
  }));
}

export function calculateCriticalGitInvoices(items: ImportGITItem[]): ImportGITItem[] {
  return items.filter((item) => calculateGitAge(item.invoiceDate) > 90);
}

// ─── Period / Monthly helpers ───

export interface PeriodSummary {
  period: string;
  totalValue: number;
  totalStock: number;
  materialCount: number;
  momValueChange: number;
  momQuantityChange: number;
}

export function calculatePeriodSummaries(
  periods: { period: string; items: InventoryItem[] }[]
): PeriodSummary[] {
  const summaries: PeriodSummary[] = [];

  for (let i = 0; i < periods.length; i++) {
    const { period, items } = periods[i];
    const totalValue = calculateInventoryValue(items);
    const totalStock = calculateStockQuantity(items);
    const materialCount = calculateUniqueMaterials(items);

    let momValueChange = 0;
    let momQuantityChange = 0;

    if (i > 0) {
      const prevItems = periods[i - 1].items;
      const prevValue = calculateInventoryValue(prevItems);
      const prevStock = calculateStockQuantity(prevItems);
      momValueChange = calculateMoM(totalValue, prevValue);
      momQuantityChange = calculateMoM(totalStock, prevStock);
    }

    summaries.push({
      period,
      totalValue: Math.round(totalValue * 100) / 100,
      totalStock,
      materialCount,
      momValueChange: Math.round(momValueChange * 100) / 100,
      momQuantityChange: Math.round(momQuantityChange * 100) / 100,
    });
  }

  return summaries;
}
