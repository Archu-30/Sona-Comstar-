const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
console.log('Sheets:', wb.SheetNames);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('Range:', ws['!ref']);

// Print rows 0-3 to see header structure
for (let r = 0; r <= 3; r++) {
  const rowVals = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    rowVals.push(`${XLSX.utils.encode_col(c)}:${cell ? String(cell.v).trim() : ''}`);
  }
  console.log(`Row ${r + 1}: ${rowVals.join(' | ')}`);
}
