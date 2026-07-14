const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

const blankGrRows = [];
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'WICQ') {
    const gr = ws[XLSX.utils.encode_cell({ r, c: 23 })]?.v;
    if (!gr) {
      const val = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
      if (val > 0) {
        blankGrRows.push({
          row: r + 1,
          val: Math.round(val * 100), // convert to cents to avoid floating point issues
          mat: ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v,
          batch: ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v,
          transfer: ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v || 0,
        });
      }
    }
  }
}

console.log(`Loaded ${blankGrRows.length} blank GR rows for WICQ.`);

// We want to find subsets that sum to exactly 56359 * 100 (with some tolerance)
const target = 5635900;
const tolerance = 500; // tolerance of 5.00

// Using a standard backtracking search with sorting and pruning
blankGrRows.sort((a, b) => b.val - a.val);

const results = [];
function backtrack(idx, currentSum, path) {
  if (Math.abs(currentSum - target) <= tolerance) {
    results.push([...path]);
    if (results.length >= 10) return true; // limit to first 10
  }
  if (currentSum > target + tolerance || idx >= blankGrRows.length) return false;

  // Include
  path.push(blankGrRows[idx]);
  if (backtrack(idx + 1, currentSum + blankGrRows[idx].val, path)) return true;
  path.pop();

  // Exclude
  if (backtrack(idx + 1, currentSum, path)) return true;

  return false;
}

backtrack(0, 0, []);

console.log(`Found ${results.length} matches for Above 3 Years (56359):`);
results.forEach((r, idx) => {
  console.log(`\nMatch ${idx + 1}:`);
  let sum = 0;
  r.forEach(item => {
    sum += item.val / 100;
    console.log(`  Row ${item.row}: mat=${item.mat} batch=${item.batch} val=${item.val/100} transfer=${item.transfer}`);
  });
  console.log(`  Total: ${sum}`);
});
