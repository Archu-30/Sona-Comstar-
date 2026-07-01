'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  Info,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/loading-skeleton';
import { useDashboardSummary } from '@/hooks/use-data';

type Severity = 'info' | 'warning' | 'critical';
type Category = 'trend' | 'risk' | 'recommendation' | 'opportunity';

const severityConfig: Record<Severity, { label: string; color: string; badgeClass: string }> = {
  info: {
    label: 'Info',
    color: 'text-blue-600',
    badgeClass: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  },
  warning: {
    label: 'Warning',
    color: 'text-amber-600',
    badgeClass: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  },
  critical: {
    label: 'Critical',
    color: 'text-rose-600',
    badgeClass: 'bg-rose-500/15 text-rose-600 border-rose-500/20',
  },
};

const categoryIcon: Record<Category, typeof TrendingUp> = {
  trend: TrendingUp,
  risk: AlertTriangle,
  recommendation: Lightbulb,
  opportunity: Target,
};

const categoryLabel: Record<Category, string> = {
  trend: 'Trend',
  risk: 'Business Risk',
  recommendation: 'Recommendation',
  opportunity: 'Cost Saving',
};

export default function AIInsightsPage() {
  const { data, isLoading } = useDashboardSummary();
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');

  const insights = useMemo(() => {
    if (!data?.aiInsights) return [];
    let filtered = data.aiInsights;
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter((i) => i.severity === selectedSeverity);
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((i) => i.category === selectedCategory);
    }
    return filtered;
  }, [data, selectedSeverity, selectedCategory]);

  const severityCounts = useMemo(() => {
    if (!data?.aiInsights) return { all: 0, info: 0, warning: 0, critical: 0 };
    return {
      all: data.aiInsights.length,
      info: data.aiInsights.filter((i) => i.severity === 'info').length,
      warning: data.aiInsights.filter((i) => i.severity === 'warning').length,
      critical: data.aiInsights.filter((i) => i.severity === 'critical').length,
    };
  }, [data]);

  if (isLoading) return <PageSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <PageHeader
        title="AI Insights"
        description="Automated business intelligence and inventory recommendations"
        icon={Brain}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-rose-200/60 bg-rose-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <span className="text-sm font-semibold text-foreground">Critical</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{severityCounts.critical}</p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Warnings</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{severityCounts.warning}</p>
        </div>
        <div className="rounded-xl border border-blue-200/60 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-foreground">Informational</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{severityCounts.info}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Severity:</span>
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setSelectedSeverity(sev)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedSeverity === sev
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {sev === 'all' ? `All (${severityCounts.all})` : `${severityConfig[sev].label} (${severityCounts[sev]})`}
          </button>
        ))}

        <span className="text-xs font-medium text-muted-foreground ml-4 mr-1">Category:</span>
        {(['all', 'risk', 'recommendation', 'opportunity', 'trend'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {cat === 'all' ? 'All' : categoryLabel[cat]}
          </button>
        ))}
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
            <Brain className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No insights match the current filters</p>
          </div>
        ) : (
          insights.map((insight, index) => {
            const config = severityConfig[insight.severity];
            const CatIcon = categoryIcon[insight.category] ?? Info;

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    insight.severity === 'critical'
                      ? 'bg-rose-500/15 text-rose-600'
                      : insight.severity === 'warning'
                        ? 'bg-amber-500/15 text-amber-600'
                        : 'bg-blue-500/15 text-blue-600'
                  }`}>
                    <CatIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.badgeClass}`}>
                        {config.label}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {categoryLabel[insight.category]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>

                    {(insight.metric || insight.value) && (
                      <div className="mt-2 flex items-center gap-4">
                        {insight.metric && (
                          <span className="text-xs text-muted-foreground">{insight.metric}:</span>
                        )}
                        {insight.value && (
                          <span className="text-xs font-semibold text-foreground">{insight.value}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
