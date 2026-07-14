const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx') || f.endsWith('.XLSX') || f.endsWith('.xlsb'));

const TARGET_NUMBERS = [214693230, 105765332, 13682525, 23091051, 13881780];

console.log('Searching files for target numbers:', TARGET_NUMBERS);

files.forEach(file => {
  const filePath = path.join(DATA_DIR, file);
  console.log(`Scanning file: ${file}`);
  try {
    const wb = XLSX.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
      if (!range) return;
      
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v !== undefined) {
            const num = Math.round(Number(cell.v));
            if (TARGET_NUMBERS.includes(num)) {
              console.log(`  MATCH FOUND in sheet "${sheetName}", cell ${XLSX.utils.encode_cell({r, c})}: value=${cell.v}`);
            }
          }
        }
      }
    });
  } catch (e) {
    console.log(`  Error scanning ${file}: ${e.message}`);
  }
});
