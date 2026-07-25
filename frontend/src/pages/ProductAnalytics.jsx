import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Boxes, Layers, IndianRupee, Timer } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { KPICard } from '../components/shared/KPICard';
import { ChartContainer } from '../components/shared/ChartContainer';
import { EmptyState } from '../components/shared/EmptyState';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { useDashboardSummary } from '../hooks/useData';
import { MultiSelect } from '../components/shared/MultiSelect';
import { PeriodTrend } from '../components/shared/PeriodTrend';
import { GlobalFilters } from '../components/shared/GlobalFilters';
import { useFilterStore } from '../store/filterStore';
import { useFilterOptions } from '../hooks/useFilters';
import { STORAGE_AGE_BUCKETS } from '../config/constants';

echarts.use([
  BarChart,
  PieChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const BUCKET_COLORS = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444', '#7f1d1d', '#991b1b', '#78350f', '#365314', '#1e3a5f'];

function fmtInr(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
}

export default function ProductAnalyticsPage() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedBuckets, setSelectedBuckets] = useState([]);

  const MONTH_NAMES_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const yearQuery = selectedYears.length === 1 ? selectedYears[0] : '';
  const monthName = selectedMonths.length === 1 ? selectedMonths[0] : '';
  const monthQuery = monthName ? String(MONTH_NAMES_FULL.indexOf(monthName) + 1) : '';
  const datesQuery = selectedDates.length > 0 ? selectedDates : [];

  const { data: summary, isLoading, isError, error } = useDashboardSummary({
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

  const productAgeing = summary?.productAnalytics ?? [];
  const bucketNames = STORAGE_AGE_BUCKETS;

  const productOptions = useMemo(
    () => productAgeing.map((p) => p.productType),
    [productAgeing]
  );

  const allPeriods = summary?.inventory?.periodSummaries ?? [];
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

  const products = useMemo(() => {
    const rows = productAgeing.map((p) => {
      const buckets = {};
      let filteredValue = 0;
      let filteredQuantity = 0;
      for (const b of p.buckets) {
        const isMatched = selectedBuckets.length === 0 || selectedBuckets.includes(b.bucket);
        if (isMatched) {
          filteredValue += b.totalValue || 0;
          filteredQuantity += b.totalQuantity || 0;
        }
        buckets[b.bucket] = b.totalValue;
      }
      return {
        productType: p.productType,
        totalValue: selectedBuckets.length === 0 ? p.totalValue : filteredValue,
        totalQuantity: selectedBuckets.length === 0 ? p.totalQuantity : filteredQuantity,
        materialCount: p.materialCount,
        avgAge: p.avgAge,
        inventoryPercentage: p.inventoryPercentage,
        buckets,
      };
    });
    if (selectedProducts.length === 0) return rows;
    return rows.filter((r) => selectedProducts.includes(r.productType));
  }, [productAgeing, selectedProducts, selectedBuckets]);

  const grandTotalValue = useMemo(
    () => products.reduce((s, p) => s + p.totalValue, 0),
    [products]
  );

  const kpis = useMemo(() => ({
    totalTypes: products.length,
    totalValue: grandTotalValue,
    totalQty: products.reduce((s, p) => s + p.totalQuantity, 0),
    totalMaterials: products.reduce((s, p) => s + p.materialCount, 0),
  }), [products, grandTotalValue]);

  const barValueOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', formatter: (p) => `<b>${p[0].name}</b><br/>Value: ${fmtInr(p[0].value)}` },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: products.map((p) => p.productType), axisLabel: { fontSize: 11 } },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        { type: 'bar', data: products.map((p) => p.totalValue), itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] }, barWidth: '50%' },
      ],
    }),
    [products]
  );

  const pieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: (p) => `${p.name}: ${fmtInr(p.value)} (${Math.round(p.percent)}%)` },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%', fontSize: 11 },
          data: products.map((p) => ({ name: p.productType, value: p.totalValue })),
        },
      ],
    }),
    [products]
  );

  const stackedOption = useMemo(() => {
    const activeBuckets = bucketNames.filter((b) =>
      products.some((p) => (p.buckets[b] ?? 0) > 0)
    );
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
        let s = `<b>${params[0].name}</b><br/>`;
        params.forEach((p) => { s += `${p.marker} ${p.seriesName}: ${fmtInr(p.value)}<br/>`; });
        return s;
      } },
      legend: { data: activeBuckets, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: products.map((p) => p.productType) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: activeBuckets.map((b, i) => ({
        name: b,
        type: 'bar',
        stack: 'total',
        data: products.map((p) => p.buckets[b] ?? 0),
        itemStyle: { color: BUCKET_COLORS[i % BUCKET_COLORS.length] },
      })),
    };
  }, [products, bucketNames]);

  if (isLoading && !summary) return <PageSkeleton />;
  if (isError)
    return (
      <EmptyState
        title="Data not available"
        description={error?.message ?? 'Upload Ageing Report via the Upload button to see product analytics.'}
      />
    );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <PageHeader
        title="Product Analytics"
        description="Product-wise ageing analysis calculated from SAP inventory data."
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 rounded-xl border border-border/50 bg-card p-4 items-end">
        <MultiSelect label="Year" options={yearOptions} selected={selectedYears} onChange={setSelectedYears} />
        <MultiSelect label="Month" options={monthOptions} selected={selectedMonths} onChange={setSelectedMonths} />
        <MultiSelect label="Date" options={dateOptions} selected={selectedDates} onChange={setSelectedDates} />
        <MultiSelect label="Product Type" options={productOptions} selected={selectedProducts} onChange={setSelectedProducts} />
        <MultiSelect label="Age Bucket" options={STORAGE_AGE_BUCKETS} selected={selectedBuckets} onChange={setSelectedBuckets} />
      </div>

      {filteredPeriods.length > 0 && (
        <PeriodTrend periods={filteredPeriods} startIndex={0} selectedTypes={selectedProducts} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Product Types" value={kpis.totalTypes} format="number" icon={Layers} color="blue" index={0} />
        <KPICard label="Total Inventory Value" value={kpis.totalValue} format="currency" icon={IndianRupee} color="emerald" index={1} />
        <KPICard label="Total Quantity" value={kpis.totalQty} format="number" icon={Boxes} color="purple" index={2} />
        <KPICard label="Total Materials" value={kpis.totalMaterials} format="number" icon={Timer} color="amber" index={3} />
      </div>

      <section className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Product-wise Ageing Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
              <tr>
                <th className="py-2 px-2 text-left">Product Type</th>
                {bucketNames.map((b) => (
                  <th key={b} className="py-2 px-2 text-right">{b}</th>
                ))}
                <th className="py-2 px-2 text-right">Grand Total</th>
                <th className="py-2 px-2 text-right">Inv %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const pct = grandTotalValue > 0 ? (p.totalValue / grandTotalValue) * 100 : 0;
                return (
                  <tr key={p.productType} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{p.productType}</td>
                    {bucketNames.map((b) => (
                      <td key={b} className="py-2 px-2 text-right tabular-nums">{fmtInr(p.buckets[b] ?? 0)}</td>
                    ))}
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-600">{fmtInr(p.totalValue)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Math.round(pct)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
              <tr>
                <td className="py-2 px-2">Grand Total</td>
                {bucketNames.map((b) => (
                  <td key={b} className="py-2 px-2 text-right tabular-nums">
                    {fmtInr(products.reduce((s, p) => s + (p.buckets[b] ?? 0), 0))}
                  </td>
                ))}
                <td className="py-2 px-2 text-right tabular-nums">{fmtInr(grandTotalValue)}</td>
                <td className="py-2 px-2 text-right tabular-nums">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Inventory Value by Product" subtitle="Grand Total per product" index={0}>
          <ReactEChartsCore echarts={echarts} option={barValueOption} style={{ height: 340 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Value Share by Product" subtitle="Contribution to grand total" index={1}>
          <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 340 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>

      <ChartContainer title="Ageing Distribution by Product" subtitle="Stacked value across age buckets" index={2}>
        <ReactEChartsCore echarts={echarts} option={stackedOption} style={{ height: 380 }} notMerge lazyUpdate />
      </ChartContainer>
    </motion.div>
  );
}
