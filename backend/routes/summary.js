const express = require('express');
const router = express.Router();

const {
  getClosingInventory,
  getInventoryAgeing,
  getImportGIT,
  getAvailablePeriods,
  getLatestPeriod,
  sortPeriods,
} = require('../../database/index');
const {
  calculateInventoryValue,
  calculateStockQuantity,
  calculateUniqueMaterials,
  calculateDeadStock,
  calculateDeadStockCount,
  calculateSlowMovingValue,
  calculateImportValue,
  calculateImportCYValue,
  calculateInventoryByType,
  calculateAgeing,
  calculateTopMaterials,
  calculateAverageInventoryAge,
  calculateStorageLocationAgeing,
  calculateStorageLocationAgeingDetailed,
  calculateProductAgeing,
  calculateMonthlyGrTrend,
  calculateOldestMaterials,
  calculateGitSupplierPending,
  calculateGitMaterialPending,
  calculateMonthlyInvoiceTrend,
  calculateGitAgeing,
  calculateCriticalGitInvoices,
  calculatePeriodSummaries,
  itemValue,
  debugAgeingRow,
  calculateStorageAgeingMatrix,
  calculateGrTrendMatrix,
} = require('../lib/calculations');

const { isAvailable, ensureAvailable, getPool } = require('../db/connection');

// ─── MySQL → Excel format mappers ────────────────────────────────────────────
// These convert MySQL rows to the exact property names the calculation engine
// expects, so the SAME functions process both Excel and MySQL data.

function mysqlToAgeingItem(row) {
  return {
    plant: row.plant,
    storageLocation: row.storage_location,
    material: row.material,
    materialDescription: row.material_desc,
    productType: row.product_type,
    batch: row.batch,
    unrestricted: Number(row.quantity) || 0,
    valueUnrestricted: Number(row.value_unrestricted) || 0,
    valInTransfer: Number(row.value_transit) || 0,
    valueQualInsp: Number(row.value_qual_insp) || 0,
    valueRestricted: Number(row.value_restricted) || 0,
    valueBlocked: Number(row.value_blocked) || 0,
    totalValue: Number(row.total_value) || 0,
    aaAgingDays: Number(row.aging_days) || 0,
    grIssueDate: row.gr_date ? new Date(row.gr_date).getTime() : 0,
  };
}

function mysqlToClosingPeriods(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.period_name;
    if (!map.has(key)) map.set(key, { period: key, items: [] });
    map.get(key).items.push({
      material: row.material,
      description: row.material_desc,
      type: row.item_type,
      totalValue: Number(row.total_value) || 0,
      totalStock: Number(row.total_stock) || 0,
    });
  }
  return Array.from(map.values());
}

function mysqlToGitItem(row) {
  return {
    invoiceNumber: row.invoice_no,
    invoiceDate: row.invoice_date ? new Date(row.invoice_date).getTime() : 0,
    material: row.material,
    materialDescription: row.material_desc,
    vendorCode: row.vendor_code,
    product: row.product,
    qty: Number(row.quantity) || 0,
    value: Number(row.value_inr) || 0,
    cyValue: Number(row.cy_value) || 0,
    currency: row.currency,
  };
}

// ─── MySQL data source helpers ────────────────────────────────────────────────

async function db(pool, sql, binds = []) {
  if (!binds || binds.length === 0) {
    const [rows] = await pool.query(sql);
    return rows;
  }
  const [rows] = await pool.execute(sql, binds);
  return rows;
}

async function getLatestReportDate(pool, table) {
  const rows = await db(pool, `SELECT MAX(report_date) AS d FROM ${table} WHERE report_date IS NOT NULL`);
  return rows[0]?.d || null;
}

function buildPeriodWhere(table, reportYear, reportMonth, reportDates) {
  const conds = [];
  const binds = [];
  const prefix = table ? `${table}.` : '';

  if (reportYear) {
    conds.push(`${prefix}report_year = ?`);
    binds.push(reportYear);
  }
  if (reportMonth) {
    conds.push(`${prefix}report_month = ?`);
    binds.push(reportMonth);
  }
  if (reportDates && reportDates.length > 0) {
    conds.push(`${prefix}report_date IN (${reportDates.map(() => '?').join(',')})`);
    binds.push(...reportDates);
  }

  return { conds, binds };
}

