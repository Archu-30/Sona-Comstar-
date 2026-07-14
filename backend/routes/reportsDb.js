const express = require('express');
const router = express.Router();
const { getPool, isAvailable } = require('../db/connection');

function parseArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter(Boolean) : []; }
  catch { return v.split(',').map((s) => s.trim()).filter(Boolean); }
}

function bucketToSql(b) {
  switch (b) {
    case '0-30 Days':    return 'aging_days BETWEEN 0 AND 30';
    case '31-60 Days':   return 'aging_days BETWEEN 31 AND 60';
    case '61-90 Days':   return 'aging_days BETWEEN 61 AND 90';
    case '91-180 Days':  return 'aging_days BETWEEN 91 AND 180';
    case '181-365 Days': return 'aging_days BETWEEN 181 AND 365';
    case 'Above 1 Year': return 'aging_days BETWEEN 366 AND 730';
    case 'Above 2 Years':return 'aging_days BETWEEN 731 AND 1095';
    case 'Above 3 Years':return 'aging_days BETWEEN 1096 AND 1460';
    case 'Above 4 Years':return 'aging_days BETWEEN 1461 AND 1825';
    case 'Above 5 Years':return 'aging_days > 1825';
    default: return '1=1';
  }
}

function ageBucketLabel(days) {
  if (days <= 30)   return '0-30 Days';
  if (days <= 60)   return '31-60 Days';
  if (days <= 90)   return '61-90 Days';
  if (days <= 180)  return '91-180 Days';
  if (days <= 365)  return '181-365 Days';
  if (days <= 730)  return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}

const AGE_CASE = `CASE
  WHEN aging_days BETWEEN 0 AND 30   THEN '0-30 Days'
  WHEN aging_days BETWEEN 31 AND 60  THEN '31-60 Days'
  WHEN aging_days BETWEEN 61 AND 90  THEN '61-90 Days'
  WHEN aging_days BETWEEN 91 AND 180 THEN '91-180 Days'
  WHEN aging_days BETWEEN 181 AND 365 THEN '181-365 Days'
  WHEN aging_days BETWEEN 366 AND 730 THEN 'Above 1 Year'
  WHEN aging_days BETWEEN 731 AND 1095 THEN 'Above 2 Years'
  WHEN aging_days BETWEEN 1096 AND 1460 THEN 'Above 3 Years'
  WHEN aging_days BETWEEN 1461 AND 1825 THEN 'Above 4 Years'
  ELSE 'Above 5 Years'
END`;

const BUCKET_SUMS = `
  SUM(CASE WHEN aging_days BETWEEN 0 AND 30   THEN total_value ELSE 0 END) AS b_0_30,
  SUM(CASE WHEN aging_days BETWEEN 31 AND 60  THEN total_value ELSE 0 END) AS b_31_60,
  SUM(CASE WHEN aging_days BETWEEN 61 AND 90  THEN total_value ELSE 0 END) AS b_61_90,
  SUM(CASE WHEN aging_days BETWEEN 91 AND 180 THEN total_value ELSE 0 END) AS b_91_180,
  SUM(CASE WHEN aging_days BETWEEN 181 AND 365 THEN total_value ELSE 0 END) AS b_181_365,
  SUM(CASE WHEN aging_days BETWEEN 366 AND 730 THEN total_value ELSE 0 END) AS b_1yr,
  SUM(CASE WHEN aging_days BETWEEN 731 AND 1095 THEN total_value ELSE 0 END) AS b_2yr,
  SUM(CASE WHEN aging_days BETWEEN 1096 AND 1460 THEN total_value ELSE 0 END) AS b_3yr,
  SUM(CASE WHEN aging_days BETWEEN 1461 AND 1825 THEN total_value ELSE 0 END) AS b_4yr,
  SUM(CASE WHEN aging_days > 1825 THEN total_value ELSE 0 END) AS b_5yr
`;

