const { getPool } = require('./connection');

function tsToDate(ts) {
  if (!ts || ts <= 0) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

async function clearAndInsertInventory(items, uploadId) {
  const pool = getPool();
  await pool.execute('DELETE FROM inventory_items WHERE upload_id IS NULL OR upload_id = ?', [uploadId || 0]);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const grDate = (item) => tsToDate(item.grIssueDate);
    const values = batch.map((item) => {
      const gd = grDate(item);
      const d = gd ? new Date(gd) : null;
      return [
        uploadId || null,
        item.plant || null,
        item.storageLocation || null,
        item.material || null,
        item.materialDescription || null,
        item.productType || null,
        item.batch || null,
        item.unrestricted || 0,
        item.valueUnrestricted || 0,
        item.valInTransfer || 0,
        item.valueQualInsp || 0,
        item.valueRestricted || 0,
        item.valueBlocked || 0,
        item.totalValue || 0,
        item.aaAgingDays || 0,
        gd,
        d ? d.getFullYear() : null,
        d ? d.getMonth() + 1 : null,
      ];
    });
    await pool.query(
      `INSERT INTO inventory_items
       (upload_id,plant,storage_location,material,material_desc,product_type,batch,
        quantity,value_unrestricted,value_transit,value_qual_insp,value_restricted,
        value_blocked,total_value,aging_days,gr_date,gr_year,gr_month)
       VALUES ?`,
      [values]
    );
    inserted += batch.length;
  }
  return inserted;
}

async function clearAndInsertClosing(periods, uploadId) {
  const pool = getPool();
  await pool.execute('DELETE FROM closing_inventory WHERE upload_id IS NULL OR upload_id = ?', [uploadId || 0]);

  const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  function parsePeriod(name) {
    const m = name.match(/^(\w+)\s+(\d{4})$/i);
    if (!m) return null;
    const mo = MONTH_MAP[m[1].toLowerCase().substring(0,3)];
    return mo ? { month: mo, year: parseInt(m[2]) } : null;
  }

  let inserted = 0;
  for (const period of periods) {
    const parsed = parsePeriod(period.period);
    if (!parsed) continue;
    const BATCH = 500;
    for (let i = 0; i < period.items.length; i += BATCH) {
      const batch = period.items.slice(i, i + BATCH);
      const values = batch.map((item) => [
        uploadId || null,
        period.period,
        parsed.month,
        parsed.year,
        item.material || null,
        item.description || null,
        item.type || null,
        item.totalStock || 0,
        item.totalValue || 0,
      ]);
      await pool.query(
        `INSERT INTO closing_inventory
         (upload_id,period_name,period_month,period_year,material,material_desc,item_type,total_stock,total_value)
         VALUES ?`,
        [values]
      );
      inserted += batch.length;
    }
  }
  return inserted;
}

async function clearAndInsertGit(items, uploadId) {
  const pool = getPool();
  await pool.execute('DELETE FROM git_items WHERE upload_id IS NULL OR upload_id = ?', [uploadId || 0]);

  if (!items.length) return 0;
  const now = Date.now();
  const values = items.map((item) => {
    const invDate = item.invoiceDate ? tsToDate(item.invoiceDate) : null;
    const agingDays = invDate
      ? Math.max(0, Math.floor((now - new Date(invDate).getTime()) / 86400000))
      : 0;
    return [
      uploadId || null,
      item.invoiceNumber || null,
      invDate,
      item.material || null,
      item.materialDescription || null,
      item.vendorCode ? String(item.vendorCode) : null,
      item.product || null,
      item.qty || 0,
      item.value || 0,
      item.cyValue || 0,
      item.currency || null,
      agingDays,
    ];
  });
  await pool.query(
    `INSERT INTO git_items
     (upload_id,invoice_no,invoice_date,material,material_desc,vendor_code,product,
      quantity,value_inr,cy_value,currency,aging_days)
     VALUES ?`,
    [values]
  );
  return items.length;
}

async function seedFromExcel() {
  try {
    const {
      getInventoryAgeing,
      getClosingInventory,
      getImportGIT,
    } = require('../../database/index');

    const pool = getPool();
    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) as cnt FROM inventory_items');
    if (cnt > 0) {
      console.log(`[MySQL] inventory_items already has ${cnt} rows — skip seed`);
      return;
    }

    console.log('[MySQL] Seeding from Excel files...');
    const ageingItems = getInventoryAgeing();
    const n1 = await clearAndInsertInventory(ageingItems, null);
    console.log(`[MySQL] Seeded ${n1} inventory rows`);

    const closing = getClosingInventory();
    const n2 = await clearAndInsertClosing(closing, null);
    console.log(`[MySQL] Seeded ${n2} closing inventory rows`);

    const git = getImportGIT();
    const n3 = await clearAndInsertGit(git, null);
    console.log(`[MySQL] Seeded ${n3} GIT rows`);
  } catch (err) {
    console.error('[MySQL] Seed error:', err.message);
  }
}

module.exports = { seedFromExcel, clearAndInsertInventory, clearAndInsertClosing, clearAndInsertGit };
