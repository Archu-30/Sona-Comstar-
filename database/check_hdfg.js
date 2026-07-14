const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('data', "upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX");
const wb = XLSX.readFile(filePath, { cellDates: false, raw: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref']);

// Find header row (row index 1 based on earlier analysis)
const headerRow = 1;

// Get headers
const headers = {};
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = ws[XLSX.utils.encode_cell({r: headerRow, c})];
  if (cell) headers[c] = String(cell.v).trim();
}

// Find key column indices
let storLocIdx = -1, aaIdx = -1, agingIdx = -1, matIdx = -1, totalValIdx = -1, grDateIdx = -1;
for (const [ci, h] of Object.entries(headers)) {
  const ci2 = parseInt(ci);
  if (h === 'Storage Location') storLocIdx = ci2;
  if (h === 'AA') aaIdx = ci2;
  if (h === 'Aging(Date of Rcpt)') agingIdx = ci2;
  if (h === 'Material') matIdx = ci2;
  if (h === 'Total Value') totalValIdx = ci2;
  if (h === 'GR Issue date') grDateIdx = ci2;
}

console.log(`Storage Location col: ${storLocIdx} (${headers[storLocIdx]})`);
console.log(`AA col: ${aaIdx} (${headers[aaIdx]})`);
console.log(`Aging(Date of Rcpt) col: ${agingIdx} (${headers[agingIdx]})`);
console.log(`GR Issue date col: ${grDateIdx} (${headers[grDateIdx]})`);
console.log(`Total Value col: ${totalValIdx} (${headers[totalValIdx]})`);

// Read all HDFG rows
const hdfgRows = [];
const dataStart = headerRow + 1;
for (let r = dataStart; r <= Math.min(range.e.r, 25000); r++) {
  const matCell = ws[XLSX.utils.encode_cell({r, c: matIdx})];
  if (!matCell || !matCell.v) break; // Stop at first empty material
  
  const storCell = ws[XLSX.utils.encode_cell({r, c: storLocIdx})];
  const loc = storCell ? String(storCell.v).trim() : '';
  
  if (loc !== 'HDFG') continue;
  
  const aaCell = ws[XLSX.utils.encode_cell({r, c: aaIdx})];
  const agingCell = ws[XLSX.utils.encode_cell({r, c: agingIdx})];
  const valCell = ws[XLSX.utils.encode_cell({r, c: totalValIdx})];
  const grCell = ws[XLSX.utils.encode_cell({r, c: grDateIdx})];
  
  hdfgRows.push({
    row: r + 1,
    mat: String(matCell.v).trim(),
    aa: aaCell ? Number(aaCell.v) : 0,
    aging: agingCell ? Number(agingCell.v) : 0,
    grDate: grCell ? grCell.v : '(blank)',
    val: valCell ? Number(valCell.v) : 0,
  });
}

console.log(`\nHDFG rows in raw Excel: ${hdfgRows.length}`);
for (const r of hdfgRows) {
  console.log(`  Row ${r.row}: mat=${r.mat} aa=${r.aa} aging=${r.aging} gr=${r.grDate} val=${r.val}`);
}

// What does the pivot see?
// The pivot table "Sheet3" - let's read it
const pivotSheet = wb.Sheets['Sheet3'];
const pivotRange = XLSX.utils.decode_range(pivotSheet['!ref']);
console.log('\n=== Sheet3 (Pivot) ===');
for (let r = pivotRange.s.r; r <= pivotRange.e.r; r++) {
  const labelCell = pivotSheet[XLSX.utils.encode_cell({r, c: 0})];
  const valCell = pivotSheet[XLSX.utils.encode_cell({r, c: 1})];
  if (labelCell) console.log(`  ${r}: ${String(labelCell.v).trim()} => ${valCell ? valCell.v : '(no val)'}`);
}
