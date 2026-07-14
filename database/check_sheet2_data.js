const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);

const sheet2 = wb.Sheets['Sheet2'];
if (sheet2) {
  const range = XLSX.utils.decode_range(sheet2['!ref']);
  console.log(`Sheet2 range: ${sheet2['!ref']}`);
  for (let r = range.s.r; r <= Math.min(range.e.r, 50); r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet2[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? cell.v : '(empty)');
    }
    console.log(`Row ${r + 1}:`, row.join(' | '));
  }
} else {
  console.log('No Sheet2 in uploaded file');
}
