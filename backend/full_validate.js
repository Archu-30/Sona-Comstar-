/**
 * Incremental sync validation script.
 * Run with:  node backend/full_validate.js
 *
 * Tests:
 *   1. First upsert — inserts all rows, 0 updated, 0 unchanged
 *   2. Identical upsert — 0 inserted, 0 updated, all unchanged
 *   3. Modified upsert — only changed rows counted as updated
 *   4. Different period — stored separately (no cross-contamination)
 *   5. New material partial upload — only new rows inserted
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { initPool, ensureAvailable } = require('./db/connection');
const { runSchema } = require('./db/schema');
const { upsertInventory, upsertClosing, upsertGit,
        extractDateFromFilename, derivePeriod } = require('./db/seed');
const { getPool } = require('./db/connection');

let passed = 0, failed = 0;

function assert(label, actual, expected) {
  const ok = actual === expected;
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (ok) passed++; else failed++;
}

async function clearTables(pool) {
  await pool.execute('DELETE FROM inventory_items');
  await pool.execute('DELETE FROM closing_inventory');
  await pool.execute('DELETE FROM git_items');
}

const PERIOD_A = { year: 2026, month: 6, date: '2026-06-24' };
const PERIOD_B = { year: 2026, month: 7, date: '2026-07-15' };

const SAMPLE_INV = [
  { plant: 'P001', storageLocation: 'SL01', material: 'MAT-A', batch: 'B1',
    grIssueDate: new Date('2026-01-15').getTime(),
    materialDescription: 'Material A', productType: 'YBOP',
    unrestricted: 100, valueUnrestricted: 5000, valInTransfer: 0,
    valueQualInsp: 0, valueRestricted: 0, valueBlocked: 0, totalValue: 5000, aaAgingDays: 180 },
  { plant: 'P001', storageLocation: 'SL01', material: 'MAT-B', batch: 'B2',
    grIssueDate: new Date('2026-02-20').getTime(),
    materialDescription: 'Material B', productType: 'YFGS',
    unrestricted: 200, valueUnrestricted: 8000, valInTransfer: 0,
    valueQualInsp: 0, valueRestricted: 0, valueBlocked: 0, totalValue: 8000, aaAgingDays: 145 },
];

const SAMPLE_CLOSING = [{
  period: 'January 2026',
  items: [
    { material: 'MAT-A', description: 'Material A', type: 'YBOP', totalStock: 100, totalValue: 5000 },
    { material: 'MAT-B', description: 'Material B', type: 'YFGS', totalStock: 200, totalValue: 8000 },
  ],
}];

const SAMPLE_GIT = [
  { invoiceNumber: 'INV-001', material: 'MAT-A',
    invoiceDate: new Date('2026-01-10').getTime(),
    materialDescription: 'Material A', vendorCode: 'V001', product: 'YBOP',
    qty: 100, value: 5000, cyValue: 60, currency: 'USD' },
  { invoiceNumber: 'INV-002', material: 'MAT-B',
    invoiceDate: new Date('2026-02-05').getTime(),
    materialDescription: 'Material B', vendorCode: 'V002', product: 'YFGS',
    qty: 200, value: 8000, cyValue: 96, currency: 'USD' },
];

async function testInventory() {
  console.log('\n[inventory_items]');
  const r1 = await upsertInventory(SAMPLE_INV, null, PERIOD_A);
  console.log(' Pass 1 (fresh insert, period A):');
  assert('inserted', r1.inserted, 2);
  assert('updated', r1.updated, 0);
  assert('unchanged', r1.unchanged, 0);

  const r2 = await upsertInventory(SAMPLE_INV, null, PERIOD_A);
  console.log(' Pass 2 (identical re-upload, period A):');
  assert('inserted', r2.inserted, 0);
  assert('updated', r2.updated, 0);
  assert('unchanged', r2.unchanged, 2);

  const modified = SAMPLE_INV.map((item, i) =>
    i === 0 ? { ...item, totalValue: 9999, valueUnrestricted: 9999 } : item
  );
  const r3 = await upsertInventory(modified, null, PERIOD_A);
  console.log(' Pass 3 (one row changed, period A):');
  assert('inserted', r3.inserted, 0);
  assert('updated', r3.updated, 1);
  assert('unchanged', r3.unchanged, 1);

  // Different period = separate storage
  const r4 = await upsertInventory(SAMPLE_INV, null, PERIOD_B);
  console.log(' Pass 4 (same data, different period B):');
  assert('inserted', r4.inserted, 2);
  assert('updated', r4.updated, 0);
  assert('unchanged', r4.unchanged, 0);
  assert('totalInDb', r4.totalInDb, 4);

  // Partial upload — only new material
  const newMaterial = [
    { plant: 'P001', storageLocation: 'SL01', material: 'MAT-C', batch: 'B3',
      grIssueDate: new Date('2026-03-01').getTime(),
      materialDescription: 'Material C', productType: 'YBOP',
      unrestricted: 50, valueUnrestricted: 3000, valInTransfer: 0,
      valueQualInsp: 0, valueRestricted: 0, valueBlocked: 0, totalValue: 3000, aaAgingDays: 90 },
  ];
  const r5 = await upsertInventory(newMaterial, null, PERIOD_A);
  console.log(' Pass 5 (partial upload — 1 new material, period A):');
  assert('inserted', r5.inserted, 1);
  assert('updated', r5.updated, 0);
  assert('unchanged', r5.unchanged, 0);
  assert('totalInDb', r5.totalInDb, 5);
}

async function testClosing() {
  console.log('\n[closing_inventory]');
  const r1 = await upsertClosing(SAMPLE_CLOSING, null, PERIOD_A);
  console.log(' Pass 1 (fresh insert, period A):');
  assert('inserted', r1.inserted, 2);
  assert('updated', r1.updated, 0);
  assert('unchanged', r1.unchanged, 0);

  const r2 = await upsertClosing(SAMPLE_CLOSING, null, PERIOD_A);
  console.log(' Pass 2 (identical re-upload, period A):');
  assert('inserted', r2.inserted, 0);
  assert('updated', r2.updated, 0);
  assert('unchanged', r2.unchanged, 2);

  const modified = [{ ...SAMPLE_CLOSING[0],
    items: SAMPLE_CLOSING[0].items.map((it, i) => i === 0 ? { ...it, totalValue: 99999 } : it) }];
  const r3 = await upsertClosing(modified, null, PERIOD_A);
  console.log(' Pass 3 (one row changed, period A):');
  assert('inserted', r3.inserted, 0);
  assert('updated', r3.updated, 1);
  assert('unchanged', r3.unchanged, 1);

  const r4 = await upsertClosing(SAMPLE_CLOSING, null, PERIOD_B);
  console.log(' Pass 4 (same data, different period B):');
  assert('inserted', r4.inserted, 2);
  assert('updated', r4.updated, 0);
  assert('unchanged', r4.unchanged, 0);
  assert('totalInDb', r4.totalInDb, 4);
}

async function testGit() {
  console.log('\n[git_items]');
  const r1 = await upsertGit(SAMPLE_GIT, null, PERIOD_A);
  console.log(' Pass 1 (fresh insert, period A):');
  assert('inserted', r1.inserted, 2);
  assert('updated', r1.updated, 0);
  assert('unchanged', r1.unchanged, 0);

  const r2 = await upsertGit(SAMPLE_GIT, null, PERIOD_A);
  console.log(' Pass 2 (identical re-upload, period A):');
  assert('inserted', r2.inserted, 0);
  assert('updated', r2.updated, 0);
  assert('unchanged', r2.unchanged, 2);

  const modified = SAMPLE_GIT.map((it, i) => i === 1 ? { ...it, value: 12345 } : it);
  const r3 = await upsertGit(modified, null, PERIOD_A);
  console.log(' Pass 3 (one row changed, period A):');
  assert('inserted', r3.inserted, 0);
  assert('updated', r3.updated, 1);
  assert('unchanged', r3.unchanged, 1);

  const r4 = await upsertGit(SAMPLE_GIT, null, PERIOD_B);
  console.log(' Pass 4 (same data, different period B):');
  assert('inserted', r4.inserted, 2);
  assert('updated', r4.updated, 0);
  assert('unchanged', r4.unchanged, 0);
  assert('totalInDb', r4.totalInDb, 4);
}

function testPeriodDerivation() {
  console.log('\n[period derivation]');

  // The seed file and an uploaded copy of the SAME file must resolve to the
  // SAME date — this is what guarantees re-uploads match existing rows.
  assert('bundled seed file',
    extractDateFromFilename('Inventory Ageing Report_24062026 summary.XLSX'), '2026-06-24');
  assert('uploaded copy (multer prefix)',
    extractDateFromFilename('upload_1784019505546_Inventory Ageing Report_24062026 _1_.XLSX'), '2026-06-24');
  assert('ISO date in name',
    extractDateFromFilename('report_2026-07-15.xlsx'), '2026-07-15');
  assert('DD_MM_YYYY in name',
    extractDateFromFilename('report_15_07_2026.xlsx'), '2026-07-15');
  assert('no date in name', extractDateFromFilename('inventory ageing.xlsx'), null);

  // Same file uploaded twice ⇒ identical period ⇒ identical biz_keys
  const pa = derivePeriod('ageing', 'Inventory Ageing Report_24062026 summary.XLSX', SAMPLE_INV, null);
  const pb = derivePeriod('ageing', 'upload_1784019505546_Inventory Ageing Report_24062026 _1_.XLSX', SAMPLE_INV, null);
  assert('seed vs upload period.date match', pa.date === pb.date, true);
  assert('derived date', pa.date, '2026-06-24');
}

async function main() {
  console.log('=== Incremental Sync Validation ===');
  try {
    initPool();
    const ok = await ensureAvailable();
    if (!ok) {
      console.error('MySQL not available — cannot run validation.');
      process.exit(1);
    }
    await runSchema();

    const pool = getPool();
    await clearTables(pool);
    console.log('Tables cleared for clean test run.');

    testPeriodDerivation();
    await testInventory();
    await testClosing();
    await testGit();

    // Leave tables empty so the server seed repopulates real data on restart
    await clearTables(pool);
    console.log('\nTest rows cleared — server will re-seed real data on next start.');

    console.log('\n══════════════════════════════════');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

main();