async function fetchMySQLAgeingItems(pool, reportYear, reportMonth, reportDates) {
  const { conds, binds } = buildPeriodWhere(null, reportYear, reportMonth, reportDates);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db(pool, `SELECT * FROM inventory_items ${where} ORDER BY id`, binds);
  return rows.map(mysqlToAgeingItem);
}

async function fetchMySQLClosingPeriods(pool, reportYear, reportMonth, reportDates) {
  const { conds, binds } = buildPeriodWhere(null, reportYear, reportMonth, reportDates);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db(pool, `SELECT * FROM closing_inventory ${where} ORDER BY period_year, period_month`, binds);
  return mysqlToClosingPeriods(rows);
}

async function fetchMySQLGitItems(pool, reportYear, reportMonth, reportDates) {
  const { conds, binds } = buildPeriodWhere(null, reportYear, reportMonth, reportDates);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await db(pool, `SELECT * FROM git_items ${where} ORDER BY id`, binds);
  return rows.map(mysqlToGitItem);
}

async function fetchAvailablePeriods(pool) {
  const rows = await db(pool,
    `SELECT DISTINCT report_year AS yr, report_month AS mo, report_date AS d
     FROM inventory_items WHERE report_year > 0 ORDER BY report_year DESC, report_month DESC, report_date DESC`
  );
  return rows;
}

// --- AI Insight Generator ---

