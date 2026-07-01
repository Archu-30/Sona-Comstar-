export type { ModuleKey } from '@/config/constants';

export interface InventoryItem {
  glAccount: number;
  valuationArea: number;
  material: string;
  description: string;
  totalStock: number;
  unit: string;
  totalValue: number;
  currency: string;
  type?: string;
}

export interface InventoryAgeingItem {
  material: string;
  materialDescription: string;
  plant: string;
  storageLocation: string;
  batch: string;
  baseUnit: string;
  unrestricted: number;
  currency: string;
  valueUnrestricted: number;
  transitTransfer: number;
  valInTransfer: number;
  qualityInspection: number;
  valueQualInsp: number;
  restrictedUse: number;
  valueRestricted: number;
  blocked: number;
  valueBlocked: number;
  returns: number;
  valueReturns: number;
  invoice: string;
  goodsRecipient: string;
  grIssueDate: number;
  agingDateOfReceipt: number;
  enteredOn: number;
  agingLastTransfer: number;
  manufactureDate: number;
  manufactureDateAging: number;
}

export interface ImportGITItem {
  invoiceNumber: string;
  invoiceDate: number;
  asnCreatedOn: number;
  material: string;
  materialDescription: string;
  vendorCode: number;
  currency: string;
  qty: number;
  rate: number;
  value: number;
  exRate: number;
  cyValue: number;
  product: string;
}

export interface KPIData {
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  format: 'currency' | 'number' | 'percent';
  icon: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortingState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DataResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  summary?: Record<string, number>;
}

export interface ExcelFileInfo {
  name: string;
  sheets: string[];
  path: string;
  size: number;
  lastModified: string;
}
