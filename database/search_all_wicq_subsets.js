const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

// Collect all WICQ rows (blank and non-blank) and search for subsets that sum to 56359 or 665436
const wicqRows = [];
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'WICQ') {
    const val = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
    if (val > 0) {
      wicqRows.push({
        row: r + 1,
        val,
        mat: ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v,
        batch: ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v,
        aa: ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v || 0,
        transfer: ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v || 0,
      });
    }
  }
}

console.log(`Searching all WICQ rows (${wicqRows.length}) for subsets summing to 56359...`);

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
  const sorted = [...arr].sort((a, b) => b.val - a.val);
  search(0, 0, []);
  return results;
}

const matches = findSubsets(wicqRows, 56359, 1);
console.log(`Found ${matches.length} matches:`);
matches.forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.row}: mat=${i.mat} val=${i.val} aa=${i.aa} transfer=${i.transfer}`));
});
