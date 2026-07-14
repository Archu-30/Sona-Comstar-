const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('Checking formulas for Row 3 and Row 12968 (WICQ):');
[3, 63, 111, 132, 12968].forEach(r => {
  console.log(`\nRow ${r}:`);
  for (let c = 21; c <= 31; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c })];
    if (cell) {
      console.log(`  Col ${XLSX.utils.encode_col(c)} (${cell.v}): formula=${cell.f || 'none'}`);
    }
  }
});
