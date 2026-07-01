'use client';

import { useState, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
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
import {
  Truck,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Package,
  FileWarning,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataTable } from '@/components/shared/data-table';
import { ChartContainer } from '@/components/shared/chart-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useImportData, useExportData } from '@/hooks/use-data';
import { formatCurrency, formatNumber, formatDate } from '@/lib/formatters';
import { calculateGitAge, getGitAgeBucket } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GIT_AGE_BUCKETS } from '@/config/constants';
import type { ImportGITItem } from '@/types';

echarts.use([
  BarChart,
  PieChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const CHART_COLORS = ['#06b6d4', '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];

export default function InTransitPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error } = useImportData({
    page: 1,
    pageSize: 500,
    search,
    sortField,
    sortDir,
    filters,
  });

  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format: 'xlsx' | 'csv') => {
      exportMutation.mutate({ module: 'git', format, filters, search });
    },
    [exportMutation, filters, search]
  );

  const handleSortChange = useCallback(
    (field: string, direction: 'asc' | 'desc') => {
      setSortField(field);
      setSortDir(direction);
      setPage(1);
    },
    []
  );

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
    setPage(1);
  }, []);

  const allItems = data?.data ?? [];

  // KPIs — Pending Value, Pending Quantity, Pending Invoice Count, Critical Pending Invoices
  const kpis = useMemo(() => {
    const pendingValue = allItems.reduce((s, r) => s + r.value, 0);
    const pendingQty = allItems.reduce((s, r) => s + r.qty, 0);
    const pendingInvoiceCount = new Set(allItems.map((r) => r.invoiceNumber)).size;
    const criticalCount = allItems.filter(
      (r) => calculateGitAge(r.invoiceDate) > 90
    ).length;
    return { pendingValue, pendingQty, pendingInvoiceCount, criticalCount };
  }, [allItems]);

  // Value by product chart
  const productChartData = useMemo(() => {
    const map = new Map<string, number>();
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

  // GIT Ageing Distribution chart data
  const gitAgeingChartData = useMemo(() => {
    const bucketOrder = [...GIT_AGE_BUCKETS];
    const valueMap = new Map<string, number>();
    const countMap = new Map<string, number>();
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

  const productPieOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}<br/>Value: ${formatCurrency(params.value)}<br/>Share: ${params.percent.toFixed(1)}%`,
      },
      legend: {
        orient: 'vertical' as const,
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
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
          },
          labelLine: { show: false },
          data: productChartData,
        },
      ],
    }),
    [productChartData]
  );

  const gitAgeingBarOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Value: ${formatCurrency(p.value)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: gitAgeingChartData.buckets,
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (val: number) =>
            val >= 10000000
              ? `${(val / 10000000).toFixed(1)}Cr`
              : val >= 100000
                ? `${(val / 100000).toFixed(1)}L`
                : val >= 1000
                  ? `${(val / 1000).toFixed(0)}K`
                  : String(val),
        },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'GIT Value',
          type: 'bar' as const,
          data: gitAgeingChartData.values,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#22d3ee' },
              { offset: 1, color: '#0891b2' },
            ]),
          },
          barWidth: '50%',
        },
      ],
    }),
    [gitAgeingChartData]
  );

  // Filter options
  const productOptions = useMemo(() => {
    const unique = [...new Set(allItems.map((d) => d.product))];
    return unique
      .filter(Boolean)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [allItems]);

  const currencyOptions = useMemo(() => {
    const unique = [...new Set(allItems.map((d) => d.currency))];
    return unique
      .filter(Boolean)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [allItems]);

  const filterValues = useMemo(() => {
    const vals: Record<string, string> = { ...filters };
    if (search) vals.search = search;
    return vals;
  }, [filters, search]);

  const handleFilterBarChange = useCallback(
    (key: string, value: string) => {
      if (key === 'search') {
        setSearch(value);
        setPage(1);
      } else {
        handleFilterChange(key, value);
      }
    },
    [handleFilterChange]
  );

  // Paginate client-side
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allItems.slice(start, start + pageSize);
  }, [allItems, page, pageSize]);

  const columns = useMemo<ColumnDef<ImportGITItem, unknown>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: 'Invoice No.',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'invoiceDate',
        header: 'Invoice Date',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? formatDate(new Date(val)) : '--';
        },
      },
      {
        accessorKey: 'asnCreatedOn',
        header: 'ASN Created On',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? formatDate(new Date(val)) : '--';
        },
      },
      {
        accessorKey: 'material',
        header: 'Material',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'materialDescription',
        header: 'Description',
        cell: ({ getValue }) => (
          <span className="max-w-[180px] truncate block" title={getValue<string>()}>
            {getValue<string>() || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'vendorCode',
        header: 'Vendor Code',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'currency',
        header: 'Currency',
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'rate',
        header: 'Rate',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium text-cyan-600">
            {formatCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'exRate',
        header: 'Ex. Rate',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'cyValue',
        header: 'CY Value',
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium text-emerald-600">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'product',
        header: 'Product',
      },
      {
        id: 'gitAge',
        header: 'GIT Age (Days)',
        accessorFn: (row) => calculateGitAge(row.invoiceDate),
        cell: ({ getValue }) => {
          const days = getValue<number>();
          return (
            <span className={cn(
              'tabular-nums font-medium',
              days > 90 ? 'text-red-600' : days > 60 ? 'text-orange-600' : 'text-foreground'
            )}>
              {days}
            </span>
          );
        },
      },
      {
        id: 'gitBucket',
        header: 'Age Bucket',
        accessorFn: (row) => getGitAgeBucket(calculateGitAge(row.invoiceDate)),
        cell: ({ row }) => {
          const days = calculateGitAge(row.original.invoiceDate);
          const bucket = getGitAgeBucket(days);
          return (
            <Badge variant={days > 90 ? 'destructive' : days > 60 ? 'outline' : 'secondary'}>
              {bucket}
            </Badge>
          );
        },
      },
    ],
    []
  );

  if (isLoading && !data) {
    return <PageSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Error loading data"
        description={
          error instanceof Error ? error.message : 'An error occurred'
        }
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
      {/* Header */}
      <PageHeader
        title="In-Transit Inventory (Import GIT)"
        description="Goods in transit from import suppliers — sourced from Import GIT May 2026"
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

      {/* KPI Row — Pending summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Pending Value"
          value={kpis.pendingValue}
          format="currency"
          icon={IndianRupee}
          color="cyan"
          index={0}
        />
        <KPICard
          label="Pending Quantity"
          value={kpis.pendingQty}
          format="number"
          icon={Package}
          color="blue"
          index={1}
        />
        <KPICard
          label="Pending Invoice Count"
          value={kpis.pendingInvoiceCount}
          format="number"
          icon={FileWarning}
          color="purple"
          index={2}
        />
        <KPICard
          label="Critical Pending Invoices"
          value={kpis.criticalCount}
          format="number"
          icon={AlertTriangle}
          color="rose"
          index={3}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={[
          {
            key: 'search',
            label: 'Search',
            type: 'search' as const,
            placeholder: 'Search materials, vendors, invoices...',
          },
          {
            key: 'product',
            label: 'All Products',
            type: 'select' as const,
            options: productOptions,
          },
          {
            key: 'currency',
            label: 'All Currencies',
            type: 'select' as const,
            options: currencyOptions,
          },
        ]}
        values={filterValues}
        onFilterChange={handleFilterBarChange}
        onClear={handleClearFilters}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer
          title="GIT Value by Product"
          subtitle="Distribution of in-transit value across product categories"
          index={0}
        >
          <ReactEChartsCore
            echarts={echarts}
            option={productPieOption}
            style={{ height: 320 }}
            notMerge
            lazyUpdate
          />
        </ChartContainer>
        <ChartContainer
          title="GIT Ageing Distribution"
          subtitle="In-transit value distribution by age buckets (Current Date - Invoice Date)"
          index={1}
        >
          <ReactEChartsCore
            echarts={echarts}
            option={gitAgeingBarOption}
            style={{ height: 320 }}
            notMerge
            lazyUpdate
          />
        </ChartContainer>
      </div>

      {/* Data Table */}
      {paginatedItems.length > 0 ? (
        <DataTable<ImportGITItem>
          columns={columns}
          data={paginatedItems}
          total={allItems.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onSortChange={handleSortChange}
          isLoading={isLoading}
        />
      ) : (
        <EmptyState
          icon={Truck}
          title="No in-transit inventory"
          description="No items match your current filters."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      )}
    </motion.div>
  );
}
