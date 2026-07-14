const express = require('express');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const fs = require('fs');
const { getSummaryReportPath, getInventoryAgeing } = require('../../database/index');
const {
  calculateProductAgeing,
  calculateStorageLocationAgeingDetailed,
} = require('../lib/calculations');

const router = express.Router();

const BRAND = 'Sona Comstar';
const TITLE = 'Inventory Analytics — Summary Report';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
const SUB_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
const BORDER = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const ALL_BORDER = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

function applyHeaderRow(row) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 22;
  row.eachCell((c) => { c.border = ALL_BORDER; });
}
function applyBodyRow(row, opts = {}) {
  row.eachCell((c) => {
    c.border = ALL_BORDER;
    c.alignment = { vertical: 'middle', horizontal: opts.align ?? 'right' };
  });
  if (opts.total) {
    row.font = { bold: true };
    row.fill = TOTAL_FILL;
  }
}
function setColWidths(ws, widths) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}
function addTitleBanner(ws, title, subtitle, colSpan) {
  const banner = ws.addRow([title]);
  ws.mergeCells(banner.number, 1, banner.number, colSpan);
  banner.font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  banner.height = 26;
  banner.alignment = { horizontal: 'left', vertical: 'middle' };
  if (subtitle) {
    const s = ws.addRow([subtitle]);
    ws.mergeCells(s.number, 1, s.number, colSpan);
    s.font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    s.alignment = { horizontal: 'left' };
  }
  ws.addRow([]);
}

function fmtInr(cell) {
  cell.numFmt = '[$₹-4009]#,##,##0.00;[Red]-[$₹-4009]#,##,##0.00';
}
function fmtNum(cell) {
  cell.numFmt = '#,##,##0.00';
}
function fmtPct(cell) {
  cell.numFmt = '0.00"%"';
}

