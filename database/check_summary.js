const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Check the summary XLSX file  
const summaryFile = path.join('data', 'Inventory Ageing Report_24062026 summary.XLSX');
console.log('Checking summary file:', summaryFile);

const wb = XLSX.readFile(summaryFile, { cellDates: false, raw: true });
console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`\nSheet "${sheetName}" range: ${ws['!ref']} (${range.e.r+1} rows, ${range.e.c+1} cols)`);
  
  // Print first few rows
  for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
    const rowData = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, 15); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      rowData.push(cell ? String(cell.v).slice(0, 20) : '(empty)');
    }
    const hasData = rowData.some(v => v !== '(empty)');
    if (hasData) console.log(`  Row ${r}: ${rowData.join(' | ')}`);
  }
}
