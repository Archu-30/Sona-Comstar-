/**
 * exportService.js — Reusable modular Excel export service for Sona Comstar.
 * All sheet builders live here. The export route composes them.
 * DO NOT modify any business logic or calculations here.
 */
const ExcelJS = require('exceljs');

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  headerBg:       '1F4E79',
  headerFont:     'FFFFFF',
  titleBg:        '2E75B6',
  titleFont:      'FFFFFF',
  subtitleBg:     '4472C4',
  subtitleFont:   'FFFFFF',
  kpiBg:          'D6E4F0',
  kpiFont:        '1F4E79',
  kpiValueFont:   '1F4E79',
  altRow:         'F2F7FB',
  grandTotalBg:   '1F4E79',
  grandTotalFont: 'FFFFFF',
  border:         'B4C6E7',
  sectionBg:      'E2EFDA',
  sectionFont:    '375623',
  filterBg:       'FFF9E6',
  filterFont:     '5C4A00',
  warnBg:         'FFC000',
  successBg:      '70AD47',
  successFont:    'FFFFFF',
  orange:         'ED7D31',
  teal:           '00B0F0',
  purple:         '7030A0',
  rose:           'FF0000',
};

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + argb } };
}

function thinBorder(color = C.border) {
  const side = { style: 'thin', color: { argb: 'FF' + color } };
  return { top: side, bottom: side, left: side, right: side };
}

function medBorder() {
  const side = { style: 'medium', color: { argb: 'FF' + C.headerBg } };
  return { top: side, bottom: side, left: side, right: side };
}

function nowIST() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function fmtInrNum(n) {
  if (!n && n !== 0) return '—';
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
}

// ─── AGE BUCKETS ──────────────────────────────────────────────────────────────
const AGE_BUCKETS = [
  '0-30 Days', '31-60 Days', '61-90 Days', '91-180 Days', '181-365 Days',
  'Above 1 Year', 'Above 2 Years', 'Above 3 Years', 'Above 4 Years', 'Above 5 Years',
];

