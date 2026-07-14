const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];

// Let's check if there are columns beyond AF (index 31)
console.log('Checking columns beyond AF:');
for (let r = 0; r < 20; r++) {
  for (let c = 32; c < 50; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.v !== undefined) {
      console.log(`Row ${r}, Col ${XLSX.utils.encode_col(c)} (${c}): ${cell.v}`);
    }
  }
}
console.log('Done.');
