const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('Sheet1 declared range:', ws['!ref']);

// Find the FIRST non-empty row
for (let r = 0; r <= Math.min(10, range.e.r); r++) {
  const rowCells = [];
  for (let c = 0; c <= Math.min(35, range.e.c); c++) {
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    rowCells.push(cell ? String(cell.v).trim() : '(EMPTY)');
  }
  const hasData = rowCells.some(v => v !== '(EMPTY)' && v !== '');
  if (hasData) {
    console.log('Row ' + r + ':');
    rowCells.forEach((v, i) => { if (v !== '(EMPTY)') console.log('  Col ' + i + ' ('+XLSX.utils.encode_col(i)+'): ' + v); });
  }
}
