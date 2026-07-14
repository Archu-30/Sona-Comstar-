import { useMemo, useCallback, useState } from 'react';
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

export default function InventoryPage() {
  const { data: summaryData, isLoading, isError, error } = useDashboardSummary();
  const { data: filterOptions = {} } = useFilterOptions();
  const gf = useFilterStore();
  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format) => {
      exportMutation.mutate({ module: 'inventory', format });
    },
    [exportMutation]
  );

  const totalValue = summaryData?.inventory?.totalValue ?? 0;
  const totalStock = summaryData?.inventory?.totalStock ?? 0;
  const materialCount = summaryData?.inventory?.materialCount ?? 0;
  const byType = summaryData?.inventory?.inventoryByType ?? [];

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);

  const allPeriods = summaryData?.inventory?.periodSummaries ?? [];
  const yearOptions = useMemo(
    () => [...new Set(allPeriods.map((p) => p.period.split(' ')[1]).filter(Boolean))].sort(),
    [allPeriods]
  );
  const monthOptions = useMemo(
    () => [...new Set(allPeriods.map((p) => p.period.split(' ')[0]))],
    [allPeriods]
  );
  const filteredPeriods = useMemo(() => {
    return allPeriods.filter((p) => {
      const [month, year] = p.period.split(' ');
      if (selectedYears.length > 0 && !selectedYears.includes(year)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) return false;
      return true;
    });
  }, [allPeriods, selectedYears, selectedMonths]);

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
    const types = byType.map((t) => t.type);
    const values = byType.map((t) => t.totalValue);

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
  }, [byType]);

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

      <GlobalFilters
        filters={gf}
        onChange={(f) => gf.setFilters(f)}
        options={filterOptions}
      />

      {allPeriods.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/50 bg-card p-4">
          <MultiSelect label="Year" options={yearOptions} selected={selectedYears} onChange={setSelectedYears} />
          <MultiSelect label="Month" options={monthOptions} selected={selectedMonths} onChange={setSelectedMonths} />
          <p className="pb-2 text-xs text-muted-foreground">
            {filteredPeriods.length} of {allPeriods.length} periods selected — compare trends below
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Total Value" value={totalValue} format="currency" icon={IndianRupee} color="emerald" index={0} />
        <KPICard label="Total Stock" value={totalStock} format="number" icon={Package} color="blue" index={1} />
        <KPICard label="Materials" value={materialCount} format="number" icon={Package} color="purple" index={2} />
      </div>

      {filteredPeriods.length > 0 && <PeriodTrend periods={filteredPeriods} startIndex={0} />}

      {byType.length > 0 && (
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
                {byType.map((t) => (
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
