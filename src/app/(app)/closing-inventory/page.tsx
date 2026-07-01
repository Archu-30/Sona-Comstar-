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
  Package,
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  BarChart3,
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
import { useInventoryData, useDashboardSummary, useExportData } from '@/hooks/use-data';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { INVENTORY_TYPES } from '@/config/constants';
import type { InventoryItem } from '@/types';

echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const TYPE_COLORS: Record<string, string> = {
  YBOP: '#3b82f6',
  YFGS: '#10b981',
  YSFG: '#f59e0b',
  YSCP: '#8b5cf6',
};

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error } = useInventoryData({
    page,
    pageSize,
    search,
    sortField,
    sortDir,
    filters,
  });

  const { data: summaryData } = useDashboardSummary();

  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format: 'xlsx' | 'csv') => {
      exportMutation.mutate({ module: 'inventory', format, filters, search });
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

  // Derive KPIs from summary
  const summary = data?.summary;
  const totalValue = summary?.totalValue ?? 0;
  const totalStock = summary?.totalStock ?? 0;

  const inventoryTypeOptions = useMemo(
    () => INVENTORY_TYPES.map((t) => ({ label: t, value: t })),
    []
  );

  // Monthly Closing Inventory Comparison (April vs May)
  const monthlyComparisonOption = useMemo(() => {
    const periods = summaryData?.inventory?.periodSummaries ?? [];
    const labels = periods.map((p) => p.period);
    const values = periods.map((p) => p.totalValue);

    return {
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
        data: labels,
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
          name: 'Inventory Value',
          type: 'bar' as const,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: i === 0 ? '#6366f1' : '#3b82f6',
            },
          })),
          barWidth: '40%',
        },
      ],
    };
  }, [summaryData]);

  // Closing Inventory Value by Type
  const typeComparisonOption = useMemo(() => {
    const byType = summaryData?.inventory?.inventoryByType ?? [];
    const types = byType.map((t) => t.type);
    const values = byType.map((t) => t.totalValue);

    return {
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
        data: types,
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
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: TYPE_COLORS[types[i]] ?? '#94a3b8',
            },
          })),
          barWidth: '50%',
        },
      ],
    };
  }, [summaryData]);

  const columns = useMemo<ColumnDef<InventoryItem, unknown>[]>(
    () => [
      {
        accessorKey: 'material',
        header: 'Material',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => (
          <span className="max-w-[200px] truncate block" title={getValue<string>()}>
            {getValue<string>() || '--'}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => getValue<string>() || '--',
      },
      {
        accessorKey: 'totalStock',
        header: 'Total Stock',
        cell: ({ getValue }) => (
          <span className="tabular-nums">
            {formatNumber(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
      },
      {
        accessorKey: 'totalValue',
        header: 'Total Value',
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium text-emerald-600">
            {formatCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'currency',
        header: 'Currency',
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

      {/* KPI Row — 2 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard
          label="Total Value"
          value={totalValue}
          format="currency"
          icon={IndianRupee}
          color="emerald"
          index={0}
        />
        <KPICard
          label="Total Stock"
          value={totalStock}
          format="number"
          icon={Package}
          color="blue"
          index={1}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartContainer
          title="Monthly Closing Inventory Comparison"
          subtitle="Inventory value comparison across periods"
          index={0}
        >
          <ReactEChartsCore
            echarts={echarts}
            option={monthlyComparisonOption}
            style={{ height: 320 }}
            notMerge
            lazyUpdate
          />
        </ChartContainer>
        <ChartContainer
          title="Closing Inventory Value by Type"
          subtitle="Inventory value distribution across inventory types"
          index={1}
        >
          <ReactEChartsCore
            echarts={echarts}
            option={typeComparisonOption}
            style={{ height: 320 }}
            notMerge
            lazyUpdate
          />
        </ChartContainer>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={[
          { key: 'search', label: 'Search', type: 'search' as const, placeholder: 'Search materials, descriptions...' },
          { key: 'type', label: 'Inventory Type', type: 'select' as const, options: inventoryTypeOptions },
        ]}
        values={{ search, ...filters }}
        onFilterChange={(key, value) => {
          if (key === 'search') handleSearchChange(value);
          else handleFilterChange(key, value);
        }}
        onClear={handleClearFilters}
      />

      {/* Data Table */}
      {data && data.data.length > 0 ? (
        <DataTable<InventoryItem>
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
          icon={BarChart3}
          title="No inventory data"
          description="No inventory records match your current filters."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      )}
    </motion.div>
  );
}
