// Validation script: compare calculated bucket values against user's pivot table
const http = require('http');

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5000' + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// User's pivot table values (from screenshot)
// Locations shown in pivot: ACFG, ACNP, ACNW, ACPP, HDFG, INNW, INPP, SANM, WICQ, WIEV, WIPH, WIPS, WSMT
// Note: INFG not in pivot shown
const PIVOT = {
  'ACFG':  { '0-30 Days': 0,         '31-60 Days': 0,        '61-90 Days': 0,       '91-180 Days': 0,        '181-365 Days': 0,      'Above 1 Year': 4736523,   'Above 2 Years': 46461285,  'Above 3 Years': 23462616, 'Above 4 Years': 47527069, 'Above 5 Years': 0,       'Grand Total': 122187493 },
  'ACNP':  { '0-30 Days': 78547716,  '31-60 Days': 28455899, '61-90 Days': 7289600, '91-180 Days': 3540613,  '181-365 Days': 4226813,'Above 1 Year': 8499609,   'Above 2 Years': 11697200,  'Above 3 Years': 4611937,  'Above 4 Years': 13872012, 'Above 5 Years': 6980802, 'Grand Total': 167721201 },
  'ACNW':  { '0-30 Days': 74397524,  '31-60 Days': 30695059, '61-90 Days': 0,       '91-180 Days': 27895,    '181-365 Days': 2568,   'Above 1 Year': 4219428,   'Above 2 Years': 24282266,  'Above 3 Years': 5459949,  'Above 4 Years': 16359777, 'Above 5 Years': 0,       'Grand Total': 155444466 },
  'ACPP':  { '0-30 Days': 130736481, '31-60 Days': 91424780, '61-90 Days': 0,       '91-180 Days': 9090398,  '181-365 Days': 7268143,'Above 1 Year': 15637225,  'Above 2 Years': 12682820,  'Above 3 Years': 12404985, 'Above 4 Years': 11534706, 'Above 5 Years': 5727207, 'Grand Total': 296506745 },
  'HDFG':  { '0-30 Days': 0,         '31-60 Days': 0,        '61-90 Days': 0,       '91-180 Days': 0,        '181-365 Days': 0,      'Above 1 Year': 0,         'Above 2 Years': 1219327,   'Above 3 Years': 0,        'Above 4 Years': 14295141, 'Above 5 Years': 0,       'Grand Total': 15514468 },
  'INNW':  { '0-30 Days': 40009038,  '31-60 Days': 15085773, '61-90 Days': 0,       '91-180 Days': 14660862, '181-365 Days': 0,      'Above 1 Year': 0,         'Above 2 Years': 25544966,  'Above 3 Years': 0,        'Above 4 Years': 0,        'Above 5 Years': 0,       'Grand Total': 95300639 },
  'INPP':  { '0-30 Days': 26327527,  '31-60 Days': 2668817,  '61-90 Days': 0,       '91-180 Days': 9374884,  '181-365 Days': 0,      'Above 1 Year': 105762,    'Above 2 Years': 0,         'Above 3 Years': 0,        'Above 4 Years': 0,        'Above 5 Years': 0,       'Grand Total': 38477490 },
  'SANM':  { '0-30 Days': 73012843,  '31-60 Days': 35424516, '61-90 Days': 4827073, '91-180 Days': 8049527,  '181-365 Days': 14742437,'Above 1 Year': 26726568, 'Above 2 Years': 21887524,  'Above 3 Years': 22843782, 'Above 4 Years': 19287624, 'Above 5 Years': 0,       'Grand Total': 226801894 },
  'WICQ':  { '0-30 Days': 0,         '31-60 Days': 0,        '61-90 Days': 0,       '91-180 Days': 12682,    '181-365 Days': 99393,  'Above 1 Year': 5703866,   'Above 2 Years': 3416553,   'Above 3 Years': 3498578,  'Above 4 Years': 1955724,  'Above 5 Years': 0,       'Grand Total': 14686796 },
  'WIEV':  { '0-30 Days': 26826994,  '31-60 Days': 18219316, '61-90 Days': 1965767, '91-180 Days': 7048432,  '181-365 Days': 6178127,'Above 1 Year': 8476393,   'Above 2 Years': 10641768,  'Above 3 Years': 7052082,  'Above 4 Years': 4218895,  'Above 5 Years': 5034377, 'Grand Total': 95661151 },
  'WIPH':  { '0-30 Days': 0,         '31-60 Days': 5200,     '61-90 Days': 0,       '91-180 Days': 0,        '181-365 Days': 120478, 'Above 1 Year': 565118,    'Above 2 Years': 999220,    'Above 3 Years': 0,        'Above 4 Years': 0,        'Above 5 Years': 0,       'Grand Total': 1690016 },
  'WIPS':  { '0-30 Days': 20079428,  '31-60 Days': 9386278,  '61-90 Days': 2064083, '91-180 Days': 7399498,  '181-365 Days': 1424063,'Above 1 Year': 1193018,   'Above 2 Years': 218370,    'Above 3 Years': 0,        'Above 4 Years': 0,        'Above 5 Years': 0,       'Grand Total': 41764738 },
  'WSMT':  { '0-30 Days': 7395800,   '31-60 Days': 3891823,  '61-90 Days': 1367026, '91-180 Days': 8148820,  '181-365 Days': 5398742,'Above 1 Year': 1965905,   'Above 2 Years': 805468,    'Above 3 Years': 329170,   'Above 4 Years': 0,        'Above 5 Years': 0,       'Grand Total': 29302754 },
};

