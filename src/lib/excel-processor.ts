import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type {
  InventoryItem,
  InventoryAgeingItem,
  ImportGITItem,
} from '@/types';

// --- File paths ---
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function readWorkbook(filePath: string): XLSX.WorkBook {
  const buf = fs.readFileSync(filePath);
  return XLSX.read(buf, { type: 'buffer' });
}

const FILES = {
  closingInventory: path.join(DATA_DIR, 'Closing Inventory.xlsx'),
  closingInventoryNew: path.join(
    DATA_DIR,
    "Closing Inventory-Apr'26-May'26.xlsx"
  ),
  inventoryAgeing: path.join(
    DATA_DIR,
    'Inventory Ageing Report_24062026.XLSX'
  ),
  importGIT: path.join(DATA_DIR, "Import GIT-May'2026.xlsb"),
} as const;

// --- In-memory cache ---
interface CachedData {
  closingInventory: Map<string, InventoryItem[]>;
  inventoryAgeing: InventoryAgeingItem[];
  importGIT: ImportGITItem[];
  loadedAt: number;
}

let cachedData: CachedData | null = null;

// --- Helpers ---

function trimStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function trimKeys(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.trim()] = value;
  }
  return result;
}

/**
 * Convert an Excel serial date number to a JavaScript Date timestamp (ms).
 * Excel epoch starts 1900-01-01 (serial 1), with the Lotus 1-2-3 leap-year bug
 * treating 1900 as a leap year (serial 60 = Feb 29 1900, which doesn't exist).
 */
function excelSerialToTimestamp(serial: unknown): number {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Excel epoch: Jan 0 1900 = serial 0
  // Adjust for Lotus bug: serials > 60 are off by 1 day
  const adjusted = n > 60 ? n - 1 : n;
  // 86400000 = ms per day; Excel serial 1 = Jan 1 1900
  const msFromEpoch = (adjusted - 1) * 86400000;
  const excelEpoch = new Date(1900, 0, 1).getTime();
  return excelEpoch + msFromEpoch;
}

// --- Parsers ---

function parseClosingInventorySheet(
  sheet: XLSX.WorkSheet,
  hasType: boolean
): InventoryItem[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  return rawRows.map((rawRow) => {
    const row = trimKeys(rawRow);
    const item: InventoryItem = {
      glAccount: toNumber(row['G/L Acct'] ?? row['G/L Account']),
      valuationArea: toNumber(row['ValA'] ?? row['Valuation Area']),
      material: trimStr(row['Material']),
      description: trimStr(row['Description']),
      totalStock: toNumber(row['Total Stock']),
      unit: trimStr(row['BUn'] ?? row['Base Unit']),
      totalValue: toNumber(row['Total Value']),
      currency: trimStr(row['Crcy'] ?? row['Currency']),
    };
    if (hasType) {
      item.type = trimStr(row['Type']);
    }
    return item;
  });
}

function parseInventoryAgeing(sheet: XLSX.WorkSheet): InventoryAgeingItem[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  return rawRows.map((rawRow) => {
    const row = trimKeys(rawRow);
    return {
      material: trimStr(row['Material']),
      materialDescription: trimStr(
        row['Material Description'] ?? row['Material description']
      ),
      plant: trimStr(row['Plant']),
      storageLocation: trimStr(
        row['Storage Location'] ?? row['Storage location'] ?? row['Stge loc.']
      ),
      batch: trimStr(row['Batch']),
      baseUnit: trimStr(
        row['Base Unit of Measure'] ?? row['Base Unit'] ?? row['Base unit of measure']
      ),
      unrestricted: toNumber(row['Unrestricted']),
      currency: trimStr(row['Currency'] ?? row['Crcy']),
      valueUnrestricted: toNumber(
        row['Value Unrestricted'] ?? row['Val. unrestricted']
      ),
      transitTransfer: toNumber(
        row['Transit and Transfer'] ?? row['Transit/Transfer'] ?? row['Transit/Transf.']
      ),
      valInTransfer: toNumber(
        row['Val. in Trans./Tfr'] ?? row['Val.in Transfer'] ?? row['Val. in transfer']
      ),
      qualityInspection: toNumber(
        row['Quality Inspection'] ?? row['Quality inspection']
      ),
      valueQualInsp: toNumber(
        row['Value in QualInsp.'] ?? row['Value Qual.Insp.'] ?? row['Val. qual. insp.']
      ),
      restrictedUse: toNumber(
        row['Restricted-Use Stock'] ?? row['Restricted'] ?? row['Restricted-use']
      ),
      valueRestricted: toNumber(
        row['Value Restricted'] ?? row['Val. restricted']
      ),
      blocked: toNumber(row['Blocked']),
      valueBlocked: toNumber(
        row['Value BlockedStock'] ?? row['Value Blocked'] ?? row['Val. blocked']
      ),
      returns: toNumber(row['Returns']),
      valueReturns: toNumber(
        row['Value Rets Blocked'] ?? row['Value Returns'] ?? row['Val. returns']
      ),
      invoice: trimStr(row['Invoice']),
      goodsRecipient: trimStr(
        row['Goods Recipient Number'] ?? row['Goods recipient']
      ),
      grIssueDate: excelSerialToTimestamp(
        row['GR Issue date'] ?? row['GR issue date']
      ),
      agingDateOfReceipt: toNumber(
        row['Aging(Date of Rcpt)'] ??
          row['Aging: Date of receipt'] ??
          row['AgingDateOfReceipt']
      ),
      enteredOn: excelSerialToTimestamp(
        row['Entered On'] ?? row['Entered on'] ?? row['EnteredOn']
      ),
      agingLastTransfer: toNumber(
        row['Aging(Last Date of Trnsfr)'] ??
          row['Aging: last transfer'] ??
          row['AgingLastTransfer']
      ),
      manufactureDate: excelSerialToTimestamp(
        row['Manufacture Date'] ?? row['Manufacture date'] ?? row['ManufactureDate']
      ),
      manufactureDateAging: toNumber(
        row['Manufacture Date Aging'] ??
          row['Manufacture date aging'] ??
          row['ManufactureDateAging']
      ),
    };
  });
}

