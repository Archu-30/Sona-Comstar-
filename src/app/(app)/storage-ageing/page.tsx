'use client';

import { useState, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
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
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KPICard } from '@/components/shared/kpi-card';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataTable } from '@/components/shared/data-table';
import { ChartContainer } from '@/components/shared/chart-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useAgeingData, useExportData } from '@/hooks/use-data';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '@/lib/formatters';
import { getAgeBucket, calculateInventoryAge } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { STORAGE_LOCATIONS } from '@/config/constants';
import type { InventoryAgeingItem } from '@/types';

echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

function getAgingDays(item: InventoryAgeingItem): number {
  if (item.grIssueDate > 0) return calculateInventoryAge(item.grIssueDate);
  return Math.max(0, item.agingDateOfReceipt ?? 0);
}

function getAgingColor(days: number): string {
  if (days <= 30) return 'text-emerald-600';
  if (days <= 60) return 'text-yellow-600';
  if (days <= 90) return 'text-orange-600';
  if (days <= 180) return 'text-rose-600';
  if (days <= 365) return 'text-red-500';
  return 'text-red-700';
}

function getAgingBadgeVariant(
  days: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (days <= 30) return 'secondary';
  if (days <= 90) return 'outline';
  return 'destructive';
}

export default function StorageAgeingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error } = useAgeingData({
    page,
    pageSize,
    search,
    sortField,
    sortDir,
    filters,
  });

  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format: 'xlsx' | 'csv') => {
      exportMutation.mutate({ module: 'ageing', format, filters, search });
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

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
    setPage(1);
  }, []);

  // Derive KPIs
  const summary = data?.summary;
  const totalUnrestricted = summary?.totalUnrestricted ?? 0;
  const totalBlocked = summary?.totalBlocked ?? 0;

  // Calculate in-transit and quality values from page data
  const pageItems = data?.data ?? [];
  const totalInTransit = useMemo(
    () => pageItems.reduce((s, i) => s + i.valInTransfer, 0),
    [pageItems]
  );

  // Extract filter options
  const plantOptions = useMemo(() => {
    if (!data?.data) return [];
    const unique = [...new Set(data.data.map((d) => d.plant))];
    return unique
      .filter(Boolean)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [data?.data]);

  const storageLocOptions = useMemo(
    () => STORAGE_LOCATIONS.map((v) => ({ label: v, value: v })),
    []
  );

  // Aging bucket chart data — uses centralized getAgeBucket (GR Issue Date)
  const agingChartData = useMemo(() => {
    if (!data?.data) return { buckets: [] as string[], values: [] as number[], quantities: [] as number[] };
    const valueMap = new Map<string, number>();
    const qtyMap = new Map<string, number>();
    const bucketOrder = [
      '0-30 Days',
      '31-60 Days',
      '61-90 Days',
      '91-180 Days',
      '181-365 Days',
      'Above 365 Days',
    ];
    for (const b of bucketOrder) {
      valueMap.set(b, 0);
      qtyMap.set(b, 0);
    }
    for (const item of data.data) {
      const days = getAgingDays(item);
      const bucket = getAgeBucket(days);
      if (bucket === 'Unknown') continue;
      valueMap.set(bucket, (valueMap.get(bucket) ?? 0) + item.valueUnrestricted);
      qtyMap.set(bucket, (qtyMap.get(bucket) ?? 0) + item.unrestricted);
    }
    return {
      buckets: bucketOrder,
      values: bucketOrder.map((b) => valueMap.get(b) ?? 0),
      quantities: bucketOrder.map((b) => qtyMap.get(b) ?? 0),
    };
  }, [data?.data]);

  const chartOption = useMemo(
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
        data: agingChartData.buckets,
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
          name: 'Value',
          type: 'bar' as const,
          data: agingChartData.values,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1e40af' },
            ]),
          },
          barWidth: '50%',
        },
      ],
    }),
    [agingChartData]
  );

  const columns = useMemo<ColumnDef<InventoryAgeingItem, unknown>[]>(
    () => [
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
          <span
            className="max-w-[180px] truncate block"
            title={getValue<string>()}
          >
            {getValue<string>() || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'plant',
        header: 'Plant',
      },
      {
        accessorKey: 'storageLocation',
        header: 'Storage Loc',
      },
      {
        accessorKey: 'batch',
        header: 'Batch',
        cell: ({ getValue }) => getValue<string>() || '--',
      },
      {
        accessorKey: 'unrestricted',
        header: 'Unrestricted',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'valueUnrestricted',
        header: 'Value',
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium text-emerald-600">
            {formatCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'transitTransfer',
        header: 'Transit',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'blocked',
        header: 'Blocked',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span
              className={cn(
                'tabular-nums',
                val > 0 && 'text-rose-600 font-medium'
              )}
            >
              {formatNumber(val)}
            </span>
          );
        },
      },
      {
        accessorKey: 'returns',
        header: 'Returns',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'grIssueDate',
        header: 'GR Date',
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? formatDate(new Date(val)) : '--';
        },
      },
      {
        id: 'agingDays',
        header: 'Aging Days',
        accessorFn: (row) => getAgingDays(row),
        cell: ({ getValue }) => {
          const days = getValue<number>();
          return (
            <span className={cn('tabular-nums font-medium', getAgingColor(days))}>
              {days}
            </span>
          );
        },
      },
      {
        id: 'agingBucket',
        header: 'Aging Bucket',
        accessorFn: (row) => getAgeBucket(getAgingDays(row)),
        cell: ({ row }) => {
          const days = getAgingDays(row.original);
          const bucket = getAgeBucket(days);
          return (
            <Badge variant={getAgingBadgeVariant(days)}>
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
        title="Storage Ageing"
        description="Analyze storage age distribution based on GR Issue Date"
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

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total Unrestricted Value"
          value={totalUnrestricted}
          format="currency"
          icon={IndianRupee}
          color="emerald"
          index={0}
        />
        <KPICard
          label="Blocked Stock Value"
          value={totalBlocked}
          format="currency"
          icon={ShieldAlert}
          color="rose"
          index={1}
        />
        <KPICard
          label="In-Transit Value"
          value={totalInTransit}
          format="currency"
          icon={Truck}
          color="blue"
          index={2}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={[
          { key: 'search', label: 'Search', type: 'search' as const, placeholder: 'Search materials, plants, batches...' },
          { key: 'plant', label: 'Plant', type: 'select' as const, options: plantOptions },
          { key: 'storageLocation', label: 'Storage Location', type: 'select' as const, options: storageLocOptions },
        ]}
        values={{ search, ...filters }}
        onFilterChange={(key, value) => {
          if (key === 'search') handleSearchChange(value);
          else handleFilterChange(key, value);
        }}
        onClear={handleClearFilters}
      />

      {/* Aging Summary Chart */}
      {agingChartData.values.some((v) => v > 0) && (
        <ChartContainer
          title="Value by Aging Bucket"
          subtitle="Distribution of inventory value across aging periods"
          index={0}
        >
          <ReactEChartsCore
            echarts={echarts}
            option={chartOption}
            style={{ height: 300 }}
            notMerge
            lazyUpdate
          />
        </ChartContainer>
      )}

      {/* Data Table */}
      {data && data.data.length > 0 ? (
        <DataTable<InventoryAgeingItem>
          columns={columns}
          data={data.data}
          total={data.total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortChange={handleSortChange}
          isLoading={isLoading}
        />
      ) : (
        <EmptyState
          icon={Clock}
          title="No ageing data"
          description="No ageing records match your current filters."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      )}
    </motion.div>
  );
}
