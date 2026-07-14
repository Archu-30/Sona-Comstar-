const XLSX = require('xlsx');
const path = require('path');

const file1 = path.join('data', 'Inventory Ageing Report_24062026.XLSX');
const file2 = path.join('data', 'upload_1783664386775_Inventory Ageing Report_24062026 _1_.XLSX');

const wb1 = XLSX.readFile(file1);
const wb2 = XLSX.readFile(file2);

const ws1 = wb1.Sheets['Sheet1'];
const ws2 = wb2.Sheets['Sheet1'];

const range1 = XLSX.utils.decode_range(ws1['!ref']);
const range2 = XLSX.utils.decode_range(ws2['!ref']);

// Let's load all HDFG rows from file1
const hdfg1 = [];
for (let r = 1; r <= range1.e.r; r++) {
  const loc = ws1[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'HDFG') {
    hdfg1.push({
      rowIndex: r + 1,
      mat: ws1[XLSX.utils.encode_cell({ r, c: 0 })]?.v,
      batch: ws1[XLSX.utils.encode_cell({ r, c: 5 })]?.v,
      val: ws1[XLSX.utils.encode_cell({ r, c: 18 })]?.v, // Blocked Stock Value
      aging: ws1[XLSX.utils.encode_cell({ r, c: 24 })]?.v, // Aging(Date of Rcpt)
      gr: ws1[XLSX.utils.encode_cell({ r, c: 23 })]?.v
    });
  }
}

// Let's load all HDFG rows from file2
const hdfg2 = [];
for (let r = 2; r <= range2.e.r; r++) {
  const loc = ws2[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
  if (loc === 'HDFG') {
    hdfg2.push({
      rowIndex: r + 1,
      mat: ws2[XLSX.utils.encode_cell({ r, c: 0 })]?.v,
      batch: ws2[XLSX.utils.encode_cell({ r, c: 5 })]?.v,
      val: ws2[XLSX.utils.encode_cell({ r, c: 18 })]?.v, // Blocked Stock Value
      aa: ws2[XLSX.utils.encode_cell({ r, c: 24 })]?.v, // AA
      aging: ws2[XLSX.utils.encode_cell({ r, c: 25 })]?.v, // Aging(Date of Rcpt)
      gr: ws2[XLSX.utils.encode_cell({ r, c: 23 })]?.v
    });
  }
}

console.log(`Loaded ${hdfg1.length} HDFG rows from File 1`);
console.log(`Loaded ${hdfg2.length} HDFG rows from File 2`);

// Let's match them by Material and Batch
hdfg1.forEach(item1 => {
  const match = hdfg2.find(item2 => item2.mat === item1.mat && item2.batch === item1.batch);
  if (match) {
    console.log(`\nMatch for Mat=${item1.mat} Batch=${item1.batch}:`);
    console.log(`  File 1: row=${item1.rowIndex}, val=${item1.val}, aging=${item1.aging}, gr=${item1.gr}`);
    console.log(`  File 2: row=${match.rowIndex}, val=${match.val}, AA=${match.aa}, agingRcpt=${match.aging}, gr=${match.gr}`);
  } else {
    console.log(`\nNo match in File 2 for File 1 Row ${item1.rowIndex}: Mat=${item1.mat} Batch=${item1.batch}`);
  }
});
