/**
 * routes/export.js
 * Export route — supports GET (and POST for backward compat).
 *
 * GET /api/export?module=complete&format=xlsx&years=["2026"]&months=["5"]...
 * GET /api/export?module=storage-ageing&format=xlsx
 * GET /api/export?module=dashboard&format=xlsx
 * GET /api/export?format=pdf   → returns JSON payload for client-side PDF
 *
 * FIX: Was POST-only; frontend called GET → caused 404.
 *      Now handles GET (primary) + POST (backward-compat).
 */
const express = require('express');
const router = express.Router();

const {
  buildCompleteWorkbook,
  buildSingleWorkbook,
  exportFilename,
} = require('../lib/exportService');

const { isAvailable, getPool } = require('../db/connection');

// ─── Parse query params ───────────────────────────────────────────────────────
function parseArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter(Boolean) : []; }
  catch { return v.split(',').map((s) => s.trim()).filter(Boolean); }
}

function extractFilters(query) {
  return {
    years:     parseArr(query.years),
    months:    parseArr(query.months),
    products:  parseArr(query.products),
    locations: parseArr(query.locations),
    materials: parseArr(query.materials),
    days:      parseArr(query.days),
    dates:     parseArr(query.dates),
  };
}

// ─── Build WHERE clause for inventory_items ───────────────────────────────────
function buildWhere(filters) {
  const conds = [];
  const binds = [];

  const { years, months, products, locations, materials, days, dates } = filters;

  if (products.length)   { conds.push(`product_type IN (${products.map(() => '?').join()})`);  binds.push(...products); }
  if (locations.length)  { conds.push(`storage_location IN (${locations.map(() => '?').join()})`); binds.push(...locations); }
  if (materials.length)  { conds.push(`material IN (${materials.map(() => '?').join()})`);     binds.push(...materials); }
  if (years.length)      { conds.push(`gr_year IN (${years.map(() => '?').join()})`);          binds.push(...years.map(Number)); }
  if (months.length)     { conds.push(`gr_month IN (${months.map(() => '?').join()})`);        binds.push(...months.map(Number)); }
  if (dates.length)      { conds.push(`DATE(gr_date) IN (${dates.map(() => '?').join(',')})`); binds.push(...dates); }

  // Days filter uses proper bucket labels (0-30 Days, 31-60 Days, etc.)
  if (days.length) {
    const dConds = days.map((d) => {
      switch (d) {
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
        // Legacy short-form support
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

  return {
    where: conds.length ? `WHERE ${conds.join(' AND ')}` : '',
    binds,
  };
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

// ─── MySQL data fetchers ──────────────────────────────────────────────────────

async function fetchDashboardData(pool, filters) {
  const { where, binds } = buildWhere(filters);

  const [[ageing]] = await pool.execute(`
    SELECT COUNT(*) AS total_items, ROUND(SUM(total_value),2) AS total_value,
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
    SELECT storage_location, ROUND(SUM(total_value),2) AS total_value,
      ROUND(AVG(aging_days)) AS avg_age
    FROM inventory_items ${where} GROUP BY storage_location ORDER BY total_value DESC LIMIT 20
  `, binds);

  const [byBucket] = await pool.execute(`
    SELECT ${AGE_CASE} AS bucket, COUNT(*) AS cnt, ROUND(SUM(total_value),2) AS total_value
    FROM inventory_items ${where} GROUP BY bucket ORDER BY MIN(aging_days)
  `, binds);

  return { ageing, byProduct, byLocation, byBucket };
}

async function fetchAgeingData(pool, filters) {
  const { where, binds } = buildWhere(filters);

  const [matrix] = await pool.execute(`
    SELECT storage_location, product_type, ${BUCKET_SUMS},
      SUM(total_value) AS total_value, COUNT(*) AS item_count, ROUND(AVG(aging_days)) AS avg_age
    FROM inventory_items ${where}
    GROUP BY storage_location, product_type ORDER BY storage_location, product_type
  `, binds);

  const [[kpis]] = await pool.execute(`
    SELECT COUNT(*) AS total_items, ROUND(SUM(total_value),2) AS total_value,
      ROUND(AVG(aging_days)) AS avg_age,
      ROUND(SUM(CASE WHEN aging_days > 180 THEN total_value ELSE 0 END),2) AS dead_stock_value,
      ROUND(SUM(CASE WHEN aging_days BETWEEN 91 AND 180 THEN total_value ELSE 0 END),2) AS slow_moving_value,
      COUNT(DISTINCT storage_location) AS location_count,
      COUNT(DISTINCT product_type) AS product_count,
      COUNT(DISTINCT material) AS material_count
    FROM inventory_items ${where}
  `, binds);

  const [byProduct] = await pool.execute(`
    SELECT COALESCE(product_type,'UNASSIGNED') AS product_type,
      ROUND(SUM(total_value),2) AS total_value, COUNT(*) AS cnt
    FROM inventory_items ${where} GROUP BY product_type ORDER BY total_value DESC
  `, binds);

  const [byBucket] = await pool.execute(`
    SELECT ${AGE_CASE} AS bucket, COUNT(*) AS cnt, ROUND(SUM(total_value),2) AS total_value
    FROM inventory_items ${where} GROUP BY bucket ORDER BY MIN(aging_days)
  `, binds);

  return { kpis, matrix, byProduct, byBucket };
}

async function fetchProductData(pool, filters) {
  const { where, binds } = buildWhere(filters);

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

  const [[totals]] = await pool.execute(
    `SELECT ROUND(SUM(total_value),2) AS grand_total FROM inventory_items ${where}`,
    binds
  );

  return { data: rows, grandTotal: totals?.grand_total || 0 };
}

async function fetchClosingData(pool, filters) {
  const conds = [];
  const binds = [];
  if (filters.years.length)  { conds.push(`period_year IN (${filters.years.map(() => '?').join()})`);  binds.push(...filters.years.map(Number)); }
  if (filters.months.length) { conds.push(`period_month IN (${filters.months.map(() => '?').join()})`); binds.push(...filters.months.map(Number)); }
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
    FROM closing_inventory ${where} GROUP BY item_type ORDER BY total_value DESC
  `, binds);

  return { periods, byType };
}

async function fetchGitData(pool) {
  const [[kpis]] = await pool.execute(`
    SELECT COUNT(*) AS item_count, ROUND(SUM(value_inr),2) AS total_value,
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
    COUNT(*) AS cnt, ROUND(SUM(value_inr),2) AS total_value
    FROM git_items GROUP BY bucket ORDER BY MIN(aging_days)
  `);

  const [byProduct] = await pool.execute(`
    SELECT product, ROUND(SUM(value_inr),2) AS total_value, COUNT(*) AS cnt
    FROM git_items WHERE product IS NOT NULL GROUP BY product ORDER BY total_value DESC
  `);

  const [byVendor] = await pool.execute(`
    SELECT vendor_code, ROUND(SUM(value_inr),2) AS total_value, COUNT(*) AS cnt
    FROM git_items GROUP BY vendor_code ORDER BY total_value DESC LIMIT 15
  `);

  return { kpis, byBucket, byProduct, byVendor };
}

async function fetchTrendData(pool, filters) {
  const { where, binds } = buildWhere(filters);
  const [rows] = await pool.execute(`
    SELECT gr_year AS yr, gr_month AS mo,
      ROUND(SUM(total_value),2) AS total_value,
      ROUND(SUM(quantity),0) AS total_qty,
      COUNT(*) AS cnt
    FROM inventory_items
    ${where ? where + ' AND gr_year IS NOT NULL' : 'WHERE gr_year IS NOT NULL'}
    GROUP BY gr_year, gr_month ORDER BY gr_year, gr_month
  `, binds);
  return { data: rows };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handleExport(req, res) {
  try {
    const params = { ...req.query, ...req.body };
    const { module = 'complete', format = 'xlsx' } = params;
    const filters = extractFilters(params);

    if (!['xlsx', 'pdf-data', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'format must be xlsx, pdf-data, or csv' });
    }

    // ── PDF data payload (client renders the PDF) ──
    if (format === 'pdf-data') {
      if (!isAvailable()) {
        return res.status(503).json({ error: 'MySQL not connected — cannot generate PDF data.' });
      }
      const pool = getPool();
      const [dashboardData, ageingData, productData, closingData, gitData, trendData] = await Promise.all([
        fetchDashboardData(pool, filters),
        fetchAgeingData(pool, filters),
        fetchProductData(pool, filters),
        fetchClosingData(pool, filters),
        fetchGitData(pool),
        fetchTrendData(pool, filters),
      ]);
      return res.json({ dashboardData, ageingData, productData, closingData, gitData, trendData, filters });
    }

    // ── Excel export ──
    if (format === 'xlsx') {
      let wb;

      if (isAvailable()) {
        // MySQL available — use live data
        const pool = getPool();

        if (module === 'complete') {
          const [dashboardData, ageingData, productData, closingData, gitData, trendData] = await Promise.all([
            fetchDashboardData(pool, filters),
            fetchAgeingData(pool, filters),
            fetchProductData(pool, filters),
            fetchClosingData(pool, filters),
            fetchGitData(pool),
            fetchTrendData(pool, filters),
          ]);
          wb = await buildCompleteWorkbook({ dashboardData, ageingData, productData, closingData, gitData, trendData }, filters);
        } else {
          // Single module
          let data;
          switch (module) {
            case 'dashboard':          data = await fetchDashboardData(pool, filters);  break;
            case 'closing-inventory':  data = await fetchClosingData(pool, filters);    break;
            case 'storage-ageing':     data = await fetchAgeingData(pool, filters);     break;
            case 'product-ageing':     data = await fetchProductData(pool, filters);    break;
            case 'git':                data = await fetchGitData(pool);                 break;
            default:
              return res.status(400).json({ error: `Unknown module: ${module}` });
          }
          wb = await buildSingleWorkbook(module, data, filters);
        }
      } else {
        // No MySQL — build empty workbook with notice
        const ExcelJS = require('exceljs');
        wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Notice');
        ws.getCell('A1').value = 'MySQL not connected. Please configure .env and restart backend.';
        ws.getCell('A1').font = { bold: true, color: { argb: 'FFFF0000' } };
        ws.getColumn(1).width = 60;
      }

      const buffer = await wb.xlsx.writeBuffer();
      const prefix = module === 'complete' ? 'Complete_Report' : module.replace(/-/g, '_');
      const filename = exportFilename(prefix, 'xlsx');

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-cache',
      });
      return res.send(Buffer.from(buffer));
    }

    // ── CSV (simple fallback) ──
    if (format === 'csv') {
      return res.status(400).json({ error: 'For CSV, use module-specific routes. Use format=xlsx for full export.' });
    }

    return res.status(400).json({ error: 'Unsupported format' });

  } catch (error) {
    console.error('[export] Error:', error);
    res.status(500).json({ error: 'Export failed: ' + error.message });
  }
}

// Register both GET and POST (GET is primary, POST for backward compat)
router.get('/', handleExport);
router.post('/', handleExport);

module.exports = router;
