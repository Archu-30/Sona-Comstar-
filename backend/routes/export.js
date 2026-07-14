const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

const {
  getClosingInventory,
  getAvailablePeriods,
  getInventoryAgeing,
  getImportGIT,
  getLatestPeriod,
  sortPeriods,
} = require('../../database/index');

// Reports use ONLY the latest uploaded period (e.g. May 2025 when Apr+May exist)
function getLatestPeriodItems() {
  const latest = getLatestPeriod();
  if (!latest) return [];
  const p = getClosingInventory().find((x) => x.period === latest);
  return p ? p.items : [];
}

const {
  calculateInventoryValue,
  calculateStockQuantity,
  calculateUniqueMaterials,
  calculateInventoryByType,
  calculateStorageLocationAgeingDetailed,
  calculateProductAgeing,
  calculateImportValue,
  calculateGitAgeing,
  itemValue,
} = require('../lib/calculations');

// --- Color scheme ---
const C = {
  headerBg: '1F4E79',
  headerFont: 'FFFFFF',
  titleBg: '2E75B6',
  titleFont: 'FFFFFF',
  kpiBg: 'D6E4F0',
  kpiFont: '1F4E79',
  altRow: 'F2F7FB',
  grandTotalBg: '1F4E79',
  grandTotalFont: 'FFFFFF',
  border: 'B4C6E7',
  sectionBg: 'E2EFDA',
  sectionFont: '375623',
};

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + argb } };
}

function thinBorder() {
  const side = { style: 'thin', color: { argb: 'FF' + C.border } };
  return { top: side, bottom: side, left: side, right: side };
}

function now() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

const AGE_BUCKETS = [
  '0-30 Days', '31-60 Days', '61-90 Days', '91-180 Days', '181-365 Days',
  'Above 1 Year', 'Above 2 Years', 'Above 3 Years', 'Above 4 Years', 'Above 5 Years',
];

// --- Helper: write company header block ---
function writeHeader(ws, title, subtitle, colSpan) {
  let r = 1;
  ws.mergeCells(r, 1, r, colSpan);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = 'SONA COMSTAR';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF' + C.titleFont } };
  titleCell.fill = fill(C.titleBg);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  r++;
  ws.mergeCells(r, 1, r, colSpan);
  const subTitle = ws.getCell(r, 1);
  subTitle.value = title;
  subTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF' + C.titleFont } };
  subTitle.fill = fill(C.titleBg);
  subTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  r++;
  ws.mergeCells(r, 1, r, colSpan);
  const dateCell = ws.getCell(r, 1);
  dateCell.value = subtitle + ' | Generated: ' + now();
  dateCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF4472C4' } };
  dateCell.alignment = { horizontal: 'center' };

  return r + 2;
}

// --- Helper: write KPI block ---
function writeKPIs(ws, kpis, startRow, colSpan) {
  let r = startRow;
  ws.mergeCells(r, 1, r, colSpan);
  const sec = ws.getCell(r, 1);
  sec.value = 'EXECUTIVE SUMMARY';
  sec.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF' + C.sectionFont } };
  sec.fill = fill(C.sectionBg);
  sec.border = thinBorder();
  r++;

  const pairs = Object.entries(kpis);
  for (let i = 0; i < pairs.length; i += 2) {
    const [k1, v1] = pairs[i];
    const lc1 = ws.getCell(r, 1);
    lc1.value = k1;
    lc1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + C.kpiFont } };
    lc1.fill = fill(C.kpiBg);
    lc1.border = thinBorder();
    const vc1 = ws.getCell(r, 2);
    vc1.value = v1;
    vc1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF' + C.headerBg } };
    vc1.fill = fill(C.kpiBg);
    vc1.border = thinBorder();
    vc1.alignment = { horizontal: 'right' };
    if (typeof v1 === 'number') vc1.numFmt = '#,##0';

    if (i + 1 < pairs.length) {
      const [k2, v2] = pairs[i + 1];
      const lc2 = ws.getCell(r, 4);
      lc2.value = k2;
      lc2.font = lc1.font;
      lc2.fill = fill(C.kpiBg);
      lc2.border = thinBorder();
      const vc2 = ws.getCell(r, 5);
      vc2.value = v2;
      vc2.font = vc1.font;
      vc2.fill = fill(C.kpiBg);
      vc2.border = thinBorder();
      vc2.alignment = { horizontal: 'right' };
      if (typeof v2 === 'number') vc2.numFmt = '#,##0';
    }
    r++;
  }
  return r + 1;
}