const BUCKETS = ['0-30 Days','31-60 Days','61-90 Days','91-180 Days','181-365 Days','Above 1 Year','Above 2 Years','Above 3 Years','Above 4 Years','Above 5 Years'];

async function main() {
  try {
    const data = await fetchJson('/api/data/summary/');
    const locations = (data.ageing && data.ageing.storageLocationAgeingDetailed) || [];
    
    if (!locations.length) {
      console.log('No storage location data found');
      console.log('Response keys:', Object.keys(data));
      return;
    }

    console.log('\n====== BUCKET COMPARISON: APP vs PIVOT ======\n');
    
    let totalDiffs = 0;
    let exactMatches = 0;
    let totalCells = 0;
    
    for (const [locName, pivotBuckets] of Object.entries(PIVOT)) {
      const locData = locations.find(l => l.storageLocation === locName);
      if (!locData) {
        console.log(`[MISSING] ${locName} - not found in API response`);
        continue;
      }
      
      const appBucketMap = {};
      for (const b of locData.buckets) appBucketMap[b.bucket] = Math.round(b.totalValue);
      
      let locHasDiff = false;
      const diffs = [];
      
      for (const bucket of BUCKETS) {
        const expected = Math.round(pivotBuckets[bucket] || 0);
        const actual = appBucketMap[bucket] || 0;
        const diff = Math.abs(expected - actual);
        totalCells++;
        if (diff <= 1) {
          exactMatches++;
        } else {
          locHasDiff = true;
          totalDiffs++;
          diffs.push({ bucket, expected, actual, diff });
        }
      }
      
      // Also check grand total
      const pivotGT = Math.round(pivotBuckets['Grand Total'] || 0);
      const appGT = Math.round(locData.totalValue);
      totalCells++;
      if (Math.abs(pivotGT - appGT) <= 1) {
        exactMatches++;
      } else {
        locHasDiff = true;
        diffs.push({ bucket: 'Grand Total', expected: pivotGT, actual: appGT, diff: Math.abs(pivotGT - appGT) });
      }
      
      if (locHasDiff) {
        console.log(`\n[MISMATCH] ${locName}:`);
        for (const d of diffs) {
          console.log(`  ${d.bucket.padEnd(15)}: Expected=${d.expected.toLocaleString('en-IN').padStart(15)}, App=${d.actual.toLocaleString('en-IN').padStart(15)}, Diff=${d.diff.toLocaleString('en-IN')}`);
        }
      } else {
        console.log(`[OK] ${locName} - all buckets match`);
      }
    }
    
    console.log(`\n====== SUMMARY ======`);
    console.log(`Exact matches: ${exactMatches}/${totalCells} cells`);
    console.log(`Mismatches: ${totalDiffs} cells`);
    
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main();
