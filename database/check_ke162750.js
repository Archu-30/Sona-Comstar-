const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const file2 = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');

const wb1 = XLSX.readFile(file1);
const wb2 = XLSX.readFile(file2);

const ws1 = wb1.Sheets['Sheet1'];
const ws2 = wb2.Sheets['Sheet1'];

const range1 = XLSX.utils.decode_range(ws1['!ref']);
const range2 = XLSX.utils.decode_range(ws2['!ref']);

// Let's find KE162750 rows with value 149815.44
console.log('File 1 rows:');
for (let r = 1; r <= range1.e.r; r++) {
  const mat = ws1[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
  if (mat === 'KE162750') {
    const val = ws1[XLSX.utils.encode_cell({ r, c: 18 })]?.v;
    const batch = ws1[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
    const loc = ws1[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
    console.log(`  Row ${r+1}: loc=${loc}, batch=${batch}, blockedStockVal=${val}`);
  }
}

console.log('File 2 rows:');
for (let r = 2; r <= range2.e.r; r++) {
  const mat = ws2[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
  if (mat === 'KE162750') {
    const val = ws2[XLSX.utils.encode_cell({ r, c: 18 })]?.v;
    const batch = ws2[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
    const loc = ws2[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
    console.log(`  Row ${r+1}: loc=${loc}, batch=${batch}, blockedStockVal=${val}`);
  }
}
