const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// --- File paths ---
const DATA_DIR = path.join(__dirname, 'data');

function readWorkbook(filePath) {
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
    'Inventory Ageing Report_24062026 summary.XLSX'
  ),
  inventoryAgeingLegacy: path.join(
    DATA_DIR,
    'Inventory Ageing Report_24062026.XLSX'
  ),
  importGIT: path.join(DATA_DIR, "Import GIT-May'2026.xlsb"),
  summaryReport: path.join(DATA_DIR, 'SUMMARY FILE.xlsx'),
};

function setSourceFile(kind, filePath) {
  if (kind === 'ageing') FILES.inventoryAgeing = filePath;
  else if (kind === 'git') FILES.importGIT = filePath;
  else if (kind === 'summary') FILES.summaryReport = filePath;
  else throw new Error('Unknown source kind: ' + kind);
  cachedData = null;
}

function getSummaryReportPath() {
  return FILES.summaryReport;
}

// Latest uploaded inventory ageing file wins over the bundled default.
// Uploads are saved as "upload_<timestamp>_<original name>" in DATA_DIR.
function resolveLatestAgeingFile() {
  try {
    const uploads = fs
      .readdirSync(DATA_DIR)
      .filter((f) => /^upload_\d+_.*(ageing|aging).*\.(xlsx|xls|xlsb)$/i.test(f))
      .map((f) => ({ f, ts: Number(f.match(/^upload_(\d+)_/)[1]) }))
      .sort((a, b) => b.ts - a.ts);
    if (uploads.length > 0) {
      const latest = path.join(DATA_DIR, uploads[0].f);
      console.log(`[DATA LOAD] Using latest uploaded ageing file: ${uploads[0].f}`);
      return latest;
    }
  } catch (err) {
    console.error('[DATA LOAD] Upload scan failed:', err.message);
  }
  return FILES.inventoryAgeing;
}

function getSourceFiles() {
  return { ...FILES };
}

// --- In-memory cache ---
let cachedData = null;

// --- Helpers ---

function trimStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function trimKeys(row) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.trim()] = value;
  }
  return result;
}

function excelSerialToTimestamp(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const adjusted = n > 60 ? n - 1 : n;
  const msFromEpoch = (adjusted - 1) * 86400000;
  const excelEpoch = new Date(1900, 0, 1).getTime();
  return excelEpoch + msFromEpoch;
}

function parseAnyDate(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  if (Number.isFinite(n) && n > 0) {
    if (n > 25569 && n < 60000) return excelSerialToTimestamp(n);
    if (n > 946684800000) return n;
    if (n > 946684800) return n * 1000;
    return excelSerialToTimestamp(n);
  }
  const s = String(val).trim();
  if (!s) return 0;
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const d = parseInt(ddmmyyyy[1], 10);
    const m = parseInt(ddmmyyyy[2], 10) - 1;
    const y = parseInt(ddmmyyyy[3], 10);
    return new Date(y, m, d).getTime();
  }
  const yyyymmdd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yyyymmdd) {
    const y = parseInt(yyyymmdd[1], 10);
    const m = parseInt(yyyymmdd[2], 10) - 1;
    const d = parseInt(yyyymmdd[3], 10);
    return new Date(y, m, d).getTime();
  }
  const ts = Date.parse(s);
  if (Number.isFinite(ts) && ts > 0) return ts;
  return 0;
}

// --- Dynamic header detection ---

function findHeaderRow(sheet, knownHeaders) {
  const ref = sheet['!ref'];
  if (!ref) return -1;
  const range = XLSX.utils.decode_range(ref);
  const maxScan = Math.min(range.e.r, 20);
  const lowerHeaders = knownHeaders.map((h) => h.toLowerCase());

  for (let r = range.s.r; r <= maxScan; r++) {
    let matchCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined) {
        const val = String(cell.v).trim().toLowerCase();
        if (lowerHeaders.includes(val)) matchCount++;
      }
    }
    if (matchCount >= 3) return r;
  }
  return -1;
}

