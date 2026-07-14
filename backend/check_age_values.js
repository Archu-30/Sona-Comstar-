// Investigate items with extreme aaAgingDays (report date = 46199)
const { getInventoryAgeing } = require('../database/index');

const items = getInventoryAgeing();
console.log(`Total items: ${items.length}`);

// Check items with aaAgingDays >= 46000 (report date serial)
const extremeItems = items.filter(i => i.aaAgingDays >= 46000);
console.log(`\nItems with aaAgingDays >= 46000: ${extremeItems.length}`);

// Distribution of aaAgingDays for these items  
const locMap = {};
let totalExtreme = 0;
for (const item of extremeItems) {
  const loc = item.storageLocation || '(blank)';
  if (!locMap[loc]) locMap[loc] = { count: 0, value: 0 };
  locMap[loc].count++;
  locMap[loc].value += item.totalValue;
  totalExtreme++;
}

console.log(`\nExtreme items by location:`);
for (const [loc, d] of Object.entries(locMap).sort()) {
  console.log(`  ${loc}: count=${d.count}, value=₹${Math.round(d.value).toLocaleString('en-IN')}`);
}

// Also check the non-extreme "Above 5 Years" items (aaAgingDays > 1825 but < 46000)
const above5Normal = items.filter(i => i.aaAgingDays > 1825 && i.aaAgingDays < 46000);
console.log(`\nItems with aaAgingDays > 1825 AND < 46000: ${above5Normal.length}`);
for (const item of above5Normal.slice(0, 5)) {
  console.log(`  loc=${item.storageLocation} aa=${item.aaAgingDays} aging=${item.agingDateOfReceipt} val=${item.totalValue}`);
}

// What is the actual HDFG breakdown using agingDateOfReceipt?
console.log('\n=== HDFG with agingDateOfReceipt ===');
const hdfg = items.filter(i => i.storageLocation === 'HDFG');
console.log(`HDFG items: ${hdfg.length}`);
const hdfgBuckets = {};
for (const item of hdfg) {
  const d = item.agingDateOfReceipt;
  let bucket;
  if (d <= 30) bucket = '0-30';
  else if (d <= 60) bucket = '31-60';
  else if (d <= 90) bucket = '61-90';
  else if (d <= 180) bucket = '91-180';
  else if (d <= 365) bucket = '181-365';
  else if (d <= 730) bucket = 'Above 1 Year';
  else if (d <= 1095) bucket = 'Above 2 Years';
  else if (d <= 1460) bucket = 'Above 3 Years';
  else if (d <= 1825) bucket = 'Above 4 Years';
  else bucket = 'Above 5 Years';
  if (!hdfgBuckets[bucket]) hdfgBuckets[bucket] = { count: 0, value: 0 };
  hdfgBuckets[bucket].count++;
  hdfgBuckets[bucket].value += item.totalValue;
}
for (const [b, d] of Object.entries(hdfgBuckets)) {
  console.log(`  ${b}: count=${d.count}, value=₹${Math.round(d.value).toLocaleString('en-IN')}`);
}

// What is HDFG using aaAgingDays?
console.log('\n=== HDFG with aaAgingDays ===');
const hdfgBuckets2 = {};
for (const item of hdfg) {
  const d = item.aaAgingDays;
  let bucket;
  if (d >= 46000) bucket = '(REPORT DATE - BLANK GR)';
  else if (d <= 30) bucket = '0-30';
  else if (d <= 60) bucket = '31-60';
  else if (d <= 90) bucket = '61-90';
  else if (d <= 180) bucket = '91-180';
  else if (d <= 365) bucket = '181-365';
  else if (d <= 730) bucket = 'Above 1 Year';
  else if (d <= 1095) bucket = 'Above 2 Years';
  else if (d <= 1460) bucket = 'Above 3 Years';
  else if (d <= 1825) bucket = 'Above 4 Years';
  else bucket = 'Above 5 Years (>1825 <46000)';
  if (!hdfgBuckets2[bucket]) hdfgBuckets2[bucket] = { count: 0, value: 0, samples: [] };
  hdfgBuckets2[bucket].count++;
  hdfgBuckets2[bucket].value += item.totalValue;
  if (hdfgBuckets2[bucket].samples.length < 3) hdfgBuckets2[bucket].samples.push({ aa: d, aging: item.agingDateOfReceipt, mat: item.material });
}
for (const [b, d] of Object.entries(hdfgBuckets2)) {
  console.log(`  ${b}: count=${d.count}, value=₹${Math.round(d.value).toLocaleString('en-IN')}`);
  for (const s of d.samples) {
    console.log(`    -> mat=${s.mat} aa=${s.aa} aging=${s.aging}`);
  }
}
