const DEAD_STOCK_THRESHOLD_DAYS = 180;
const SLOW_MOVING_THRESHOLD_DAYS = 90;

// --- Inventory Calculations ---

function calculateInventoryValue(items) {
  return items.reduce((sum, item) => sum + item.totalValue, 0);
}

function calculateStockQuantity(items) {
  return items.reduce((sum, item) => sum + item.totalStock, 0);
}

function calculateUniqueMaterials(items) {
  return new Set(items.map((i) => i.material)).size;
}

function calculateAvgUnitCost(items) {
  const totalValue = calculateInventoryValue(items);
  const totalStock = calculateStockQuantity(items);
  return totalStock > 0 ? totalValue / totalStock : 0;
}

function calculateInventoryByType(items) {
  // Dynamically reads ALL product types found in the data.
  // No hardcoded list. No filter. Every type SAP produces is shown.
  const totalValue = calculateInventoryValue(items);
  const map = new Map();
  for (const item of items) {
    const type = (item.type || '').trim();
    if (!type) continue; // Skip rows with truly empty type — not a valid product type
    const existing = map.get(type);
    if (existing) {
      existing.count++;
      existing.totalValue += item.totalValue;
      existing.totalStock += item.totalStock;
    } else {
      map.set(type, { count: 1, totalValue: item.totalValue, totalStock: item.totalStock });
    }
  }
  return Array.from(map.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    totalValue: Math.round(data.totalValue * 100) / 100,
    totalStock: data.totalStock,
    percentage: totalValue > 0 ? Math.round((data.totalValue / totalValue) * 10000) / 100 : 0,
  }));
}

