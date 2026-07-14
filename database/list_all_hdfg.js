const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('Listing ALL HDFG rows in the uploaded file (excluding zero total values):');
let totalVal = 0;
let count = 0;
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'HDFG') {
    const val = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
    if (val > 0) {
      count++;
      totalVal += val;
      const mat = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      const batch = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
      const aa = ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v;
      const ageRcpt = ws[XLSX.utils.encode_cell({ r, c: 25 })]?.v;
      console.log(`  Row ${r+1}: mat=${mat}, batch=${batch}, aa=${aa}, ageRcpt=${ageRcpt}, val=${val}`);
    }
  }
}
console.log(`Total HDFG non-zero rows: ${count}, Sum of values: ${totalVal}`);
