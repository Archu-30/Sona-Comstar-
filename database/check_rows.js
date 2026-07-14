const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];

[12968, 12977].forEach(r => {
  console.log(`\nRow ${r}:`);
  for (let c = 0; c < 32; c++) {
    const header = ws[XLSX.utils.encode_cell({ r: 1, c })];
    const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c })];
    if (cell && cell.v !== undefined) {
      console.log(`  ${header ? header.v : `Col_${c}`}: ${cell.v}`);
    }
  }
});