function calculateTopMaterials(items, count) {
  if (count === undefined) count = 10;
  const map = new Map();
  for (const item of items) {
    const existing = map.get(item.material);
    if (existing) {
      existing.totalValue += item.totalValue;
    } else {
      map.set(item.material, {
        description: item.description,
        totalValue: item.totalValue,
      });
    }
  }
  return Array.from(map.entries())
    .map(([material, data]) => ({
      material,
      description: data.description,
      totalValue: Math.round(data.totalValue * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, count);
}

// --- Month-over-Month ---

function calculateMoM(currentValue, previousValue) {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

// --- Ageing Calculations (using GR Issue Date) ---

function calculateInventoryAge(grIssueDateMs) {
  if (!grIssueDateMs || grIssueDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - grIssueDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getAgeBucket(days) {
  if (days < 0) return 'Unknown';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  if (days <= 730) return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}

const BUCKET_ORDER = [
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
  'Unknown',
];

function calculateAgeing(items) {
  const totalValue = items.reduce((s, i) => s + itemValue(i), 0);
  const buckets = {};

  for (const bucket of BUCKET_ORDER) {
    buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, materials: new Set(), totalAge: 0 };
  }

  for (const item of items) {
    const ageDays = itemAgeDays(item);
    const bucket = getAgeBucket(ageDays);

    if (!buckets[bucket]) {
      buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, materials: new Set(), totalAge: 0 };
    }

    buckets[bucket].count++;
    buckets[bucket].totalValue += itemValue(item);
    buckets[bucket].totalQuantity += item.unrestricted;
    buckets[bucket].materials.add(item.material);
    if (ageDays >= 0) buckets[bucket].totalAge += ageDays;
  }

  return BUCKET_ORDER
    .filter((bucket) => buckets[bucket])
    .map((bucket) => {
      const data = buckets[bucket];
      return {
        bucket,
        count: data.count,
        totalValue: Math.round(data.totalValue * 100) / 100,
        totalQuantity: data.totalQuantity,
        materialCount: data.materials.size,
        avgAge: data.count > 0 ? Math.round(data.totalAge / data.count) : 0,
        percentage: totalValue > 0 ? Math.round((data.totalValue / totalValue) * 10000) / 100 : 0,
      };
    });
}

function calculateAverageInventoryAge(items) {
  if (items.length === 0) return 0;
  let totalAge = 0;
  let count = 0;
  for (const item of items) {
    const ageDays = itemAgeDays(item);
    if (ageDays >= 0) {
      totalAge += ageDays;
      count++;
    }
  }
  return count > 0 ? Math.round(totalAge / count) : 0;
}

// --- Bucket helper for a group ---

function emptyBuckets() {
  const b = {};
  for (const k of BUCKET_ORDER) b[k] = { count: 0, totalValue: 0, totalQuantity: 0 };
  return b;
}

// Age in days from Column Y ("AA" header) of the SAP Inventory Ageing Report.
// Col Y ("AA") = Report Date − GR Issue Date. This is the value the user's pivot table
// uses for bucket assignments. Col Z ("Aging(Date of Rcpt)") is a slightly different
// value and must NOT be used for bucket assignment.
// Falls back to agingDateOfReceipt (Col Z) only if AA column is absent/zero.
// Guard: values >= 10000 (>27 years) are Excel date serial numbers accidentally read as
// day-counts — typically seen on rows without a GR date.
// Returns -1 (→ "Unknown" bucket) when no valid age is found so these rows are not
// misclassified as "0-30 Days".
const MAX_VALID_AGE_DAYS = 9999;
function itemAgeDays(item) {
  const aa = item.aaAgingDays;
  if (aa > 0 && aa <= MAX_VALID_AGE_DAYS) return aa;
  const adr = item.agingDateOfReceipt;
  if (adr > 0 && adr <= MAX_VALID_AGE_DAYS) return adr;
  return -1;
}

// Inventory value per row = Column AF "Total Value".
// The SAP Inventory Ageing Report Column AF contains the total stock value per row
// (unrestricted + restricted + blocked + QI + in-transit).
// This is the column the user's pivot table sums as "Sum of Total Value".
function itemValue(item) {
  return item.totalValue || 0;
}

// --- Storage Ageing Matrix ---
// Fine-grained aggregation by (storageLocation × productType × bucket) carrying the
// five value components (Excel columns K, M, O, Q, S) so the frontend can filter by
// location, product, and value column in any combination.
function calculateStorageAgeingMatrix(items) {
  const map = new Map();
  for (const item of items) {
    const loc = (item.storageLocation || 'Unknown').trim() || 'Unknown';
    const raw = (item.productType || '').trim();
    const product = !raw || raw === '#N/A' ? 'UNASSIGNED PRODUCT' : raw;
    const bucket = getAgeBucket(itemAgeDays(item));
    const key = `${loc}|${product}|${bucket}`;
    let e = map.get(key);
    if (!e) {
      e = {
        storageLocation: loc,
        productType: product,
        bucket,
        count: 0,
        totalQuantity: 0,
        vUnrestricted: 0,
        vTransit: 0,
        vQualInsp: 0,
        vRestricted: 0,
        vBlocked: 0,
        totalValue: 0,
      };
      map.set(key, e);
    }
    e.count++;
    e.totalQuantity += item.unrestricted || 0;
    e.vUnrestricted += item.valueUnrestricted || 0;
    e.vTransit += item.valInTransfer || 0;
    e.vQualInsp += item.valueQualInsp || 0;
    e.vRestricted += item.valueRestricted || 0;
    e.vBlocked += item.valueBlocked || 0;
    e.totalValue += itemValue(item);
  }
  return Array.from(map.values()).map((e) => ({
    ...e,
    vUnrestricted: Math.round(e.vUnrestricted * 100) / 100,
    vTransit: Math.round(e.vTransit * 100) / 100,
    vQualInsp: Math.round(e.vQualInsp * 100) / 100,
    vRestricted: Math.round(e.vRestricted * 100) / 100,
    vBlocked: Math.round(e.vBlocked * 100) / 100,
    totalValue: Math.round(e.totalValue * 100) / 100,
  }));
}

// Debug helper: prints details for a single ageing row to the console.
// Call with debugAgeingRow(item) inside any loop to trace bucket assignments.
function debugAgeingRow(item, reason) {
  const ageDays = itemAgeDays(item);
  const bucket = getAgeBucket(ageDays);
  const val = itemValue(item);
  if (reason) {
    console.log(
      `[DEBUG EXCLUDED] Material=${item.material} | Product=${item.productType || ''} | ` +
      `StorageLoc=${item.storageLocation} | AgeDays=${ageDays} | Bucket=${bucket} | ` +
      `ValueUnrestricted=${val} | Reason=${reason}`
    );
  } else {
    console.log(
      `[DEBUG ROW] Material=${item.material} | Product=${item.productType || ''} | ` +
      `StorageLoc=${item.storageLocation} | AgeDays=${ageDays} | Bucket=${bucket} | ` +
      `ValueUnrestricted=${val}`
    );
  }
}

// --- Ageing by Storage Location (with buckets + oldest/newest) ---

function calculateStorageLocationAgeingDetailed(items) {
  const grandTotalValue = items.reduce((s, i) => s + itemValue(i), 0);
  const map = new Map();
  for (const item of items) {
    const loc = item.storageLocation || 'Unknown';
    const ageDays = itemAgeDays(item);
    const val = itemValue(item);
    let entry = map.get(loc);
    if (!entry) {
      entry = {
        totalValue: 0,
        totalQuantity: 0,
        materials: new Set(),
        totalAge: 0,
        count: 0,
        oldest: -Infinity,
        newest: Infinity,
        buckets: emptyBuckets(),
      };
      map.set(loc, entry);
    }
    entry.totalValue += val;
    entry.totalQuantity += item.unrestricted;
    entry.materials.add(item.material);
    if (ageDays >= 0) entry.totalAge += ageDays;
    entry.count++;
    if (ageDays >= 0 && ageDays > entry.oldest) entry.oldest = ageDays;
    if (ageDays >= 0 && ageDays < entry.newest) entry.newest = ageDays;
    const b = getAgeBucket(ageDays);
    if (entry.buckets[b]) {
      entry.buckets[b].count++;
      entry.buckets[b].totalValue += val;
      entry.buckets[b].totalQuantity += item.unrestricted;
    }
  }
  return Array.from(map.entries())
    .map(([storageLocation, d]) => ({
      storageLocation,
      totalValue: Math.round(d.totalValue * 100) / 100,
      totalQuantity: d.totalQuantity,
      materialCount: d.materials.size,
      avgAge: d.count > 0 ? Math.round(d.totalAge / d.count) : 0,
      oldest: d.count > 0 ? d.oldest : 0,
      newest: d.count > 0 ? d.newest : 0,
      inventoryPercentage: grandTotalValue > 0 ? Math.round((d.totalValue / grandTotalValue) * 10000) / 100 : 0,
      buckets: BUCKET_ORDER.map((b) => ({
        bucket: b,
        count: d.buckets[b].count,
        totalValue: Math.round(d.buckets[b].totalValue * 100) / 100,
        totalQuantity: d.buckets[b].totalQuantity,
      })),
    }))
    .sort((a, b) => a.storageLocation.localeCompare(b.storageLocation));
}

// --- Product-wise Ageing (Column Y = age source, Column AF = value source) ---
// Rules:
//   - ALL rows are processed. No row is ever skipped or excluded.
//   - Rows with blank or #N/A productType are labeled 'UNASSIGNED PRODUCT'.
//   - This ensures SUM(Product Grand Totals) = SUM(Column AF).
//   - Product types are discovered DYNAMICALLY from the data — no hardcoded list.
//   - Use ONLY Column Y (agingDateOfReceipt) for bucket assignment.
//   - Use ONLY Column AF (valueUnrestricted) for monetary values.

const UNASSIGNED_LABEL = 'UNASSIGNED PRODUCT';

function calculateProductAgeing(items) {
  const grandTotalValue = items.reduce((s, i) => s + itemValue(i), 0);
  const map = new Map();
  for (const item of items) {
    const raw = (item.productType || '').trim();
    // Blank or #N/A → label as UNASSIGNED PRODUCT. Never skip any row.
    const type = (!raw || raw === '#N/A') ? UNASSIGNED_LABEL : raw;
    const ageDays = itemAgeDays(item);
    const val = itemValue(item);
    let entry = map.get(type);
    if (!entry) {
      entry = {
        totalValue: 0,
        totalQuantity: 0,
        materials: new Set(),
        totalAge: 0,
        count: 0,
        oldest: -Infinity,
        newest: Infinity,
        buckets: emptyBuckets(),
      };
      map.set(type, entry);
    }
    entry.totalValue += val;
    entry.totalQuantity += item.unrestricted;
    entry.materials.add(item.material);
    if (ageDays >= 0) entry.totalAge += ageDays;
    entry.count++;
    if (ageDays >= 0 && ageDays > entry.oldest) entry.oldest = ageDays;
    if (ageDays >= 0 && ageDays < entry.newest) entry.newest = ageDays;
    const b = getAgeBucket(ageDays);
    if (entry.buckets[b]) {
      entry.buckets[b].count++;
      entry.buckets[b].totalValue += val;
      entry.buckets[b].totalQuantity += item.unrestricted;
    }
  }
  return Array.from(map.entries())
    .map(([productType, d]) => {
      const buckets = BUCKET_ORDER.map((b) => ({
        bucket: b,
        count: d.buckets[b].count,
        totalValue: Math.round(d.buckets[b].totalValue * 100) / 100,
        totalQuantity: d.buckets[b].totalQuantity,
      }));
      const bucketSum = buckets.reduce((s, b) => s + b.totalValue, 0);
      const grandTotal = Math.round(d.totalValue * 100) / 100;
      // Bucket sum must equal grand total — log discrepancies
      if (Math.abs(bucketSum - grandTotal) > 0.01) {
        console.warn(
          `[PRODUCT AGEING VALIDATION] ${productType}: bucket sum (${bucketSum}) ` +
          `!= grand total (${grandTotal}), diff=${Math.abs(bucketSum - grandTotal).toFixed(2)}`
        );
      }
      return {
        productType,
        totalValue: grandTotal,
        totalQuantity: d.totalQuantity,
        materialCount: d.materials.size,
        avgAge: d.count > 0 ? Math.round(d.totalAge / d.count) : 0,
        oldest: d.count > 0 ? d.oldest : 0,
        newest: d.count > 0 ? d.newest : 0,
        inventoryPercentage: grandTotalValue > 0 ? Math.round((d.totalValue / grandTotalValue) * 10000) / 100 : 0,
        buckets,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

// --- Monthly GR trend matrix ---
// Rows keyed by (GR month × storageLocation × productType) with the five value
// components, so the frontend trend can respond to every filter combination.
function calculateGrTrendMatrix(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.grIssueDate || item.grIssueDate <= 0) continue;
    const d = new Date(item.grIssueDate);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const loc = (item.storageLocation || 'Unknown').trim() || 'Unknown';
    const raw = (item.productType || '').trim();
    const product = !raw || raw === '#N/A' ? 'UNASSIGNED PRODUCT' : raw;
    const key = `${month}|${loc}|${product}`;
    let e = map.get(key);
    if (!e) {
      e = {
        month,
        storageLocation: loc,
        productType: product,
        count: 0,
        totalQuantity: 0,
        vUnrestricted: 0,
        vTransit: 0,
        vQualInsp: 0,
        vRestricted: 0,
        vBlocked: 0,
        totalValue: 0,
      };
      map.set(key, e);
    }
    e.count++;
    e.totalQuantity += item.unrestricted || 0;
    e.vUnrestricted += item.valueUnrestricted || 0;
    e.vTransit += item.valInTransfer || 0;
    e.vQualInsp += item.valueQualInsp || 0;
    e.vRestricted += item.valueRestricted || 0;
    e.vBlocked += item.valueBlocked || 0;
    e.totalValue += itemValue(item);
  }
  return Array.from(map.values()).map((e) => ({
    ...e,
    vUnrestricted: Math.round(e.vUnrestricted * 100) / 100,
    vTransit: Math.round(e.vTransit * 100) / 100,
    vQualInsp: Math.round(e.vQualInsp * 100) / 100,
    vRestricted: Math.round(e.vRestricted * 100) / 100,
    vBlocked: Math.round(e.vBlocked * 100) / 100,
    totalValue: Math.round(e.totalValue * 100) / 100,
  }));
}

// --- Monthly GR trend ---

function calculateMonthlyGrTrend(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.grIssueDate || item.grIssueDate <= 0) continue;
    const d = new Date(item.grIssueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalValue += itemValue(item);
      existing.totalQuantity += item.unrestricted;
      existing.count++;
    } else {
      map.set(key, {
        totalValue: itemValue(item),
        totalQuantity: item.unrestricted,
        count: 1,
      });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      totalValue: Math.round(d.totalValue * 100) / 100,
      totalQuantity: d.totalQuantity,
      count: d.count,
    }));
}

// --- Top oldest materials ---

function calculateOldestMaterials(items, limit) {
  if (limit === undefined) limit = 10;
  return items
    .map((i) => ({
      material: i.material,
      description: i.materialDescription,
      plant: i.plant,
      storageLocation: i.storageLocation,
      ageDays: itemAgeDays(i),
      value: Math.round(itemValue(i) * 100) / 100,
      quantity: i.unrestricted,
    }))
    .filter((i) => i.ageDays > 0)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, limit);
}

// --- Legacy Ageing by Storage Location (kept for existing callers) ---

function calculateStorageLocationAgeing(items) {
  const map = new Map();

  for (const item of items) {
    const loc = item.storageLocation || 'Unknown';
    const ageDays = itemAgeDays(item);

    const existing = map.get(loc);
    if (existing) {
      existing.totalValue += itemValue(item);
      existing.totalQuantity += item.unrestricted;
      existing.materials.add(item.material);
      if (ageDays >= 0) existing.totalAge += ageDays;
      existing.count++;
    } else {
      map.set(loc, {
        totalValue: itemValue(item),
        totalQuantity: item.unrestricted,
        materials: new Set([item.material]),
        totalAge: ageDays >= 0 ? ageDays : 0,
        count: 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([storageLocation, data]) => ({
      storageLocation,
      totalValue: Math.round(data.totalValue * 100) / 100,
      totalQuantity: data.totalQuantity,
      materialCount: data.materials.size,
      avgAge: data.count > 0 ? Math.round(data.totalAge / data.count) : 0,
    }))
    .sort((a, b) => a.storageLocation.localeCompare(b.storageLocation));
}

// --- Dead Stock & Slow Moving ---

function calculateDeadStock(items) {
  return items
    .filter((i) => itemAgeDays(i) > DEAD_STOCK_THRESHOLD_DAYS)
    .reduce((sum, i) => sum + itemValue(i), 0);
}

function calculateDeadStockCount(items) {
  return new Set(
    items
      .filter((i) => itemAgeDays(i) > DEAD_STOCK_THRESHOLD_DAYS)
      .map((i) => i.material)
  ).size;
}

function calculateSlowMovingValue(items) {
  return items
    .filter((i) => {
      const ageDays = itemAgeDays(i);
      return ageDays > SLOW_MOVING_THRESHOLD_DAYS && ageDays <= DEAD_STOCK_THRESHOLD_DAYS;
    })
    .reduce((sum, i) => sum + itemValue(i), 0);
}

// --- Import GIT Calculations ---

function calculateImportValue(items) {
  return items.reduce((sum, i) => sum + i.value, 0);
}

function calculateImportCYValue(items) {
  return items.reduce((sum, i) => sum + i.cyValue, 0);
}

function calculateGitAge(invoiceDateMs) {
  if (!invoiceDateMs || invoiceDateMs <= 0) return 0;
  const now = Date.now();
  const diffMs = now - invoiceDateMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const GIT_BUCKET_ORDER = [
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

function getGitAgeBucket(days) {
  if (days <= 0) return '0-30 Days';
  if (days <= 30) return '0-30 Days';
  if (days <= 60) return '31-60 Days';
  if (days <= 90) return '61-90 Days';
  if (days <= 180) return '91-180 Days';
  if (days <= 365) return '181-365 Days';
  if (days <= 730) return 'Above 1 Year';
  if (days <= 1095) return 'Above 2 Years';
  if (days <= 1460) return 'Above 3 Years';
  if (days <= 1825) return 'Above 4 Years';
  return 'Above 5 Years';
}

function calculateGitAgeing(items) {
  const buckets = {};

  for (const bucket of GIT_BUCKET_ORDER) {
    buckets[bucket] = { count: 0, totalValue: 0, totalQuantity: 0, invoices: new Set() };
  }

  for (const item of items) {
    const ageDays = calculateGitAge(item.invoiceDate);
    const bucket = getGitAgeBucket(ageDays);

    buckets[bucket].count++;
    buckets[bucket].totalValue += item.value;
    buckets[bucket].totalQuantity += item.qty;
    buckets[bucket].invoices.add(item.invoiceNumber);
  }

  return GIT_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: buckets[bucket].count,
    totalValue: Math.round(buckets[bucket].totalValue * 100) / 100,
    totalQuantity: buckets[bucket].totalQuantity,
    invoiceCount: buckets[bucket].invoices.size,
  }));
}

function calculateCriticalGitInvoices(items) {
  return items.filter((item) => calculateGitAge(item.invoiceDate) > 90);
}

function calculateGitSupplierPending(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.vendorCode || 'Unknown';
    const ageDays = calculateGitAge(item.invoiceDate);
    const e = map.get(key);
    if (e) {
      e.totalValue += item.value;
      e.totalQuantity += item.qty;
      e.invoices.add(item.invoiceNumber);
      e.totalAge += ageDays;
      e.count++;
    } else {
      map.set(key, {
        totalValue: item.value,
        totalQuantity: item.qty,
        invoices: new Set([item.invoiceNumber]),
        totalAge: ageDays,
        count: 1,
      });
    }
  }
  return Array.from(map.entries())
    .map(([supplier, d]) => ({
      supplier: String(supplier),
      totalValue: Math.round(d.totalValue * 100) / 100,
      totalQuantity: d.totalQuantity,
      invoiceCount: d.invoices.size,
      avgAge: d.count > 0 ? Math.round(d.totalAge / d.count) : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

function calculateGitMaterialPending(items, limit) {
  if (limit === undefined) limit = 20;
  const map = new Map();
  for (const item of items) {
    const key = item.material;
    const ageDays = calculateGitAge(item.invoiceDate);
    const e = map.get(key);
    if (e) {
      e.totalValue += item.value;
      e.totalQuantity += item.qty;
      e.totalAge += ageDays;
      e.count++;
    } else {
      map.set(key, {
        description: item.materialDescription,
        totalValue: item.value,
        totalQuantity: item.qty,
        totalAge: ageDays,
        count: 1,
      });
    }
  }
  return Array.from(map.entries())
    .map(([material, d]) => ({
      material,
      description: d.description,
      totalValue: Math.round(d.totalValue * 100) / 100,
      totalQuantity: d.totalQuantity,
      avgAge: d.count > 0 ? Math.round(d.totalAge / d.count) : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);
}

function calculateMonthlyInvoiceTrend(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.invoiceDate || item.invoiceDate <= 0) continue;
    const d = new Date(item.invoiceDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const e = map.get(key);
    if (e) {
      e.totalValue += item.value;
      e.totalQuantity += item.qty;
      e.count++;
    } else {
      map.set(key, { totalValue: item.value, totalQuantity: item.qty, count: 1 });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      totalValue: Math.round(d.totalValue * 100) / 100,
      totalQuantity: d.totalQuantity,
      count: d.count,
    }));
}

// --- Period / Monthly helpers ---

const MONTH_ORDER = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parsePeriodToSortKey(period) {
  const lower = period.toLowerCase().trim();
  const match = lower.match(/^([a-z]+)\s*'?(\d{2,4})$/);
  if (match) {
    const monthIdx = MONTH_ORDER[match[1]] ?? 0;
    let year = parseInt(match[2], 10);
    if (year < 100) year += 2000;
    return year * 12 + monthIdx;
  }
  const match2 = lower.match(/(\d{2,4})\s*[/-]?\s*([a-z]+)/);
  if (match2) {
    const monthIdx = MONTH_ORDER[match2[2]] ?? 0;
    let year = parseInt(match2[1], 10);
    if (year < 100) year += 2000;
    return year * 12 + monthIdx;
  }
  return 0;
}

function sortPeriodsChronologically(periods) {
  return [...periods].sort(
    (a, b) => parsePeriodToSortKey(a.period) - parsePeriodToSortKey(b.period)
  );
}

function calculatePeriodSummaries(periods) {
  const sorted = sortPeriodsChronologically(periods);
  const summaries = [];

  for (let i = 0; i < sorted.length; i++) {
    const { period, items } = sorted[i];
    const totalValue = calculateInventoryValue(items);
    const totalStock = calculateStockQuantity(items);
    const materialCount = calculateUniqueMaterials(items);

    let momValueChange = 0;
    let momQuantityChange = 0;

    if (i > 0) {
      const prevItems = sorted[i - 1].items;
      const prevValue = calculateInventoryValue(prevItems);
      const prevStock = calculateStockQuantity(prevItems);
      momValueChange = calculateMoM(totalValue, prevValue);
      momQuantityChange = calculateMoM(totalStock, prevStock);
    }

    summaries.push({
      period,
      totalValue: Math.round(totalValue * 100) / 100,
      totalStock,
      materialCount,
      momValueChange: Math.round(momValueChange * 100) / 100,
      momQuantityChange: Math.round(momQuantityChange * 100) / 100,
      byType: calculateInventoryByType(items).map((t) => ({
        type: t.type,
        totalValue: Math.round(t.totalValue * 100) / 100,
        totalStock: t.totalStock,
      })),
    });
  }

  return summaries;
}

module.exports = {
  calculateInventoryValue,
  calculateStockQuantity,
  calculateUniqueMaterials,
  calculateAvgUnitCost,
  calculateInventoryByType,
  calculateTopMaterials,
  calculateMoM,
  calculateInventoryAge,
  getAgeBucket,
  itemValue,
  itemAgeDays,
  debugAgeingRow,
  calculateStorageAgeingMatrix,
  calculateGrTrendMatrix,
  calculateAgeing,
  calculateAverageInventoryAge,
  calculateStorageLocationAgeing,
  calculateStorageLocationAgeingDetailed,
  calculateProductAgeing,
  calculateMonthlyGrTrend,
  calculateOldestMaterials,
  calculateGitSupplierPending,
  calculateGitMaterialPending,
  calculateMonthlyInvoiceTrend,
  calculateDeadStock,
  calculateDeadStockCount,
  calculateSlowMovingValue,
  calculateImportValue,
  calculateImportCYValue,
  calculateGitAge,
  getGitAgeBucket,
  calculateGitAgeing,
  calculateCriticalGitInvoices,
  sortPeriodsChronologically,
  calculatePeriodSummaries,
};
