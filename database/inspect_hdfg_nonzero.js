const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

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

const hdfgRows = [];
for (let r = headerRow + 1; r <= range.e.r; r++) {
  const matCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
  if (!matCell || matCell.v === undefined) continue;
  
  const locCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
  const loc = locCell ? String(locCell.v).trim() : '';
  if (loc === 'HDFG') {
    const rowObj = { rowIndex: r + 1 };
    headers.forEach((h, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      rowObj[h || `Col_${c}`] = cell ? cell.v : '';
    });
    hdfgRows.push(rowObj);
  }
}

// Let's filter to rows with total value > 0 and AA > 30
hdfgRows.forEach(r => {
  if (r['Total Value'] > 0) {
    console.log(`Row ${r.rowIndex} mat=${r.Material} val=${r['Total Value']} AA=${r.AA} aging=${r['Aging(Date of Rcpt)']} entered=${r['Entered On']} transfer=${r['Aging(Last Date of Trnsfr)']} mfg=${r['Manufacture Date Aging']} gr=${r['GR Issue date']}`);
  }
});
