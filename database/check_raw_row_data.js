const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];

// Let's print headers and cells for row 12968 and 16808
const cols = [];
for (let c = 0; c < 35; c++) {
  cols.push(c);
}

console.log('Headers (row 2):');
const headers = cols.map(c => {
  const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
  return `${XLSX.utils.encode_col(c)}:${cell ? cell.v : '(empty)'}`;
});
console.log(headers.join(' | '));

console.log('\nRow 12968 (index 12967):');
const row1 = cols.map(c => {
  const cell = ws[XLSX.utils.encode_cell({ r: 12967, c })];
  return `${XLSX.utils.encode_col(c)}:${cell ? cell.v : '(empty)'}`;
});
console.log(row1.join(' | '));

console.log('\nRow 16808 (index 16807):');
const row2 = cols.map(c => {
  const cell = ws[XLSX.utils.encode_cell({ r: 16807, c })];
  return `${XLSX.utils.encode_col(c)}:${cell ? cell.v : '(empty)'}`;
});
console.log(row2.join(' | '));
