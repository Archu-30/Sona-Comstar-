const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'SUMMARY FILE.xlsx');
const wb = XLSX.readFile(filePath);
console.log('Sheets in SUMMARY FILE.xlsx:', wb.SheetNames);
for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  console.log(`  Sheet "${s}": range=${ws['!ref'] || 'none'}`);
}
