const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'SUMMARY FILE.xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['inventory ageing summary'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('Printing inventory ageing summary values:');
for (let r = range.s.r; r <= Math.min(range.e.r, 50); r++) {
  const row = [];
  for (let c = range.s.c; c <= Math.min(range.e.c, 15); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    row.push(cell ? cell.v : '(empty)');
  }
  console.log(`Row ${r + 1}:`, row.join(' | '));
}
