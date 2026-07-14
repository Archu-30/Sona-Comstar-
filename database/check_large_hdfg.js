const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('hdfg_details.json', 'utf8'));

console.log('All HDFG rows with aa > 365 or aging > 365 or blank grDate:');
rows.forEach(r => {
  if (r.AA > 365 || r['Aging(Date of Rcpt)'] > 365 || !r['GR Issue date']) {
    console.log(`Row ${r.rowIndex}: mat=${r.Material} aa=${r.AA} aging=${r['Aging(Date of Rcpt)']} gr=${r['GR Issue date']} val=${r['Total Value']}`);
  }
});
