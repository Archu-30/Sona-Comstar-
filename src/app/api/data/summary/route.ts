import { NextResponse } from 'next/server';
import {
  getClosingInventory,
  getInventoryAgeing,
  getImportGIT,
  getAvailablePeriods,
} from '@/lib/excel-processor';
import {
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
  calculateGitAgeing,
  calculateCriticalGitInvoices,
  calculatePeriodSummaries,
} from '@/lib/calculations';
import { STORAGE_LOCATIONS } from '@/config/constants';

export async function GET() {
  try {
    const allPeriods = getClosingInventory();
    const periods = getAvailablePeriods();

    const latestPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1] : null;
    const latestItems = latestPeriod?.items ?? [];

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

    // --- Ageing (using GR Issue Date) ---
    const ageingItems = getInventoryAgeing();
    const ageingBuckets = calculateAgeing(ageingItems);
    const totalUnrestrictedValue = ageingItems.reduce(
      (s, i) => s + i.valueUnrestricted,
      0
    );
    const deadStockValue = calculateDeadStock(ageingItems);
    const deadStockCount = calculateDeadStockCount(ageingItems);
    const slowMovingValue = calculateSlowMovingValue(ageingItems);
    const avgInventoryAge = calculateAverageInventoryAge(ageingItems);

    // Filter storage location ageing to only the 13 specified locations
    const allStorageLocationAgeing = calculateStorageLocationAgeing(ageingItems);
    const allowedLocations = new Set<string>(STORAGE_LOCATIONS);
    const storageLocationAgeing = allStorageLocationAgeing.filter(
      (loc) => allowedLocations.has(loc.storageLocation)
    );

    // --- Import GIT (using Invoice Date for age) ---
    const gitItems = getImportGIT();
    const totalImportValue = calculateImportValue(gitItems);
    const totalCYValue = calculateImportCYValue(gitItems);
    const vendorCount = new Set(gitItems.map((i) => i.vendorCode)).size;

    const gitAgeingBuckets = calculateGitAgeing(gitItems);
    const criticalGitInvoices = calculateCriticalGitInvoices(gitItems);

    const currencyMap = new Map<string, { totalValue: number; count: number }>();
    for (const item of gitItems) {
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

    const productMap = new Map<string, { totalValue: number; totalCYValue: number; count: number }>();
    for (const item of gitItems) {
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

    // AI Insights generation
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
        deadStockValue: Math.round(deadStockValue * 100) / 100,
        deadStockCount,
        slowMovingValue: Math.round(slowMovingValue * 100) / 100,
        avgInventoryAge,
        buckets: ageingBuckets,
        storageLocationAgeing,
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
      },
      stockValueScatter: [],
      aiInsights,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute summary' },
      { status: 500 }
    );
  }
}

// ─── AI Insight Generator ───

interface InsightInput {
  totalValue: number;
  totalStock: number;
  materialCount: number;
  deadStockValue: number;
  deadStockCount: number;
  slowMovingValue: number;
  avgInventoryAge: number;
  totalImportValue: number;
  criticalGitCount: number;
  periodSummaries: { period: string; totalValue: number; totalStock: number; momValueChange: number }[];
  storageLocationAgeing: { storageLocation: string; totalValue: number; avgAge: number }[];
  inventoryByType: { type: string; totalValue: number; percentage: number }[];
}

interface AIInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'trend' | 'risk' | 'recommendation' | 'opportunity';
  metric?: string;
  value?: string;
}

function generateAIInsights(input: InsightInput): AIInsight[] {
  const insights: AIInsight[] = [];
  let id = 1;

  // MoM trend insights
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

  // Dead stock insights
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

  // Slow moving inventory
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

  // Average inventory age
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

  // Critical GIT invoices
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

  // Storage location insight (highest ageing)
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

  // Inventory type with highest contribution
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

  // Cost saving opportunity
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
