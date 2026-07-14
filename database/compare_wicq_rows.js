const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];

const r1 = 16609 - 1; // row 16609 (index 16608)
const r2 = 16808 - 1; // row 16808 (index 16807)

console.log('Comparing Row 16609 and Row 16808 side-by-side:');
for (let c = 0; c < 35; c++) {
  const header = ws[XLSX.utils.encode_cell({ r: 1, c })]?.v || `Col_${c}`;
  const val1 = ws[XLSX.utils.encode_cell({ r: r1, c })]?.v;
  const val2 = ws[XLSX.utils.encode_cell({ r: r2, c })]?.v;
  if (val1 !== val2) {
    console.log(`Col ${XLSX.utils.encode_col(c)} (${header}):`);
    console.log(`  Row 16609: ${val1}`);
    console.log(`  Row 16808: ${val2}`);
  }
}
