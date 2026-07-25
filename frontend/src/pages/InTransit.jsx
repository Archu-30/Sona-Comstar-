import { useMemo, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Package,
  FileWarning,
  AlertTriangle,
  Users,
  TrendingUp,
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
import { useImportData, useExportData, useDashboardSummary } from '../hooks/useData';
import { MultiSelect } from '../components/shared/MultiSelect';
import { MonthlyTrend } from '../components/shared/MonthlyTrend';
import { GlobalFilters } from '../components/shared/GlobalFilters';
import { useFilterStore } from '../store/filterStore';
import { useFilterOptions } from '../hooks/useFilters';
import { formatCurrency, formatNumber } from '../lib/formatters';
import { calculateGitAge, getGitAgeBucket } from '../lib/calculations';
import { GIT_AGE_BUCKETS } from '../config/constants';

echarts.use([
  BarChart,
  PieChart,
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const CHART_COLORS = ['#06b6d4', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.98)',
  borderColor: '#e2e8f0',
  textStyle: { color: '#1e293b', fontSize: 12 },
};

function fmtCompact(val) {
  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return String(val);
}

export default function InTransitPage() {
  const MONTH_NAMES_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedBuckets, setSelectedBuckets] = useState([]);

  const yearQuery = selectedYears.length === 1 ? selectedYears[0] : '';
  const monthName = selectedMonths.length === 1 ? selectedMonths[0] : '';
  const monthQuery = monthName ? String(MONTH_NAMES_FULL.indexOf(monthName) + 1) : '';
  const datesQuery = selectedDates.length > 0 ? selectedDates : [];

  const { data, isLoading, isError, error } = useImportData({
    page: 1,
    pageSize: 500,
  });

  const { data: summary } = useDashboardSummary({
    year: yearQuery,
    month: monthQuery,
    dates: datesQuery,
  });

  const { data: filterOptions = {} } = useFilterOptions();
  const gf = useFilterStore();

  const exportMutation = useExportData();

  const rawItems = data?.data ?? [];

  const productOptions = useMemo(
    () => [...new Set(rawItems.map((i) => i.product || 'Other'))].sort(),
    [rawItems]
  );

  const locationOptions = useMemo(
    () => filterOptions.locations || [],
    [filterOptions]
  );

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

  const yearOptions = useMemo(() => {
    const years = new Set();
    for (const item of rawItems) {
      if (!item.invoiceDate) continue;
      const d = new Date(item.invoiceDate);
      if (!isNaN(d.getTime())) {
        years.add(String(d.getFullYear()));
      }
    }
    return [...years].sort();
  }, [rawItems]);

  const monthOptions = useMemo(() => {
    const months = new Set();
    for (const item of rawItems) {
      if (!item.invoiceDate) continue;
      const d = new Date(item.invoiceDate);
      if (!isNaN(d.getTime())) {
        months.add(MONTH_NAMES_FULL[d.getMonth()]);
      }
    }
    return [...months].sort((a, b) => MONTH_NAMES_FULL.indexOf(a) - MONTH_NAMES_FULL.indexOf(b));
  }, [rawItems]);

  const allItems = useMemo(() => {
    return rawItems.filter((i) => {
      // 1. Product Type filter
      if (selectedProducts.length > 0 && !selectedProducts.includes(i.product || 'Other')) return false;

      // Date parsing for Year/Month/Date
      if (i.invoiceDate) {
        const d = new Date(i.invoiceDate);
        if (!isNaN(d.getTime())) {
          const yr = String(d.getFullYear());
          const mo = MONTH_NAMES_FULL[d.getMonth()];
          const dt = String(d.getDate());
          if (selectedYears.length > 0 && !selectedYears.includes(yr)) return false;
          if (selectedMonths.length > 0 && !selectedMonths.includes(mo)) return false;
          if (selectedDates.length > 0 && !selectedDates.includes(dt)) return false;
        }
      } else {
        if (selectedYears.length > 0 || selectedMonths.length > 0 || selectedDates.length > 0) return false;
      }

      // 2. Age Bucket filter
      if (selectedBuckets.length > 0) {
        const days = calculateGitAge(i.invoiceDate);
        const bucket = getGitAgeBucket(days);
        if (!selectedBuckets.includes(bucket)) return false;
      }

      return true;
    });
  }, [rawItems, selectedProducts, selectedYears, selectedMonths, selectedDates, selectedBuckets]);

  const handleExport = useCallback(
    (format) => {
      exportMutation.mutate({
        module: 'git',
        format,
        years: selectedYears,
        months: selectedMonths.map(m => MONTH_NAMES_FULL.indexOf(m) + 1), // backend expects 1-12 month integers
        products: selectedProducts,
        days: selectedBuckets,
        dayDates: selectedDates,
      });
    },
    [exportMutation, selectedYears, selectedMonths, selectedProducts, selectedBuckets, selectedDates]
  );

  // Invoice-month trend computed from the (product-filtered) items so it
  // responds to the Products filter as well as Year/Month
  const invoiceTrend = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      if (!item.invoiceDate || item.invoiceDate <= 0) continue;
      const d = new Date(item.invoiceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const e = map.get(key) ?? { month: key, totalValue: 0, totalQuantity: 0, count: 0 };
      e.totalValue += item.value || 0;
      e.totalQuantity += item.qty || 0;
      e.count++;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [allItems]);

  // 2+ products selected → one trend line per product for comparison
  const invoiceSeriesData = useMemo(() => {
    if (selectedProducts.length < 2) return null;
    const map = new Map();
    for (const item of allItems) {
      if (!item.invoiceDate || item.invoiceDate <= 0) continue;
      const d = new Date(item.invoiceDate);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const series = item.product || 'Other';
      const k = `${series}|${month}`;
      map.set(k, (map.get(k) ?? 0) + (item.value || 0));
    }
    return [...map.entries()].map(([k, value]) => {
      const [series, month] = k.split('|');
      return { series, month, value };
    });
  }, [allItems, selectedProducts]);
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendYearOptions = useMemo(
    () => [...new Set(invoiceTrend.map((d) => d.month.split('-')[0]))].sort(),
    [invoiceTrend]
  );
  const trendMonthOptions = useMemo(
    () => [...new Set(invoiceTrend.map((d) => MONTH_NAMES[Number(d.month.split('-')[1]) - 1]))],
    [invoiceTrend]
  );

  const kpis = useMemo(() => {
    const pendingValue = allItems.reduce((s, r) => s + r.value, 0);
    const pendingQty = allItems.reduce((s, r) => s + r.qty, 0);
    const pendingInvoiceCount = new Set(allItems.map((r) => r.invoiceNumber)).size;
    const vendorCount = new Set(allItems.map((r) => r.vendorCode)).size;
    const cyValue = allItems.reduce((s, r) => s + (r.cyValue || 0), 0);
    const criticalCount = allItems.filter(
      (r) => calculateGitAge(r.invoiceDate) > 90
    ).length;
    const avgAge = allItems.length > 0
      ? Math.round(allItems.reduce((s, r) => s + calculateGitAge(r.invoiceDate), 0) / allItems.length)
      : 0;
    return { pendingValue, pendingQty, pendingInvoiceCount, vendorCount, cyValue, criticalCount, avgAge };
  }, [allItems]);

  // Product distribution (donut)
  const productChartData = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      const product = item.product || 'Other';
      map.set(product, (map.get(product) ?? 0) + item.value);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      }));
  }, [allItems]);

  // GIT ageing buckets
  const gitAgeingChartData = useMemo(() => {
    const bucketOrder = [...GIT_AGE_BUCKETS];
    const valueMap = new Map();
    const countMap = new Map();
    for (const b of bucketOrder) {
      valueMap.set(b, 0);
      countMap.set(b, 0);
    }
    for (const item of allItems) {
      const days = calculateGitAge(item.invoiceDate);
      const bucket = getGitAgeBucket(days);
      if (bucket === 'Unknown') continue;
      valueMap.set(bucket, (valueMap.get(bucket) ?? 0) + item.value);
      countMap.set(bucket, (countMap.get(bucket) ?? 0) + 1);
    }
    return {
      buckets: bucketOrder,
      values: bucketOrder.map((b) => valueMap.get(b) ?? 0),
      counts: bucketOrder.map((b) => countMap.get(b) ?? 0),
    };
  }, [allItems]);

  // Supplier contribution (donut)
  const supplierDonutData = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      const supplier = item.vendorCode || 'Unknown';
      map.set(supplier, (map.get(supplier) ?? 0) + item.value);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], i) => ({
        name,
        value,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      }));
  }, [allItems]);

  // Invoice age distribution (column chart with count)
  const invoiceAgeData = useMemo(() => {
    const bucketOrder = [...GIT_AGE_BUCKETS];
    const qtyMap = new Map();
    const invoiceMap = new Map();
    for (const b of bucketOrder) {
      qtyMap.set(b, 0);
      invoiceMap.set(b, new Set());
    }
    for (const item of allItems) {
      const days = calculateGitAge(item.invoiceDate);
      const bucket = getGitAgeBucket(days);
      if (bucket === 'Unknown') continue;
      qtyMap.set(bucket, (qtyMap.get(bucket) ?? 0) + item.qty);
      invoiceMap.get(bucket)?.add(item.invoiceNumber);
    }
    return {
      buckets: bucketOrder,
      quantities: bucketOrder.map((b) => qtyMap.get(b) ?? 0),
      invoiceCounts: bucketOrder.map((b) => invoiceMap.get(b)?.size ?? 0),
    };
  }, [allItems]);

  // Currency breakdown
  const currencyData = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      const cur = item.currency || 'INR';
      map.set(cur, (map.get(cur) ?? 0) + item.value);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      }));
  }, [allItems]);

  // --- Chart options ---

  const productPieOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'item',
        formatter: (params) =>
          `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
           <div>Value: <b>${formatCurrency(params.value)}</b></div>
           <div>Share: <b>${params.percent.toFixed(1)}%</b></div>`,
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
          },
          data: productChartData,
        },
      ],
    }),
    [productChartData]
  );

  const gitAgeingBarOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          const idx = gitAgeingChartData.buckets.indexOf(p.name);
          return `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
                  <div>Value: <b>${formatCurrency(p.value)}</b></div>
                  <div>Items: <b>${gitAgeingChartData.counts[idx]}</b></div>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '18%', containLabel: true },
      xAxis: {
        type: 'category',
        data: gitAgeingChartData.buckets,
        axisLabel: { color: '#64748b', fontSize: 9, rotate: 35, interval: 0 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, formatter: fmtCompact },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'GIT Value',
          type: 'bar',
          data: gitAgeingChartData.values.map((v, i) => ({
            value: v,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: i >= gitAgeingChartData.buckets.length - 2 ? '#ef4444' : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#22d3ee' },
                { offset: 1, color: '#0891b2' },
              ]),
            },
          })),
          barWidth: '50%',
        },
      ],
    }),
    [gitAgeingChartData]
  );

  const supplierDonutOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'item',
        formatter: (params) =>
          `<div style="font-weight:600;margin-bottom:4px">Supplier: ${params.name}</div>
           <div>Pending Value: <b>${formatCurrency(params.value)}</b></div>
           <div>Share: <b>${params.percent.toFixed(1)}%</b></div>`,
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
          },
          data: supplierDonutData,
        },
      ],
    }),
    [supplierDonutData]
  );

  const invoiceAgeOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'axis',
        formatter: (params) => {
          let s = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
          params.forEach((p) => {
            s += `<div>${p.marker} ${p.seriesName}: <b>${formatNumber(p.value)}</b></div>`;
          });
          return s;
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '18%', containLabel: true },
      xAxis: {
        type: 'category',
        data: invoiceAgeData.buckets,
        axisLabel: { color: '#64748b', fontSize: 9, rotate: 35, interval: 0 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Quantity',
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          axisLabel: { color: '#64748b', fontSize: 11, formatter: fmtCompact },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value',
          name: 'Invoices',
          nameTextStyle: { color: '#64748b', fontSize: 10 },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Pending Qty',
          type: 'bar',
          yAxisIndex: 0,
          data: invoiceAgeData.quantities,
          itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] },
          barWidth: '35%',
        },
        {
          name: 'Invoice Count',
          type: 'line',
          yAxisIndex: 1,
          data: invoiceAgeData.invoiceCounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2 },
        },
      ],
    }),
    [invoiceAgeData]
  );

  const currencyPieOption = useMemo(
    () => ({
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'item',
        formatter: (params) =>
          `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
           <div>Value: <b>${formatCurrency(params.value)}</b></div>
           <div>Share: <b>${params.percent.toFixed(1)}%</b></div>`,
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '42%'],
          padAngle: 3,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%', fontSize: 11 },
          data: currencyData,
        },
      ],
    }),
    [currencyData]
  );

  // GIT age bucket summary table data
  const gitBucketSummary = summary?.importStats?.gitAgeingBuckets ?? [];

  if (isLoading && !data) {
    return <PageSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Error loading data"
        description={error instanceof Error ? error.message : 'An error occurred'}
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title="In-Transit Inventory (Import GIT)"
        description="Goods in transit from import suppliers — executive analytics view"
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
        <MultiSelect label="Product Type" options={productOptions} selected={selectedProducts} onChange={setSelectedProducts} />
        <MultiSelect label="Storage Location" options={locationOptions} selected={selectedLocations} onChange={setSelectedLocations} searchable />
        <MultiSelect label="Age Bucket" options={GIT_AGE_BUCKETS} selected={selectedBuckets} onChange={setSelectedBuckets} />
      </div>

      <MonthlyTrend
        data={invoiceTrend}
        seriesData={invoiceSeriesData}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        title="GIT Value Trend by Invoice Month"
        subtitle="One line per selected product — compare pending value across invoice months"
        index={0}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard label="Pending Value" value={kpis.pendingValue} format="currency" icon={IndianRupee} color="cyan" index={0} />
        <KPICard label="CY Value" value={kpis.cyValue} format="currency" icon={IndianRupee} color="emerald" index={1} />
        <KPICard label="Pending Qty" value={kpis.pendingQty} format="number" icon={Package} color="blue" index={2} />
        <KPICard label="Invoices" value={kpis.pendingInvoiceCount} format="number" icon={FileWarning} color="purple" index={3} />
        <KPICard label="Vendors" value={kpis.vendorCount} format="number" icon={Users} color="amber" index={4} />
        <KPICard label="Avg Age (days)" value={kpis.avgAge} format="number" icon={TrendingUp} color="orange" index={5} />
        <KPICard label="Critical (>90d)" value={kpis.criticalCount} format="number" icon={AlertTriangle} color="rose" index={6} />
      </div>

      {/* Row 1: Product Distribution + GIT Ageing */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer title="GIT Value by Product" subtitle="Distribution of in-transit value across product categories" index={0}>
          <ReactEChartsCore echarts={echarts} option={productPieOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="GIT Ageing Distribution" subtitle="Pending value by age buckets (Current Date - Invoice Date)" index={1}>
          <ReactEChartsCore echarts={echarts} option={gitAgeingBarOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>

      {/* Row 2: Supplier Contribution + Invoice Age */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer title="Supplier Contribution" subtitle="Top suppliers by pending import value" index={2}>
          <ReactEChartsCore echarts={echarts} option={supplierDonutOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Invoice Age & Quantity Distribution" subtitle="Pending quantity and invoice count by age bucket" index={3}>
          <ReactEChartsCore echarts={echarts} option={invoiceAgeOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>

      {/* Row 3: Currency breakdown + GIT Ageing Summary Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer title="Currency Breakdown" subtitle="Import value distribution by currency" index={4}>
          <ReactEChartsCore echarts={echarts} option={currencyPieOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>

        <section className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">GIT Ageing Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="py-2 px-3 text-left">Age Bucket</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Value</th>
                  <th className="py-2 px-3 text-right">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {gitBucketSummary.map((b) => (
                  <tr key={b.bucket} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{b.bucket}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatNumber(b.totalQuantity)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium text-cyan-600">{formatCurrency(b.totalValue)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{b.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
                <tr>
                  <td className="py-2 px-3">Grand Total</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatNumber(gitBucketSummary.reduce((s, b) => s + b.totalQuantity, 0))}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-cyan-600">{formatCurrency(gitBucketSummary.reduce((s, b) => s + b.totalValue, 0))}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{gitBucketSummary.reduce((s, b) => s + b.invoiceCount, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
