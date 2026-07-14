const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

const headerRow = 1;
const rows = [];
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || matCell.v === undefined) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: 3 })]; // Storage Location
  const loc = locCell ? String(locCell.v).trim() : '';
  if (loc === 'WICQ') {
    const aaCell = ws[XLSX.utils.encode_cell({ r, c: 24 })]; // AA
    const agingCell = ws[XLSX.utils.encode_cell({ r, c: 25 })]; // Aging(Date of Rcpt)
    const valCell = ws[XLSX.utils.encode_cell({ r, c: 31 })]; // Total Value
    rows.push({
      rowIndex: r + 1,
      Material: matCell.v,
      AA: aaCell ? aaCell.v : 0,
      Aging: agingCell ? agingCell.v : 0,
      Value: valCell ? valCell.v : 0
    });
  }
}

console.log(`Found ${rows.length} WICQ rows`);
rows.sort((a, b) => b.AA - a.AA);
rows.forEach(r => {
  console.log(`Row ${r.rowIndex}: aa=${r.AA} aging=${r.Aging} val=${r.Value}`);
});
