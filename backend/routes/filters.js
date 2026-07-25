const express = require('express');
const router = express.Router();
const { getPool, isAvailable } = require('../db/connection');

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const AGE_BUCKETS = [
  '0-30 Days','31-60 Days','61-90 Days','91-180 Days','181-365 Days',
  'Above 1 Year','Above 2 Years','Above 3 Years','Above 4 Years','Above 5 Years',
];

// GET /api/filters
router.get('/', async (req, res) => {
  if (!isAvailable()) {
    return res.json({
      products: [], locations: [], materials: [],
      years: [], months: [], ageBuckets: AGE_BUCKETS, periods: [],
      mysqlAvailable: false,
    });
  }
  try {
    const pool = getPool();
    const [[products], [locations], [materials], [years], [months], [periods], [dates],
           [reportYears], [reportMonths], [reportDates]] = await Promise.all([
      pool.execute(
        'SELECT DISTINCT product_type FROM inventory_items WHERE product_type IS NOT NULL AND product_type != "" ORDER BY product_type'
      ),
      pool.execute(
        'SELECT DISTINCT storage_location FROM inventory_items WHERE storage_location IS NOT NULL ORDER BY storage_location'
      ),
      pool.execute(
        'SELECT DISTINCT material, material_desc FROM inventory_items WHERE material IS NOT NULL ORDER BY material LIMIT 3000'
      ),
      pool.execute(
        'SELECT DISTINCT gr_year as yr FROM inventory_items WHERE gr_year IS NOT NULL ORDER BY gr_year'
      ),
      pool.execute(
        'SELECT DISTINCT gr_month as mo FROM inventory_items WHERE gr_month IS NOT NULL ORDER BY gr_month'
      ),
      pool.execute(
        'SELECT DISTINCT period_name, period_month, period_year FROM closing_inventory ORDER BY period_year, period_month'
      ),
      pool.execute(
        'SELECT d FROM (SELECT DISTINCT DATE_FORMAT(gr_date, "%Y-%m-%d") AS d FROM inventory_items WHERE gr_date IS NOT NULL) t ORDER BY d DESC LIMIT 500'
      ),
      pool.execute(
        'SELECT DISTINCT report_year AS yr FROM inventory_items WHERE report_year > 0 ORDER BY report_year DESC'
      ),
      pool.execute(
        'SELECT DISTINCT report_month AS mo FROM inventory_items WHERE report_month > 0 ORDER BY report_month'
      ),
      pool.execute(
        'SELECT DISTINCT DATE_FORMAT(report_date, "%Y-%m-%d") AS d FROM inventory_items WHERE report_date IS NOT NULL ORDER BY d DESC LIMIT 100'
      ),
    ]);

    res.json({
      mysqlAvailable: true,
      products: products.map((r) => r.product_type),
      locations: locations.map((r) => r.storage_location),
      materials: materials.map((r) => ({ material: r.material, desc: r.material_desc || '' })),
      years: years.map((r) => r.yr).filter(Boolean),
      months: months
        .map((r) => ({ index: r.mo, name: MONTH_NAMES[(r.mo || 1) - 1] || '' }))
        .filter((m) => m.name),
      periods: periods.map((r) => r.period_name),
      dates: dates.map((r) => r.d).filter(Boolean),
      reportYears: reportYears.map((r) => r.yr).filter(Boolean),
      reportMonths: reportMonths
        .map((r) => ({ index: r.mo, name: MONTH_NAMES[(r.mo || 1) - 1] || '' }))
        .filter((m) => m.name),
      reportDates: reportDates.map((r) => r.d).filter(Boolean),
    });
  } catch (err) {
    console.error('[filters]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
