const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

// We want to test all candidate columns for grouping WICQ blank GR rows.
// The targets for blank GR rows in WICQ are:
// Above 1 Year: 665436
// Above 3 Years: 56359
// Above 5 Years: 13535773
// Note: We know that the sum of these three is 14257568, which is the total WICQ blank GR value.

const wicqBlanks = [];
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'WICQ') {
    const gr = ws[XLSX.utils.encode_cell({ r, c: 23 })]?.v;
    if (!gr) {
      const val = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
      if (val > 0) {
        wicqBlanks.push({
          row: r + 1,
          val,
          aa: ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v || 0,
          ageRcpt: ws[XLSX.utils.encode_cell({ r, c: 25 })]?.v || 0,
          entered: ws[XLSX.utils.encode_cell({ r, c: 26 })]?.v || 0,
          transfer: ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v || 0,
          mfgDate: ws[XLSX.utils.encode_cell({ r, c: 28 })]?.v || 0,
          mfgAg: ws[XLSX.utils.encode_cell({ r, c: 29 })]?.v || 0,
        });
      }
    }
  }
}

console.log(`Analyzing ${wicqBlanks.length} WICQ blank GR rows...`);

// Let's test different columns as the aging days column for these blank GR rows.
// We'll define a function that buckets the value and checks how close the sums are.
const colNames = ['aa', 'ageRcpt', 'entered', 'transfer', 'mfgAg'];

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

colNames.forEach(col => {
  console.log(`\n--- Testing Col: ${col} directly ---`);
  const buckets = {};
  wicqBlanks.forEach(item => {
    const days = item[col];
    const b = getAgeBucket(days);
    buckets[b] = (buckets[b] || 0) + item.val;
  });
  Object.keys(buckets).sort().forEach(b => {
    console.log(`  ${b}: ${Math.round(buckets[b]).toLocaleString()}`);
  });
});

// Let's also test: (Report Date - DateValue) for Entered On and Manufacture Date.
// We'll try Report Date = 46199.
console.log('\n--- Testing 46199 - entered ---');
let bucketsEntered = {};
wicqBlanks.forEach(item => {
  const days = 46199 - item.entered;
  const b = getAgeBucket(days);
  bucketsEntered[b] = (bucketsEntered[b] || 0) + item.val;
});
Object.keys(bucketsEntered).sort().forEach(b => {
  console.log(`  ${b}: ${Math.round(bucketsEntered[b]).toLocaleString()}`);
});

console.log('\n--- Testing 46199 - mfgDate ---');
let bucketsMfg = {};
wicqBlanks.forEach(item => {
  if (item.mfgDate > 0) {
    const days = 46199 - item.mfgDate;
    const b = getAgeBucket(days);
    bucketsMfg[b] = (bucketsMfg[b] || 0) + item.val;
  } else {
    bucketsMfg['No Mfg Date'] = (bucketsMfg['No Mfg Date'] || 0) + item.val;
  }
});
Object.keys(bucketsMfg).sort().forEach(b => {
  console.log(`  ${b}: ${Math.round(bucketsMfg[b]).toLocaleString()}`);
});
