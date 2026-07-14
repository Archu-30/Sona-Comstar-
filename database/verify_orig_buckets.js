const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);
const headerRow = 0; // Row 1 = index 0 (NO pre-header row)

const headers = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
  headers.push(cell ? String(cell.v).trim() : '');
}

// Column index lookup
const colIdx = (name) => headers.indexOf(name);
const locIdx = colIdx('Storage Location');
const ageRcptIdx = colIdx('Aging(Date of Rcpt)');
const aaIdx = colIdx('AA'); // This is Aging(Last Date of Trnsfr)!
const valIdx = colIdx('Value Unrestricted');
const totalValIdx = colIdx('AF') !== -1 ? colIdx('AF') : -1;
// Let's check a few columns
console.log('Headers (0-indexed):');
headers.forEach((h, i) => { if (h) console.log(`  [${i}] ${h}`); });

// Find Total Value column 
// In original file there's no "Total Value" - it uses Value Unrestricted
console.log('\nLocIdx:', locIdx, 'AgeRcptIdx:', ageRcptIdx, 'AAIdx:', aaIdx, 'ValIdx:', valIdx);

// WICQ buckets using Aging(Date of Rcpt) column
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

const BUCKET_ORDER = ['0-30 Days','31-60 Days','61-90 Days','91-180 Days','181-365 Days','Above 1 Year','Above 2 Years','Above 3 Years','Above 4 Years','Above 5 Years'];

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

// Build buckets for WICQ and HDFG using Value Unrestricted and Aging(Date of Rcpt)
const locBuckets = {};
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || !matCell.v) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: locIdx })];
  const loc = locCell ? String(locCell.v).trim() : '';
  
  if (!TARGETS[loc]) continue;
  
  const ageCell = ws[XLSX.utils.encode_cell({ r, c: ageRcptIdx })];
  const valCell = ws[XLSX.utils.encode_cell({ r, c: valIdx })];
  
  const ageDays = Number(ageCell ? ageCell.v : 0);
  const val = Number(valCell ? valCell.v : 0);
  
  if (!locBuckets[loc]) {
    locBuckets[loc] = {};
    BUCKET_ORDER.forEach(b => locBuckets[loc][b] = 0);
  }
  
  const bucket = getAgeBucket(ageDays);
  locBuckets[loc][bucket] += val;
}

console.log('\n=== USING Aging(Date of Rcpt) with Value Unrestricted ===');
for (const loc of ['WICQ', 'HDFG']) {
  const buckets = locBuckets[loc] || {};
  console.log(`\nLocation: ${loc}`);
  let pass = true;
  BUCKET_ORDER.forEach(b => {
    const expected = TARGETS[loc][b];
    const actual = Math.round(buckets[b] || 0);
    const diff = Math.abs(expected - actual);
    const status = diff <= 5 ? '[OK]' : `(DIFF=${diff.toLocaleString()})`;
    if (diff > 5) pass = false;
    console.log(`  ${b.padEnd(15)}: expected=${expected.toLocaleString().padStart(12)}, actual=${actual.toLocaleString().padStart(12)} ${status}`);
  });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}`);
}