function buildInventoryWhere(q) {
  const conds = [];
  const binds = [];

  const products   = parseArr(q.products);
  const locations  = parseArr(q.locations);
  const materials  = parseArr(q.materials);
  const dates      = parseArr(q.dates);
  const days       = parseArr(q.days);
  const years      = parseArr(q.years).map(Number).filter(Boolean);
  const months     = parseArr(q.months).map(Number).filter(Boolean);

  if (products.length)  { conds.push(`product_type IN (${products.map(()=>'?').join()})`);  binds.push(...products); }
  if (locations.length) { conds.push(`storage_location IN (${locations.map(()=>'?').join()})`); binds.push(...locations); }
  if (materials.length) { conds.push(`material IN (${materials.map(()=>'?').join()})`);     binds.push(...materials); }
  if (years.length)     { conds.push(`gr_year IN (${years.map(()=>'?').join()})`);           binds.push(...years); }
  if (months.length)    { conds.push(`gr_month IN (${months.map(()=>'?').join()})`);         binds.push(...months); }
  if (dates.length) {
    conds.push(`DATE(gr_date) IN (${dates.map(() => '?').join(',')})`);
    binds.push(...dates);
  }
  if (days.length) {
    const dConds = days.map((d) => {
      switch (d) {
        case '0-30':     return 'aging_days BETWEEN 0 AND 30';
        case '31-60':    return 'aging_days BETWEEN 31 AND 60';
        case '61-90':    return 'aging_days BETWEEN 61 AND 90';
        case '91-180':   return 'aging_days BETWEEN 91 AND 180';
        case '181-365':  return 'aging_days BETWEEN 181 AND 365';
        case '366-730':  return 'aging_days BETWEEN 366 AND 730';
        case '731-1095': return 'aging_days BETWEEN 731 AND 1095';
        case '1096-1460':return 'aging_days BETWEEN 1096 AND 1460';
        case '1461-1825':return 'aging_days BETWEEN 1461 AND 1825';
        case '>1825':    return 'aging_days > 1825';
        default: return '1=1';
      }
    });
    conds.push(`(${dConds.join(' OR ')})`);
  }

  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', binds };
}

function notAvailable(res) {
  return res.status(503).json({ error: 'MySQL not available. Please configure and connect MySQL.' });
}

