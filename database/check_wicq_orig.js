const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);
const headerRow = 0;

const ageRcptIdx = 24;
const transferIdx = 26;
const mfgAgingIdx = 28;
const locIdx = 3;
const grIdx = 23;

function getTotalValue(r) {
  const v = [10, 12, 14, 16, 18, 20];
  let total = 0;
  for (const c of v) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) total += Number(cell.v || 0);
  }
  return total;
}

function getAgeBucket(days) {
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  if (days <= 730) return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}

// Check all WICQ rows in original file
const wicqRows = [];
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || !matCell.v) continue;
  const locCell = ws[XLSX.utils.encode_cell({ r, c: locIdx })];
  const loc = locCell ? String(locCell.v).trim() : '';
  if (loc !== 'WICQ') continue;
  
  const grCell = ws[XLSX.utils.encode_cell({ r, c: grIdx })];
  const ageCell = ws[XLSX.utils.encode_cell({ r, c: ageRcptIdx })];
  const transferCell = ws[XLSX.utils.encode_cell({ r, c: transferIdx })];
  const mfgAgCell = ws[XLSX.utils.encode_cell({ r, c: mfgAgingIdx })];
  const val = getTotalValue(r);
  
  const gr = grCell ? Number(grCell.v) : 0;
  const age = Number(ageCell ? ageCell.v : 0);
  const transfer = Number(transferCell ? transferCell.v : 0);
  const mfgAg = Number(mfgAgCell ? mfgAgCell.v : 0);
  
  wicqRows.push({ rowIndex: r + 1, mat: matCell.v, gr, age, transfer, mfgAg, val });
}

console.log(`Found ${wicqRows.length} WICQ rows in original file`);
console.log('\nSorted by age desc:');
wicqRows.sort((a, b) => b.age - a.age);
wicqRows.forEach(r => {
  console.log(`Row ${r.rowIndex}: gr=${r.gr} age=${r.age} transfer=${r.transfer} mfgAg=${r.mfgAg} val=${r.val}`);
});
