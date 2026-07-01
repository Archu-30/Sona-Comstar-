// ─── Storage Locations ───
export const STORAGE_LOCATIONS = [
  'HDHS',
  'HDNW',
  'RJNW',
  'RJRR',
  'RJSR',
  'WIPS',
  'WIEV',
  'WIPH',
  'WICQ',
  'WSMT',
  'REFG',
  'QUSM',
  'SCRA',
] as const;

export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

// ─── Closing Inventory Types ───
export const INVENTORY_TYPES = ['YBOP', 'YFGS', 'YSFG', 'YSCP'] as const;

export type InventoryType = (typeof INVENTORY_TYPES)[number];

// ─── Storage Age Buckets ───
export const STORAGE_AGE_BUCKETS = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181-365 Days',
  'Above 365 Days',
] as const;

export type StorageAgeBucket = (typeof STORAGE_AGE_BUCKETS)[number];

// ─── GIT Age Buckets ───
export const GIT_AGE_BUCKETS = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  'Above 90 Days',
] as const;

export type GitAgeBucket = (typeof GIT_AGE_BUCKETS)[number];

// ─── Thresholds ───
export const DEAD_STOCK_THRESHOLD_DAYS = 180;
export const SLOW_MOVING_THRESHOLD_DAYS = 90;
export const CRITICAL_GIT_THRESHOLD_DAYS = 90;

// ─── Module Keys ───
export type ModuleKey =
  | 'dashboard'
  | 'closing-inventory'
  | 'storage-ageing'
  | 'in-transit'
  | 'reports'
  | 'ai-insights';
