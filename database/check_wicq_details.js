const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

const headerRow = 1;
const headers = [];
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
  headers.push(cell ? String(cell.v).trim() : '');
}

const wicqRows = [];
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || matCell.v === undefined) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: 3 })]; // Storage Location
  const loc = locCell ? String(locCell.v).trim() : '';
  if (loc === 'WICQ') {
    const rowObj = { rowIndex: r + 1 };
    headers.forEach((h, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      rowObj[h || `Col_${c}`] = cell ? cell.v : '';
    });
    wicqRows.push(rowObj);
  }
}

console.log(`Found ${wicqRows.length} WICQ rows`);
// Let's filter to rows that are aa=46199 or similar extreme
const extreme = wicqRows.filter(r => r.AA >= 46000);
console.log(`Extreme rows: ${extreme.length}`);

// We want to see if any other column has a non-zero value for these rows.
// Let's print unique values or summaries for aging-related columns:
// Aging(Date of Rcpt), Entered On, Aging(Last Date of Trnsfr), Manufacture Date Aging, grIssueDate, etc.
extreme.forEach(r => {
  console.log(`Row ${r.rowIndex} mat=${r.Material}: aa=${r.AA} aging_rcpt=${r['Aging(Date of Rcpt)']} entered=${r['Entered On']} aging_transfer=${r['Aging(Last Date of Trnsfr)']} mfg_aging=${r['Manufacture Date Aging']} val=${r['Total Value']}`);
});
