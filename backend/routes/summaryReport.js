const express = require('express');
const XLSX = require('xlsx');
const fs = require('fs');
const { getSummaryReportPath } = require('../../database/index');

const router = express.Router();

function readSheetAoA(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

function findSheet(wb, needle) {
  const target = needle.toLowerCase();
  return wb.SheetNames.find((n) => n.toLowerCase().includes(target));
}

function trimStr(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --- Inventory Summary parser ---
// Layout:
// Row 0: header [Product type, April stock, May stock, Difference, % change, April value, May value, Value Difference, % Value change]
// Rows 1..N: product rows (stops on blank)
// Then somewhere: OVERALL STOCK COMPARISON block with TOTAL STOCK QUANTY / TOTAL STOCK VALUE
function parseInventorySummary(rows) {
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || trimStr(r[0]) === '') break;
    const label = trimStr(r[0]);
    if (label.toLowerCase().includes('overall')) break;
    products.push({
      productType: label,
      openingStock: num(r[1]),
      closingStock: num(r[2]),
      stockDifference: num(r[3]),
      percentStockChange: num(r[4]),
      openingValue: num(r[5]),
      closingValue: num(r[6]),
      valueDifference: num(r[7]),
      percentValueChange: num(r[8]),
    });
  }

  let overallStockQty = null;
  let overallStockValue = null;
  let periodLabels = { opening: 'Opening', closing: 'Closing' };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const label = trimStr(r[0]).toLowerCase();
    if (label === 'overall stock comparison') {
      periodLabels = {
        opening: trimStr(r[2]) || 'Opening',
        closing: trimStr(r[3]) || 'Closing',
      };
    }
    if (label.includes('total stock quanty') || label.includes('total stock quantity')) {
      overallStockQty = {
        opening: num(r[2]),
        closing: num(r[3]),
        difference: num(r[4]),
        percentChange: num(r[5]),
      };
    }
    if (label.includes('total stock value')) {
      overallStockValue = {
        opening: num(r[2]),
        closing: num(r[3]),
        difference: num(r[4]),
        percentChange: num(r[5]),
      };
    }
  }

  return { products, overall: { stockQty: overallStockQty, stockValue: overallStockValue }, periodLabels };
}

// --- Inventory Ageing Summary parser ---
// Row 2: ["Row Labels","0-30 Days","31-60 Days","61-90 Days","91-180 Days","181-365 Days",">365 Days","Grand Total"]
// Rows 3..: product rows; last row "Grand Total"
function parseAgeingSummary(rows) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    if (trimStr(r[0]).toLowerCase() === 'row labels') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { buckets: [], products: [], grandTotal: null };

  const header = rows[headerIdx];
  const buckets = header.slice(1, -1).map((b) => trimStr(b));

  const products = [];
  let grandTotal = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r[0] || trimStr(r[0]) === '') break;
    const label = trimStr(r[0]);
    const bucketValues = {};
    buckets.forEach((b, bi) => {
      bucketValues[b] = num(r[1 + bi]);
    });
    const total = num(r[header.length - 1]);
    if (label.toLowerCase() === 'grand total') {
      grandTotal = { buckets: bucketValues, total };
    } else {
      products.push({ productType: label, buckets: bucketValues, total });
    }
  }
  return { bucketNames: buckets, products, grandTotal };
}

// --- GIT Analysis parser ---
// Row 0: ["Row Labels","Sum of Qty","Sum of Value"]
// Rows 1..: bucket rows; last "Grand Total"
function parseGitSummary(rows) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    if (trimStr(r[0]).toLowerCase() === 'row labels') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { buckets: [], grandTotal: null };

  const buckets = [];
  let grandTotal = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r[0] || trimStr(r[0]) === '') break;
    const label = trimStr(r[0]);
    const entry = { bucket: label, qty: num(r[1]), value: num(r[2]) };
    if (label.toLowerCase() === 'grand total') grandTotal = entry;
    else buckets.push(entry);
  }
  return { buckets, grandTotal };
}

router.get('/', (_req, res) => {
  try {
    const filePath = getSummaryReportPath();
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Summary report file not found. Upload one first.' });
    }
    const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

    const invSheetName = findSheet(wb, 'inventory summary');
    const ageingSheetName = findSheet(wb, 'ageing');
    const gitSheetName = findSheet(wb, 'git');

    const inventorySummary = invSheetName
      ? parseInventorySummary(readSheetAoA(wb, invSheetName))
      : { products: [], overall: {}, periodLabels: {} };
    const ageingSummary = ageingSheetName
      ? parseAgeingSummary(readSheetAoA(wb, ageingSheetName))
      : { bucketNames: [], products: [], grandTotal: null };
    const gitSummary = gitSheetName
      ? parseGitSummary(readSheetAoA(wb, gitSheetName))
      : { buckets: [], grandTotal: null };

    res.json({
      sourceFile: filePath.split(/[/\\]/).pop(),
      sheets: wb.SheetNames,
      periodLabels: inventorySummary.periodLabels,
      inventorySummary: {
        products: inventorySummary.products,
        overall: inventorySummary.overall,
      },
      ageingSummary,
      gitSummary,
    });
  } catch (err) {
    console.error('Summary report error:', err);
    res.status(500).json({ error: err.message || 'Failed to load summary report' });
  }
});

module.exports = router;