// --- Helper: write data table ---
function writeDataTable(ws, headers, rows, startRow, opts = {}) {
  const colCount = headers.length;
  let r = startRow;

  if (opts.sectionTitle) {
    ws.mergeCells(r, 1, r, colCount);
    const sec = ws.getCell(r, 1);
    sec.value = opts.sectionTitle;
    sec.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF' + C.sectionFont } };
    sec.fill = fill(C.sectionBg);
    sec.border = thinBorder();
    r++;
  }

  // Header row
  for (let c = 0; c < colCount; c++) {
    const cell = ws.getCell(r, c + 1);
    cell.value = headers[c];
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + C.headerFont } };
    cell.fill = fill(C.headerBg);
    cell.border = thinBorder();
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  r++;

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const rowData = rows[i];
    const isGT = rowData._grandTotal === true;
    for (let c = 0; c < colCount; c++) {
      const val = rowData[c];
      const cell = ws.getCell(r, c + 1);
      cell.value = val;
      cell.border = thinBorder();

      if (isGT) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + C.grandTotalFont } };
        cell.fill = fill(C.grandTotalBg);
      } else {
        cell.font = { name: 'Calibri', size: 10 };
        if (i % 2 === 1) cell.fill = fill(C.altRow);
      }

      if (typeof val === 'number') {
        if (opts.percentCols && opts.percentCols.includes(c)) {
          cell.numFmt = '0.0%';
        } else {
          cell.numFmt = '#,##0';
        }
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { horizontal: c === 0 ? 'left' : 'center' };
      }
    }
    r++;
  }
  return r + 1;
}

