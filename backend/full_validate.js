/**
 * Full validation with CORRECTLY ORDERED bucket values from pivot screenshot.
 * 
 * The pivot screenshot columns are in ALPHABETICAL order (Excel text sort):
 *   Col1: 0-30 Days
 *   Col2: 181-365 Days
 *   Col3: 31-60 Days
 *   Col4: 61-90 Days
 *   Col5: 91-180 Days
 *   Col6: Above 1 Year
 *   Col7: Above 2 Years
 *   Col8: Above 3 Years
 *   Col9: Above 4 Years
 *   Col10: Above 5 Years
 * 
 * So the expected values per location reading from left-to-right in the screenshot
 * map to: 0-30, 181-365, 31-60, 61-90, 91-180, Above 1 Yr, Above 2 Yr, Above 3 Yr, Above 4 Yr, Above 5 Yr
 */

const EXPECTED = {
  HDFG: { '0-30 Days': 7168337, '181-365 Days': 2300143, '31-60 Days': 723710, '61-90 Days': 0, '91-180 Days': 3303255, 'Above 1 Year': 438673, 'Above 2 Years': 276769, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 1303780, Grand: 15514668 },
  HDHS: { '0-30 Days': 292921, '181-365 Days': 0, '31-60 Days': 21633, '61-90 Days': 0, '91-180 Days': 0, 'Above 1 Year': 0, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 0, Grand: 314553 },
  HDNW: { '0-30 Days': 1547802, '181-365 Days': 33663, '31-60 Days': 613625, '61-90 Days': 182817, '91-180 Days': 1727, 'Above 1 Year': 0, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 18363, Grand: 2397997 },
  QUSM: { '0-30 Days': 0, '181-365 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '91-180 Days': 0, 'Above 1 Year': 435424, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 1440242, Grand: 1875666 },
  REFG: { '0-30 Days': 419956, '181-365 Days': 0, '31-60 Days': 1398150, '61-90 Days': 0, '91-180 Days': 1366560, 'Above 1 Year': 2699511, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 2674967, Grand: 8559144 },
  RJNW: { '0-30 Days': 747893, '181-365 Days': 620068, '31-60 Days': 93861, '61-90 Days': 22963, '91-180 Days': 23321, 'Above 1 Year': 439281, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 30606, Grand: 1977993 },
  RJRR: { '0-30 Days': 448738, '181-365 Days': 37026, '31-60 Days': 0, '61-90 Days': 0, '91-180 Days': 390764, 'Above 1 Year': 1127, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 0, Grand: 877655 },
  RJSR: { '0-30 Days': 321360, '181-365 Days': 24511, '31-60 Days': 1635, '61-90 Days': 0, '91-180 Days': 36138, 'Above 1 Year': 160628, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 0, Grand: 544272 },
  SCRA: { '0-30 Days': 369962, '181-365 Days': 0, '31-60 Days': 12661, '61-90 Days': 74832, '91-180 Days': 16062, 'Above 1 Year': 46824, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 817, 'Above 5 Years': 0, Grand: 521157 },
  WICQ: { '0-30 Days': 0, '181-365 Days': 429410, '31-60 Days': 0, '61-90 Days': 0, '91-180 Days': 0, 'Above 1 Year': 665436, 'Above 2 Years': 0, 'Above 3 Years': 56359, 'Above 4 Years': 0, 'Above 5 Years': 13535773, Grand: 14686978 },
  WIEV: { '0-30 Days': 61502727, '181-365 Days': 2532699, '31-60 Days': 9676019, '61-90 Days': 6174900, '91-180 Days': 8389926, 'Above 1 Year': 5748921, 'Above 2 Years': 728403, 'Above 3 Years': 20059, 'Above 4 Years': 25843, 'Above 5 Years': 861654, Grand: 95661151 },
  WIPH: { '0-30 Days': 47700, '181-365 Days': 171230, '31-60 Days': 1468554, '61-90 Days': 2015, '91-180 Days': 816, 'Above 1 Year': 0, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 0, Grand: 1690316 },
  WIPS: { '0-30 Days': 28483538, '181-365 Days': 708755, '31-60 Days': 6283959, '61-90 Days': 1500032, '91-180 Days': 903606, 'Above 1 Year': 198410, 'Above 2 Years': 10151, 'Above 3 Years': 550, 'Above 4 Years': 0, 'Above 5 Years': 246953, Grand: 41764738 },
  WSMT: { '0-30 Days': 4414399, '181-365 Days': 6825020, '31-60 Days': 2797244, '61-90 Days': 3995470, '91-180 Days': 1745828, 'Above 1 Year': 2521992, 'Above 2 Years': 0, 'Above 3 Years': 0, 'Above 4 Years': 0, 'Above 5 Years': 6006989, Grand: 28306942 },
};

const { getInventoryAgeing } = require('../database/index');

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

const BUCKET_ORDER = ['0-30 Days', '31-60 Days', '61-90 Days', '91-180 Days', '181-365 Days', 'Above 1 Year', 'Above 2 Years', 'Above 3 Years', 'Above 4 Years', 'Above 5 Years'];

const items = getInventoryAgeing();
const locBuckets = {};
for (const item of items) {
  const loc = item.storageLocation;
  if (!EXPECTED[loc]) continue;
  const ageDays = item.agingDateOfReceipt > 0 ? item.agingDateOfReceipt : (item.aaAgingDays > 0 && item.aaAgingDays < 46000 ? item.aaAgingDays : 0);
  const val = item.totalValue || 0;
  if (!locBuckets[loc]) {
    locBuckets[loc] = {};
    for (const b of BUCKET_ORDER) locBuckets[loc][b] = 0;
  }
  const bucket = getAgeBucket(ageDays);
  locBuckets[loc][bucket] += val;
}

let totalPass = 0, totalFail = 0;

for (const loc of Object.keys(EXPECTED)) {
  const expected = EXPECTED[loc];
  const actual = locBuckets[loc] || {};
  let locPass = true;
  const diffs = [];

  for (const b of BUCKET_ORDER) {
    const exp = expected[b] || 0;
    const act = Math.round(actual[b] || 0);
    const diff = Math.abs(exp - act);
    if (diff > 5) {
      locPass = false;
      diffs.push(`  ${b.padEnd(15)}: expected=${exp.toLocaleString().padStart(12)}, got=${act.toLocaleString().padStart(12)} (diff=${diff.toLocaleString()})`);
    }
  }

  if (locPass) {
    totalPass++;
    console.log(`${loc}: ✓ PASS`);
  } else {
    totalFail++;
    console.log(`${loc}: ✗ FAIL`);
    for (const d of diffs) console.log(d);
  }
}
console.log(`\n=== RESULT: ${totalPass} PASS, ${totalFail} FAIL (out of ${totalPass + totalFail}) ===`);
