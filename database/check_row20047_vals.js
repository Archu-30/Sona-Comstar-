const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];

const r = 20046; // row 20047 (0-indexed 20046)
console.log(`Checking value columns for Row 20047 (index 20046):`);
for (let c = 0; c < 32; c++) {
  const header = ws[XLSX.utils.encode_cell({ r: 1, c })]?.v;
  const val = ws[XLSX.utils.encode_cell({ r, c })]?.v;
  if (val !== undefined && val !== '') {
    console.log(`  Col ${XLSX.utils.encode_col(c)} (${header}): ${val}`);
  }
}