// ─── Storage Ageing ──────────────────────────────────────────────────────────
router.get('/storage-ageing', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const { where, binds } = buildInventoryWhere(req.query);

    const [matrix] = await pool.execute(`
      SELECT storage_location, product_type,
        ${BUCKET_SUMS},
        SUM(total_value) AS total_value,
        COUNT(*) AS item_count,
        ROUND(AVG(aging_days)) AS avg_age
      FROM inventory_items ${where}
      GROUP BY storage_location, product_type
      ORDER BY storage_location, product_type
    `, binds);

    const [[kpis]] = await pool.execute(`
      SELECT
        COUNT(*)  AS total_items,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(AVG(aging_days))    AS avg_age,
        ROUND(SUM(CASE WHEN aging_days > 180 THEN total_value ELSE 0 END),2) AS dead_stock_value,
        ROUND(SUM(CASE WHEN aging_days BETWEEN 91 AND 180 THEN total_value ELSE 0 END),2) AS slow_moving_value,
        COUNT(DISTINCT storage_location) AS location_count,
        COUNT(DISTINCT product_type)     AS product_count,
        COUNT(DISTINCT material)         AS material_count
      FROM inventory_items ${where}
    `, binds);

    const [byProduct] = await pool.execute(`
      SELECT COALESCE(product_type,'UNASSIGNED') AS product_type,
        ROUND(SUM(total_value),2) AS total_value, COUNT(*) AS cnt
      FROM inventory_items ${where}
      GROUP BY product_type ORDER BY total_value DESC
    `, binds);

    const [byBucket] = await pool.execute(`
      SELECT ${AGE_CASE} AS bucket,
        COUNT(*) AS cnt, ROUND(SUM(total_value),2) AS total_value
      FROM inventory_items ${where}
      GROUP BY bucket ORDER BY MIN(aging_days)
    `, binds);

    res.json({ matrix, kpis, byProduct, byBucket });
  } catch (err) {
    console.error('[db/storage-ageing]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Product Ageing ──────────────────────────────────────────────────────────
router.get('/product-ageing', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const { where, binds } = buildInventoryWhere(req.query);

    const [rows] = await pool.execute(`
      SELECT COALESCE(NULLIF(product_type,''),'UNASSIGNED PRODUCT') AS product_type,
        ${BUCKET_SUMS},
        ROUND(SUM(total_value),2) AS total_value,
        COUNT(DISTINCT material) AS material_count,
        COUNT(*) AS item_count,
        ROUND(AVG(aging_days)) AS avg_age
      FROM inventory_items ${where}
      GROUP BY product_type ORDER BY total_value DESC
    `, binds);

    const [[totals]] = await pool.execute(`
      SELECT ROUND(SUM(total_value),2) AS grand_total FROM inventory_items ${where}
    `, binds);

    res.json({ data: rows, grandTotal: totals?.grand_total || 0 });
  } catch (err) {
    console.error('[db/product-ageing]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Closing Inventory ───────────────────────────────────────────────────────
router.get('/closing-inventory', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const conds = [];
    const binds = [];
    const years  = parseArr(req.query.years).map(Number).filter(Boolean);
    const months = parseArr(req.query.months).map(Number).filter(Boolean);
    const mats   = parseArr(req.query.materials);
    if (years.length)  { conds.push(`period_year IN (${years.map(()=>'?').join()})`);  binds.push(...years); }
    if (months.length) { conds.push(`period_month IN (${months.map(()=>'?').join()})`); binds.push(...months); }
    if (mats.length)   { conds.push(`material IN (${mats.map(()=>'?').join()})`);       binds.push(...mats); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [periods] = await pool.execute(`
      SELECT period_name, period_month, period_year,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(SUM(total_stock),3) AS total_stock,
        COUNT(DISTINCT material) AS material_count
      FROM closing_inventory ${where}
      GROUP BY period_name, period_month, period_year
      ORDER BY period_year, period_month
    `, binds);

    const [byType] = await pool.execute(`
      SELECT item_type, ROUND(SUM(total_value),2) AS total_value, COUNT(DISTINCT material) AS cnt
      FROM closing_inventory ${where}
      GROUP BY item_type ORDER BY total_value DESC
    `, binds);

    res.json({ periods, byType });
  } catch (err) {
    console.error('[db/closing-inventory]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GIT Report ──────────────────────────────────────────────────────────────
router.get('/git', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();

    const [[kpis]] = await pool.execute(`
      SELECT COUNT(*) AS item_count,
        ROUND(SUM(value_inr),2) AS total_value,
        COUNT(DISTINCT vendor_code) AS vendor_count,
        SUM(CASE WHEN aging_days > 90 THEN 1 ELSE 0 END) AS critical_count,
        ROUND(AVG(aging_days)) AS avg_age
      FROM git_items
    `);

    const [byBucket] = await pool.execute(`
      SELECT CASE
        WHEN aging_days BETWEEN 0 AND 30   THEN '0-30 Days'
        WHEN aging_days BETWEEN 31 AND 60  THEN '31-60 Days'
        WHEN aging_days BETWEEN 61 AND 90  THEN '61-90 Days'
        WHEN aging_days BETWEEN 91 AND 180 THEN '91-180 Days'
        WHEN aging_days BETWEEN 181 AND 365 THEN '181-365 Days'
        ELSE 'Above 1 Year'
      END AS bucket,
      COUNT(*) AS cnt,
      ROUND(SUM(value_inr),2) AS total_value
      FROM git_items GROUP BY bucket ORDER BY MIN(aging_days)
    `);

    const [byProduct] = await pool.execute(`
      SELECT product, ROUND(SUM(value_inr),2) AS total_value, COUNT(*) AS cnt
      FROM git_items WHERE product IS NOT NULL
      GROUP BY product ORDER BY total_value DESC
    `);

    const [byVendor] = await pool.execute(`
      SELECT vendor_code, ROUND(SUM(value_inr),2) AS total_value, COUNT(*) AS cnt
      FROM git_items GROUP BY vendor_code ORDER BY total_value DESC LIMIT 15
    `);

    res.json({ kpis, byBucket, byProduct, byVendor });
  } catch (err) {
    console.error('[db/git]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const { where, binds } = buildInventoryWhere(req.query);

    const [[ageing]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_items,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(AVG(aging_days)) AS avg_age,
        ROUND(SUM(CASE WHEN aging_days > 180 THEN total_value ELSE 0 END),2) AS dead_stock_value,
        COUNT(DISTINCT material) AS material_count,
        COUNT(DISTINCT storage_location) AS location_count
      FROM inventory_items ${where}
    `, binds);

    const [byProduct] = await pool.execute(`
      SELECT COALESCE(NULLIF(product_type,''),'UNASSIGNED') AS product_type,
        ROUND(SUM(total_value),2) AS total_value, COUNT(*) AS cnt
      FROM inventory_items ${where} GROUP BY product_type ORDER BY total_value DESC
    `, binds);

    const [byLocation] = await pool.execute(`
      SELECT storage_location,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(AVG(aging_days)) AS avg_age
      FROM inventory_items ${where}
      GROUP BY storage_location ORDER BY total_value DESC LIMIT 20
    `, binds);

    const [byBucket] = await pool.execute(`
      SELECT ${AGE_CASE} AS bucket,
        COUNT(*) AS cnt,
        ROUND(SUM(total_value),2) AS total_value
      FROM inventory_items ${where}
      GROUP BY bucket ORDER BY MIN(aging_days)
    `, binds);

    const [topMaterials] = await pool.execute(`
      SELECT material, material_desc, product_type,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(AVG(aging_days)) AS avg_age
      FROM inventory_items ${where}
      GROUP BY material, material_desc, product_type
      ORDER BY total_value DESC LIMIT 20
    `, binds);

    res.json({ ageing, byProduct, byLocation, byBucket, topMaterials });
  } catch (err) {
    console.error('[db/dashboard]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Raw inventory (paginated) ───────────────────────────────────────────────
router.get('/inventory', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const { where, binds } = buildInventoryWhere(req.query);
    const page     = Math.max(1, parseInt(req.query.page || '1'));
    const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize || '50')));
    const offset   = (page - 1) * pageSize;

    const [rows] = await pool.execute(
      `SELECT material, material_desc, product_type, storage_location, plant,
              quantity, total_value, aging_days, gr_date,
              ${AGE_CASE} AS age_bucket
       FROM inventory_items ${where}
       ORDER BY total_value DESC LIMIT ? OFFSET ?`,
      [...binds, pageSize, offset]
    );

    const [[meta]] = await pool.execute(
      `SELECT COUNT(*) AS cnt, ROUND(SUM(total_value),2) AS total_value FROM inventory_items ${where}`,
      binds
    );

    res.json({
      data: rows,
      total: meta.cnt,
      totalValue: meta.total_value,
      page,
      pageSize,
      pages: Math.ceil(meta.cnt / pageSize),
    });
  } catch (err) {
    console.error('[db/inventory]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Monthly trend ────────────────────────────────────────────────────────────
router.get('/monthly-trend', async (req, res) => {
  if (!isAvailable()) return notAvailable(res);
  try {
    const pool = getPool();
    const { where, binds } = buildInventoryWhere(req.query);

    const [rows] = await pool.execute(`
      SELECT gr_year AS yr, gr_month AS mo,
        ROUND(SUM(total_value),2) AS total_value,
        ROUND(SUM(quantity),0) AS total_qty,
        COUNT(*) AS cnt
      FROM inventory_items
      ${where ? where + ' AND gr_year IS NOT NULL' : 'WHERE gr_year IS NOT NULL'}
      GROUP BY gr_year, gr_month ORDER BY gr_year, gr_month
    `, binds);

    res.json({ data: rows });
  } catch (err) {
    console.error('[db/monthly-trend]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
