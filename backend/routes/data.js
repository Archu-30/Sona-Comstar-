const express = require('express');
const router = express.Router();

const {
  getClosingInventory,
  getInventoryAgeing,
  getImportGIT,
  getAllData,
  getLatestPeriod,
} = require('../../database/index');
const { STORAGE_LOCATIONS } = require('../config/constants');

function matchesSearch(row, search) {
  const lowerSearch = search.toLowerCase();
  return Object.values(row).some((val) => {
    if (val === null || val === undefined) return false;
    return String(val).toLowerCase().includes(lowerSearch);
  });
}

function matchesFilters(row, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    const fieldVal = String(row[key] ?? '').toLowerCase();
    if (!fieldVal.includes(value.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function sortData(data, sortField, sortDir) {
  if (!sortField) return data;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir;
    }
    return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
  });
}

function computeSummary(module, data) {
  const summary = { count: data.length };

  if (module === 'inventory') {
    summary.totalValue = data.reduce((s, i) => s + i.totalValue, 0);
    summary.totalStock = data.reduce((s, i) => s + i.totalStock, 0);
    summary.materialCount = new Set(data.map((i) => i.material)).size;
  } else if (module === 'ageing') {
    summary.totalUnrestricted = data.reduce(
      (s, i) => s + i.valueUnrestricted,
      0
    );
    summary.totalBlocked = data.reduce((s, i) => s + i.valueBlocked, 0);
    summary.materialCount = new Set(data.map((i) => i.material)).size;
  } else if (module === 'git') {
    summary.totalValue = data.reduce((s, i) => s + i.value, 0);
    summary.totalCYValue = data.reduce((s, i) => s + i.cyValue, 0);
    summary.vendorCount = new Set(data.map((i) => i.vendorCode)).size;
  }

  return summary;
}

router.get('/', (req, res) => {
  try {
    const module = req.query.module ?? 'all';
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(req.query.pageSize ?? '25', 10))
    );
    const search = req.query.search ?? '';
    const sortField = req.query.sortField ?? '';
    const sortDir = req.query.sortDir ?? 'asc';

    let filters = {};
    const filtersParam = req.query.filters;
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {
        // ignore malformed filters
      }
    }

    let rawData;

    switch (module) {
      case 'inventory': {
        const latestPeriodName = getLatestPeriod();
        const periodData = latestPeriodName ? getClosingInventory(latestPeriodName) : [];
        rawData = periodData.length > 0 ? periodData[0].items : [];
        break;
      }
      case 'ageing': {
        const allowedLocs = new Set(STORAGE_LOCATIONS);
        rawData = getInventoryAgeing().filter(
          (item) => allowedLocs.has(item.storageLocation)
        );
        break;
      }
      case 'git':
        rawData = getImportGIT();
        break;
      case 'all': {
        const all = getAllData();
        rawData = [
          ...all.closingInventory.flatMap((r) => r.items),
          ...all.inventoryAgeing,
          ...all.importGIT,
        ];
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown module: ${module}` });
    }

    // Filter
    let filtered = rawData;
    if (search) {
      filtered = filtered.filter((row) => matchesSearch(row, search));
    }
    if (Object.keys(filters).length > 0) {
      filtered = filtered.filter((row) => matchesFilters(row, filters));
    }

    // Sort
    const sorted = sortData(filtered, sortField, sortDir);

    // Summary (on filtered data)
    const summary = computeSummary(module, sorted);

    // Paginate
    const total = sorted.length;
    const startIdx = (page - 1) * pageSize;
    const paginatedData = sorted.slice(startIdx, startIdx + pageSize);

    res.json({
      data: paginatedData,
      total,
      page,
      pageSize,
      summary,
    });
  } catch (error) {
    console.error('Data API error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

module.exports = router;
