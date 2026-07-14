const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('hdfg_details.json', 'utf8'));

let total = 0;
rows.forEach(r => {
  total += Number(r['Total Value'] || 0);
});

console.log('Total HDFG value from raw rows:', total);