async function generateWorkbook(filters) {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND;
  wb.created = new Date();

  // Read summary source
  const filePath = getSummaryReportPath();
  if (!fs.existsSync(filePath)) throw new Error('Summary source file not found. Upload one first.');
  const src = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const readSheet = (name) => {
    const s = src.Sheets[src.SheetNames.find((n) => n.toLowerCase().includes(name.toLowerCase()))];
    return s ? XLSX.utils.sheet_to_json(s, { header: 1, defval: null }) : [];
  };
  const invRows = readSheet('inventory summary');
  const ageingRows = readSheet('ageing');
  const gitRows = readSheet('git');

  // ---------- Sheet 1: Cover / Filters / KPIs ----------
  const cover = wb.addWorksheet('Overview', { views: [{ showGridLines: false }] });
  setColWidths(cover, [26, 22, 22, 22, 22, 22, 22]);

  addTitleBanner(cover, `${BRAND} — ${TITLE}`, `Generated on ${new Date().toLocaleString('en-IN')}`, 7);

  const filtHead = cover.addRow(['Selected Filters']);
  cover.mergeCells(filtHead.number, 1, filtHead.number, 7);
  filtHead.font = { bold: true, size: 12 };
  filtHead.fill = SUB_FILL;
  cover.addRow(['Year', filters.year ?? 'All']);
  cover.addRow(['Month', filters.month ?? 'All']);
  cover.addRow(['Product Type', filters.productType ?? 'All']);
  cover.addRow(['Storage Location', filters.storageLocation ?? 'All']);
  cover.addRow(['Plant', filters.plant ?? 'All']);
  cover.addRow([]);

  // KPI grid
  const kpiHead = cover.addRow(['KPI Summary']);
  cover.mergeCells(kpiHead.number, 1, kpiHead.number, 7);
  kpiHead.font = { bold: true, size: 12 };
  kpiHead.fill = SUB_FILL;

  // Compute KPIs from source
  const products = [];
  for (let i = 1; i < invRows.length; i++) {
    const r = invRows[i];
    if (!r || !r[0]) break;
    const label = String(r[0]).trim();
    if (label.toLowerCase().includes('overall')) break;
    products.push({
      productType: label,
      openingStock: Number(r[1]) || 0,
      closingStock: Number(r[2]) || 0,
      openingValue: Number(r[5]) || 0,
      closingValue: Number(r[6]) || 0,
    });
  }
  const totQtyOpen = products.reduce((s, p) => s + p.openingStock, 0);
  const totQtyClose = products.reduce((s, p) => s + p.closingStock, 0);
  const totValOpen = products.reduce((s, p) => s + p.openingValue, 0);
  const totValClose = products.reduce((s, p) => s + p.closingValue, 0);

  const showMonth = String(filters.month || 'all').toLowerCase();
  const useOpening = showMonth === 'opening' || showMonth === 'april';
  const invQty = useOpening ? totQtyOpen : totQtyClose;
  const invVal = useOpening ? totValOpen : totValClose;

  const gitBuckets = [];
  let gitGT = null;
  for (let i = 1; i < gitRows.length; i++) {
    const r = gitRows[i];
    if (!r || !r[0]) break;
    const label = String(r[0]).trim();
    const entry = { bucket: label, qty: Number(r[1]) || 0, value: Number(r[2]) || 0 };
    if (label.toLowerCase() === 'grand total') gitGT = entry;
    else gitBuckets.push(entry);
  }

  const kpiRow = cover.addRow(['Total Inv Qty', 'Total Inv Value', 'Total GIT Qty', 'Total GIT Value', 'Product Types', '', '']);
  applyHeaderRow(kpiRow);
  const vals = cover.addRow([invQty, invVal, gitGT?.qty ?? 0, gitGT?.value ?? 0, products.length, '', '']);
  fmtNum(vals.getCell(1));
  fmtInr(vals.getCell(2));
  fmtNum(vals.getCell(3));
  fmtInr(vals.getCell(4));
  applyBodyRow(vals);
  cover.addRow([]);

  // ---------- Sheet 2: Inventory Summary ----------
  const inv = wb.addWorksheet('Inventory Summary', { views: [{ showGridLines: false }] });
  setColWidths(inv, [16, 18, 18, 18, 14, 20, 20, 20, 16]);
  addTitleBanner(inv, 'Inventory Summary', 'Product-wise opening vs closing (from source Excel)', 9);

  const invHeader = inv.addRow(['Product Type', 'April Stock', 'May Stock', 'Difference', '% Change', 'April Value', 'May Value', 'Value Diff', '% Value Change']);
  applyHeaderRow(invHeader);

  for (let i = 1; i < invRows.length; i++) {
    const r = invRows[i];
    if (!r || !r[0]) break;
    const label = String(r[0]).trim();
    if (label.toLowerCase().includes('overall')) break;
    if (filters.productType && filters.productType !== 'All' && label !== filters.productType) continue;
    const row = inv.addRow([label, Number(r[1]) || 0, Number(r[2]) || 0, Number(r[3]) || 0, Number(r[4]) || 0, Number(r[5]) || 0, Number(r[6]) || 0, Number(r[7]) || 0, Number(r[8]) || 0]);
    fmtNum(row.getCell(2)); fmtNum(row.getCell(3)); fmtNum(row.getCell(4));
    fmtPct(row.getCell(5));
    fmtInr(row.getCell(6)); fmtInr(row.getCell(7)); fmtInr(row.getCell(8));
    fmtPct(row.getCell(9));
    applyBodyRow(row, { align: 'right' });
  }

  const totalRow = inv.addRow(['TOTAL', totQtyOpen, totQtyClose, totQtyClose - totQtyOpen, ((totQtyClose - totQtyOpen) / (totQtyOpen || 1)) * 100, totValOpen, totValClose, totValClose - totValOpen, ((totValClose - totValOpen) / (totValOpen || 1)) * 100]);
  fmtNum(totalRow.getCell(2)); fmtNum(totalRow.getCell(3)); fmtNum(totalRow.getCell(4));
  fmtPct(totalRow.getCell(5));
  fmtInr(totalRow.getCell(6)); fmtInr(totalRow.getCell(7)); fmtInr(totalRow.getCell(8));
  fmtPct(totalRow.getCell(9));
  applyBodyRow(totalRow, { align: 'right', total: true });

  // ---------- Sheet 3: Ageing Summary (pivot from source) ----------
  const age = wb.addWorksheet('Ageing Summary', { views: [{ showGridLines: false }] });
  addTitleBanner(age, 'Inventory Ageing Summary', 'Product × Age Bucket (Sum of Value Unrestricted)', 8);

  // Find header row in ageingRows (row 2 in source)
  let ageHeaderIdx = ageingRows.findIndex((r) => (r && String(r[0]).trim().toLowerCase() === 'row labels'));
  if (ageHeaderIdx === -1) ageHeaderIdx = 2;
  const bucketNames = (ageingRows[ageHeaderIdx] || []).slice(1, -1).map((v) => String(v));
  setColWidths(age, [14, ...bucketNames.map(() => 20), 20]);

  const ageHeader = age.addRow(['Product Type', ...bucketNames, 'Grand Total']);
  applyHeaderRow(ageHeader);

  for (let i = ageHeaderIdx + 1; i < ageingRows.length; i++) {
    const r = ageingRows[i];
    if (!r || !r[0]) break;
    const label = String(r[0]).trim();
    if (filters.productType && filters.productType !== 'All' && label !== filters.productType && label.toLowerCase() !== 'grand total') continue;
    const row = age.addRow([label, ...bucketNames.map((_, bi) => Number(r[1 + bi]) || 0), Number(r[bucketNames.length + 1]) || 0]);
    for (let c = 2; c <= bucketNames.length + 2; c++) fmtInr(row.getCell(c));
    applyBodyRow(row, { total: label.toLowerCase() === 'grand total' });
  }

  // ---------- Sheet 4: Storage Ageing (unfiltered — matches Excel Grand Total) ----------
  const stor = wb.addWorksheet('Storage Ageing', { views: [{ showGridLines: false }] });
  addTitleBanner(stor, 'Storage Location Ageing', 'Location × Age Bucket + KPI columns', 10);

  const ageingItems = getInventoryAgeing();
  let locations = calculateStorageLocationAgeingDetailed(ageingItems);
  if (filters.storageLocation && filters.storageLocation !== 'All') {
    locations = locations.filter((l) => l.storageLocation === filters.storageLocation);
  }
  const buckets = ['0-30 Days', '31-60 Days', '61-90 Days', '91-180 Days', '181-365 Days', 'Above 365 Days'];
  setColWidths(stor, [14, 12, 16, 20, 10, 12, 12, 10, ...buckets.map(() => 18)]);
  const storHead = stor.addRow(['Storage Loc', 'Materials', 'Quantity', 'Value', 'Inv %', 'Avg Age', 'Oldest', 'Newest', ...buckets]);
  applyHeaderRow(storHead);

  let stGT = { mat: 0, qty: 0, val: 0, buckets: buckets.reduce((a, b) => (a[b] = 0, a), {}) };
  for (const l of locations) {
    const row = stor.addRow([
      l.storageLocation,
      l.materialCount,
      l.totalQuantity,
      l.totalValue,
      l.inventoryPercentage,
      l.avgAge,
      l.oldest,
      l.newest,
      ...buckets.map((b) => l.buckets.find((x) => x.bucket === b)?.totalValue ?? 0),
    ]);
    fmtNum(row.getCell(2)); fmtNum(row.getCell(3));
    fmtInr(row.getCell(4));
    fmtPct(row.getCell(5));
    for (let c = 9; c <= 8 + buckets.length; c++) fmtInr(row.getCell(c));
    applyBodyRow(row);
    stGT.mat += l.materialCount;
    stGT.qty += l.totalQuantity;
    stGT.val += l.totalValue;
    buckets.forEach((b) => { stGT.buckets[b] += (l.buckets.find((x) => x.bucket === b)?.totalValue ?? 0); });
  }
  const stTotal = stor.addRow(['GRAND TOTAL', stGT.mat, stGT.qty, stGT.val, 100, '', '', '', ...buckets.map((b) => stGT.buckets[b])]);
  fmtNum(stTotal.getCell(2)); fmtNum(stTotal.getCell(3));
  fmtInr(stTotal.getCell(4));
  fmtPct(stTotal.getCell(5));
  for (let c = 9; c <= 8 + buckets.length; c++) fmtInr(stTotal.getCell(c));
  applyBodyRow(stTotal, { total: true });

  // ---------- Sheet 5: Product Analytics ----------
  const prod = wb.addWorksheet('Product Analytics', { views: [{ showGridLines: false }] });
  addTitleBanner(prod, 'Product Analytics', 'Product Type × KPIs + Age Bucket values', 10);
  let productAgeing = calculateProductAgeing(ageingItems);
  if (filters.productType && filters.productType !== 'All') {
    productAgeing = productAgeing.filter((p) => p.productType === filters.productType);
  }
  setColWidths(prod, [14, 12, 16, 20, 10, 12, 12, 10, ...buckets.map(() => 18)]);
  const prodHead = prod.addRow(['Product', 'Materials', 'Quantity', 'Value', 'Inv %', 'Avg Age', 'Oldest', 'Newest', ...buckets]);
  applyHeaderRow(prodHead);
  let prGT = { mat: 0, qty: 0, val: 0, buckets: buckets.reduce((a, b) => (a[b] = 0, a), {}) };
  for (const p of productAgeing) {
    const row = prod.addRow([
      p.productType,
      p.materialCount,
      p.totalQuantity,
      p.totalValue,
      p.inventoryPercentage,
      p.avgAge,
      p.oldest,
      p.newest,
      ...buckets.map((b) => p.buckets.find((x) => x.bucket === b)?.totalValue ?? 0),
    ]);
    fmtNum(row.getCell(2)); fmtNum(row.getCell(3));
    fmtInr(row.getCell(4));
    fmtPct(row.getCell(5));
    for (let c = 9; c <= 8 + buckets.length; c++) fmtInr(row.getCell(c));
    applyBodyRow(row);
    prGT.mat += p.materialCount;
    prGT.qty += p.totalQuantity;
    prGT.val += p.totalValue;
    buckets.forEach((b) => { prGT.buckets[b] += (p.buckets.find((x) => x.bucket === b)?.totalValue ?? 0); });
  }
  const prTotal = prod.addRow(['GRAND TOTAL', prGT.mat, prGT.qty, prGT.val, 100, '', '', '', ...buckets.map((b) => prGT.buckets[b])]);
  fmtNum(prTotal.getCell(2)); fmtNum(prTotal.getCell(3));
  fmtInr(prTotal.getCell(4));
  fmtPct(prTotal.getCell(5));
  for (let c = 9; c <= 8 + buckets.length; c++) fmtInr(prTotal.getCell(c));
  applyBodyRow(prTotal, { total: true });

  // ---------- Sheet 6: GIT Summary ----------
  const gitWs = wb.addWorksheet('GIT Summary', { views: [{ showGridLines: false }] });
  setColWidths(gitWs, [22, 20, 22]);
  addTitleBanner(gitWs, 'GIT Analysis', 'Age Bucket totals from source Excel', 3);
  const gh = gitWs.addRow(['Age Bucket', 'Sum of Qty', 'Sum of Value']);
  applyHeaderRow(gh);
  for (const b of gitBuckets) {
    const row = gitWs.addRow([b.bucket, b.qty, b.value]);
    fmtNum(row.getCell(2)); fmtInr(row.getCell(3));
    applyBodyRow(row);
  }
  if (gitGT) {
    const row = gitWs.addRow(['Grand Total', gitGT.qty, gitGT.value]);
    fmtNum(row.getCell(2)); fmtInr(row.getCell(3));
    applyBodyRow(row, { total: true });
  }

  // ---------- Sheet 7: Charts (native ExcelJS chart placeholders via images) ----------
  // ExcelJS does not support native charts; we'll add pivot-style data tables labelled as "Charts Data" so Excel users can insert charts one-click.
  const charts = wb.addWorksheet('Charts Data', { views: [{ showGridLines: false }] });
  addTitleBanner(charts, 'Charts — Data Series', 'Select a table and Insert → Chart in Excel', 4);

  const addChartTable = (title, headers, rows) => {
    const h = charts.addRow([title]);
    charts.mergeCells(h.number, 1, h.number, headers.length);
    h.font = { bold: true, size: 12 };
    h.fill = SUB_FILL;
    const hr = charts.addRow(headers);
    applyHeaderRow(hr);
    for (const r of rows) {
      const row = charts.addRow(r);
      for (let c = 2; c <= headers.length; c++) {
        if (typeof r[c - 1] === 'number') fmtInr(row.getCell(c));
      }
      applyBodyRow(row);
    }
    charts.addRow([]);
  };

  addChartTable('Inventory Value by Product', ['Product', 'Value'], productAgeing.map((p) => [p.productType, p.totalValue]));
  addChartTable('Inventory Value by Storage Location', ['Location', 'Value'], locations.map((l) => [l.storageLocation, l.totalValue]));
  addChartTable('Quantity by Product', ['Product', 'Quantity'], productAgeing.map((p) => [p.productType, p.totalQuantity]));
  addChartTable('Age Bucket Distribution', ['Bucket', 'Value'], buckets.map((b) => [b, prGT.buckets[b]]));
  addChartTable('Monthly Inventory Trend', ['Period', 'Value'], [['April', totValOpen], ['May', totValClose]]);
  addChartTable('GIT Value Trend', ['Bucket', 'Value'], gitBuckets.map((b) => [b.bucket, b.value]));

  return wb;
}

router.post('/', async (req, res) => {
  try {
    const wb = await generateWorkbook(req.body || {});
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Sona_Summary_Report.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Summary export error:', err);
    res.status(500).json({ error: err.message || 'Failed to build summary export' });
  }
});

// Convenience GET so browsers can hit it directly with query filters
router.get('/', async (req, res) => {
  try {
    const wb = await generateWorkbook(req.query || {});
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Sona_Summary_Report.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Summary export error:', err);
    res.status(500).json({ error: err.message || 'Failed to build summary export' });
  }
});

module.exports = router;
