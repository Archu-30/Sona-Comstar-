const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath, { cellDates: false });
const ws = wb.Sheets['Sheet1'];

console.log('Checking formulas in row 3 (first data row) and row 12968:');
const cols = ['Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF'];
cols.forEach(col => {
  const cell3 = ws[`${col}3`];
  const cell12968 = ws[`${col}12968`];
  console.log(`Col ${col}:`);
  console.log(`  Row 3: val=${cell3 ? cell3.v : '(empty)'}, formula=${cell3 && cell3.f ? cell3.f : '(none)'}`);
  console.log(`  Row 12968: val=${cell12968 ? cell12968.v : '(empty)'}, formula=${cell12968 && cell12968.f ? cell12968.f : '(none)'}`);
});
