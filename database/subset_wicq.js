const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

const headerRow = 1;
const headers = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
  headers.push(cell ? String(cell.v).trim() : '');
}

const blankGrRows = [];
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || matCell.v === undefined) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
  const loc = locCell ? String(locCell.v).trim() : '';
  if (loc === 'WICQ') {
    const grCell = ws[XLSX.utils.encode_cell({ r, c: 23 })];
    if (!grCell || !grCell.v) {
      const rowObj = { rowIndex: r + 1 };
      headers.forEach((h, c) => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        rowObj[h || `Col_${c}`] = cell ? cell.v : '';
      });
      blankGrRows.push(rowObj);
    }
  }
}

const items = blankGrRows.map(r => ({
  rowIndex: r.rowIndex,
  mat: r.Material,
  val: Number(r['Total Value'] || 0),
  aa: Number(r.AA || 0),
  aging: Number(r['Aging(Date of Rcpt)'] || 0),
  transfer: Number(r['Aging(Last Date of Trnsfr)'] || 0),
  mfg: Number(r['Manufacture Date Aging'] || 0),
  gr: r['GR Issue date'] || ''
}));

console.log('Total blank GR items in WICQ:', items.length);

function findSubsets(arr, target, tolerance = 5) {
  const results = [];
  function search(idx, currentSum, path) {
    if (Math.abs(currentSum - target) <= tolerance) {
      results.push([...path]);
      return;
    }
    if (currentSum > target + tolerance || idx >= arr.length) return;
    
    // Include
    path.push(arr[idx]);
    search(idx + 1, currentSum + arr[idx].val, path);
    path.pop();
    
    // Exclude
    search(idx + 1, currentSum, path);
  }
  const sorted = [...arr].sort((a, b) => b.val - a.val);
  search(0, 0, []);
  return results;
}

const matches1Y = findSubsets(items, 665436, 1);
console.log(`\nMatches for Above 1 Year (665436):`);
matches1Y.slice(0, 5).forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.rowIndex}: mat=${i.mat} val=${i.val} aa=${i.aa} aging=${i.aging} transfer=${i.transfer} mfg=${i.mfg}`));
});

const matches3Y = findSubsets(items, 56359, 1);
console.log(`\nMatches for Above 3 Years (56359):`);
matches3Y.slice(0, 5).forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.rowIndex}: mat=${i.mat} val=${i.val} aa=${i.aa} aging=${i.aging} transfer=${i.transfer} mfg=${i.mfg}`));
});
