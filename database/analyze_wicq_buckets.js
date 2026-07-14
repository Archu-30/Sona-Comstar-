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

const wicqRows = [];
const hdfgRows = [];

for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || matCell.v === undefined) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: 3 })]; // Storage Location
  const loc = locCell ? String(locCell.v).trim() : '';
  
  if (loc === 'WICQ' || loc === 'HDFG') {
    const rowObj = { rowIndex: r + 1, loc };
    headers.forEach((h, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      rowObj[h || `Col_${c}`] = cell ? cell.v : '';
    });
    if (loc === 'WICQ') wicqRows.push(rowObj);
    else hdfgRows.push(rowObj);
  }
}

const BUCKET_ORDER = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181-365 Days',
  'Above 1 Year',
  'Above 2 Years',
  'Above 3 Years',
  'Above 4 Years',
  'Above 5 Years',
];

function getAgeBucket(days) {
  if (days < 0) return 'Unknown';
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

const TARGETS = {
  WICQ: {
    '0-30 Days': 0,
    '31-60 Days': 0,
    '61-90 Days': 0,
    '91-180 Days': 0,
    '181-365 Days': 429410,
    'Above 1 Year': 665436,
    'Above 2 Years': 0,
    'Above 3 Years': 56359,
    'Above 4 Years': 0,
    'Above 5 Years': 13535773,
  },
  HDFG: {
    '0-30 Days': 7168337,
    '31-60 Days': 723710,
    '61-90 Days': 0,
    '91-180 Days': 3303255,
    '181-365 Days': 2300143,
    'Above 1 Year': 438673,
    'Above 2 Years': 276769,
    'Above 3 Years': 0,
    'Above 4 Years': 0,
    'Above 5 Years': 1303780,
  }
};

const candidates = [
  { name: 'AA (Col Y)', fn: (r) => Number(r['AA'] || 0) },
  { name: 'Aging(Date of Rcpt) (Col Z)', fn: (r) => Number(r['Aging(Date of Rcpt)'] || 0) },
];

candidates.forEach((cand) => {
  console.log(`\n===========================================`);
  console.log(`Candidate: ${cand.name}`);
  console.log(`===========================================`);
  
  ['WICQ', 'HDFG'].forEach((loc) => {
    const rows = loc === 'WICQ' ? wicqRows : hdfgRows;
    const buckets = {};
    BUCKET_ORDER.forEach(b => buckets[b] = 0);
    
    rows.forEach(r => {
      const days = cand.fn(r);
      const b = getAgeBucket(days);
      buckets[b] += Number(r['Total Value'] || 0);
    });
    
    console.log(`\nLocation: ${loc}`);
    let locPass = true;
    BUCKET_ORDER.forEach(b => {
      const expected = TARGETS[loc][b];
      const actual = Math.round(buckets[b]);
      const diff = Math.abs(expected - actual);
      if (diff > 5) {
        locPass = false;
        console.log(`  ${b.padEnd(15)}: Expected=${expected.toLocaleString().padStart(12)}, Actual=${actual.toLocaleString().padStart(12)} (DIFF=${diff.toLocaleString()})`);
      } else {
        console.log(`  ${b.padEnd(15)}: Expected=${expected.toLocaleString().padStart(12)}, Actual=${actual.toLocaleString().padStart(12)} [OK]`);
      }
    });
    console.log(`Result for ${loc}: ${locPass ? 'PASS' : 'FAIL'}`);
  });
});