function setColWidths(ws, widths) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// --- Period parsing ---
const MONTH_ABBR = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parsePeriod(period) {
  const match = period.toLowerCase().trim().match(/^([a-z]+)\s*'?(\d{2,4})$/);
  if (!match) return null;
  const monthIdx = MONTH_ABBR[match[1]];
  if (monthIdx === undefined) return null;
  let year = parseInt(match[2], 10);
  if (year < 100) year += 2000;
  return { month: monthIdx, year };
}

// --- Sheet builders ---

function buildDashboardSheet(wb) {
  const ws = wb.addWorksheet('Dashboard Summary');
  const closingFlat = getLatestPeriodItems();

  const colSpan = 6;
  let row = writeHeader(ws, 'DASHBOARD SUMMARY REPORT', 'Executive overview of inventory analytics', colSpan);

  const totalValue = calculateInventoryValue(closingFlat);
  const totalStock = calculateStockQuantity(closingFlat);
  const materialCount = calculateUniqueMaterials(closingFlat);
  const byType = calculateInventoryByType(closingFlat);

  row = writeKPIs(ws, {
    'Total Inventory Value': Math.round(totalValue),
    'Total Inventory Quantity': Math.round(totalStock),
    'Unique Materials': materialCount,
    'Product Types': byType.length,
  }, row, colSpan);

  const typeHeaders = ['Type', 'Materials', 'Total Stock', 'Total Value', 'Share %'];
  const typeRows = byType.map((t) => [t.type, t.count, Math.round(t.totalStock), Math.round(t.totalValue), t.percentage / 100]);
  const typeGT = ['Grand Total', typeRows.reduce((s, r) => s + r[1], 0), typeRows.reduce((s, r) => s + r[2], 0),
    typeRows.reduce((s, r) => s + r[3], 0), 1];
  typeGT._grandTotal = true;
  typeRows.push(typeGT);

  row = writeDataTable(ws, typeHeaders, typeRows, row, {
    sectionTitle: 'INVENTORY BY TYPE',
    currencyCols: [1, 2, 3],
    percentCols: [4],
  });

  setColWidths(ws, [22, 18, 18, 18, 14, 14]);
  return ws;
}

function buildInventorySummarySheet(wb) {
  const ws = wb.addWorksheet('Inventory Summary');
  const periods = sortPeriods(getAvailablePeriods());
  const allPeriods = getClosingInventory();
  const closingFlat = getLatestPeriodItems();

  const colSpan = 10;
  let row = writeHeader(ws, 'INVENTORY SUMMARY REPORT', 'Prepared from uploaded SAP Inventory data', colSpan);

  const totalValue = calculateInventoryValue(closingFlat);
  const totalStock = calculateStockQuantity(closingFlat);
  const totalMaterials = calculateUniqueMaterials(closingFlat);

  row = writeKPIs(ws, {
    'Total Inventory Value': Math.round(totalValue),
    'Total Inventory Quantity': Math.round(totalStock),
    'Unique Materials': totalMaterials,
  }, row, colSpan);

  if (periods.length >= 2) {
    const parsed = periods.map((p) => ({ name: p, ...parsePeriod(p) })).filter((p) => p.year);
    const last2 = parsed.slice(-2);
    const p1Data = allPeriods.find((p) => p.period === last2[0].name);
    const p2Data = allPeriods.find((p) => p.period === last2[1].name);

    if (p1Data && p2Data) {
      const byType1 = calculateInventoryByType(p1Data.items);
      const byType2 = calculateInventoryByType(p2Data.items);
      const p1Name = last2[0].name;
      const p2Name = last2[1].name;

      const headers = ['Product Type', p1Name + ' Stock', p2Name + ' Stock', 'Difference', '% Change',
        p1Name + ' Value', p2Name + ' Value', 'Value Difference', '% Value Change'];

      const types = new Set([...byType1.map((t) => t.type), ...byType2.map((t) => t.type)]);
      const dataRows = [];
      let totalP1Stock = 0, totalP2Stock = 0, totalP1Val = 0, totalP2Val = 0;

      for (const type of types) {
        const t1 = byType1.find((t) => t.type === type) || { totalStock: 0, totalValue: 0 };
        const t2 = byType2.find((t) => t.type === type) || { totalStock: 0, totalValue: 0 };
        const stockDiff = t2.totalStock - t1.totalStock;
        const stockPct = t1.totalStock > 0 ? stockDiff / t1.totalStock : 0;
        const valDiff = t2.totalValue - t1.totalValue;
        const valPct = t1.totalValue > 0 ? valDiff / t1.totalValue : 0;
        dataRows.push([type, Math.round(t1.totalStock), Math.round(t2.totalStock), Math.round(stockDiff), stockPct,
          Math.round(t1.totalValue), Math.round(t2.totalValue), Math.round(valDiff), valPct]);
        totalP1Stock += t1.totalStock;
        totalP2Stock += t2.totalStock;
        totalP1Val += t1.totalValue;
        totalP2Val += t2.totalValue;
      }

      const totalStockDiff = totalP2Stock - totalP1Stock;
      const totalValDiff = totalP2Val - totalP1Val;
      const gt = ['Grand Total', Math.round(totalP1Stock), Math.round(totalP2Stock), Math.round(totalStockDiff),
        totalP1Stock > 0 ? totalStockDiff / totalP1Stock : 0,
        Math.round(totalP1Val), Math.round(totalP2Val), Math.round(totalValDiff),
        totalP1Val > 0 ? totalValDiff / totalP1Val : 0];
      gt._grandTotal = true;
      dataRows.push(gt);

      row = writeDataTable(ws, headers, dataRows, row, {
        sectionTitle: 'PRODUCT TYPE COMPARISON',
        percentCols: [4, 8],
      });
    }
  }

  for (const period of periods) {
    const pd = allPeriods.find((p) => p.period === period);
    if (!pd) continue;
    const byType = calculateInventoryByType(pd.items);
    const headers = ['Product Type', 'Total Stock', 'Total Value'];
    const dataRows = byType.map((t) => [t.type, Math.round(t.totalStock), Math.round(t.totalValue)]);
    const totalS = byType.reduce((s, t) => s + t.totalStock, 0);
    const totalV = byType.reduce((s, t) => s + t.totalValue, 0);
    const gt = ['Grand Total', Math.round(totalS), Math.round(totalV)];
    gt._grandTotal = true;
    dataRows.push(gt);

    row = writeDataTable(ws, headers, dataRows, row, {
      sectionTitle: period.toUpperCase() + ' MONTH SUMMARY',
    });
  }

  setColWidths(ws, [20, 18, 18, 18, 14, 18, 18, 18, 14, 14]);
  return ws;
}

function buildAgeingSummarySheet(wb) {
  const ws = wb.addWorksheet('Inventory Ageing');
  const ageingItems = getInventoryAgeing();

  const colSpan = AGE_BUCKETS.length + 3;
  let row = writeHeader(ws, 'INVENTORY AGEING SUMMARY', 'Age from report AA column | Value from Total Value column', colSpan);

  const totalValueAll = ageingItems.reduce((s, i) => s + itemValue(i), 0);

  row = writeKPIs(ws, {
    'Total Value': Math.round(totalValueAll),
    'Total Materials': new Set(ageingItems.map((i) => i.material)).size,
  }, row, colSpan);

  // Product-wise analysis
  const productAgeing = calculateProductAgeing(ageingItems);
  const prodHeaders = ['Product Type', ...AGE_BUCKETS, 'Grand Total', 'Inv %'];
  const prodRows = productAgeing.map((p) => {
    const bucketVals = AGE_BUCKETS.map((b) => {
      const bucket = p.buckets.find((x) => x.bucket === b);
      return bucket ? Math.round(bucket.totalValue) : 0;
    });
    return [p.productType || 'Unknown', ...bucketVals, Math.round(p.totalValue), p.inventoryPercentage / 100];
  });
  const prodGT = ['Grand Total'];
  for (let i = 0; i < AGE_BUCKETS.length; i++) {
    prodGT.push(Math.round(productAgeing.reduce((s, p) => s + (p.buckets.find((x) => x.bucket === AGE_BUCKETS[i])?.totalValue || 0), 0)));
  }
  prodGT.push(Math.round(productAgeing.reduce((s, p) => s + p.totalValue, 0)));
  prodGT.push(1);
  prodGT._grandTotal = true;
  prodRows.push(prodGT);

  row = writeDataTable(ws, prodHeaders, prodRows, row, {
    sectionTitle: 'PRODUCT WISE ANALYSIS',
    percentCols: [AGE_BUCKETS.length + 2],
  });

  // Location-wise analysis
  const locDetailed = calculateStorageLocationAgeingDetailed(ageingItems);
  const locHeaders = ['Storage Location', ...AGE_BUCKETS, 'Grand Total'];
  const locRows = locDetailed.map((loc) => {
    const bucketVals = AGE_BUCKETS.map((b) => {
      const bucket = loc.buckets.find((x) => x.bucket === b);
      return bucket ? Math.round(bucket.totalValue) : 0;
    });
    return [loc.storageLocation, ...bucketVals, Math.round(loc.totalValue)];
  });
  const locGT = ['Grand Total'];
  for (let i = 0; i < AGE_BUCKETS.length; i++) {
    locGT.push(locRows.reduce((s, r) => s + r[i + 1], 0));
  }
  locGT.push(locRows.reduce((s, r) => s + r[AGE_BUCKETS.length + 1], 0));
  locGT._grandTotal = true;
  locRows.push(locGT);

  row = writeDataTable(ws, locHeaders, locRows, row, {
    sectionTitle: 'LOCATION WISE ANALYSIS',
  });

  setColWidths(ws, [18, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 16, 10]);
  return ws;
}

function buildStorageLocationSheet(wb) {
  const ws = wb.addWorksheet('Storage Locations');
  const ageingItems = getInventoryAgeing();

  const colSpan = AGE_BUCKETS.length + 2;
  let row = writeHeader(ws, 'STORAGE LOCATION ANALYTICS', 'All storage locations from the ageing report', colSpan);

  const locDetailed = calculateStorageLocationAgeingDetailed(ageingItems);

  const headers = ['Storage Location', ...AGE_BUCKETS, 'Grand Total'];
  const dataRows = locDetailed.map((loc) => {
    const bucketVals = AGE_BUCKETS.map((b) => {
      const bucket = loc.buckets.find((x) => x.bucket === b);
      return bucket ? Math.round(bucket.totalValue) : 0;
    });
    return [loc.storageLocation, ...bucketVals, Math.round(loc.totalValue)];
  });
  const gt = ['Grand Total'];
  for (let i = 0; i < AGE_BUCKETS.length; i++) {
    gt.push(dataRows.reduce((s, r) => s + r[i + 1], 0));
  }
  gt.push(dataRows.reduce((s, r) => s + r[AGE_BUCKETS.length + 1], 0));
  gt._grandTotal = true;
  dataRows.push(gt);

  row = writeDataTable(ws, headers, dataRows, row, {
    sectionTitle: 'STORAGE LOCATION AGEING BREAKDOWN',
  });

  setColWidths(ws, [18, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 16]);
  return ws;
}

function buildProductAnalyticsSheet(wb) {
  const ws = wb.addWorksheet('Product Analytics');
  const ageingItems = getInventoryAgeing();

  const colSpan = 8;
  let row = writeHeader(ws, 'PRODUCT ANALYTICS REPORT', 'All product types from the ageing report', colSpan);

  const productAgeing = calculateProductAgeing(ageingItems);
  const headers = ['Product Type', 'Materials', 'Quantity', 'Total Value', 'Inv %', 'Avg Age', 'Oldest (days)', 'Newest (days)'];
  const dataRows = productAgeing.map((p) => [
    p.productType || 'Unknown', p.materialCount, p.totalQuantity,
    Math.round(p.totalValue), p.inventoryPercentage / 100,
    p.avgAge, p.oldest, p.newest,
  ]);
  const gt = ['Grand Total', dataRows.reduce((s, r) => s + r[1], 0), dataRows.reduce((s, r) => s + r[2], 0),
    Math.round(productAgeing.reduce((s, p) => s + p.totalValue, 0)), 1, '', '', ''];
  gt._grandTotal = true;
  dataRows.push(gt);

  row = writeDataTable(ws, headers, dataRows, row, {
    sectionTitle: 'PRODUCT TYPE SUMMARY',
    percentCols: [4],
  });

  setColWidths(ws, [18, 12, 14, 18, 10, 12, 14, 14]);
  return ws;
}

function buildGitAnalysisSheet(wb) {
  const ws = wb.addWorksheet('GIT Analysis');
  const gitItems = getImportGIT();

  const colSpan = 6;
  let row = writeHeader(ws, 'GOODS IN TRANSIT (GIT) ANALYSIS', 'Age calculated from Invoice Date', colSpan);

  const totalValue = calculateImportValue(gitItems);
  row = writeKPIs(ws, {
    'Total Import Value': Math.round(totalValue),
  }, row, colSpan);

  // Age bucket summary
  const buckets = calculateGitAgeing(gitItems);
  const bucketHeaders = ['Age Bucket', 'Quantity', 'Value'];
  const bucketRows = buckets.map((b) => [b.bucket, b.totalQuantity, Math.round(b.totalValue)]);
  const bucketGT = ['Grand Total', bucketRows.reduce((s, r) => s + r[1], 0),
    bucketRows.reduce((s, r) => s + r[2], 0)];
  bucketGT._grandTotal = true;
  bucketRows.push(bucketGT);

  row = writeDataTable(ws, bucketHeaders, bucketRows, row, {
    sectionTitle: 'GIT AGEING SUMMARY',
  });

  setColWidths(ws, [18, 16, 16, 16, 16, 16]);
  return ws;
}

// --- CSV flat export ---
function buildFlatCSVData(module) {
  switch (module) {
    case 'dashboard': {
      const closingFlat = getLatestPeriodItems();
      const byType = calculateInventoryByType(closingFlat);
      return [
        { KPI: 'Total Inventory Value', Value: Math.round(calculateInventoryValue(closingFlat)) },
        { KPI: 'Total Stock', Value: Math.round(calculateStockQuantity(closingFlat)) },
        { KPI: 'Unique Materials', Value: calculateUniqueMaterials(closingFlat) },
        {},
        ...byType.map((t) => ({ Type: t.type, Stock: Math.round(t.totalStock), Value: Math.round(t.totalValue), 'Share %': Math.round(t.percentage) })),
      ];
    }
    case 'inventory': {
      const latest = getLatestPeriod();
      const byType = calculateInventoryByType(getLatestPeriodItems());
      return byType.map((t) => ({
        Period: latest, Type: t.type, Stock: Math.round(t.totalStock), Value: Math.round(t.totalValue), 'Share %': Math.round(t.percentage),
      }));
    }
    case 'ageing': {
      const items = getInventoryAgeing();
      const products = calculateProductAgeing(items);
      return products.map((p) => {
        const row = { 'Product Type': p.productType || 'Unknown' };
        for (const b of AGE_BUCKETS) {
          const bucket = p.buckets.find((x) => x.bucket === b);
          row[b] = bucket ? Math.round(bucket.totalValue) : 0;
        }
        row['Grand Total'] = Math.round(p.totalValue);
        row['Inv %'] = Math.round(p.inventoryPercentage) + '%';
        return row;
      });
    }
    case 'storage-location': {
      const items = getInventoryAgeing();
      const detailed = calculateStorageLocationAgeingDetailed(items);
      return detailed.map((l) => {
        const row = { Location: l.storageLocation };
        for (const b of AGE_BUCKETS) {
          const bucket = l.buckets.find((x) => x.bucket === b);
          row[b] = bucket ? Math.round(bucket.totalValue) : 0;
        }
        row['Grand Total'] = Math.round(l.totalValue);
        return row;
      });
    }
    case 'product-analytics': {
      const items = getInventoryAgeing();
      const products = calculateProductAgeing(items);
      return products.map((p) => ({
        'Product Type': p.productType || 'Unknown', Materials: p.materialCount, Quantity: p.totalQuantity,
        Value: Math.round(p.totalValue), 'Inv %': Math.round(p.inventoryPercentage) + '%',
        'Avg Age': p.avgAge, Oldest: p.oldest, Newest: p.newest,
      }));
    }
    case 'git': {
      const items = getImportGIT();
      const buckets = calculateGitAgeing(items);
      return buckets.map((b) => ({
        Bucket: b.bucket, Quantity: b.totalQuantity, Value: Math.round(b.totalValue),
      }));
    }
    default:
      return [];
  }
}

// --- Route ---
router.post('/', async (req, res) => {
  try {
    const { module, format } = req.body;

    if (!module || !format) {
      return res.status(400).json({ error: 'module and format are required' });
    }

    if (!['xlsx', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be xlsx, csv, or pdf' });
    }

    // Complete multi-sheet workbook
    if (module === 'complete' || format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Sona Analytics';
      wb.created = new Date();

      if (module === 'complete') {
        buildDashboardSheet(wb);
        buildInventorySummarySheet(wb);
        buildStorageLocationSheet(wb);
        buildProductAnalyticsSheet(wb);
        buildGitAnalysisSheet(wb);
      } else {
        switch (module) {
          case 'dashboard': buildDashboardSheet(wb); break;
          case 'inventory': buildInventorySummarySheet(wb); break;
          case 'ageing': buildAgeingSummarySheet(wb); break;
          case 'storage-location': buildStorageLocationSheet(wb); break;
          case 'product-analytics': buildProductAnalyticsSheet(wb); break;
          case 'git': buildGitAnalysisSheet(wb); break;
          default: return res.status(400).json({ error: `Unknown module: ${module}` });
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const filename = `Sona-${module}-report-${Date.now()}.xlsx`;
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      });
      return res.send(Buffer.from(buffer));
    }

    // CSV format
    if (format === 'csv') {
      const data = buildFlatCSVData(module);
      const csvWs = XLSX.utils.json_to_sheet(data);
      const csvContent = XLSX.utils.sheet_to_csv(csvWs);
      const buffer = Buffer.from(csvContent, 'utf-8');
      const filename = `Sona-${module}-report-${Date.now()}.csv`;
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      });
      return res.send(buffer);
    }

    if (format === 'pdf') {
      return res.status(501).json({ error: 'PDF export coming soon' });
    }
  } catch (error) {
    console.error('Export API error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
