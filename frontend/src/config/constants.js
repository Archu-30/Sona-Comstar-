export const STORAGE_LOCATIONS = [
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

// All 9 product types from the SAP Inventory Ageing Report.
// Keep in sync with backend/config/constants.js INVENTORY_TYPES.
export const INVENTORY_TYPES = [
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

export const STORAGE_AGE_BUCKETS = [
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

export const GIT_AGE_BUCKETS = [
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

export const DEAD_STOCK_THRESHOLD_DAYS = 180;
export const SLOW_MOVING_THRESHOLD_DAYS = 90;
export const CRITICAL_GIT_THRESHOLD_DAYS = 90;