function sheetToJsonFromRow(sheet, headerRow) {
  const ref = sheet['!ref'];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const startRow = headerRow > 0 ? headerRow : range.s.r;

  // Find the actual last row with data by scanning backwards from the end
  let lastDataRow = range.e.r;
  if (range.e.r - startRow > 100000) {
    // Sheet claims way too many rows — find where data actually ends
    // Scan first 5 columns to find last row with actual content
    lastDataRow = startRow;
    for (let r = startRow + 1; r <= range.e.r; r++) {
      let hasData = false;
      for (let c = range.s.c; c <= Math.min(range.s.c + 4, range.e.c); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v !== undefined && cell.v !== '') { hasData = true; break; }
      }
      if (hasData) {
        lastDataRow = r;
      } else if (r - lastDataRow > 50) {
        // 50 consecutive empty rows = end of data
        break;
      }
    }
    console.log(`[PARSE] Sheet range ${ref} trimmed to actual data rows: ${startRow + 1} to ${lastDataRow + 1}`);
    const trimmedRange = { s: { r: startRow, c: range.s.c }, e: { r: lastDataRow, c: range.e.c } };
    return XLSX.utils.sheet_to_json(sheet, { defval: '', range: trimmedRange });
  }

  if (headerRow > 0) {
    return XLSX.utils.sheet_to_json(sheet, { defval: '', range: headerRow });
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function resolveColumn(row, ...names) {
  const lowercaseNames = names.map((n) => String(n).trim().toLowerCase());
  for (const name of lowercaseNames) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === name) {
        const val = row[key];
        if (val !== undefined && val !== '') return val;
      }
    }
  }
  return undefined;
}

// --- Parsers ---

const AGEING_KNOWN_HEADERS = [
  'Material', 'Material Description', 'Plant', 'Storage Location',
  'Batch', 'Unrestricted', 'Value Unrestricted', 'Val. unrestricted',
  'Blocked', 'Currency', 'GR Issue date', 'GR issue date',
  'Base Unit of Measure', 'TYPE', 'Type', 'AGE BUCKET', 'Age Bucket',
  'Stge loc.', 'Base Unit', 'Val. in Trans./Tfr',
];

const GIT_KNOWN_HEADERS = [
  'Invoice Number', 'Invoice Date', 'Material', 'Material Description',
  'Vendor Code', 'Currency', 'Qty', 'Rate', 'Value', 'Product',
  'ASN Created On', 'EX R', 'CY Value',
];

const CLOSING_KNOWN_HEADERS = [
  'Material', 'Description', 'Total Stock', 'Total Value',
  'G/L Acct', 'G/L Account', 'Currency', 'Crcy', 'Type',
  'ValA', 'Valuation Area', 'BUn', 'Base Unit',
];

function parseClosingInventorySheet(sheet, hasType) {
  const headerRow = findHeaderRow(sheet, CLOSING_KNOWN_HEADERS);
  const rawRows = sheetToJsonFromRow(sheet, headerRow);
  return rawRows
    .map((rawRow) => {
      const row = trimKeys(rawRow);
      const material = trimStr(resolveColumn(row, 'Material'));
      if (!material) return null;
      const item = {
        glAccount: toNumber(resolveColumn(row, 'G/L Acct', 'G/L Account')),
        valuationArea: toNumber(resolveColumn(row, 'ValA', 'Valuation Area')),
        material,
        description: trimStr(resolveColumn(row, 'Description')),
        totalStock: toNumber(resolveColumn(row, 'Total Stock')),
        unit: trimStr(resolveColumn(row, 'BUn', 'Base Unit')),
        totalValue: toNumber(resolveColumn(row, 'Total Value')),
        currency: trimStr(resolveColumn(row, 'Crcy', 'Currency')),
      };
      if (hasType) {
        item.type = trimStr(resolveColumn(row, 'Type'));
      }
      return item;
    })
    .filter(Boolean);
}

