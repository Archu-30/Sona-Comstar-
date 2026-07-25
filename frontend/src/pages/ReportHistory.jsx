import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { History, Trash2, FileText, FileSpreadsheet, Table2, RefreshCw, Filter, Database } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';

const API = '';

const FORMAT_ICON = {
  pdf:  { icon: FileText,        color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950/30' },
  xlsx: { icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  csv:  { icon: Table2,          color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  view: { icon: Database,        color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

function FormatBadge({ format }) {
  const cfg = FORMAT_ICON[format] || FORMAT_ICON.view;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="size-3" /> {(format || 'view').toUpperCase()}
    </span>
  );
}

function FiltersPreview({ json }) {
  let obj;
  try { obj = typeof json === 'string' ? JSON.parse(json) : json; }
  catch { return <span className="text-muted-foreground text-xs">—</span>; }
  if (!obj) return <span className="text-muted-foreground text-xs">All data</span>;

  const parts = [];
  if (obj.years?.length)      parts.push(`Years: ${obj.years.join(', ')}`);
  if (obj.months?.length)     parts.push(`Months: ${obj.months.join(', ')}`);
  if (obj.products?.length)   parts.push(`Products: ${obj.products.join(', ')}`);
  if (obj.locations?.length)  parts.push(`Locations: ${obj.locations.join(', ')}`);
  if (obj.materials?.length)  parts.push(`${obj.materials.length} material(s)`);
  if (obj.dates?.length) parts.push(`Dates: ${obj.dates.length} selected`);
  if (obj.days?.length)  parts.push(`Days: ${obj.days.join(', ')}`);
  if (!parts.length) return <span className="text-muted-foreground text-xs">All data</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{p}</span>
      ))}
    </div>
  );
}

export default function ReportHistory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: history = [], isLoading, error, refetch } = useQuery({
    queryKey: ['report-history'],
    queryFn: () => axios.get(`${API}/api/history`).then((r) => r.data),
    staleTime: 15000,
    retry: 1,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => axios.delete(`${API}/api/history/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['report-history']);
      toast.success('Entry deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  const filtered = history.filter((r) =>
    !search ||
    r.report_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.report_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Report History"
        description="All generated reports — filters, formats, and timestamps"
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="size-4" /> Refresh
        </button>
        <span className="text-sm text-muted-foreground">{filtered.length} records</span>
      </div>

      {isLoading && (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" /> Loading history…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30">
          Failed to load history. MySQL may not be connected.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <History className="size-8 opacity-40" />
          <p className="text-sm">No report history yet</p>
          <p className="text-xs">Reports will appear here after you export from the Reports page</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Report</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Format</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Filters Used</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Generated</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">By</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.report_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.report_type?.replace(/-/g,' ')}</p>
                  </td>
                  <td className="px-4 py-3"><FormatBadge format={r.export_format} /></td>
                  <td className="px-4 py-3 max-w-xs"><FiltersPreview json={r.filters_json} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(r.generated_date)}</td>
                  <td className="px-4 py-3 text-sm">{r.user_name || 'admin'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (confirm('Delete this history entry?')) deleteMut.mutate(r.id);
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
