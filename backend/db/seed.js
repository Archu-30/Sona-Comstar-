const { getPool } = require('./connection');

function tsToDate(ts) {
  if (!ts || ts <= 0) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

function fmtDate(d) {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d);
}

// ─── Period derivation (shared by seed + upload) ─────────────────────────────

function extractDateFromFilename(filename) {
  // Strip upload timestamp prefix (e.g. "upload_1784019505546_") so it
  // doesn't shadow the real date embedded in the original filename.
  const stripped = filename.replace(/^upload_\d+_/, '');

  const m2 = stripped.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  const m3 = stripped.match(/(\d{2})[_\-](\d{2})[_\-](\d{4})/);
  if (m3) {
    const day = m3[1], mon = m3[2], yr = m3[3];
    if (Number(mon) >= 1 && Number(mon) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${yr}-${mon}-${day}`;
    }
  }

  // DDMMYYYY without separators — iterate ALL matches (not just first)
  const re = /(\d{2})(\d{2})(\d{4})/g;
  let m1;
  while ((m1 = re.exec(stripped)) !== null) {
    const day = m1[1], mon = m1[2], yr = m1[3];
    if (Number(yr) >= 2020 && Number(yr) <= 2099 &&
        Number(mon) >= 1 && Number(mon) <= 12 &&
        Number(day) >= 1 && Number(day) <= 31) {
      return `${yr}-${mon}-${day}`;
    }
  }

  return null;
}

function derivePeriod(kind, filename, inventoryItems, gitItems) {
  const fileDate = extractDateFromFilename(filename || '');

  if (kind === 'ageing' && inventoryItems && inventoryItems.length > 0) {
    const dates = inventoryItems
      .map(i => i.grIssueDate ? new Date(i.grIssueDate) : null)
      .filter(d => d && !isNaN(d.getTime()));
    if (dates.length) {
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      const dateStr = fileDate || max.toISOString().split('T')[0];
      const d = new Date(dateStr);
      return { year: d.getFullYear(), month: d.getMonth() + 1, date: dateStr };
    }
  }

  if (kind === 'git' && gitItems && gitItems.length > 0) {
    const dates = gitItems
      .map(i => i.invoiceDate ? new Date(i.invoiceDate) : null)
      .filter(d => d && !isNaN(d.getTime()));
    if (dates.length) {
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      const dateStr = fileDate || max.toISOString().split('T')[0];
      const d = new Date(dateStr);
      return { year: d.getFullYear(), month: d.getMonth() + 1, date: dateStr };
    }
  }

  if (fileDate) {
    const d = new Date(fileDate);
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: fileDate };
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, date: now.toISOString().split('T')[0] };
}

function invBizKey(reportYear, reportMonth, reportDate, item, grDate) {
  return [
    String(reportYear || ''), String(reportMonth || ''), fmtDate(reportDate),
    item.plant || '', item.storageLocation || '', item.material || '',
    item.batch || '', grDate || '',
  ].join('~~');
}

function closingBizKey(reportDate, year, month, material, itemType, valuationArea) {
  return [
    fmtDate(reportDate), String(year || ''), String(month || ''),
    material || '', itemType || '', String(valuationArea || ''),
  ].join('~~');
}

function gitBizKey(reportYear, reportMonth, reportDate, item) {
  return [
    String(reportYear || ''), String(reportMonth || ''), fmtDate(reportDate),
    item.invoiceNumber || '', item.material || '',
  ].join('~~');
}

const BATCH = 500;

// ─── Cell-level comparison ────────────────────────────────────────────────────
// MySQL returns DECIMAL as string and DATE as Date object; incoming rows are
// JS numbers/ISO strings. Normalize both sides before comparing.

function numEq(a, b) { return Math.abs(Number(a || 0) - Number(b || 0)) < 0.005; }
function strEq(a, b) { return String(a ?? '') === String(b ?? ''); }

// Row array indices follow buildInvRow()
function countInvDiff(ex, row) {
  let d = 0;
  if (!strEq(ex.material_desc, row[8])) d++;
  if (!strEq(ex.product_type, row[9])) d++;
  if (!numEq(ex.quantity, row[11])) d++;
  if (!numEq(ex.value_unrestricted, row[12])) d++;
  if (!numEq(ex.value_transit, row[13])) d++;
  if (!numEq(ex.value_qual_insp, row[14])) d++;
  if (!numEq(ex.value_restricted, row[15])) d++;
  if (!numEq(ex.value_blocked, row[16])) d++;
  if (!numEq(ex.total_value, row[17])) d++;
  if (!numEq(ex.aging_days, row[18])) d++;
  if (!strEq(ex.gr_date || '', row[19] || '')) d++;
  if (!numEq(ex.gr_year, row[20])) d++;
  if (!numEq(ex.gr_month, row[21])) d++;
  return d;
}

function countClsDiff(ex, row) {
  let d = 0;
  if (!strEq(ex.period_name, row[5])) d++;
  if (!strEq(ex.material_desc, row[9])) d++;
  if (!numEq(ex.total_stock, row[11])) d++;
  if (!numEq(ex.total_value, row[12])) d++;
  return d;
}

function countGitDiff(ex, row) {
  let d = 0;
  if (!strEq(ex.invoice_date || '', row[6] || '')) d++;
  if (!strEq(ex.material_desc, row[8])) d++;
  if (!strEq(ex.vendor_code, row[9])) d++;
  if (!strEq(ex.product, row[10])) d++;
  if (!numEq(ex.quantity, row[11])) d++;
  if (!numEq(ex.value_inr, row[12])) d++;
  if (!numEq(ex.cy_value, row[13])) d++;
  if (!strEq(ex.currency, row[14])) d++;
  if (!numEq(ex.aging_days, row[15])) d++;
  return d;
}

// ─── inventory_items ─────────────────────────────────────────────────────────

const INV_COLS =
  '(biz_key,upload_id,report_year,report_month,report_date,' +
  'plant,storage_location,material,material_desc,' +
  'product_type,batch,quantity,value_unrestricted,value_transit,' +
  'value_qual_insp,value_restricted,value_blocked,total_value,' +
  'aging_days,gr_date,gr_year,gr_month)';

const INV_UPDATE =
  'upload_id=VALUES(upload_id),' +
  'material_desc=VALUES(material_desc),' +
  'product_type=VALUES(product_type),' +
  'quantity=VALUES(quantity),' +
  'value_unrestricted=VALUES(value_unrestricted),' +
  'value_transit=VALUES(value_transit),' +
  'value_qual_insp=VALUES(value_qual_insp),' +
  'value_restricted=VALUES(value_restricted),' +
  'value_blocked=VALUES(value_blocked),' +
  'total_value=VALUES(total_value),' +
  'aging_days=VALUES(aging_days),' +
  'gr_date=VALUES(gr_date),' +
  'gr_year=VALUES(gr_year),' +
  'gr_month=VALUES(gr_month)';

function buildInvRow(item, bizKey, grDate, uploadId, period) {
  const d = grDate ? new Date(grDate) : null;
  return [
    bizKey,
    uploadId || null,
    period.year, period.month, period.date,
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
    grDate,
    d ? d.getFullYear() : null,
    d ? d.getMonth() + 1 : null,
  ];
}

async function upsertInventory(items, uploadId, period) {
  if (!period) period = defaultPeriod();
  const pool = getPool();
  const conn = await pool.getConnection();
  const t0 = Date.now();

  // STEP 1: Verify database and table
  const [[dbRow]] = await conn.execute('SELECT DATABASE() AS db');
  console.log(`[UPSERT-INV] Database: ${dbRow.db}`);

  // STEP 2: Count before
  const [[{ countBefore }]] = await conn.execute('SELECT COUNT(*) AS countBefore FROM inventory_items');
  console.log(`[UPSERT-INV] Rows BEFORE upload: ${countBefore}`);

  // STEP 3: Verify file parsing
  console.log(`[UPSERT-INV] Rows parsed from file: ${items.length}`);
  console.log(`[UPSERT-INV] Period: year=${period.year} month=${period.month} date=${period.date}`);
  if (items.length === 0) {
    console.error('[UPSERT-INV] *** ZERO ROWS PARSED — aborting upsert to protect existing data ***');
    conn.release();
    return {
      reportType: 'Inventory Ageing',
      period,
      rowsRead: 0, rowsCompared: 0, rowsUnique: 0,
      existing: countBefore, inserted: 0, updated: 0, unchanged: 0,
      cellsUpdated: 0, duplicateRows: 0, deleted: 0,
      totalInDb: countBefore, executionMs: Date.now() - t0,
      warning: 'Zero rows parsed from file — upload skipped to protect existing data',
    };
  }

  if (items.length > 0) {
    const sample = items[0];
    console.log(`[UPSERT-INV] Sample row: material=${sample.material}, plant=${sample.plant}, storageLocation=${sample.storageLocation}, totalValue=${sample.totalValue}`);
  }

  try {
    await conn.beginTransaction();

    const rowMap = new Map();
    for (const item of items) {
      const gd = tsToDate(item.grIssueDate);
      const key = invBizKey(period.year, period.month, period.date, item, gd);
      rowMap.set(key, buildInvRow(item, key, gd, uploadId, period));
    }

    console.log(`[UPSERT-INV] Unique biz_keys: ${rowMap.size} (duplicates in file: ${items.length - rowMap.size})`);

    // Fetch existing rows for this period WITH data columns so we can do a
    // true cell-level comparison in JS (mysql2 does not report changedRows
    // for INSERT ... ON DUPLICATE KEY UPDATE).
    const [existing] = await conn.execute(
      `SELECT biz_key, material_desc, product_type, quantity,
              value_unrestricted, value_transit, value_qual_insp,
              value_restricted, value_blocked, total_value, aging_days,
              DATE_FORMAT(gr_date,'%Y-%m-%d') AS gr_date, gr_year, gr_month
       FROM inventory_items
       WHERE report_year = ? AND report_month = ? AND report_date = ?`,
      [period.year, period.month, period.date]
    );
    const existingMap = new Map(existing.map(r => [r.biz_key, r]));
    console.log(`[UPSERT-INV] Existing rows for this period: ${existingMap.size}`);

    const toInsert = [], toUpdate = [];
    let unchanged = 0, cellsUpdated = 0;
    for (const [key, row] of rowMap) {
      const ex = existingMap.get(key);
      if (!ex) { toInsert.push(row); continue; }
      const diff = countInvDiff(ex, row);
      if (diff > 0) { toUpdate.push(row); cellsUpdated += diff; }
      else unchanged++;
    }

    // STEP 4: Log what will happen
    console.log(`[UPSERT-INV] Rows to INSERT (new): ${toInsert.length}`);
    console.log(`[UPSERT-INV] Rows to UPDATE (changed cells): ${toUpdate.length}`);
    console.log(`[UPSERT-INV] Rows UNCHANGED (identical): ${unchanged}`);

    let inserted = 0, updated = 0;

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const [result] = await conn.query(`INSERT INTO inventory_items ${INV_COLS} VALUES ?`, [batch]);
      inserted += result.affectedRows;
    }

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await conn.query(
        `INSERT INTO inventory_items ${INV_COLS} VALUES ? ON DUPLICATE KEY UPDATE ${INV_UPDATE}`,
        [batch]
      );
      updated += batch.length;
    }

    // STEP 5: Verify AFTER operations but BEFORE commit
    const [[{ countAfter }]] = await conn.execute('SELECT COUNT(*) AS countAfter FROM inventory_items');

    // SAFETY GUARD: Never allow table to become empty
    if (countAfter === 0 && countBefore > 0) {
      console.error(`[UPSERT-INV] *** SAFETY GUARD *** Count would drop from ${countBefore} to 0 — ROLLING BACK`);
      await conn.rollback();
      conn.release();
      return {
        reportType: 'Inventory Ageing',
        period,
        rowsRead: items.length, rowsCompared: updated + unchanged,
        rowsUnique: rowMap.size, existing: existingMap.size,
        inserted: 0, updated: 0, unchanged: 0, cellsUpdated: 0,
        duplicateRows: items.length - rowMap.size, deleted: 0,
        totalInDb: countBefore, executionMs: Date.now() - t0,
        error: 'Safety guard prevented data loss — table would have been emptied',
      };
    }

    await conn.commit();

    // STEP 6: Verify AFTER commit
    const [[{ countFinal }]] = await conn.execute('SELECT COUNT(*) AS countFinal FROM inventory_items');

    console.log(`[UPSERT-INV] ══════════════════════════════════════`);
    console.log(`[UPSERT-INV] Rows BEFORE: ${countBefore}`);
    console.log(`[UPSERT-INV] Rows INSERTED: ${inserted}`);
    console.log(`[UPSERT-INV] Rows UPDATED: ${updated}`);
    console.log(`[UPSERT-INV] Rows UNCHANGED: ${unchanged}`);
    console.log(`[UPSERT-INV] Rows AFTER COMMIT: ${countFinal}`);
    console.log(`[UPSERT-INV] ══════════════════════════════════════`);

    return {
      reportType: 'Inventory Ageing',
      period,
      rowsRead: items.length,
      rowsCompared: updated + unchanged,
      rowsUnique: rowMap.size,
      existing: existingMap.size,
      inserted,
      updated,
      unchanged,
      cellsUpdated,
      duplicateRows: items.length - rowMap.size,
      deleted: 0,
      totalInDb: Number(countFinal),
      countBefore,
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    await conn.rollback();
    console.error(`[UPSERT-INV] *** ERROR — ROLLED BACK *** ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
}

// ─── closing_inventory ────────────────────────────────────────────────────────

const CLS_COLS =
  '(biz_key,upload_id,report_year,report_month,report_date,' +
  'period_name,period_month,period_year,' +
  'material,material_desc,item_type,total_stock,total_value)';

const CLS_UPDATE =
  'upload_id=VALUES(upload_id),' +
  'period_name=VALUES(period_name),' +
  'material_desc=VALUES(material_desc),' +
  'total_stock=VALUES(total_stock),' +
  'total_value=VALUES(total_value)';

const MONTH_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function parsePeriod(name) {
  const m = name.match(/^(\w+)\s+(\d{4})$/i);
  if (!m) return null;
  const mo = MONTH_MAP[m[1].toLowerCase().substring(0, 3)];
  return mo ? { month: mo, year: parseInt(m[2]) } : null;
}

async function upsertClosing(periods, uploadId, period) {
  if (!period) period = defaultPeriod();
  const pool = getPool();
  const conn = await pool.getConnection();
  const t0 = Date.now();

  const [[{ countBefore }]] = await conn.execute('SELECT COUNT(*) AS countBefore FROM closing_inventory');
  console.log(`[UPSERT-CLS] Rows BEFORE: ${countBefore} | Period: ${period.date}`);

  try {
    await conn.beginTransaction();

    const rowMap = new Map();
    for (const p of periods) {
      const parsed = parsePeriod(p.period);
      if (!parsed) continue;
      for (const item of p.items) {
        const key = closingBizKey(period.date, parsed.year, parsed.month, item.material, item.type, item.valuationArea);
        rowMap.set(key, [
          key,
          uploadId || null,
          period.year, period.month, period.date,
          p.period,
          parsed.month,
          parsed.year,
          item.material || null,
          item.description || null,
          item.type || null,
          item.totalStock || 0,
          item.totalValue || 0,
        ]);
      }
    }

    console.log(`[UPSERT-CLS] Unique biz_keys: ${rowMap.size}`);

    if (rowMap.size === 0) {
      console.warn('[UPSERT-CLS] Zero rows to upsert — skipping');
      await conn.rollback();
      conn.release();
      return {
        reportType: 'Closing Inventory', period,
        rowsRead: 0, rowsCompared: 0, existing: countBefore,
        inserted: 0, updated: 0, unchanged: 0, cellsUpdated: 0,
        deleted: 0, totalInDb: countBefore, periods: [],
        executionMs: Date.now() - t0,
      };
    }

    const [existing] = await conn.execute(
      `SELECT biz_key, period_name, material_desc, total_stock, total_value
       FROM closing_inventory WHERE report_date = ?`,
      [period.date]
    );
    const existingMap = new Map(existing.map(r => [r.biz_key, r]));

    const toInsert = [], toUpdate = [];
    let unchanged = 0, cellsUpdated = 0;
    for (const [key, row] of rowMap) {
      const ex = existingMap.get(key);
      if (!ex) { toInsert.push(row); continue; }
      const diff = countClsDiff(ex, row);
      if (diff > 0) { toUpdate.push(row); cellsUpdated += diff; }
      else unchanged++;
    }

    let inserted = 0, updated = 0;

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const [result] = await conn.query(`INSERT INTO closing_inventory ${CLS_COLS} VALUES ?`, [batch]);
      inserted += result.affectedRows;
    }

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await conn.query(
        `INSERT INTO closing_inventory ${CLS_COLS} VALUES ? ON DUPLICATE KEY UPDATE ${CLS_UPDATE}`,
        [batch]
      );
      updated += batch.length;
    }

    const [[{ countAfter }]] = await conn.execute('SELECT COUNT(*) AS countAfter FROM closing_inventory');

    if (countAfter === 0 && countBefore > 0) {
      console.error(`[UPSERT-CLS] *** SAFETY GUARD *** Count would drop to 0 — ROLLING BACK`);
      await conn.rollback();
      conn.release();
      return { reportType: 'Closing Inventory', period, inserted: 0, updated: 0, unchanged: 0,
        totalInDb: countBefore, error: 'Safety guard prevented data loss', executionMs: Date.now() - t0 };
    }

    await conn.commit();

    const [[{ countFinal }]] = await conn.execute('SELECT COUNT(*) AS countFinal FROM closing_inventory');
    console.log(`[UPSERT-CLS] BEFORE: ${countBefore} | INSERTED: ${inserted} | UPDATED: ${updated} | AFTER: ${countFinal}`);

    return {
      reportType: 'Closing Inventory',
      period,
      rowsRead: rowMap.size,
      rowsCompared: updated + unchanged,
      existing: existingMap.size,
      inserted,
      updated,
      unchanged,
      cellsUpdated,
      deleted: 0,
      totalInDb: Number(countFinal),
      countBefore,
      periods: periods.map(p => p.period),
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    await conn.rollback();
    console.error(`[UPSERT-CLS] *** ERROR — ROLLED BACK *** ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
}

// ─── git_items ────────────────────────────────────────────────────────────────

const GIT_COLS =
  '(biz_key,upload_id,report_year,report_month,report_date,' +
  'invoice_no,invoice_date,material,material_desc,' +
  'vendor_code,product,quantity,value_inr,cy_value,currency,aging_days)';

const GIT_UPDATE =
  'upload_id=VALUES(upload_id),' +
  'invoice_date=VALUES(invoice_date),' +
  'material_desc=VALUES(material_desc),' +
  'vendor_code=VALUES(vendor_code),' +
  'product=VALUES(product),' +
  'quantity=VALUES(quantity),' +
  'value_inr=VALUES(value_inr),' +
  'cy_value=VALUES(cy_value),' +
  'currency=VALUES(currency),' +
  'aging_days=VALUES(aging_days)';

async function upsertGit(items, uploadId, period) {
  if (!period) period = defaultPeriod();
  const pool = getPool();
  const conn = await pool.getConnection();
  const t0 = Date.now();

  const [[{ countBefore }]] = await conn.execute('SELECT COUNT(*) AS countBefore FROM git_items');
  console.log(`[UPSERT-GIT] Rows BEFORE: ${countBefore} | Rows parsed: ${items.length} | Period: ${period.date}`);

  if (items.length === 0) {
    console.warn('[UPSERT-GIT] Zero rows parsed — skipping');
    conn.release();
    return {
      reportType: 'Import GIT', period,
      rowsRead: 0, rowsCompared: 0, rowsUnique: 0,
      existing: countBefore, inserted: 0, updated: 0, unchanged: 0,
      cellsUpdated: 0, duplicateRows: 0, deleted: 0,
      totalInDb: countBefore, executionMs: Date.now() - t0,
      warning: 'Zero rows parsed — upload skipped',
    };
  }

  try {
    await conn.beginTransaction();

    const now = Date.now();
    const rowMap = new Map();
    for (const item of items) {
      const key = gitBizKey(period.year, period.month, period.date, item);
      const invDate = item.invoiceDate ? tsToDate(item.invoiceDate) : null;
      const agingDays = invDate
        ? Math.max(0, Math.floor((now - new Date(invDate).getTime()) / 86400000))
        : 0;
      rowMap.set(key, [
        key,
        uploadId || null,
        period.year, period.month, period.date,
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
      ]);
    }

    console.log(`[UPSERT-GIT] Unique biz_keys: ${rowMap.size}`);

    const [existing] = await conn.execute(
      `SELECT biz_key, DATE_FORMAT(invoice_date,'%Y-%m-%d') AS invoice_date,
              material_desc, vendor_code, product, quantity,
              value_inr, cy_value, currency, aging_days
       FROM git_items WHERE report_year = ? AND report_month = ? AND report_date = ?`,
      [period.year, period.month, period.date]
    );
    const existingMap = new Map(existing.map(r => [r.biz_key, r]));

    const toInsert = [], toUpdate = [];
    let unchanged = 0, cellsUpdated = 0;
    for (const [key, row] of rowMap) {
      const ex = existingMap.get(key);
      if (!ex) { toInsert.push(row); continue; }
      const diff = countGitDiff(ex, row);
      if (diff > 0) { toUpdate.push(row); cellsUpdated += diff; }
      else unchanged++;
    }

    console.log(`[UPSERT-GIT] To INSERT: ${toInsert.length} | To UPDATE: ${toUpdate.length} | UNCHANGED: ${unchanged}`);

    let inserted = 0, updated = 0;

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const [result] = await conn.query(`INSERT INTO git_items ${GIT_COLS} VALUES ?`, [batch]);
      inserted += result.affectedRows;
    }

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await conn.query(
        `INSERT INTO git_items ${GIT_COLS} VALUES ? ON DUPLICATE KEY UPDATE ${GIT_UPDATE}`,
        [batch]
      );
      updated += batch.length;
    }

    const [[{ countAfter }]] = await conn.execute('SELECT COUNT(*) AS countAfter FROM git_items');

    if (countAfter === 0 && countBefore > 0) {
      console.error(`[UPSERT-GIT] *** SAFETY GUARD *** Count would drop to 0 — ROLLING BACK`);
      await conn.rollback();
      conn.release();
      return { reportType: 'Import GIT', period, inserted: 0, updated: 0, unchanged: 0,
        totalInDb: countBefore, error: 'Safety guard prevented data loss', executionMs: Date.now() - t0 };
    }

    await conn.commit();

    const [[{ countFinal }]] = await conn.execute('SELECT COUNT(*) AS countFinal FROM git_items');
    console.log(`[UPSERT-GIT] BEFORE: ${countBefore} | INSERTED: ${inserted} | UPDATED: ${updated} | AFTER: ${countFinal}`);

    return {
      reportType: 'Import GIT',
      period,
      rowsRead: items.length,
      rowsCompared: updated + unchanged,
      rowsUnique: rowMap.size,
      existing: existingMap.size,
      inserted,
      updated,
      unchanged,
      cellsUpdated,
      duplicateRows: items.length - rowMap.size,
      deleted: 0,
      totalInDb: Number(countFinal),
      countBefore,
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    await conn.rollback();
    console.error(`[UPSERT-GIT] *** ERROR — ROLLED BACK *** ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    date: now.toISOString().split('T')[0],
  };
}

// ─── Initial seed from Excel ──────────────────────────────────────────────────

async function seedFromExcel() {
  try {
    const { getInventoryAgeing, getClosingInventory, getImportGIT,
            setSourceFile, getOriginalAgeingPath, clearCache } = require('../../database/index');
    const pool = getPool();

    const [[{ db }]] = await pool.execute('SELECT DATABASE() AS db');
    console.log(`[MySQL] Seed — connected to database: ${db}`);

    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM inventory_items');
    if (cnt > 0) {
      console.log(`[MySQL] inventory_items already has ${cnt} rows — skip seed`);
      return;
    }

    console.log('[MySQL] Table is empty — seeding from Excel files...');

    // Use the ORIGINAL bundled ageing file for seeding, not an uploaded test file
    const originalPath = getOriginalAgeingPath();
    console.log(`[MySQL] Seed source: ${originalPath}`);
    setSourceFile('ageing', originalPath);
    clearCache();

    const ageingItems = getInventoryAgeing();
    console.log(`[MySQL] Excel parsed: ${ageingItems.length} ageing items`);
    if (ageingItems.length === 0) {
      console.error('[MySQL] *** WARNING: Excel parser returned 0 ageing items — seed aborted ***');
      return;
    }
    if (ageingItems.length < 100) {
      console.warn(`[MySQL] *** WARNING: Only ${ageingItems.length} ageing items parsed — this seems too few. Check the source file. ***`);
    }

    // Derive period from the FILE (same logic uploads use) so seed and
    // upload produce identical biz_keys for the same data.
    const path = require('path');
    const filename = path.basename(originalPath);
    const period = derivePeriod('ageing', filename, ageingItems, null);
    console.log(`[MySQL] Seed period (from file): year=${period.year} month=${period.month} date=${period.date}`);

    const r1 = await upsertInventory(ageingItems, null, period);
    console.log(`[MySQL] Seeded inventory: ${r1.inserted} inserted (${r1.totalInDb} total)`);

    const closingPeriods = getClosingInventory();
    console.log(`[MySQL] Excel parsed: ${closingPeriods.length} closing periods`);
    const r2 = await upsertClosing(closingPeriods, null, period);
    console.log(`[MySQL] Seeded closing: ${r2.inserted} inserted (${r2.totalInDb} total)`);

    const gitItems = getImportGIT();
    console.log(`[MySQL] Excel parsed: ${gitItems.length} GIT items`);
    const r3 = await upsertGit(gitItems, null, period);
    console.log(`[MySQL] Seeded GIT: ${r3.inserted} inserted (${r3.totalInDb} total)`);

    // Final verification
    const [[{ invCount }]] = await pool.execute('SELECT COUNT(*) AS invCount FROM inventory_items');
    const [[{ clsCount }]] = await pool.execute('SELECT COUNT(*) AS clsCount FROM closing_inventory');
    const [[{ gitCount }]] = await pool.execute('SELECT COUNT(*) AS gitCount FROM git_items');
    console.log(`[MySQL] ═══ SEED COMPLETE ═══`);
    console.log(`[MySQL] inventory_items: ${invCount}`);
    console.log(`[MySQL] closing_inventory: ${clsCount}`);
    console.log(`[MySQL] git_items: ${gitCount}`);
    console.log(`[MySQL] ═════════════════════`);
  } catch (err) {
    console.error('[MySQL] *** SEED ERROR ***:', err.message);
    console.error('[MySQL] Stack:', err.stack);
  }
}

// Force-replace all closing inventory rows for a report_date by
// deleting existing rows and re-inserting (no biz_key merge).
async function replaceClosing(periods, uploadId, period) {
  if (!period) period = defaultPeriod();
  const pool = getPool();
  const conn = await pool.getConnection();
  const t0 = Date.now();

  try {
    await conn.beginTransaction();

    const [[{ countBefore }]] = await conn.execute('SELECT COUNT(*) AS countBefore FROM closing_inventory');

    // Build all rows (no dedup)
    const rows = [];
    for (const p of periods) {
      const parsed = parsePeriod(p.period);
      if (!parsed) continue;
      for (const item of p.items) {
        const key = closingBizKey(period.date, parsed.year, parsed.month, item.material, item.type, item.valuationArea);
        rows.push([
          key,
          uploadId || null,
          period.year, period.month, period.date,
          p.period,
          parsed.month,
          parsed.year,
          item.material || null,
          item.description || null,
          item.type || null,
          item.totalStock || 0,
          item.totalValue || 0,
        ]);
      }
    }

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return { inserted: 0, deleted: 0, totalInDb: countBefore, warning: 'Zero rows parsed — skipped' };
    }

    // Delete existing rows for this report_date
    const [del] = await conn.execute('DELETE FROM closing_inventory WHERE report_date = ?', [period.date]);
    const deleted = del.affectedRows;

    // Insert all rows (last-write-wins for duplicate biz_keys)
    const seen = new Map();
    for (const r of rows) seen.set(r[0], r); // r[0] = biz_key
    const unique = [...seen.values()];

    let inserted = 0;
    for (let i = 0; i < unique.length; i += BATCH) {
      const batch = unique.slice(i, i + BATCH);
      const [res] = await conn.query(`INSERT INTO closing_inventory ${CLS_COLS} VALUES ?`, [batch]);
      inserted += res.affectedRows;
    }

    const [[{ countAfter }]] = await conn.execute('SELECT COUNT(*) AS countAfter FROM closing_inventory');
    await conn.commit();

    const [[{ countFinal }]] = await conn.execute('SELECT COUNT(*) AS countFinal FROM closing_inventory');
    console.log(`[REPLACE-CLS] BEFORE: ${countBefore} | DELETED: ${deleted} | INSERTED: ${inserted} | AFTER: ${countFinal}`);

    return {
      reportType: 'Closing Inventory (force replace)',
      period,
      rowsRead: rows.length,
      rowsUnique: unique.length,
      deleted,
      inserted,
      updated: 0,
      unchanged: 0,
      totalInDb: Number(countFinal),
      countBefore,
      executionMs: Date.now() - t0,
    };
  } catch (err) {
    await conn.rollback();
    console.error(`[REPLACE-CLS] *** ERROR — ROLLED BACK *** ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  seedFromExcel,
  upsertInventory,
  upsertClosing,
  upsertGit,
  replaceClosing,
  defaultPeriod,
  extractDateFromFilename,
  derivePeriod,
  clearAndInsertInventory: upsertInventory,
  clearAndInsertClosing: upsertClosing,
  clearAndInsertGit: upsertGit,
};
