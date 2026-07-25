import { useMemo, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  Package,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { KPICard } from '../components/shared/KPICard';
import { ChartContainer } from '../components/shared/ChartContainer';
import { EmptyState } from '../components/shared/EmptyState';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { Button } from '../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/DropdownMenu';
import { useDashboardSummary, useExportData } from '../hooks/useData';
import { MultiSelect } from '../components/shared/MultiSelect';
import { PeriodTrend } from '../components/shared/PeriodTrend';
import { GlobalFilters } from '../components/shared/GlobalFilters';
import { useFilterStore } from '../store/filterStore';
import { useFilterOptions } from '../hooks/useFilters';
import { formatCurrency } from '../lib/formatters';

echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const TYPE_COLORS = {
  YBOP: '#3b82f6',
  YFGS: '#10b981',
  YSFG: '#f59e0b',
  YSCP: '#8b5cf6',
};

import { STORAGE_AGE_BUCKETS } from '../config/constants';

export default function InventoryPage() {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedBuckets, setSelectedBuckets] = useState([]);

  const MONTH_NAMES_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const yearQuery = selectedYears.length === 1 ? selectedYears[0] : '';
  const monthName = selectedMonths.length === 1 ? selectedMonths[0] : '';
  const monthQuery = monthName ? String(MONTH_NAMES_FULL.indexOf(monthName) + 1) : '';
  const datesQuery = selectedDates.length > 0 ? selectedDates : [];

  const { data: summaryData, isLoading, isError, error } = useDashboardSummary({
    year: yearQuery,
    month: monthQuery,
    dates: datesQuery,
  });

  const maxDays = useMemo(() => {
    const years = selectedYears.length > 0 ? selectedYears.map(Number) : [new Date().getFullYear()];
    const months = selectedMonths.length > 0 ? selectedMonths.map(m => MONTH_NAMES_FULL.indexOf(m)) : Array.from({length: 12}, (_, i) => i);
    
    let max = 31;
    if (selectedMonths.length > 0) {
      max = 0;
      for (const y of years) {
        for (const m of months) {
          if (m >= 0 && m < 12) {
            const days = new Date(y, m + 1, 0).getDate();
            if (days > max) max = days;
          }
        }
      }
    }
    return max;
  }, [selectedYears, selectedMonths]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => String(i + 1));
  }, [maxDays]);

  useEffect(() => {
    if (selectedDates.length > 0) {
      const validDates = selectedDates.filter(d => Number(d) <= maxDays);
      if (validDates.length !== selectedDates.length) {
        setSelectedDates(validDates);
      }
    }
  }, [maxDays, selectedDates]);

  const { data: filterOptions = {} } = useFilterOptions();
  const gf = useFilterStore();
  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format) => {
      exportMutation.mutate({
        module: 'inventory',
        format,
        years: selectedYears,
        months: selectedMonths.map(m => MONTH_NAMES_FULL.indexOf(m) + 1),
        products: selectedProducts,
        locations: selectedLocations,
        days: selectedBuckets,
        dayDates: selectedDates,
      });
    },
    [exportMutation, selectedYears, selectedMonths, selectedProducts, selectedLocations, selectedBuckets, selectedDates]
  );

  const byType = summaryData?.inventory?.inventoryByType ?? [];

  const filteredByType = useMemo(() => {
    if (selectedProducts.length === 0) return byType;
    return byType.filter((t) => selectedProducts.includes(t.type));
  }, [byType, selectedProducts]);

  const allPeriods = summaryData?.inventory?.periodSummaries ?? [];
  const yearOptions = useMemo(() => filterOptions.years?.map(String) || [], [filterOptions]);
  const monthOptions = useMemo(() => filterOptions.months?.map((m) => m.name) || [], [filterOptions]);

  const filteredPeriods = useMemo(() => {
    return allPeriods.filter((p) => {
      const [month, year] = p.period.split(' ');
      if (selectedYears.length > 0 && !selectedYears.includes(year)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return false;
      return true;
    });
  }, [allPeriods, selectedYears, selectedMonths]);

  const totalValue = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredByType.reduce((s, t) => s + t.totalValue, 0);
    }
    return filteredPeriods.length > 0 ? filteredPeriods[filteredPeriods.length - 1].totalValue : (summaryData?.inventory?.totalValue ?? 0);
  }, [filteredByType, selectedProducts, filteredPeriods, summaryData]);

  const totalStock = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredByType.reduce((s, t) => s + t.totalStock, 0);
    }
    return filteredPeriods.length > 0 ? filteredPeriods[filteredPeriods.length - 1].totalStock : (summaryData?.inventory?.totalStock ?? 0);
  }, [filteredByType, selectedProducts, filteredPeriods, summaryData]);

  const materialCount = useMemo(() => {
    if (selectedProducts.length > 0) {
      return filteredByType.reduce((s, t) => s + t.count, 0);
    }
    return filteredPeriods.length > 0 ? filteredPeriods[filteredPeriods.length - 1].materialCount : (summaryData?.inventory?.materialCount ?? 0);
  }, [filteredByType, selectedProducts, filteredPeriods, summaryData]);

  const monthlyComparisonOption = useMemo(() => {
    const periods = filteredPeriods.length > 0 ? filteredPeriods : allPeriods;
    const labels = periods.map((p) => p.period);
    const values = periods.map((p) => p.totalValue);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Value: ${formatCurrency(p.value)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (val) =>
            val >= 10000000 ? `${(val / 10000000).toFixed(1)}Cr`
              : val >= 100000 ? `${(val / 100000).toFixed(1)}L`
              : val >= 1000 ? `${(val / 1000).toFixed(0)}K`
              : String(val),
        },
      },
      series: [
        {
          name: 'Inventory Value',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { borderRadius: [4, 4, 0, 0], color: i === 0 ? '#6366f1' : '#3b82f6' },
          })),
          barWidth: '40%',
        },
      ],
    };
  }, [filteredPeriods, allPeriods]);

  const typeComparisonOption = useMemo(() => {
    const types = filteredByType.map((t) => t.type);
    const values = filteredByType.map((t) => t.totalValue);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Value: ${formatCurrency(p.value)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: types,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (val) =>
            val >= 10000000 ? `${(val / 10000000).toFixed(1)}Cr`
              : val >= 100000 ? `${(val / 100000).toFixed(1)}L`
              : val >= 1000 ? `${(val / 1000).toFixed(0)}K`
              : String(val),
        },
      },
      series: [
        {
          name: 'Value',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { borderRadius: [4, 4, 0, 0], color: TYPE_COLORS[types[i]] ?? '#94a3b8' },
          })),
          barWidth: '50%',
        },
      ],
    };
  }, [filteredByType]);

  if (isLoading && !summaryData) return <PageSkeleton />;
  if (isError)
    return (
      <EmptyState
        title="Error loading data"
        description={error instanceof Error ? error.message : 'An error occurred'}
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <PageHeader
        title="Closing Inventory"
        description="Complete inventory valuation and stock overview from SAP"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileSpreadsheet className="h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 rounded-xl border border-border/50 bg-card p-4 items-end">
        <MultiSelect label="Year" options={yearOptions} selected={selectedYears} onChange={setSelectedYears} />
        <MultiSelect label="Month" options={monthOptions} selected={selectedMonths} onChange={setSelectedMonths} />
        <MultiSelect label="Date" options={dateOptions} selected={selectedDates} onChange={setSelectedDates} />
        <MultiSelect label="Product Type" options={filterOptions.products || []} selected={selectedProducts} onChange={setSelectedProducts} />
        <MultiSelect label="Storage Location" options={filterOptions.locations || []} selected={selectedLocations} onChange={setSelectedLocations} searchable />
        <MultiSelect label="Age Bucket" options={STORAGE_AGE_BUCKETS} selected={selectedBuckets} onChange={setSelectedBuckets} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Total Value" value={totalValue} format="currency" icon={IndianRupee} color="emerald" index={0} />
        <KPICard label="Total Stock" value={totalStock} format="number" icon={Package} color="blue" index={1} />
        <KPICard label="Materials" value={materialCount} format="number" icon={Package} color="purple" index={2} />
      </div>

      {filteredPeriods.length > 0 && <PeriodTrend periods={filteredPeriods} startIndex={0} />}

      {filteredByType.length > 0 && (
        <section className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Inventory by Type</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-right">Materials</th>
                  <th className="py-2 px-3 text-right">Total Stock</th>
                  <th className="py-2 px-3 text-right">Total Value</th>
                  <th className="py-2 px-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredByType.map((t) => (
                  <tr key={t.type} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{t.type}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{t.count.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{Math.round(t.totalStock).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-emerald-600">{formatCurrency(t.totalValue)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{Math.round(t.percentage)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer title="Monthly Closing Inventory Comparison" subtitle="Inventory value comparison across periods" index={0}>
          <ReactEChartsCore echarts={echarts} option={monthlyComparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Closing Inventory Value by Type" subtitle="Inventory value distribution across inventory types" index={1}>
          <ReactEChartsCore echarts={echarts} option={typeComparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>
    </motion.div>
  );
}
