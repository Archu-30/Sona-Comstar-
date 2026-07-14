// --- Storage Locations ---
const STORAGE_LOCATIONS = [
  'HDFG',
  'HDHS',
  'HDNW',
  'RJNW',
  'RJRR',
  'RJSR',
  'WIPS',
  'WIEV',
  'WIPH',
  'WICQ',
  'WSMT',
  'REFG',
  'QUSM',
  'SCRA',
];

// --- Closing Inventory Types (SAP Product Types) ---
// All 9 product types from the SAP Inventory Ageing Report (TYPE column / Product column).
// Do NOT hard-code values here if SAP introduces new ones — the backend also reads product
// types dynamically and this list is used only for whitelisting the ageing analytics view.
const INVENTORY_TYPES = [
  'YBOP',
  'YFGS',
  'YSPR',
  'YTOL',
  'YSAF',
  'YSTA',
  'YCON',
  'YSFG',
  'YSCP',
];

// --- Storage Age Buckets ---
const STORAGE_AGE_BUCKETS = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181-365 Days',
  'Above 1 Year',
  'Above 2 Years',
  'Above 3 Years',
  'Above 4 Years',
  'Above 5 Years',
];

// --- GIT Age Buckets ---
const GIT_AGE_BUCKETS = [
  '0-30 Days',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181-365 Days',
  'Above 1 Year',
  'Above 2 Years',
  'Above 3 Years',
  'Above 4 Years',
  'Above 5 Years',
];

// --- Thresholds ---
const DEAD_STOCK_THRESHOLD_DAYS = 180;
const SLOW_MOVING_THRESHOLD_DAYS = 90;
const CRITICAL_GIT_THRESHOLD_DAYS = 90;

module.exports = {
  STORAGE_LOCATIONS,
  INVENTORY_TYPES,
  STORAGE_AGE_BUCKETS,
  GIT_AGE_BUCKETS,
  DEAD_STOCK_THRESHOLD_DAYS,
  SLOW_MOVING_THRESHOLD_DAYS,
  CRITICAL_GIT_THRESHOLD_DAYS,
};
