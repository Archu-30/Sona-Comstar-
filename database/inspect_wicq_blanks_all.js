const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

// We want to inspect all blank GR rows in WICQ
console.log('rowIndex | Material | Batch | UnrestrictedVal | AA | ageRcpt | transfer | mfgAg | Entered On | Goods Recipient | Invoice | TotalValue');
for (let r = 2; r <= range.e.r; r++) {
  const loc = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'WICQ') {
    const gr = ws[XLSX.utils.encode_cell({ r, c: 23 })]?.v;
    if (!gr) {
      const totalVal = ws[XLSX.utils.encode_cell({ r, c: 31 })]?.v || 0;
      if (totalVal > 0) {
        const mat = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
        const batch = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
        const aa = ws[XLSX.utils.encode_cell({ r, c: 24 })]?.v;
        const ageRcpt = ws[XLSX.utils.encode_cell({ r, c: 25 })]?.v;
        const transfer = ws[XLSX.utils.encode_cell({ r, c: 27 })]?.v;
        const mfgAg = ws[XLSX.utils.encode_cell({ r, c: 29 })]?.v;
        const entered = ws[XLSX.utils.encode_cell({ r, c: 26 })]?.v;
        const recipient = ws[XLSX.utils.encode_cell({ r, c: 22 })]?.v || '';
        const invoice = ws[XLSX.utils.encode_cell({ r, c: 21 })]?.v || '';
        console.log(`${r+1} | ${mat} | ${batch} | ${totalVal} | ${aa} | ${ageRcpt} | ${transfer} | ${mfgAg} | ${entered} | ${recipient} | ${invoice}`);
      }
    }
  }
}
