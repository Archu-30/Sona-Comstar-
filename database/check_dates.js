const excelEpoch = new Date(1899, 11, 30).getTime();
function toDateStr(serial) {
  if (!serial) return 'blank';
  return new Date(excelEpoch + serial * 86400000).toISOString().split('T')[0];
}

console.log('Row 20057 Manufacture Date:', toDateStr(45456));
console.log('Row 20058 Manufacture Date:', toDateStr(45457));
console.log('Row 20059 Manufacture Date:', toDateStr(45762));
console.log('Row 20039 Manufacture Date:', toDateStr(45805));
console.log('Row 20047 Manufacture Date:', toDateStr(46191)); // Entered On is 46191, Manufacture Date is blank? Oh, Manufacture Date for Row 20047 was blank.
