const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);
const headerRow = 0;

const headers = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
  headers.push(cell ? String(cell.v).trim() : '');
}

const locIdx = 3;
const ageRcptIdx = 24; // Aging(Date of Rcpt)
const transferIdx = 26; // Aging(Last Date of Trnsfr)  
const mfgAgingIdx = 28; // Manufacture Date Aging
const valUnrestIdx = 10; // Value Unrestricted
const grDateIdx = 23; // GR Issue date

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
  WICQ: { '0-30 Days':0,'31-60 Days':0,'61-90 Days':0,'91-180 Days':0,'181-365 Days':429410,'Above 1 Year':665436,'Above 2 Years':0,'Above 3 Years':56359,'Above 4 Years':0,'Above 5 Years':13535773 },
  HDFG: { '0-30 Days':7168337,'31-60 Days':723710,'61-90 Days':0,'91-180 Days':3303255,'181-365 Days':2300143,'Above 1 Year':438673,'Above 2 Years':276769,'Above 3 Years':0,'Above 4 Years':0,'Above 5 Years':1303780 }
};

// Calculate total value for each row (formula is sum of multiple value columns in uploaded file)
// In ORIGINAL file, value = Value Unrestricted + Val. in Trans./Tfr + Value in QualInsp. + Value Restricted + Value BlockedStock + Value Rets Blocked
function getTotalValue(r) {
  const v = [10, 12, 14, 16, 18, 20]; // K, M, O, Q, S, U
  let total = 0;
  for (const c of v) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) total += Number(cell.v || 0);
  }
  return total;
}

// Test multiple strategies
const strategies = [
  { name: 'Aging(Date of Rcpt) with Total Value', ageCol: ageRcptIdx, valFn: getTotalValue },
  { name: 'Aging(Date of Rcpt) with Value Unrestricted', ageCol: ageRcptIdx, valFn: (r) => {
    const c = ws[XLSX.utils.encode_cell({ r, c: valUnrestIdx })];
    return Number(c ? c.v : 0);
  }},
  { name: 'Aging(Last Date of Trnsfr) with Total Value', ageCol: transferIdx, valFn: getTotalValue },
  { name: 'Manufacture Date Aging with Total Value', ageCol: mfgAgingIdx, valFn: getTotalValue },
  { name: 'Max(Aging Date of Rcpt, Transfer) with Total Value', ageCol: -1, valFn: getTotalValue, ageFn: (r) => {
    const a = ws[XLSX.utils.encode_cell({ r, c: ageRcptIdx })];
    const t = ws[XLSX.utils.encode_cell({ r, c: transferIdx })];
    return Math.max(Number(a ? a.v : 0), Number(t ? t.v : 0));
  }},
];

for (const strat of strategies) {
  const locBuckets = {};
  
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!matCell || !matCell.v) continue;
    
    const locCell = ws[XLSX.utils.encode_cell({ r, c: locIdx })];
    const loc = locCell ? String(locCell.v).trim() : '';
    
    if (!TARGETS[loc]) continue;
    
    let ageDays;
    if (strat.ageFn) {
      ageDays = strat.ageFn(r);
    } else {
      const ageCell = ws[XLSX.utils.encode_cell({ r, c: strat.ageCol })];
      ageDays = Number(ageCell ? ageCell.v : 0);
    }
    
    const val = strat.valFn(r);
    
    if (!locBuckets[loc]) {
      locBuckets[loc] = {};
      BUCKET_ORDER.forEach(b => locBuckets[loc][b] = 0);
    }
    
    const bucket = getAgeBucket(ageDays);
    locBuckets[loc][bucket] += val;
  }
  
  console.log(`\n=== Strategy: ${strat.name} ===`);
  let stratPass = true;
  for (const loc of ['WICQ', 'HDFG']) {
    const buckets = locBuckets[loc] || {};
    let pass = true;
    BUCKET_ORDER.forEach(b => {
      const expected = TARGETS[loc][b];
      const actual = Math.round(buckets[b] || 0);
      const diff = Math.abs(expected - actual);
      if (diff > 5) pass = false;
    });
    if (!pass) stratPass = false;
    console.log(`  ${loc}: ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) {
      BUCKET_ORDER.forEach(b => {
        const expected = TARGETS[loc][b];
        const actual = Math.round(buckets[b] || 0);
        const diff = Math.abs(expected - actual);
        if (diff > 5) console.log(`    ${b.padEnd(15)}: expected=${expected.toLocaleString().padStart(12)}, actual=${actual.toLocaleString().padStart(12)} (DIFF=${diff.toLocaleString()})`);
        else console.log(`    ${b.padEnd(15)}: [OK]`);
      });
    }
  }
}
