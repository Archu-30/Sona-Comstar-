const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
console.log('Sheets in uploaded file:', wb.SheetNames);

const sheet3 = wb.Sheets['Sheet3'];
if (sheet3) {
  const range = XLSX.utils.decode_range(sheet3['!ref']);
  console.log(`Sheet3 range: ${sheet3['!ref']}`);
  for (let r = range.s.r; r <= Math.min(range.e.r, 100); r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet3[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : '(empty)');
    }
    console.log(`Row ${r + 1}:`, row.join(' | '));
  }
} else {
  console.log('No Sheet3 in uploaded file');
}
