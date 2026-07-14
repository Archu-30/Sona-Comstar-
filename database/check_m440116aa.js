const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('rowIndex | Material | Batch | Storage Location | AA | ageRcpt | transfer | mfgAg | TotalValue');
for (let r = 2; r <= range.e.r; r++) {
  const mat = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
  if (mat === 'M440116AA') {
    const batch = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
    const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
    const aa = ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v;
    const ageRcpt = ws[XLSX.utils.encode_cell({ r, c: 25 })]?.v;
    const transfer = ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v;
    const mfgAg = ws[XLSX.utils.encode_cell({ r, c: 29 })]?.v;
    const val = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v;
    console.log(`${r+1} | ${mat} | ${batch} | ${loc} | ${aa} | ${ageRcpt} | ${transfer} | ${mfgAg} | ${val}`);
  }
}