function parseImportGIT(sheet: XLSX.WorkSheet): ImportGITItem[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    range: 1,
  });
  return rawRows
    .map((rawRow) => trimKeys(rawRow))
    .filter((row) => {
      const material = trimStr(row['Material']);
      return material.length > 0;
    })
    .map((row) => ({
      invoiceNumber: trimStr(row['Invoice Number']),
      invoiceDate: excelSerialToTimestamp(row['Invoice Date']),
      asnCreatedOn: excelSerialToTimestamp(row['ASN Created On']),
      material: trimStr(row['Material']),
      materialDescription: trimStr(row['Material Description']),
      vendorCode: toNumber(row['Vendor Code']),
      currency: trimStr(row['Currency']),
      qty: toNumber(row['Qty']),
      rate: toNumber(row['Rate']),
      value: toNumber(row['Value']),
      exRate: toNumber(row['EX R']),
      cyValue: toNumber(row['CY Value']),
      product: trimStr(row['Product']),
    }));
}

// --- Loader ---

function loadAllData(): CachedData {
  if (cachedData) {
    return cachedData;
  }

  const closingInventory = new Map<string, InventoryItem[]>();

  try {
    // Primary source: Closing Inventory-Apr'26-May'26.xlsx (has Type column)
    const wb = readWorkbook(FILES.closingInventoryNew);
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (sheet) {
        closingInventory.set(sheetName, parseClosingInventorySheet(sheet, true));
      }
    }
  } catch (err) {
    console.error("Error reading Closing Inventory-Apr'26-May'26:", err);
    // Fallback to older file without Type column
    try {
      const wb1 = readWorkbook(FILES.closingInventory);
      for (const sheetName of wb1.SheetNames) {
        const sheet = wb1.Sheets[sheetName];
        if (sheet) {
          closingInventory.set(sheetName, parseClosingInventorySheet(sheet, false));
        }
      }
    } catch (err2) {
      console.error('Error reading Closing Inventory fallback:', err2);
    }
  }

  let inventoryAgeing: InventoryAgeingItem[] = [];
  try {
    const wb3 = readWorkbook(FILES.inventoryAgeing);
    const firstSheet = wb3.Sheets[wb3.SheetNames[0]];
    if (firstSheet) {
      inventoryAgeing = parseInventoryAgeing(firstSheet);
    }
  } catch (err) {
    console.error('Error reading Inventory Ageing Report:', err);
  }

  let importGIT: ImportGITItem[] = [];
  try {
    const wb4 = readWorkbook(FILES.importGIT);
    const firstSheet = wb4.Sheets[wb4.SheetNames[0]];
    if (firstSheet) {
      importGIT = parseImportGIT(firstSheet);
    }
  } catch (err) {
    console.error('Error reading Import GIT:', err);
  }

  cachedData = {
    closingInventory,
    inventoryAgeing,
    importGIT,
    loadedAt: Date.now(),
  };

  return cachedData;
}

// --- Public API ---

export interface ClosingInventoryResult {
  period: string;
  items: InventoryItem[];
}

/**
 * Get closing inventory data for a specific period or all periods.
 * @param period - Sheet name (e.g. "May 2025") or undefined for all periods.
 */
export function getClosingInventory(
  period?: string
): ClosingInventoryResult[] {
  const data = loadAllData();
  if (period) {
    const items = data.closingInventory.get(period);
    if (!items) {
      // Try case-insensitive match
      for (const [key, value] of data.closingInventory.entries()) {
        if (key.toLowerCase().includes(period.toLowerCase())) {
          return [{ period: key, items: value }];
        }
      }
      return [];
    }
    return [{ period, items }];
  }
  const results: ClosingInventoryResult[] = [];
  for (const [key, value] of data.closingInventory.entries()) {
    results.push({ period: key, items: value });
  }
  return results;
}

/**
 * Get all closing inventory items flattened across periods.
 */
export function getClosingInventoryFlat(): InventoryItem[] {
  const results = getClosingInventory();
  return results.flatMap((r) => r.items);
}

/**
 * Get inventory ageing data.
 */
export function getInventoryAgeing(): InventoryAgeingItem[] {
  return loadAllData().inventoryAgeing;
}

/**
 * Get import GIT data.
 */
export function getImportGIT(): ImportGITItem[] {
  return loadAllData().importGIT;
}

/**
 * Get all data across modules.
 */
export function getAllData(): {
  closingInventory: ClosingInventoryResult[];
  inventoryAgeing: InventoryAgeingItem[];
  importGIT: ImportGITItem[];
} {
  const data = loadAllData();
  const closingInventory: ClosingInventoryResult[] = [];
  for (const [key, value] of data.closingInventory.entries()) {
    closingInventory.push({ period: key, items: value });
  }
  return {
    closingInventory,
    inventoryAgeing: data.inventoryAgeing,
    importGIT: data.importGIT,
  };
}

/**
 * Get the available sheet/period names for closing inventory.
 */
export function getAvailablePeriods(): string[] {
  const data = loadAllData();
  return Array.from(data.closingInventory.keys());
}

/**
 * Clear the in-memory cache (useful for dev/testing).
 */
export function clearCache(): void {
  cachedData = null;
}
