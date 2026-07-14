const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('rowIndex | Material | Batch | UnrestrictedVal | BlockedVal | QualVal | RestrVal | AA | ageRcpt | transfer | mfgAg | grDate | TotalValue');
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'HDFG') {
    const totalVal = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
    if (totalVal > 0) {
      const mat = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      const batch = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
      const aa = ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v;
      const ageRcpt = ws[XLSX.utils.encode_cell({ r, c: 25 })]?.v;
      const transfer = ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v;
      const mfgAg = ws[XLSX.utils.encode_cell({ r, c: 29 })]?.v;
      const gr = ws[XLSX.utils.encode_cell({ r, c: 23 })]?.v || '';
      
      const unrestVal = ws[XLSX.utils.encode_cell({ r, c: 10 })]?.v || 0;
      const blockedVal = ws[XLSX.utils.encode_cell({ r, c: 18 })]?.v || 0;
      const qualVal = ws[XLSX.utils.encode_cell({ r, c: 14 })]?.v || 0;
      const restrVal = ws[XLSX.utils.encode_cell({ r, c: 16 })]?.v || 0;
      
      console.log(`${r+1} | ${mat} | ${batch} | ${unrestVal} | ${blockedVal} | ${qualVal} | ${restrVal} | ${aa} | ${ageRcpt} | ${transfer} | ${mfgAg} | ${gr} | ${totalVal}`);
    }
  }
}