function parseInventoryAgeing(sheet) {
  const headerRow = findHeaderRow(sheet, AGEING_KNOWN_HEADERS);
  if (headerRow < 0) {
    console.error('[PARSE] Could not find ageing header row. Known headers not found in first 20 rows.');
    return [];
  }
  console.log(`[PARSE] Ageing header row detected at Excel row ${headerRow + 1}`);

  const rawRows = sheetToJsonFromRow(sheet, headerRow);
  const validRows = [];
  const missingCols = new Set();

  for (const rawRow of rawRows) {
    const row = trimKeys(rawRow);
    const material = trimStr(resolveColumn(row, 'Material'));
    if (!material) continue;

    const grDateRaw = resolveColumn(row, 'GR Issue date', 'GR issue date', 'GR Issue Date');
    if (grDateRaw === undefined && !missingCols.has('GR Issue date')) {
      const hasCol = ['GR Issue date', 'GR issue date', 'GR Issue Date'].some((n) => n in row);
      if (!hasCol) {
        missingCols.add('GR Issue date');
        console.warn('[PARSE] Column "GR Issue date" not found. Available columns:', Object.keys(row).join(', '));
      }
    }

    validRows.push({
      material,
      materialDescription: trimStr(
        resolveColumn(row, 'Material Description', 'Material description')
      ),
      plant: trimStr(resolveColumn(row, 'Plant')),
      storageLocation: trimStr(
        resolveColumn(row, 'Storage Location', 'Storage location', 'Stge loc.')
      ),
      batch: trimStr(resolveColumn(row, 'Batch')),
      baseUnit: trimStr(
        resolveColumn(row, 'Base Unit of Measure', 'Base Unit', 'Base unit of measure')
      ),
      unrestricted: toNumber(resolveColumn(row, 'Unrestricted')),
      currency: trimStr(resolveColumn(row, 'Currency', 'Crcy')),
      valueUnrestricted: toNumber(
        resolveColumn(row, 'Value Unrestricted', 'Val. unrestricted')
      ),
      transitTransfer: toNumber(
        resolveColumn(row, 'Transit and Transfer', 'Transit/Transfer', 'Transit/Transf.')
      ),
      valInTransfer: toNumber(
        resolveColumn(row, 'Val. in Trans./Tfr', 'Val.in Transfer', 'Val. in transfer')
      ),
      qualityInspection: toNumber(
        resolveColumn(row, 'Quality Inspection', 'Quality inspection')
      ),
      valueQualInsp: toNumber(
        resolveColumn(row, 'Value in QualInsp.', 'Value Qual.Insp.', 'Val. qual. insp.')
      ),
      restrictedUse: toNumber(
        resolveColumn(row, 'Restricted-Use Stock', 'Restricted', 'Restricted-use')
      ),
      valueRestricted: toNumber(
        resolveColumn(row, 'Value Restricted', 'Val. restricted')
      ),
      blocked: toNumber(resolveColumn(row, 'Blocked')),
      valueBlocked: toNumber(
        resolveColumn(row, 'Value BlockedStock', 'Value Blocked', 'Val. blocked')
      ),
      returns: toNumber(resolveColumn(row, 'Returns')),
      valueReturns: toNumber(
        resolveColumn(row, 'Value Rets Blocked', 'Value Returns', 'Val. returns')
      ),
      invoice: trimStr(resolveColumn(row, 'Invoice')),
      goodsRecipient: trimStr(
        resolveColumn(row, 'Goods Recipient Number', 'Goods recipient')
      ),
      grIssueDate: parseAnyDate(grDateRaw),
      agingDateOfReceipt: toNumber(
        resolveColumn(row, 'Aging(Date of Rcpt)', 'Aging: Date of receipt', 'AgingDateOfReceipt')
      ),
      aaAgingDays: toNumber(
        resolveColumn(row, 'AA')
      ),
      enteredOn: parseAnyDate(
        resolveColumn(row, 'Entered On', 'Entered on', 'EnteredOn')
      ),
      agingLastTransfer: toNumber(
        resolveColumn(row, 'Aging(Last Date of Trnsfr)', 'Aging: last transfer', 'AgingLastTransfer')
      ),
      manufactureDate: parseAnyDate(
        resolveColumn(row, 'Manufacture Date', 'Manufacture date', 'ManufactureDate')
      ),
      manufactureDateAging: toNumber(
        resolveColumn(row, 'Manufacture Date Aging', 'Manufacture date aging', 'ManufactureDateAging')
      ),
      productType: trimStr(
        resolveColumn(row, 'Product', 'TYPE', 'Type', 'Product Type', 'Material Group', 'MatGrp')
      ),
      ageBucketLabel: trimStr(
        resolveColumn(row, 'AGE BUCKET', 'Age Bucket', 'AgeBucket')
      ),
      totalValue: toNumber(
        resolveColumn(row, 'Total Value', 'TotalValue', 'Total value')
      ),
    });
  }

  console.log(`[PARSE] Ageing: ${validRows.length} valid rows parsed (skipped ${rawRows.length - validRows.length} empty rows)`);
  if (missingCols.size > 0) {
    console.warn(`[PARSE] Missing columns: ${[...missingCols].join(', ')}`);
  }

  return validRows;
}

