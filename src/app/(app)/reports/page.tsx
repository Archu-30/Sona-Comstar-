'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Download,
  Package,
  Clock,
  Truck,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { useExportData } from '@/hooks/use-data';

interface ReportCard {
  title: string;
  description: string;
  icon: typeof Package;
  module: 'inventory' | 'ageing' | 'git';
  format: 'xlsx';
  iconColor: string;
}

const reports: ReportCard[] = [
  {
    title: 'Closing Inventory Report',
    description: 'Complete inventory valuation report with stock levels, unit costs, and total values across all materials.',
    icon: Package,
    module: 'inventory',
    format: 'xlsx',
    iconColor: 'bg-blue-500/15 text-blue-600',
  },
  {
    title: 'Storage Ageing Report',
    description: 'Storage age analysis based on GR Issue Date with value breakdowns by aging buckets.',
    icon: Clock,
    module: 'ageing',
    format: 'xlsx',
    iconColor: 'bg-cyan-500/15 text-cyan-600',
  },
  {
    title: 'In-Transit (GIT) Report',
    description: 'Goods in transit from import suppliers with invoice-level ageing details.',
    icon: Truck,
    module: 'git',
    format: 'xlsx',
    iconColor: 'bg-purple-500/15 text-purple-600',
  },
];

export default function ReportsPage() {
  const exportMutation = useExportData();

  const handleExport = useCallback(
    (report: ReportCard) => {
      toast.info(`Generating ${report.title}...`);
      exportMutation.mutate(
        { module: report.module, format: report.format },
        {
          onSuccess: () => {
            toast.success(`${report.title} downloaded successfully`);
          },
          onError: (error) => {
            toast.error(`Failed to generate report: ${error.message}`);
          },
        }
      );
    },
    [exportMutation]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <PageHeader
        title="Reports"
        description="Generate and download inventory analytics reports"
        icon={BarChart3}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report, index) => {
          const Icon = report.icon;
          return (
            <motion.div
              key={report.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${report.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{report.description}</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Excel (.xlsx)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(report)}
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
