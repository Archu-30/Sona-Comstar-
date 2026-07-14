const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('hdfg_details.json', 'utf8'));

const items = rows.map(r => ({
  rowIndex: r.rowIndex,
  mat: r.Material,
  val: Number(r['Total Value'] || 0),
  aa: Number(r.AA || 0),
  aging: Number(r['Aging(Date of Rcpt)'] || 0),
  transfer: Number(r['Aging(Last Date of Trnsfr)'] || 0),
  mfg: Number(r['Manufacture Date Aging'] || 0),
  gr: r['GR Issue date'] || ''
}));

console.log('Total items:', items.length);

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

const target1Y = 438673;
const target2Y = 276769;

const matches1Y = findSubsets(items, target1Y, 1);
console.log(`\nFound ${matches1Y.length} matches for Above 1 Year (438673):`);
matches1Y.forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.rowIndex}: mat=${i.mat} val=${i.val} aa=${i.aa} aging=${i.aging} transfer=${i.transfer} mfg=${i.mfg} gr=${i.gr}`));
});

const matches2Y = findSubsets(items, target2Y, 1);
console.log(`\nFound ${matches2Y.length} matches for Above 2 Years (276769):`);
matches2Y.forEach((m, idx) => {
  console.log(`Match ${idx}:`);
  m.forEach(i => console.log(`  Row ${i.rowIndex}: mat=${i.mat} val=${i.val} aa=${i.aa} aging=${i.aging} transfer=${i.transfer} mfg=${i.mfg} gr=${i.gr}`));
});