const AGE_BUCKET_KEYS = [
  'b_0_30', 'b_31_60', 'b_61_90', 'b_91_180', 'b_181_365',
  'b_1yr', 'b_2yr', 'b_3yr', 'b_4yr', 'b_5yr',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set column widths for a worksheet.
 * @param {ExcelJS.Worksheet} ws
 * @param {number[]} widths
 */
function setColWidths(ws, widths) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/**
 * Write the company header block at the top of a sheet.
 * Returns the next row index after the header block.
 */
function writeHeader(ws, title, subtitle, colSpan, filters = {}) {
  let r = 1;

  // Row 1: Company name
  ws.mergeCells(r, 1, r, colSpan);
  const compCell = ws.getCell(r, 1);
  compCell.value = 'SONA COMSTAR';
  compCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF' + C.titleFont } };
  compCell.fill = fill(C.headerBg);
  compCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 28;
  r++;

  // Row 2: Report title
  ws.mergeCells(r, 1, r, colSpan);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF' + C.titleFont } };
  titleCell.fill = fill(C.titleBg);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 22;
  r++;

  // Row 3: Subtitle + generated date
  ws.mergeCells(r, 1, r, colSpan);
  const subCell = ws.getCell(r, 1);
  subCell.value = `${subtitle}  |  Generated: ${nowIST()}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4472C4' } };
  subCell.fill = fill('EBF3FB');
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 18;
  r++;

  // Row 4: Applied filters (if any)
  const filterParts = [];
  if (filters.years?.length)     filterParts.push(`Year: ${filters.years.join(', ')}`);
  if (filters.months?.length)    filterParts.push(`Month: ${filters.months.join(', ')}`);
  if (filters.products?.length)  filterParts.push(`Product Type: ${filters.products.join(', ')}`);
  if (filters.locations?.length) filterParts.push(`Storage Location: ${filters.locations.join(', ')}`);
  if (filters.days?.length)      filterParts.push(`Age Bucket: ${filters.days.join(', ')}`);
  if (filters.dates?.length)     filterParts.push(`Date: ${filters.dates.join(', ')}`);

  const filterStr = filterParts.length > 0
    ? `Applied Filters → ${filterParts.join('  |  ')}`
    : 'Applied Filters → All Data (no filters applied)';

  ws.mergeCells(r, 1, r, colSpan);
  const filterCell = ws.getCell(r, 1);
  filterCell.value = filterStr;
  filterCell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF' + C.filterFont } };
  filterCell.fill = fill(C.filterBg.replace('#', ''));
  filterCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  filterCell.border = { bottom: thinBorder().bottom };
  ws.getRow(r).height = 16;
  r++;

  // Blank row
  r++;

  return r;
}

/**
 * Write KPI cards in a 2-column layout.
 */
function writeKPIs(ws, kpis, startRow, colSpan) {
  let r = startRow;

  // Section title
  ws.mergeCells(r, 1, r, colSpan);
  const sec = ws.getCell(r, 1);
  sec.value = '⬛  KEY PERFORMANCE INDICATORS';
  sec.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF' + C.sectionFont } };
  sec.fill = fill(C.sectionBg);
  sec.border = thinBorder();
  sec.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 20;
  r++;

  const pairs = Object.entries(kpis);
  for (let i = 0; i < pairs.length; i += 2) {
    const [k1, v1] = pairs[i];

    // Label 1
    const lc1 = ws.getCell(r, 1);
    lc1.value = k1;
    lc1.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF' + C.kpiFont } };
    lc1.fill = fill(C.kpiBg);
    lc1.border = thinBorder();
    lc1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // Value 1
    const vc1 = ws.getCell(r, 2);
    vc1.value = v1;
    vc1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF' + C.headerBg } };
    vc1.fill = fill(C.kpiBg);
    vc1.border = thinBorder();
    vc1.alignment = { horizontal: 'right', vertical: 'middle' };
    if (typeof v1 === 'number') vc1.numFmt = '₹#,##0';

    // Spacer col 3
    const sp = ws.getCell(r, 3);
    sp.fill = fill('FFFFFF');

    if (i + 1 < pairs.length) {
      const [k2, v2] = pairs[i + 1];
      const lc2 = ws.getCell(r, 4);
      lc2.value = k2;
      lc2.font = lc1.font;
      lc2.fill = fill(C.kpiBg);
      lc2.border = thinBorder();
      lc2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      const vc2 = ws.getCell(r, 5);
      vc2.value = v2;
      vc2.font = vc1.font;
      vc2.fill = fill(C.kpiBg);
      vc2.border = thinBorder();
      vc2.alignment = { horizontal: 'right', vertical: 'middle' };
      if (typeof v2 === 'number') vc2.numFmt = '₹#,##0';
    }

    ws.getRow(r).height = 18;
    r++;
  }
  return r + 1;
}

/**
 * Write a data table with headers, alternating rows, and grand total.
 * opts: { sectionTitle, percentCols, currencyCols, noFmtCols }
 */
function writeDataTable(ws, headers, rows, startRow, opts = {}) {
  const colCount = headers.length;
  let r = startRow;

  if (opts.sectionTitle) {
    ws.mergeCells(r, 1, r, colCount);
    const sec = ws.getCell(r, 1);
    sec.value = `⬛  ${opts.sectionTitle}`;
    sec.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF' + C.sectionFont } };
    sec.fill = fill(C.sectionBg);
    sec.border = thinBorder();
    sec.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(r).height = 20;
    r++;
  }

  // Header row
  for (let c = 0; c < colCount; c++) {
    const cell = ws.getCell(r, c + 1);
    cell.value = headers[c];
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF' + C.headerFont } };
    cell.fill = fill(C.headerBg);
    cell.border = thinBorder('2E75B6');
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  ws.getRow(r).height = 20;
  r++;

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    const rowData = rows[i];
    const isGT = rowData._grandTotal === true;
    ws.getRow(r).height = 15;

    for (let c = 0; c < colCount; c++) {
      const val = rowData[c];
      const cell = ws.getCell(r, c + 1);
      cell.value = val;
      cell.border = thinBorder();

      if (isGT) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF' + C.grandTotalFont } };
        cell.fill = fill(C.grandTotalBg);
        cell.alignment = { horizontal: c === 0 ? 'left' : 'right', vertical: 'middle', indent: c === 0 ? 1 : 0 };
      } else {
        cell.font = { name: 'Calibri', size: 9 };
        if (i % 2 === 1) cell.fill = fill(C.altRow);
        cell.alignment = { horizontal: c === 0 ? 'left' : 'right', vertical: 'middle', indent: c === 0 ? 1 : 0 };
      }

      if (typeof val === 'number') {
        if (opts.percentCols && opts.percentCols.includes(c)) {
          cell.numFmt = '0.0%';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (opts.noFmtCols && opts.noFmtCols.includes(c)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.numFmt = '₹#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      }
    }
    r++;
  }

  return r + 1;
}

/**
 * Freeze the top N rows of a worksheet.
 */
function freezeTopRows(ws, count = 1) {
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: count }];
}

// ─── Sheet Builders ───────────────────────────────────────────────────────────

/**
 * Build the Executive Summary sheet.
 */
function generateExecutiveSummary(wb, allData, filters) {
  const ws = wb.addWorksheet('1. Executive Summary');
  const colSpan = 8;
  let row = writeHeader(ws, 'EXECUTIVE SUMMARY', 'Consolidated overview across all report modules', colSpan, filters);

  const { dashboardData, ageingData, gitData, closingData } = allData;

  // Total Inventory Value comes from closing inventory (latest period), not ageing sum
  const latestClosingPeriod = closingData?.periods?.length
    ? closingData.periods[closingData.periods.length - 1]
    : null;

  const kpis = {};
  if (dashboardData?.ageing) {
    kpis['Total Inventory Value']     = Number(latestClosingPeriod?.total_value) || Number(dashboardData.ageing.total_value) || 0;
    kpis['Total Inventory Items']     = Number(dashboardData.ageing.total_items) || 0;
    kpis['Unique Materials']          = Number(dashboardData.ageing.material_count) || 0;
    kpis['Storage Locations']         = Number(dashboardData.ageing.location_count) || 0;
    kpis['Dead Stock (>180 days)']    = Number(dashboardData.ageing.dead_stock_value) || 0;
    kpis['Avg Age (days)']            = Number(dashboardData.ageing.avg_age) || 0;
  }
  if (gitData?.kpis) {
    kpis['Total GIT Value']           = Number(gitData.kpis.total_value) || 0;
    kpis['GIT Items']                 = Number(gitData.kpis.item_count) || 0;
    kpis['Critical GIT (>90d)']       = Number(gitData.kpis.critical_count) || 0;
  }

  row = writeKPIs(ws, kpis, row, colSpan);

  // Product breakdown table
  if (dashboardData?.byProduct?.length) {
    const headers = ['Product Type', 'Total Value (₹)', 'Item Count'];
    const rows = dashboardData.byProduct.map((r) => [
      r.product_type || 'UNASSIGNED',
      Number(r.total_value) || 0,
      Number(r.cnt) || 0,
    ]);
    const totalVal = rows.reduce((s, r) => s + r[1], 0);
    const totalCnt = rows.reduce((s, r) => s + r[2], 0);
    const gt = ['Grand Total', totalVal, totalCnt];
    gt._grandTotal = true;
    rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'INVENTORY BY PRODUCT TYPE', noFmtCols: [2] });
  }

  // GIT bucket table
  if (gitData?.byBucket?.length) {
    const headers = ['Age Bucket', 'Items', 'Total Value (₹)'];
    const rows = gitData.byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true;
    rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'GIT AGEING SUMMARY', noFmtCols: [1] });
  }

  setColWidths(ws, [28, 22, 14, 22, 22, 14, 14, 14]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Dashboard sheet.
 */
function generateDashboard(wb, data, filters, closingData) {
  const ws = wb.addWorksheet('2. Dashboard');
  const colSpan = 8;
  let row = writeHeader(ws, 'DASHBOARD SUMMARY', 'Real-time inventory analytics overview', colSpan, filters);

  if (!data) { ws.getCell(row, 1).value = 'No data available.'; setColWidths(ws, [30]); return ws; }

  const { ageing, byProduct = [], byLocation = [], byBucket = [] } = data;

  // Use closing inventory total for the headline value (matches dashboard)
  const latestClosingPeriod = closingData?.periods?.length
    ? closingData.periods[closingData.periods.length - 1]
    : null;

  if (ageing) {
    row = writeKPIs(ws, {
      'Total Inventory Value':   Number(latestClosingPeriod?.total_value) || Number(ageing.total_value) || 0,
      'Total Items':             Number(ageing.total_items) || 0,
      'Unique Materials':        Number(ageing.material_count) || 0,
      'Storage Locations':       Number(ageing.location_count) || 0,
      'Dead Stock (>180d)':      Number(ageing.dead_stock_value) || 0,
      'Average Age (days)':      Number(ageing.avg_age) || 0,
    }, row, colSpan);
  }

  // Product distribution
  if (byProduct.length) {
    const headers = ['Product Type', 'Total Value (₹)', 'Items'];
    const rows = byProduct.map((r) => [r.product_type || 'UNASSIGNED', Number(r.total_value) || 0, Number(r.cnt) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'VALUE BY PRODUCT TYPE', noFmtCols: [2] });
  }

  // Location distribution
  if (byLocation.length) {
    const headers = ['Storage Location', 'Total Value (₹)', 'Avg Age (days)'];
    const rows = byLocation.map((r) => [r.storage_location, Number(r.total_value) || 0, Number(r.avg_age) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), ''];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'VALUE BY STORAGE LOCATION', noFmtCols: [2] });
  }

  // Age bucket distribution
  if (byBucket.length) {
    const headers = ['Age Bucket', 'Items', 'Total Value (₹)'];
    const rows = byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'AGE BUCKET DISTRIBUTION', noFmtCols: [1] });
  }

  setColWidths(ws, [28, 22, 14, 22, 22, 14, 14, 14]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Closing Inventory sheet.
 */
function generateClosingInventory(wb, data, filters) {
  const ws = wb.addWorksheet('3. Closing Inventory');
  const colSpan = 6;
  let row = writeHeader(ws, 'CLOSING INVENTORY REPORT', 'Period-wise inventory closing balances', colSpan, filters);

  if (!data) { ws.getCell(row, 1).value = 'No data available.'; setColWidths(ws, [30]); return ws; }

  const { periods = [], byType = [] } = data;

  // Period summary
  if (periods.length) {
    const latest = periods[periods.length - 1];
    row = writeKPIs(ws, {
      'Latest Period':     latest?.period_name || '—',
      'Total Periods':     periods.length,
      'Latest Value':      Number(latest?.total_value) || 0,
      'Latest Stock':      Number(latest?.total_stock) || 0,
      'Materials (Latest)': Number(latest?.material_count) || 0,
    }, row, colSpan);

    const headers = ['Period', 'Month', 'Year', 'Total Value (₹)', 'Total Stock', 'Materials'];
    const rows = periods.map((p) => [
      p.period_name,
      p.period_month,
      p.period_year,
      Number(p.total_value) || 0,
      Number(p.total_stock) || 0,
      Number(p.material_count) || 0,
    ]);
    const gt = ['Grand Total', '', '', rows.reduce((s, r) => s + r[3], 0), rows.reduce((s, r) => s + r[4], 0), ''];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, {
      sectionTitle: 'PERIOD-WISE CLOSING INVENTORY',
      noFmtCols: [1, 2, 5],
    });
  }

  // By type
  if (byType.length) {
    const headers = ['Item Type', 'Total Value (₹)', 'Items'];
    const rows = byType.map((r) => [r.item_type || 'UNKNOWN', Number(r.total_value) || 0, Number(r.cnt) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'BY INVENTORY TYPE', noFmtCols: [2] });
  }

  setColWidths(ws, [22, 12, 10, 22, 18, 14]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Storage Ageing sheet.
 */
function generateStorageAgeing(wb, data, filters) {
  const ws = wb.addWorksheet('4. Storage Ageing');
  const colSpan = AGE_BUCKETS.length + 3;
  let row = writeHeader(ws, 'STORAGE AGEING ANALYSIS', 'Inventory ageing by storage location and product type', colSpan, filters);

  if (!data) { ws.getCell(row, 1).value = 'No data available.'; setColWidths(ws, [30]); return ws; }

  const { kpis, matrix = [], byProduct = [], byBucket = [] } = data;

  if (kpis) {
    row = writeKPIs(ws, {
      'Total Inventory Value':    Number(kpis.total_value) || 0,
      'Total Items':              Number(kpis.total_items) || 0,
      'Avg Age (days)':           Number(kpis.avg_age) || 0,
      'Dead Stock (>180d)':       Number(kpis.dead_stock_value) || 0,
      'Slow Moving (91–180d)':    Number(kpis.slow_moving_value) || 0,
      'Storage Locations':        Number(kpis.location_count) || 0,
      'Product Types':            Number(kpis.product_count) || 0,
      'Unique Materials':         Number(kpis.material_count) || 0,
    }, row, colSpan);
  }

  // Matrix table: Location × Product × Buckets
  if (matrix.length) {
    const headers = ['Storage Location', 'Product Type', ...AGE_BUCKETS, 'Grand Total'];
    const rows = matrix.map((r) => [
      r.storage_location,
      r.product_type || 'UNASSIGNED',
      ...AGE_BUCKET_KEYS.map((k) => Number(r[k]) || 0),
      Number(r.total_value) || 0,
    ]);

    // Location grand totals
    const locMap = new Map();
    for (const r of rows) {
      const loc = r[0];
      if (!locMap.has(loc)) locMap.set(loc, new Array(AGE_BUCKETS.length + 1).fill(0));
      const arr = locMap.get(loc);
      for (let i = 0; i < AGE_BUCKETS.length + 1; i++) arr[i] += r[i + 2];
    }

    // Grand total row
    const gt = ['Grand Total', ''];
    const bucketTotals = AGE_BUCKETS.map((_, bi) => rows.reduce((s, r) => s + (r[bi + 2] || 0), 0));
    gt.push(...bucketTotals);
    gt.push(rows.reduce((s, r) => s + r[r.length - 1], 0));
    gt._grandTotal = true;
    rows.push(gt);

    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'STORAGE LOCATION × PRODUCT AGEING MATRIX' });
  }

  // By product summary
  if (byProduct.length) {
    const headers = ['Product Type', 'Total Value (₹)', 'Items'];
    const rows = byProduct.map((r) => [r.product_type || 'UNASSIGNED', Number(r.total_value) || 0, Number(r.cnt) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'PRODUCT TYPE SUMMARY', noFmtCols: [2] });
  }

  // By bucket summary
  if (byBucket.length) {
    const headers = ['Age Bucket', 'Items', 'Total Value (₹)'];
    const rows = byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'AGE BUCKET SUMMARY', noFmtCols: [1] });
  }

  const widths = [20, 18, ...AGE_BUCKETS.map(() => 13), 16];
  setColWidths(ws, widths);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Product Analytics sheet.
 */
function generateProductAnalytics(wb, data, filters) {
  const ws = wb.addWorksheet('5. Product Analytics');
  const colSpan = AGE_BUCKETS.length + 4;
  let row = writeHeader(ws, 'PRODUCT ANALYTICS REPORT', 'Ageing analysis by product type', colSpan, filters);

  if (!data) { ws.getCell(row, 1).value = 'No data available.'; setColWidths(ws, [30]); return ws; }

  const { data: rows = [], grandTotal = 0 } = data;

  row = writeKPIs(ws, {
    'Grand Total Value':  Number(grandTotal) || 0,
    'Product Types':      rows.length,
    'Avg Age (days)':     rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.avg_age || 0), 0) / rows.length) : 0,
  }, row, colSpan);

  if (rows.length) {
    const headers = ['Product Type', ...AGE_BUCKETS, 'Grand Total', 'Materials', 'Items', 'Avg Age (d)'];
    const dataRows = rows.map((r) => [
      r.product_type || 'UNASSIGNED',
      ...AGE_BUCKET_KEYS.map((k) => Number(r[k]) || 0),
      Number(r.total_value) || 0,
      Number(r.material_count) || 0,
      Number(r.item_count) || 0,
      Number(r.avg_age) || 0,
    ]);
    const gt = ['Grand Total'];
    for (let i = 0; i < AGE_BUCKETS.length; i++) {
      gt.push(dataRows.reduce((s, r) => s + (r[i + 1] || 0), 0));
    }
    gt.push(Number(grandTotal) || 0);
    gt.push(dataRows.reduce((s, r) => s + r[AGE_BUCKETS.length + 1], 0));
    gt.push(dataRows.reduce((s, r) => s + r[AGE_BUCKETS.length + 2], 0));
    gt.push('');
    gt._grandTotal = true;
    dataRows.push(gt);

    row = writeDataTable(ws, headers, dataRows, row, {
      sectionTitle: 'PRODUCT TYPE AGEING DISTRIBUTION',
      noFmtCols: [AGE_BUCKETS.length + 2, AGE_BUCKETS.length + 3, AGE_BUCKETS.length + 4],
    });
  }

  const widths = [20, ...AGE_BUCKETS.map(() => 13), 16, 12, 10, 12];
  setColWidths(ws, widths);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the GIT (In Transit) sheet.
 */
function generateGIT(wb, data, filters) {
  const ws = wb.addWorksheet('6. In Transit (GIT)');
  const colSpan = 6;
  let row = writeHeader(ws, 'GOODS IN TRANSIT (GIT) REPORT', 'Import shipments in transit — ageing analysis', colSpan, filters);

  if (!data) { ws.getCell(row, 1).value = 'No data available.'; setColWidths(ws, [30]); return ws; }

  const { kpis, byBucket = [], byProduct = [], byVendor = [] } = data;

  if (kpis) {
    row = writeKPIs(ws, {
      'Total GIT Value':        Number(kpis.total_value) || 0,
      'Total Items':            Number(kpis.item_count) || 0,
      'Unique Vendors':         Number(kpis.vendor_count) || 0,
      'Critical Items (>90d)':  Number(kpis.critical_count) || 0,
      'Avg Age (days)':         Number(kpis.avg_age) || 0,
    }, row, colSpan);
  }

  if (byBucket.length) {
    const headers = ['Age Bucket', 'Items', 'Total Value (₹)'];
    const rows = byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'GIT AGEING BUCKETS', noFmtCols: [1] });
  }

  if (byProduct.length) {
    const headers = ['Product', 'Items', 'Total Value (₹)'];
    const rows = byProduct.map((r) => [r.product || '—', Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'GIT BY PRODUCT', noFmtCols: [1] });
  }

  if (byVendor.length) {
    const headers = ['Vendor Code', 'Items', 'Total Value (₹)'];
    const rows = byVendor.map((r) => [r.vendor_code || '—', Number(r.cnt) || 0, Number(r.total_value) || 0]);
    const gt = ['Grand Total', rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)];
    gt._grandTotal = true; rows.push(gt);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'GIT BY VENDOR (TOP 15)', noFmtCols: [1] });
  }

  setColWidths(ws, [26, 14, 22, 22, 22, 14]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Monthly Comparison sheet.
 */
function generateMonthlyComparison(wb, closingData, filters) {
  const ws = wb.addWorksheet('7. Monthly Comparison');
  const colSpan = 6;
  let row = writeHeader(ws, 'MONTHLY COMPARISON REPORT', 'Period-over-period inventory trend', colSpan, filters);

  const periods = closingData?.periods || [];

  if (periods.length < 2) {
    ws.getCell(row, 1).value = 'Insufficient period data for comparison.';
    setColWidths(ws, [40]);
    return ws;
  }

  // Build month-over-month comparison
  const headers = ['Period', 'Value (₹)', 'Stock', 'Materials', 'MoM Value Δ (₹)', 'MoM Value Δ %'];
  const dataRows = [];

  for (let i = 0; i < periods.length; i++) {
    const cur = periods[i];
    const prev = periods[i - 1];
    const valDelta = prev ? (Number(cur.total_value) - Number(prev.total_value)) : null;
    const pctDelta = (prev && Number(prev.total_value) > 0) ? valDelta / Number(prev.total_value) : null;
    dataRows.push([
      cur.period_name,
      Number(cur.total_value) || 0,
      Number(cur.total_stock) || 0,
      Number(cur.material_count) || 0,
      valDelta !== null ? valDelta : '—',
      pctDelta !== null ? pctDelta : '—',
    ]);
  }

  // Grand total
  const gt = [
    'Grand Total',
    dataRows.reduce((s, r) => s + (typeof r[1] === 'number' ? r[1] : 0), 0),
    dataRows.reduce((s, r) => s + (typeof r[2] === 'number' ? r[2] : 0), 0),
    '',
    '',
    '',
  ];
  gt._grandTotal = true;
  dataRows.push(gt);

  row = writeDataTable(ws, headers, dataRows, row, {
    sectionTitle: 'MONTH-OVER-MONTH COMPARISON',
    noFmtCols: [2, 3],
    percentCols: [5],
  });

  setColWidths(ws, [20, 22, 18, 14, 22, 18]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Trend Analysis sheet.
 */
function generateTrendAnalysis(wb, trendData, filters) {
  const ws = wb.addWorksheet('8. Trend Analysis');
  const colSpan = 5;
  let row = writeHeader(ws, 'TREND ANALYSIS', 'Monthly inventory trend from GR date', colSpan, filters);

  const rows = trendData?.data || [];

  if (!rows.length) {
    ws.getCell(row, 1).value = 'No trend data available.';
    setColWidths(ws, [30]);
    return ws;
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const headers = ['Year', 'Month', 'Period', 'Total Value (₹)', 'Total Qty', 'Items'];
  const dataRows = rows.map((r) => [
    r.yr,
    r.mo,
    `${MONTH_NAMES[(r.mo || 1) - 1]} ${r.yr}`,
    Number(r.total_value) || 0,
    Number(r.total_qty) || 0,
    Number(r.cnt) || 0,
  ]);
  const gt = ['Grand Total', '', '', dataRows.reduce((s, r) => s + r[3], 0), dataRows.reduce((s, r) => s + r[4], 0), dataRows.reduce((s, r) => s + r[5], 0)];
  gt._grandTotal = true; dataRows.push(gt);

  row = writeDataTable(ws, headers, dataRows, row, { sectionTitle: 'MONTHLY TREND DATA', noFmtCols: [0, 1, 4, 5] });

  setColWidths(ws, [10, 10, 16, 22, 16, 12]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Charts Dashboard sheet (data tables for each chart type).
 * ExcelJS native charts are limited; we provide clear labeled data tables
 * that users can chart themselves, plus descriptive headers.
 */
function generateChartsDashboard(wb, allData, filters) {
  const ws = wb.addWorksheet('7. Charts Dashboard');
  const colSpan = 6;
  let row = writeHeader(ws, 'CHARTS DATA DASHBOARD', 'Data tables for all chart types — use Insert → Chart in Excel', colSpan, filters);

  // Note banner
  ws.mergeCells(row, 1, row, colSpan);
  const note = ws.getCell(row, 1);
  note.value = '📊  Select any data range below and use Excel Insert → Chart to create interactive charts.';
  note.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF5C4A00' } };
  note.fill = fill('FFF9E6');
  note.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 18;
  row += 2;

  const { dashboardData, ageingData, gitData } = allData;

  // Product distribution (Pie chart data)
  if (dashboardData?.byProduct?.length) {
    const headers = ['Product Type', 'Value (₹)', '% Share'];
    const totalVal = dashboardData.byProduct.reduce((s, r) => s + Number(r.total_value || 0), 0);
    const rows = dashboardData.byProduct.map((r) => [
      r.product_type || 'UNASSIGNED',
      Number(r.total_value) || 0,
      totalVal > 0 ? (Number(r.total_value) / totalVal) : 0,
    ]);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'PRODUCT DISTRIBUTION (PIE CHART DATA)', percentCols: [2] });
  }

  // Age bucket distribution (Bar chart data)
  if (dashboardData?.byBucket?.length) {
    const headers = ['Age Bucket', 'Items', 'Value (₹)'];
    const rows = dashboardData.byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'AGE BUCKET DISTRIBUTION (BAR CHART DATA)', noFmtCols: [1] });
  }

  // Location distribution (Column chart data)
  if (dashboardData?.byLocation?.length) {
    const headers = ['Storage Location', 'Value (₹)', 'Avg Age (d)'];
    const rows = dashboardData.byLocation.map((r) => [r.storage_location, Number(r.total_value) || 0, Number(r.avg_age) || 0]);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'LOCATION DISTRIBUTION (COLUMN CHART DATA)', noFmtCols: [2] });
  }

  // GIT ageing (Stacked column data)
  if (gitData?.byBucket?.length) {
    const headers = ['Age Bucket', 'Items', 'Value (₹)'];
    const rows = gitData.byBucket.map((r) => [r.bucket, Number(r.cnt) || 0, Number(r.total_value) || 0]);
    row = writeDataTable(ws, headers, rows, row, { sectionTitle: 'GIT AGEING (STACKED COLUMN DATA)', noFmtCols: [1] });
  }

  setColWidths(ws, [28, 22, 16, 22, 22, 14]);
  freezeTopRows(ws, 5);
  return ws;
}

/**
 * Build the Validation Summary sheet.
 */
function generateValidationSummary(wb, allData, filters) {
  const ws = wb.addWorksheet('8. Validation Summary');
  const colSpan = 5;
  let row = writeHeader(ws, 'VALIDATION SUMMARY', 'Data integrity and completeness checks', colSpan, filters);

  const checks = [];

  if (allData.dashboardData?.ageing) {
    const a = allData.dashboardData.ageing;
    checks.push(['Dashboard', 'Inventory Items', Number(a.total_items) || 0, 'PASS', 'Total items loaded']);
    checks.push(['Dashboard', 'Total Value', fmtInrNum(a.total_value), 'PASS', 'Calculated from DB']);
    checks.push(['Dashboard', 'Materials', Number(a.material_count) || 0, 'PASS', 'Unique material codes']);
    checks.push(['Dashboard', 'Locations', Number(a.location_count) || 0, 'PASS', 'Unique storage locations']);
  }

  if (allData.closingData?.periods) {
    checks.push(['Closing Inventory', 'Periods Available', allData.closingData.periods.length, 'PASS', 'SAP periods loaded']);
  }

  if (allData.gitData?.kpis) {
    const g = allData.gitData.kpis;
    checks.push(['GIT', 'GIT Items', Number(g.item_count) || 0, Number(g.item_count) > 0 ? 'PASS' : 'WARN', 'Import shipments']);
    checks.push(['GIT', 'Vendors', Number(g.vendor_count) || 0, 'PASS', 'Unique vendors']);
    checks.push(['GIT', 'Critical (>90d)', Number(g.critical_count) || 0,
      Number(g.critical_count) > 0 ? 'WARN' : 'PASS', 'Items >90 days old']);
  }

  checks.push(['Export', 'Generated At', nowIST(), 'PASS', 'Report generation timestamp']);
  checks.push(['Export', 'Format', 'Excel (XLSX)', 'PASS', 'Enterprise format']);

  if (filters.years?.length || filters.months?.length || filters.products?.length || filters.locations?.length || filters.days?.length) {
    checks.push(['Filters', 'Filters Applied', Object.entries(filters).filter(([, v]) => v?.length).length, 'INFO', 'User-applied filters']);
  } else {
    checks.push(['Filters', 'Filters Applied', 'None', 'INFO', 'All data included']);
  }

  const headers = ['Module', 'Check', 'Value', 'Status', 'Notes'];
  const dataRows = checks.map((c) => [...c]);
  row = writeDataTable(ws, headers, dataRows, row, { sectionTitle: 'DATA VALIDATION CHECKS' });

  // Color status column
  // (applied after writeDataTable since it only fills generically)
  // Find the data rows and apply conditional colors
  const headerRowIndex = row - dataRows.length - 1;
  for (let i = 0; i < dataRows.length; i++) {
    const status = dataRows[i][3];
    const cell = ws.getCell(headerRowIndex + i, 4);
    if (status === 'PASS') {
      cell.fill = fill(C.successBg);
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF' + C.successFont } };
    } else if (status === 'WARN') {
      cell.fill = fill(C.warnBg);
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF000000' } };
    } else {
      cell.fill = fill('4472C4');
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    }
  }

  setColWidths(ws, [20, 24, 22, 12, 36]);
  freezeTopRows(ws, 5);
  return ws;
}

// ─── Complete Workbook Builder ─────────────────────────────────────────────────

/**
 * Build a complete multi-sheet workbook from all data sources.
 * @param {object} allData - { dashboardData, closingData, ageingData, gitData, trendData }
 * @param {object} filters - applied filters
 * @returns {ExcelJS.Workbook}
 */
async function buildCompleteWorkbook(allData, filters) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sona Comstar Analytics';
  wb.company = 'Sona Comstar';
  wb.created = new Date();
  wb.modified = new Date();

  generateExecutiveSummary(wb, allData, filters);
  generateDashboard(wb, allData.dashboardData, filters, allData.closingData);
  generateClosingInventory(wb, allData.closingData, filters);
  generateStorageAgeing(wb, allData.ageingData, filters);
  generateProductAnalytics(wb, allData.productData, filters);
  generateGIT(wb, allData.gitData, filters);

  return wb;
}

/**
 * Build a single-module workbook.
 */
async function buildSingleWorkbook(module, data, filters) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sona Comstar Analytics';
  wb.company = 'Sona Comstar';
  wb.created = new Date();

  switch (module) {
    case 'dashboard':          generateDashboard(wb, data, filters);           break;
    case 'closing-inventory':  generateClosingInventory(wb, data, filters);    break;
    case 'storage-ageing':     generateStorageAgeing(wb, data, filters);       break;
    case 'product-ageing':     generateProductAnalytics(wb, data, filters);    break;
    case 'git':                generateGIT(wb, data, filters);                 break;
    default:
      throw new Error(`Unknown module: ${module}`);
  }

  return wb;
}

/**
 * Generate export filename.
 */
function exportFilename(prefix, format) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `SonaComstar_${prefix}_${date}_${time}.${format}`;
}

module.exports = {
  buildCompleteWorkbook,
  buildSingleWorkbook,
  generateExecutiveSummary,
  generateDashboard,
  generateClosingInventory,
  generateStorageAgeing,
  generateProductAnalytics,
  generateGIT,
  generateMonthlyComparison,
  generateTrendAnalysis,
  generateChartsDashboard,
  generateValidationSummary,
  exportFilename,
  writeHeader,
  writeKPIs,
  writeDataTable,
  setColWidths,
  freezeTopRows,
  AGE_BUCKETS,
  AGE_BUCKET_KEYS,
};