function parseImportGIT(sheet) {
  const headerRow = findHeaderRow(sheet, GIT_KNOWN_HEADERS);
  if (headerRow < 0) {
    console.error('[PARSE] Could not find GIT header row. Known headers not found in first 20 rows.');
    return [];
  }
  console.log(`[PARSE] GIT header row detected at Excel row ${headerRow + 1}`);

  const rawRows = sheetToJsonFromRow(sheet, headerRow);
  return rawRows
    .map((rawRow) => trimKeys(rawRow))
    .filter((row) => {
      const material = trimStr(resolveColumn(row, 'Material'));
      return material.length > 0;
    })
    .map((row) => ({
      invoiceNumber: trimStr(resolveColumn(row, 'Invoice Number')),
      invoiceDate: parseAnyDate(resolveColumn(row, 'Invoice Date')),
      asnCreatedOn: parseAnyDate(resolveColumn(row, 'ASN Created On')),
      material: trimStr(resolveColumn(row, 'Material')),
      materialDescription: trimStr(resolveColumn(row, 'Material Description')),
      vendorCode: toNumber(resolveColumn(row, 'Vendor Code')),
      currency: trimStr(resolveColumn(row, 'Currency')),
      qty: toNumber(resolveColumn(row, 'Qty')),
      rate: toNumber(resolveColumn(row, 'Rate')),
      value: toNumber(resolveColumn(row, 'Value')),
      exRate: toNumber(resolveColumn(row, 'EX R')),
      cyValue: toNumber(resolveColumn(row, 'CY Value')),
      product: trimStr(resolveColumn(row, 'Product')),
    }));
}

// --- Sheet selection ---

function findBestDataSheet(wb, knownHeaders) {
  let bestSheet = null;
  let bestName = null;
  let bestHeaderRow = -1;
  let bestScore = -1;

  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name];
    if (!s || !s['!ref']) continue;

    const hr = findHeaderRow(s, knownHeaders);
    if (hr < 0) continue;

    const range = XLSX.utils.decode_range(s['!ref']);
    const colCount = range.e.c - range.s.c + 1;
    let sampleDataRows = 0;
    const sampleLimit = Math.min(hr + 50, range.e.r);
    for (let r = hr + 1; r <= sampleLimit; r++) {
      let hasData = false;
      for (let c = range.s.c; c <= Math.min(range.s.c + 5, range.e.c); c++) {
        const cell = s[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v !== undefined && cell.v !== '') { hasData = true; break; }
      }
      if (hasData) sampleDataRows++;
    }
    const score = sampleDataRows * colCount;

    if (score > bestScore) {
      bestScore = score;
      bestSheet = s;
      bestName = name;
      bestHeaderRow = hr;
    }
  }

  if (bestSheet) {
    console.log(`[PARSE] Selected sheet "${bestName}" (header at row ${bestHeaderRow + 1})`);
  }
  return bestSheet;
}

