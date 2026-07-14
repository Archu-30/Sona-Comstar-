const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('database', 'data', 'Inventory Ageing Report_24062026.XLSX');
const wb = XLSX.readFile(filePath);
console.log('Sheets in Inventory Ageing Report_24062026.XLSX:', wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`Sheet 0 range: ${ws['!ref']}`);

const headers = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]; // maybe header at row 0?
  headers.push(cell ? cell.v : `Col_${c}`);
}
console.log('Header Row 0:', headers.join(' | '));

const headers1 = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 1, c })]; // maybe header at row 1?
  headers1.push(cell ? cell.v : `Col_${c}`);
}
console.log('Header Row 1:', headers1.join(' | '));
