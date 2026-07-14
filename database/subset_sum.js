const XLSX = require('xlsx');
const path = require('path');

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

// Let's find which rows sum to 56359 (or close to it)
console.log('Searching for subset summing to 56359...');
const items = blankGrRows.map(r => ({
  rowIndex: r.rowIndex,
  mat: r.Material,
  val: Number(r['Total Value'] || 0),
  entered: Number(r['Entered On'] || 0),
  transfer: Number(r['Aging(Last Date of Trnsfr)'] || 0),
  mfg: Number(r['Manufacture Date Aging'] || 0),
  mfgDate: Number(r['Manufacture Date'] || 0),
}));

// Simple greedy / branch-and-bound or exhaustive search for subset sum
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
  // Sort descending to find matches faster and prune
  const sorted = [...arr].sort((a, b) => b.val - a.val);
  search(0, 0, []);
  return results;
}

const matches3Y = findSubsets(items, 56359, 10);
console.log(`Found ${matches3Y.length} matches for Above 3 Years (56359):`);
matches3Y.slice(0, 5).forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.rowIndex}: mat=${i.mat} val=${i.val} mfg=${i.mfg} transfer=${i.transfer}`));
});
