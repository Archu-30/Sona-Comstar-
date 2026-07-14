const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const file2 = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');

const wb1 = XLSX.readFile(file1);
const wb2 = XLSX.readFile(file2);

const ws1 = wb1.Sheets['Sheet1'];
const ws2 = wb2.Sheets['Sheet1'];

// Compare values of Row 20039, 20047, 20057, 20058, 20059 in both files
const rows = [20039, 20047, 20057, 20058, 20059];

console.log('Comparing rows in original file (file1) and uploaded file (file2):');
rows.forEach(r => {
  console.log(`\nRow ${r}:`);
  
  // File 1 values
  const mat1 = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 0 })]?.v;
  const loc1 = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 3 })]?.v;
  const val1 = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 18 })]?.v; // Value BlockedStock
  const aa1 = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 24 })]?.v; // Aging(Date of Rcpt)
  const gr1 = ws1[XLSX.utils.encode_cell({ r: r - 1, c: 23 })]?.v;
  
  // File 2 values
  // Wait, in file2, the headers are shifted! Let's check the columns by name.
  // Col Y is AA, Col Z is Aging(Date of Rcpt), Col AF is Total Value.
  const mat2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 0 })]?.v;
  const loc2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 3 })]?.v;
  const val2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 18 })]?.v; // Value BlockedStock
  const aa2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 24 })]?.v; // AA
  const gr2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 23 })]?.v;
  const ageRcpt2 = ws2[XLSX.utils.encode_cell({ r: r - 1, c: 25 })]?.v; // Aging(Date of Rcpt)
  
  console.log(`  File 1: mat=${mat1}, loc=${loc1}, blockedStockVal=${val1}, agingRcpt=${aa1}, gr=${gr1}`);
  console.log(`  File 2: mat=${mat2}, loc=${loc2}, blockedStockVal=${val2}, AA=${aa2}, gr=${gr2}, agingRcpt=${ageRcpt2}`);
});