// --- Loader ---

function loadAllData() {
  if (cachedData) {
    return cachedData;
  }

  const closingInventory = new Map();

  try {
    const wb = readWorkbook(FILES.closingInventoryNew);
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (sheet) {
        const items = parseClosingInventorySheet(sheet, true);
        if (items.length > 0) closingInventory.set(sheetName, items);
      }
    }
  } catch (err) {
    console.error("Error reading Closing Inventory-Apr'26-May'26:", err.message);
    try {
      const wb1 = readWorkbook(FILES.closingInventory);
      for (const sheetName of wb1.SheetNames) {
        const sheet = wb1.Sheets[sheetName];
        if (sheet) {
          const items = parseClosingInventorySheet(sheet, false);
          if (items.length > 0) closingInventory.set(sheetName, items);
        }
      }
    } catch (err2) {
      console.error('Error reading Closing Inventory fallback:', err2.message);
    }
  }

  let inventoryAgeing = [];
  try {
    const wb3 = readWorkbook(resolveLatestAgeingFile());
    const bestSheet = findBestDataSheet(wb3, AGEING_KNOWN_HEADERS);
    if (bestSheet) {
      inventoryAgeing = parseInventoryAgeing(bestSheet);
    } else {
      console.error('[PARSE] No valid ageing data sheet found in workbook. Sheets:', wb3.SheetNames);
    }
  } catch (err) {
    console.error('Error reading Inventory Ageing Report:', err.message);
    try {
      const wbL = readWorkbook(FILES.inventoryAgeingLegacy);
      const bestSheet = findBestDataSheet(wbL, AGEING_KNOWN_HEADERS);
      if (bestSheet) {
        inventoryAgeing = parseInventoryAgeing(bestSheet);
      } else {
        const firstSheet = wbL.Sheets[wbL.SheetNames[0]];
        if (firstSheet) inventoryAgeing = parseInventoryAgeing(firstSheet);
      }
    } catch (err2) {
      console.error('Legacy ageing fallback also failed:', err2.message);
    }
  }

  // -----------------------------------------------------------------------
  // RAW DATA INTEGRITY — Do NOT infer or resolve product types.
  // Use ONLY the Product column value as it appears in the Excel.
  // Blank or #N/A rows are labeled 'UNASSIGNED PRODUCT' in the UI.
  // -----------------------------------------------------------------------
  {
    const blankTypeRows = inventoryAgeing.filter((i) => {
      const t = (i.productType || '').trim();
      return !t || t === '#N/A';
    });
    const blankTypeValue = blankTypeRows.reduce((s, i) => s + i.valueUnrestricted, 0);
    const distinctTypes = [...new Set(inventoryAgeing.map((i) => (i.productType || '').trim()).filter(Boolean))].sort();
    console.log(`[DATA LOAD] Product column — distinct types found in raw Excel: [${distinctTypes.join(', ')}]`);
    console.log(`[DATA LOAD] Product column — blank/N/A rows: ${blankTypeRows.length} (value: ${Math.round(blankTypeValue)}) — shown as UNASSIGNED PRODUCT in UI`);
  }

  let importGIT = [];
  try {
    const wb4 = readWorkbook(FILES.importGIT);
    const bestSheet = findBestDataSheet(wb4, GIT_KNOWN_HEADERS);
    if (bestSheet) {
      importGIT = parseImportGIT(bestSheet);
    } else {
      const firstSheet = wb4.Sheets[wb4.SheetNames[0]];
      if (firstSheet) importGIT = parseImportGIT(firstSheet);
    }
  } catch (err) {
    console.error('Error reading Import GIT:', err.message);
  }

  // Validation logging
  const totalUnrestricted = inventoryAgeing.reduce((s, i) => s + i.valueUnrestricted, 0);
  const totalGit = importGIT.reduce((s, i) => s + i.value, 0);
  const closingTotal = [...closingInventory.values()].reduce(
    (s, items) => s + items.reduce((si, i) => si + i.totalValue, 0), 0
  );
  const ageingWithGrDate = inventoryAgeing.filter((i) => i.grIssueDate > 0).length;
  const ageingWithoutGrDate = inventoryAgeing.length - ageingWithGrDate;

  console.log(`[DATA LOAD] Closing Inventory: ${closingInventory.size} periods, total value: ${Math.round(closingTotal)}`);
  console.log(`[DATA LOAD] Inventory Ageing: ${inventoryAgeing.length} items, unrestricted value: ${Math.round(totalUnrestricted)}`);
  console.log(`[DATA LOAD] Ageing dates: ${ageingWithGrDate} with GR date, ${ageingWithoutGrDate} without`);
  console.log(`[DATA LOAD] Import GIT: ${importGIT.length} items, total value: ${Math.round(totalGit)}`);

  if (inventoryAgeing.length > 0 && totalUnrestricted === 0) {
    console.error('[DATA LOAD] WARNING: Ageing items loaded but total unrestricted value is 0 — possible column mapping issue');
    const sample = inventoryAgeing[0];
    console.error('[DATA LOAD] Sample row:', JSON.stringify(sample).substring(0, 500));
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

function getClosingInventory(period) {
  const data = loadAllData();
  if (period) {
    const items = data.closingInventory.get(period);
    if (!items) {
      for (const [key, value] of data.closingInventory.entries()) {
        if (key.toLowerCase().includes(period.toLowerCase())) {
          return [{ period: key, items: value }];
        }
      }
      return [];
    }
    return [{ period, items }];
  }
  const results = [];
  for (const [key, value] of data.closingInventory.entries()) {
    results.push({ period: key, items: value });
  }
  return results;
}

function getClosingInventoryFlat() {
  const results = getClosingInventory();
  return results.flatMap((r) => r.items);
}

function getInventoryAgeing() {
  return loadAllData().inventoryAgeing;
}

function getImportGIT() {
  return loadAllData().importGIT;
}

function getAllData() {
  const data = loadAllData();
  const closingInventory = [];
  for (const [key, value] of data.closingInventory.entries()) {
    closingInventory.push({ period: key, items: value });
  }
  return {
    closingInventory,
    inventoryAgeing: data.inventoryAgeing,
    importGIT: data.importGIT,
  };
}

function getAvailablePeriods() {
  const data = loadAllData();
  return Array.from(data.closingInventory.keys());
}

function parsePeriodToDate(period) {
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const cleaned = period.replace(/['']/g, ' ').trim();
  const match = cleaned.match(/^(\w+)\s+(\d{2,4})$/i);
  if (!match) return new Date(0);
  const monthStr = match[1].toLowerCase().substring(0, 3);
  let year = parseInt(match[2], 10);
  if (year < 100) year += 2000;
  const monthIdx = months[monthStr];
  if (monthIdx === undefined) return new Date(0);
  return new Date(year, monthIdx, 1);
}

function sortPeriods(periods) {
  return [...periods].sort(
    (a, b) => parsePeriodToDate(a).getTime() - parsePeriodToDate(b).getTime()
  );
}

function getLatestPeriod() {
  const periods = getAvailablePeriods();
  if (periods.length === 0) return null;
  const sorted = sortPeriods(periods);
  return sorted[sorted.length - 1];
}

function clearCache() {
  cachedData = null;
}

module.exports = {
  getClosingInventory,
  getClosingInventoryFlat,
  getInventoryAgeing,
  getImportGIT,
  getAllData,
  getAvailablePeriods,
  getLatestPeriod,
  sortPeriods,
  clearCache,
  setSourceFile,
  getSourceFiles,
  getSummaryReportPath,
};
