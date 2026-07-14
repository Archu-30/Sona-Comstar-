const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const file2 = path.join('data', 'Inventory Ageing Report_24062026 summary.XLSX');

console.log('Checking sheets in legacy file:', file1);
try {
  const wb1 = XLSX.readFile(file1);
  console.log('wb1 sheets:', wb1.SheetNames);
} catch (e) {
  console.log('Error reading wb1:', e.message);
}

console.log('\nChecking sheets in summary file:', file2);
try {
  const wb2 = XLSX.readFile(file2);
  console.log('wb2 sheets:', wb2.SheetNames);
} catch (e) {
  console.log('Error reading wb2:', e.message);
}