function generateAIInsights(input) {
  const insights = [];
  let id = 1;

  if (input.periodSummaries.length >= 2) {
    const latest = input.periodSummaries[input.periodSummaries.length - 1];
    if (latest.momValueChange > 0) {
      insights.push({
        id: String(id++),
        title: 'Inventory Value Increased',
        description: `Inventory value increased by ${Math.abs(latest.momValueChange).toFixed(1)}% compared to the previous month (${latest.period}).`,
        severity: 'info',
        category: 'trend',
        metric: 'MoM Change',
        value: `+${latest.momValueChange.toFixed(1)}%`,
      });
    } else if (latest.momValueChange < -5) {
      insights.push({
        id: String(id++),
        title: 'Significant Inventory Value Drop',
        description: `Inventory value decreased by ${Math.abs(latest.momValueChange).toFixed(1)}% compared to the previous month.`,
        severity: 'warning',
        category: 'trend',
        metric: 'MoM Change',
        value: `${latest.momValueChange.toFixed(1)}%`,
      });
    }
  }

  if (input.deadStockValue > 0) {
    const deadStockPct = (input.deadStockValue / input.totalValue) * 100;
    insights.push({
      id: String(id++),
      title: 'Dead Stock Alert',
      description: `${input.deadStockCount} materials worth ₹${(input.deadStockValue / 10000000).toFixed(2)} Cr are classified as dead stock (>180 days). This represents ${deadStockPct.toFixed(1)}% of total inventory value.`,
      severity: deadStockPct > 5 ? 'critical' : 'warning',
      category: 'risk',
      metric: 'Dead Stock Value',
      value: `₹${(input.deadStockValue / 10000000).toFixed(2)} Cr`,
    });
  }

  if (input.slowMovingValue > 0) {
    insights.push({
      id: String(id++),
      title: 'Slow Moving Inventory',
      description: `Inventory worth ₹${(input.slowMovingValue / 10000000).toFixed(2)} Cr is slow-moving (90-180 days). Consider reducing procurement for these materials.`,
      severity: 'warning',
      category: 'recommendation',
      metric: 'Slow Moving Value',
      value: `₹${(input.slowMovingValue / 10000000).toFixed(2)} Cr`,
    });
  }

  if (input.avgInventoryAge > 60) {
    insights.push({
      id: String(id++),
      title: 'High Average Inventory Age',
      description: `Average inventory age is ${input.avgInventoryAge} days. Consider implementing inventory optimization strategies to improve turnover.`,
      severity: input.avgInventoryAge > 120 ? 'critical' : 'warning',
      category: 'risk',
      metric: 'Avg Age',
      value: `${input.avgInventoryAge} days`,
    });
  }

  if (input.criticalGitCount > 0) {
    insights.push({
      id: String(id++),
      title: 'Critical GIT Invoices',
      description: `${input.criticalGitCount} GIT invoice(s) are older than 90 days. Recommend clearing pending GIT invoices to avoid financial discrepancies.`,
      severity: 'critical',
      category: 'risk',
      metric: 'Critical Invoices',
      value: String(input.criticalGitCount),
    });
  }

  if (input.storageLocationAgeing.length > 0) {
    const highestAging = input.storageLocationAgeing.reduce((max, loc) =>
      loc.avgAge > max.avgAge ? loc : max
    );
    if (highestAging.avgAge > 60) {
      insights.push({
        id: String(id++),
        title: 'Storage Location with Highest Ageing',
        description: `Storage Location ${highestAging.storageLocation} has the highest average inventory age of ${highestAging.avgAge} days with ₹${(highestAging.totalValue / 100000).toFixed(1)}L value.`,
        severity: 'info',
        category: 'recommendation',
        metric: 'Storage Location',
        value: highestAging.storageLocation,
      });
    }
  }

  if (input.inventoryByType.length > 0) {
    const highest = input.inventoryByType.reduce((max, t) =>
      t.totalValue > max.totalValue ? t : max
    );
    insights.push({
      id: String(id++),
      title: 'Dominant Inventory Type',
      description: `Closing Inventory Type "${highest.type}" contributes ${highest.percentage.toFixed(1)}% of total inventory value.`,
      severity: 'info',
      category: 'trend',
      metric: 'Top Type',
      value: highest.type,
    });
  }

  if (input.deadStockValue + input.slowMovingValue > 0) {
    const savingPotential = input.deadStockValue + input.slowMovingValue;
    insights.push({
      id: String(id++),
      title: 'Cost Saving Opportunity',
      description: `Potential savings of ₹${(savingPotential / 10000000).toFixed(2)} Cr by optimizing dead stock and slow-moving inventory through liquidation, write-off, or procurement reduction.`,
      severity: 'info',
      category: 'opportunity',
      metric: 'Savings Potential',
      value: `₹${(savingPotential / 10000000).toFixed(2)} Cr`,
    });
  }

  return insights;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parsePeriod(periodName) {
  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const cleaned = periodName.replace(/['']/g, ' ').trim();
  const match = cleaned.match(/^(\w+)\s+(\d{2,4})$/i);
  if (!match) return null;
  const monthStr = match[1].toLowerCase().substring(0, 3);
  let year = parseInt(match[2], 10);
  if (year < 100) year += 2000;
  const monthIdx = monthMap[monthStr];
  if (monthIdx === undefined) return null;
  return { year, month: monthIdx };
}

router.get('/', async (req, res) => {
  try {
    const filterYear = req.query.year ? parseInt(req.query.year, 10) : null;
    const filterMonth = req.query.month !== undefined && req.query.month !== '' && req.query.month !== 'all'
      ? parseInt(req.query.month, 10)
      : null;

    let filterDates = [];
    if (req.query.dates) {
      try {
        filterDates = JSON.parse(req.query.dates).map(String);
      } catch (e) {
        if (typeof req.query.dates === 'string') {
          filterDates = req.query.dates.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    // ── Data source selection ──────────────────────────────────────────────
    // When MySQL is available and has data, use it as the data source
    // so that historical uploads are queryable. Otherwise fall back to Excel.
    let allPeriods, periods, allAgeingItems, gitItems;
    let useMysql = false;
    let availableReportPeriods = [];

    if (isAvailable()) {
      try {
        const pool = getPool();
        const cntRows = await db(pool, 'SELECT COUNT(*) AS cnt FROM inventory_items');
        const cnt = cntRows[0]?.cnt || 0;

        if (cnt > 0) {
          useMysql = true;

          // Build report_date strings from year+month+date filters
          let reportDates = [];
          if (filterYear && filterMonth && filterDates.length > 0) {
            for (const d of filterDates) {
              reportDates.push(`${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            }
          }

          // If no specific period filter, use latest report_date
          const hasFilter = filterYear || filterMonth || filterDates.length > 0;
          let reportYear = filterYear || null;
          let reportMonth = filterMonth || null;

          if (!hasFilter) {
            const latestDate = await getLatestReportDate(pool, 'inventory_items');
            if (latestDate) {
              const ld = new Date(latestDate);
              reportYear = ld.getFullYear();
              reportMonth = ld.getMonth() + 1;
              reportDates = [latestDate instanceof Date ? latestDate.toISOString().split('T')[0] : String(latestDate)];
            }
          }

          // Fetch historical data from MySQL
          [allAgeingItems, allPeriods, gitItems] = await Promise.all([
            fetchMySQLAgeingItems(pool, reportYear, reportMonth, reportDates.length ? reportDates : null),
            fetchMySQLClosingPeriods(pool, reportYear, reportMonth, reportDates.length ? reportDates : null),
            fetchMySQLGitItems(pool, reportYear, reportMonth, reportDates.length ? reportDates : null),
          ]);

          periods = allPeriods.map(p => p.period);
          availableReportPeriods = await fetchAvailablePeriods(pool);

          console.log(`[SUMMARY] MySQL source — ${allAgeingItems.length} ageing, ${periods.length} closing periods, ${gitItems.length} GIT items`);
        }
      } catch (err) {
        console.error('[SUMMARY] MySQL query failed, falling back to Excel:', err.message);
        useMysql = false;
      }
    }

    if (!useMysql) {
      // ── Excel fallback (original behavior) ────────────────────────────
      allPeriods = getClosingInventory();
      periods = sortPeriods(getAvailablePeriods());
      allAgeingItems = getInventoryAgeing();
      gitItems = getImportGIT();
    }

    // ── From here on, the ENTIRE calculation pipeline is UNCHANGED ─────
    // The only difference is where allPeriods, allAgeingItems, gitItems came from.

    const latestPeriodName = periods.length > 0 ? periods[periods.length - 1] : null;
    const latestPeriodData = latestPeriodName
      ? allPeriods.find((p) => p.period === latestPeriodName)
      : null;
    const latestItems = latestPeriodData?.items ?? [];

    const totalValue = calculateInventoryValue(latestItems);
    const totalStock = calculateStockQuantity(latestItems);
    const materialCount = calculateUniqueMaterials(latestItems);

    const topMaterialsByValue = calculateTopMaterials(latestItems, 10);
    const inventoryByType = calculateInventoryByType(latestItems);

    const periodData = periods.map((period) => {
      const pd = allPeriods.find((p) => p.period === period);
      return { period, items: pd?.items ?? [] };
    });
    const periodSummaries = calculatePeriodSummaries(periodData);

    // --- Derive available filters from closing inventory periods ---
    const availYears = new Set();
    const availMonthMap = new Map();
    const periodMeta = [];
    for (const pName of periods) {
      const parsed = parsePeriod(pName);
      if (parsed) {
        availYears.add(parsed.year);
        if (!availMonthMap.has(parsed.month)) {
          availMonthMap.set(parsed.month, MONTH_NAMES[parsed.month]);
        }
        periodMeta.push({ name: pName, year: parsed.year, month: parsed.month });
      }
    }

    // Find matching closing inventory periods for the selected filter
    let matchedPeriodMeta = periodMeta;
    if (!useMysql && (filterYear || filterMonth !== null)) {
      matchedPeriodMeta = periodMeta.filter((p) => {
        if (filterYear && p.year !== filterYear) return false;
        if (filterMonth !== null && p.month !== filterMonth) return false;
        return true;
      });
    }

    // Selected closing inventory period for KPI values
    const selectedPeriodName = matchedPeriodMeta.length > 0
      ? matchedPeriodMeta[matchedPeriodMeta.length - 1].name
      : latestPeriodName;
    const selectedPeriodData = allPeriods.find((p) => p.period === selectedPeriodName);
    const selectedPeriodItems = selectedPeriodData?.items ?? [];
    const closingInvValue = selectedPeriodItems.reduce((s, i) => s + i.totalValue, 0);
    const closingInvStock = selectedPeriodItems.reduce((s, i) => s + i.totalStock, 0);
    const closingInvMaterials = new Set(selectedPeriodItems.map((i) => i.material)).size;

    // --- Ageing ---
    let ageingItems = allAgeingItems;

    // Excel path: filter ageing by matched closing period materials
    if (!useMysql && (filterYear || filterMonth !== null)) {
      const matchedMaterials = new Set();
      for (const mp of matchedPeriodMeta) {
        const pd = allPeriods.find((p) => p.period === mp.name);
        if (pd) {
          for (const item of pd.items) {
            if (item.material) matchedMaterials.add(item.material);
          }
        }
      }
      if (matchedMaterials.size > 0) {
        ageingItems = allAgeingItems.filter((item) => matchedMaterials.has(item.material));
      }
    }

    if (!useMysql && filterDates.length > 0) {
      ageingItems = ageingItems.filter((item) => {
        if (!item.grIssueDate) return false;
        const d = new Date(item.grIssueDate);
        return filterDates.includes(String(d.getDate()));
      });
    }

    // Debug validation logging
    console.log(`[FILTER] year=${filterYear ?? 'all'}, month=${filterMonth ?? 'all'}, source=${useMysql ? 'MySQL' : 'Excel'}`);
    console.log(`[FILTER] Closing inventory periods: ${periods.join(', ')}`);
    console.log(`[FILTER] Matched periods: ${matchedPeriodMeta.map((p) => p.name).join(', ') || 'all'}`);
    console.log(`[FILTER] Selected period: ${selectedPeriodName}`);
    console.log(`[FILTER] Closing Inv Value: ${Math.round(closingInvValue)} | Stock: ${Math.round(closingInvStock)} | Materials: ${closingInvMaterials}`);
    console.log(`[FILTER] Ageing items: ${ageingItems.length} / ${allAgeingItems.length} total`);
    console.log(`[FILTER] Storage locations: ${new Set(ageingItems.map((i) => i.storageLocation)).size}`);
    console.log(`[FILTER] Product types: ${new Set(ageingItems.map((i) => i.productType || 'Unknown')).size}`);

    // ====================================================================
    // CALCULATION ENGINE — SINGLE SOURCE OF TRUTH (UNCHANGED)
    // ====================================================================

    const ageingProductMap = new Map();
    for (const item of ageingItems) {
      const raw = (item.productType || '').trim();
      const key = (!raw || raw === '#N/A') ? 'UNASSIGNED PRODUCT' : raw;
      const v = itemValue(item);
      if (!ageingProductMap.has(key)) ageingProductMap.set(key, { count: 0, value: 0 });
      const e = ageingProductMap.get(key);
      e.count++;
      e.value += v;
    }

    const ageingLocMap = new Map();
    for (const item of ageingItems) {
      const loc = (item.storageLocation || '').trim() || '<blank>';
      const v = itemValue(item);
      if (!ageingLocMap.has(loc)) ageingLocMap.set(loc, { count: 0, value: 0 });
      const e = ageingLocMap.get(loc);
      e.count++;
      e.value += v;
    }

    const overallSumColAF = ageingItems.reduce((s, i) => s + itemValue(i), 0);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[ENGINE] FULL DATASET REPORT`);
    console.log(`[ENGINE] Total rows read    : ${ageingItems.length}`);
    console.log(`[ENGINE] Overall SUM(Col AF): ₹${Math.round(overallSumColAF).toLocaleString('en-IN')}`);
    console.log(`[ENGINE] Distinct products  : ${ageingProductMap.size}`);
    console.log(`[ENGINE] Distinct locations : ${ageingLocMap.size}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`[ENGINE] PRODUCT BREAKDOWN (from raw Product column):`);
    for (const [type, d] of [...ageingProductMap.entries()].sort()) {
      console.log(`  ${type.padEnd(22)} rows=${String(d.count).padStart(6)}  value=₹${Math.round(d.value).toLocaleString('en-IN')}`);
    }
    console.log(`[ENGINE] STORAGE LOCATION BREAKDOWN:`);
    for (const [loc, d] of [...ageingLocMap.entries()].sort()) {
      console.log(`  ${loc.padEnd(8)} rows=${String(d.count).padStart(6)}  value=₹${Math.round(d.value).toLocaleString('en-IN')}`);
    }
    console.log(`${'='.repeat(70)}\n`);

    const ageingBuckets = calculateAgeing(ageingItems);
    const totalUnrestrictedValue = overallSumColAF;
    const deadStockValue = calculateDeadStock(ageingItems);
    const deadStockCount = calculateDeadStockCount(ageingItems);
    const slowMovingValue = calculateSlowMovingValue(ageingItems);
    const avgInventoryAge = calculateAverageInventoryAge(ageingItems);

    const storageLocationAgeing = calculateStorageLocationAgeing(ageingItems);
    const storageLocationAgeingDetailed = calculateStorageLocationAgeingDetailed(ageingItems);
    const storageAgeingMatrix = calculateStorageAgeingMatrix(ageingItems);
    const grTrendMatrix = calculateGrTrendMatrix(ageingItems);
    const monthlyGrTrend = calculateMonthlyGrTrend(ageingItems);
    const oldestMaterials = calculateOldestMaterials(ageingItems, 10);

    // --- Import GIT ---
    let filteredGitItems = gitItems;
    if (!useMysql && filterDates.length > 0) {
      filteredGitItems = gitItems.filter((item) => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return filterDates.includes(String(d.getDate()));
      });
    }
    const totalImportValue = calculateImportValue(filteredGitItems);
    const totalCYValue = calculateImportCYValue(filteredGitItems);
    const vendorCount = new Set(filteredGitItems.map((i) => i.vendorCode)).size;

    const gitAgeingBuckets = calculateGitAgeing(filteredGitItems);
    const criticalGitInvoices = calculateCriticalGitInvoices(filteredGitItems);
    const gitSupplierPending = calculateGitSupplierPending(filteredGitItems);
    const gitMaterialPending = calculateGitMaterialPending(filteredGitItems, 20);
    const monthlyInvoiceTrend = calculateMonthlyInvoiceTrend(filteredGitItems);

    const currencyMap = new Map();
    for (const item of filteredGitItems) {
      const existing = currencyMap.get(item.currency);
      if (existing) {
        existing.totalValue += item.value;
        existing.count++;
      } else {
        currencyMap.set(item.currency, { totalValue: item.value, count: 1 });
      }
    }
    const currencyBreakdown = Array.from(currencyMap.entries()).map(
      ([currency, data]) => ({
        currency,
        totalValue: Math.round(data.totalValue * 100) / 100,
        count: data.count,
      })
    );

    const productMap = new Map();
    for (const item of filteredGitItems) {
      const product = item.product || 'Unknown';
      const existing = productMap.get(product);
      if (existing) {
        existing.totalValue += item.value;
        existing.totalCYValue += item.cyValue;
        existing.count++;
      } else {
        productMap.set(product, { totalValue: item.value, totalCYValue: item.cyValue, count: 1 });
      }
    }
    const importByProduct = Array.from(productMap.entries())
      .map(([product, data]) => ({
        product,
        totalValue: Math.round(data.totalValue * 100) / 100,
        totalCYValue: Math.round(data.totalCYValue * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // MoM calculation
    let momChange = 0;
    if (periodSummaries.length >= 2) {
      momChange = periodSummaries[periodSummaries.length - 1].momValueChange;
    }

    // --- Validation ---
    const roundedTotalValue = Math.round(totalValue * 100) / 100;
    const donutTotal = inventoryByType.reduce((s, t) => s + t.totalValue, 0);

    if (Math.abs(donutTotal - roundedTotalValue) > 1) {
      console.error(
        `VALIDATION FAIL: Donut total (${donutTotal}) != Total Inventory Value (${roundedTotalValue})`
      );
    }

    const ageingBucketTotal = ageingBuckets.reduce((s, b) => s + b.totalValue, 0);

    if (Math.abs(ageingBucketTotal - totalUnrestrictedValue) > 1) {
      console.error(
        `VALIDATION WARN: Ageing bucket total (${Math.round(ageingBucketTotal)}) vs Total Unrestricted Value (${Math.round(totalUnrestrictedValue)}) — diff: ${Math.round(Math.abs(ageingBucketTotal - totalUnrestrictedValue))}`
      );
    }

    const gitBucketTotal = gitAgeingBuckets.reduce((s, b) => s + b.totalValue, 0);
    if (Math.abs(gitBucketTotal - totalImportValue) > 1) {
      console.error(
        `VALIDATION FAIL: GIT bucket total (${gitBucketTotal}) != Total Import Value (${totalImportValue})`
      );
    }

    console.log(
      `[VALIDATION] Dashboard Total Inventory Value: ${roundedTotalValue} | ` +
      `Ageing Unrestricted: ${Math.round(totalUnrestrictedValue * 100) / 100} | ` +
      `GIT Import Value: ${Math.round(totalImportValue * 100) / 100}`
    );

    const productAgeing = calculateProductAgeing(ageingItems);

    const paGrandTotal = productAgeing.reduce((s, p) => s + p.totalValue, 0);
    const overallColAF = overallSumColAF;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[VALIDATION] PRE-RENDER CHECKS`);
    console.log(`${'='.repeat(70)}`);

    const productVsOverall = Math.abs(paGrandTotal - overallColAF);
    if (productVsOverall > 1) {
      console.error(
        `[VALIDATION] ❌ PRODUCT GRAND TOTAL MISMATCH` +
        ` | SUM(Products)=₹${Math.round(paGrandTotal).toLocaleString('en-IN')}` +
        ` | SUM(ColAF)=₹${Math.round(overallColAF).toLocaleString('en-IN')}` +
        ` | Diff=₹${Math.round(productVsOverall).toLocaleString('en-IN')}`
      );
    } else {
      console.log(`[VALIDATION] ✓ SUM(Product Grand Totals) = SUM(Col AF) = ₹${Math.round(paGrandTotal).toLocaleString('en-IN')}`);
    }

    let productBucketPass = true;
    for (const p of productAgeing) {
      const bucketSum = Math.round(p.buckets.reduce((s, b) => s + b.totalValue, 0) * 100) / 100;
      const gt = p.totalValue;
      const diff = Math.abs(bucketSum - gt);
      if (diff > 0.02) {
        productBucketPass = false;
        console.error(
          `[VALIDATION] ❌ PRODUCT BUCKET MISMATCH — ${p.productType}` +
          ` | GrandTotal=₹${gt} | BucketSum=₹${bucketSum} | Diff=₹${diff.toFixed(2)}`
        );
        for (const b of p.buckets) {
          if (b.totalValue > 0)
            console.error(`  Bucket [${b.bucket}]: count=${b.count} value=₹${b.totalValue}`);
        }
      } else {
        console.log(
          `[VALIDATION] ✓ ${p.productType.padEnd(22)} GrandTotal=₹${Math.round(gt).toLocaleString('en-IN').padStart(14)} BucketSum=₹${Math.round(bucketSum).toLocaleString('en-IN').padStart(14)} [OK]`
        );
      }
    }
    if (productBucketPass) console.log(`[VALIDATION] ✓ ALL PRODUCTS — bucket sums match grand totals`);

    const storageGrandTotal = storageLocationAgeingDetailed.reduce((s, l) => s + l.totalValue, 0);
    const storageVsOverall = Math.abs(storageGrandTotal - overallColAF);
    if (storageVsOverall > 1) {
      console.error(
        `[VALIDATION] ❌ STORAGE GRAND TOTAL MISMATCH` +
        ` | SUM(Locations)=₹${Math.round(storageGrandTotal).toLocaleString('en-IN')}` +
        ` | SUM(ColAF)=₹${Math.round(overallColAF).toLocaleString('en-IN')}` +
        ` | Diff=₹${Math.round(storageVsOverall).toLocaleString('en-IN')}`
      );
    } else {
      console.log(`[VALIDATION] ✓ SUM(Storage Grand Totals) = SUM(Col AF) = ₹${Math.round(storageGrandTotal).toLocaleString('en-IN')}`);
    }

    let storageBucketPass = true;
    for (const loc of storageLocationAgeingDetailed) {
      const bucketSum = Math.round(loc.buckets.reduce((s, b) => s + b.totalValue, 0) * 100) / 100;
      const gt = loc.totalValue;
      const diff = Math.abs(bucketSum - gt);
      if (diff > 0.02) {
        storageBucketPass = false;
        console.error(
          `[VALIDATION] ❌ STORAGE BUCKET MISMATCH — ${loc.storageLocation}` +
          ` | GrandTotal=₹${gt} | BucketSum=₹${bucketSum} | Diff=₹${diff.toFixed(2)}`
        );
      }
    }
    if (storageBucketPass) console.log(`[VALIDATION] ✓ ALL STORAGE LOCATIONS — bucket sums match grand totals`);

    const productRowCount = productAgeing.reduce((s, p) => s + p.materialCount, 0);

    console.log(`${'='.repeat(70)}\n`);

    const aiInsights = generateAIInsights({
      totalValue: roundedTotalValue,
      totalStock,
      materialCount,
      deadStockValue,
      deadStockCount,
      slowMovingValue,
      avgInventoryAge,
      totalImportValue,
      criticalGitCount: criticalGitInvoices.length,
      periodSummaries,
      storageLocationAgeing,
      inventoryByType,
    });

    const summary = {
      dataSource: useMysql ? 'mysql' : 'excel',
      inventory: {
        totalValue: roundedTotalValue,
        totalStock,
        materialCount,
        topMaterialsByValue,
        inventoryByType,
        periodSummaries,
        momChange: Math.round(momChange * 100) / 100,
      },
      ageing: {
        totalItems: ageingItems.length,
        totalUnrestrictedValue: Math.round(totalUnrestrictedValue * 100) / 100,
        closingInventoryValue: Math.round(closingInvValue * 100) / 100,
        closingInventoryStock: Math.round(closingInvStock * 100) / 100,
        closingMaterialCount: closingInvMaterials,
        selectedPeriod: selectedPeriodName,
        deadStockValue: Math.round(deadStockValue * 100) / 100,
        deadStockCount,
        slowMovingValue: Math.round(slowMovingValue * 100) / 100,
        avgInventoryAge,
        buckets: ageingBuckets,
        storageLocationAgeing,
        storageLocationAgeingDetailed,
        storageAgeingMatrix,
        grTrendMatrix,
        productAgeing,
        monthlyGrTrend,
        oldestMaterials,
      },
      importStats: {
        totalImportValue: Math.round(totalImportValue * 100) / 100,
        totalCYValue: Math.round(totalCYValue * 100) / 100,
        vendorCount,
        itemCount: gitItems.length,
        currencyBreakdown,
        importByProduct,
        gitAgeingBuckets,
        criticalGitCount: criticalGitInvoices.length,
        gitSupplierPending,
        gitMaterialPending,
        monthlyInvoiceTrend,
      },
      productAnalytics: productAgeing,
      stockValueScatter: [],
      aiInsights,
      availableFilters: {
        years: [...availYears].sort((a, b) => a - b),
        months: [...availMonthMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, name]) => ({ index, name })),
      },
      availableReportPeriods: availableReportPeriods.length > 0
        ? availableReportPeriods.map(r => ({ year: r.yr, month: r.mo, date: r.d }))
        : undefined,
    };

    res.json(summary);
  } catch (error) {
    console.error('Summary API error:', error);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

module.exports = router;
