import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Store, TrendingUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";
import {
  compareStores,
  compareStoresPeriod,
  getCompareStoresQueryKey,
  getCompareStoresPeriodQueryKey,
  type StoreComparisonRow,
  type PeriodComparisonResult,
} from "@/lib/stores";
import { AlertTriangle, ScanLine, ArrowUpRight, ArrowDownRight } from "lucide-react";

function formatDayLabel(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatHourLabel(hourStr: string): string {
  const hour = parseInt(hourStr.split(":")[0], 10);
  if (Number.isNaN(hour)) return hourStr;
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function formatMonthLabel(monthStr: string): string {
  try {
    return new Date(`${monthStr}-01T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  } catch {
    return monthStr;
  }
}

/** ISO week keys look like "2026-W05". There's no calendar date to parse
 * back out of that (a week isn't a single day), so just show it as
 * "Week 5, 2026" rather than fighting Date parsing for something that
 * was never a real date to begin with. */
function formatWeekLabel(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const [, year, week] = match;
  return `Wk ${parseInt(week, 10)}, ${year}`;
}

const LINE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function healthTone(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function HealthOccupancyTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-lg min-w-[180px]">
      <div className="text-sm font-semibold text-foreground mb-2">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
          {entry.name} : {entry.value}
        </div>
      ))}
    </div>
  );
}

function SalesTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-lg min-w-[180px]">
      <div className="text-xs text-muted-foreground mb-2">{labelFormatter(label)}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name} : {entry.value}
        </div>
      ))}
    </div>
  );
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Default zero-filled bucket range for each chart period, used whenever
 * there isn't any real data yet so the chart still has something to draw
 * rather than staying empty. */
function defaultBuckets(key: "sales_trend_today" | "sales_trend_daily" | "sales_trend_weekly" | "sales_trend_monthly"): string[] {
  const now = new Date();
  if (key === "sales_trend_today") {
    const currentHour = now.getHours();
    return Array.from({ length: currentHour + 1 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  }
  if (key === "sales_trend_daily") {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
  }
  if (key === "sales_trend_weekly") {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (7 - i) * 7);
      return isoWeekKey(d);
    });
  }
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return monthKey(d);
  });
}

/** Merges each store's independent {date, units_sold} series (either the
 * daily or monthly trend) into one date-aligned dataset recharts can plot as
 * multiple lines: each row becomes { date, "Store A": n, "Store B": n, ... }.
 * Missing buckets for a store are filled with 0 rather than skipped, so the
 * lines stay comparable. If none of the stores have any data at all for a
 * period, a default zero-filled range is used so the chart always renders
 * instead of showing nothing.
 */
function buildSalesSeries(
  rows: StoreComparisonRow[],
  key: "sales_trend_today" | "sales_trend_daily" | "sales_trend_weekly" | "sales_trend_monthly",
) {
  const bucketSet = new Set<string>();
  rows.forEach((r) => r[key].forEach((p) => bucketSet.add(p.date)));

  if (bucketSet.size === 0) {
    defaultBuckets(key).forEach((b) => bucketSet.add(b));
  }

  const buckets = Array.from(bucketSet).sort();
  return buckets.map((bucket) => {
    const point: Record<string, string | number> = { date: bucket };
    rows.forEach((r) => {
      const match = r[key].find((p) => p.date === bucket);
      point[r.store_name] = match ? match.units_sold : 0;
    });
    return point;
  });
}

/** All Metrics table body, parameterized by which period's metrics to
 * read off each row (all-time avg_health_score/etc. vs. the Today/Weekly/
 * Monthly scoped metrics_today/metrics_week/metrics_month, which reset at
 * local midnight / Monday / the 1st of the month respectively). */
function MetricsTable({
  rows,
  getMetrics,
}: {
  rows: StoreComparisonRow[];
  getMetrics: (row: StoreComparisonRow) => {
    avg_health_score: number;
    avg_occupancy_pct: number;
    avg_utilization_pct: number;
    total_scans: number;
    estimated_units_sold: number;
    confirmed_units_sold: number;
    restock_alerts: number;
    active_alerts: number;
  };
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Store</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Avg Health</TableHead>
          <TableHead className="text-right">Avg Occupancy</TableHead>
          <TableHead className="text-right">Avg Utilization</TableHead>
          <TableHead className="text-right">Total Scans</TableHead>
          <TableHead className="text-right">Est. Units Sold</TableHead>
          <TableHead className="text-right">Restock Alerts</TableHead>
          <TableHead className="text-right">Active Alerts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const m = getMetrics(row);
          return (
            <TableRow key={row.store_id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {row.store_name}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {[row.address, row.country].filter(Boolean).join(", ") || "N/A"}
              </TableCell>
              <TableCell className={`text-right font-semibold ${healthTone(m.avg_health_score)}`}>
                {m.avg_health_score.toFixed(1)}
              </TableCell>
              <TableCell className="text-right">{m.avg_occupancy_pct.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{m.avg_utilization_pct.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{m.total_scans}</TableCell>
              <TableCell className="text-right">
                <span className="font-semibold">{m.estimated_units_sold}</span>
                <span className="text-xs text-muted-foreground block">
                  {m.confirmed_units_sold} confirmed
                </span>
              </TableCell>
              <TableCell className="text-right">
                {m.restock_alerts > 0 ? <Badge variant="destructive">{m.restock_alerts}</Badge> : "0"}
              </TableCell>
              <TableCell className="text-right">
                {m.active_alerts > 0 ? <Badge variant="secondary">{m.active_alerts}</Badge> : "0"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SalesLineChart({
  data,
  rows,
  labelFormatter,
  chartKey,
}: {
  data: Record<string, string | number>[];
  rows: StoreComparisonRow[];
  labelFormatter: (value: string) => string;
  chartKey: string;
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            {rows.map((r, i) => (
              <linearGradient key={r.store_id} id={`colorSales-${chartKey}-${r.store_id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.35} />
                <stop offset="95%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={labelFormatter} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<SalesTooltip labelFormatter={labelFormatter} />} cursor={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }} />
          <Legend />
          {rows.map((r, i) => (
            <Area
              key={r.store_id}
              type="monotone"
              dataKey={r.store_name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#colorSales-${chartKey}-${r.store_id})`}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Drill-down dialog for one specific month or year: fetches the richer
 * breakdown (scans, alerts generated, top/bottom shelf, health/occupancy)
 * for every store, plus a short summary of which store came out ahead --
 * instead of just the units-sold number the trend chart already shows. */
function PeriodDetailDialog({
  period,
  rows,
  onClose,
}: {
  period: { granularity: "month" | "year"; key: string; label: string } | null;
  rows: StoreComparisonRow[];
  onClose: () => void;
}) {
  const { session } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: period ? getCompareStoresPeriodQueryKey(period.granularity, period.key) : ["period-detail-disabled"],
    queryFn: () => compareStoresPeriod(session?.accessToken, period!.granularity, period!.key),
    enabled: !!session?.accessToken && !!period,
  });
  const error = queryError instanceof Error ? queryError.message : queryError ? "Failed to load this period's detail." : null;

  const colorFor = (storeId: number) => {
    const idx = rows.findIndex((r) => r.store_id === storeId);
    return LINE_COLORS[(idx >= 0 ? idx : 0) % LINE_COLORS.length];
  };

  return (
    <Dialog open={!!period} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{period?.label ?? ""}</DialogTitle>
          <DialogDescription>
            {period?.granularity === "year" ? "Full-year" : "Monthly"} comparison across your stores -- scans, alerts, and standout shelves, not just units sold.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && !isLoading && (
          <div className="space-y-4">
            {data.stores.map((s) => (
              <div key={s.store_id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorFor(s.store_id) }}
                    />
                    {s.store_name}
                  </span>
                  <span className={`text-sm font-semibold ${healthTone(s.avg_health_score)}`}>
                    {s.avg_health_score.toFixed(0)}/100 avg health
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Units sold
                    </div>
                    <div className="font-semibold tabular-nums">{s.units_sold}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs flex items-center gap-1">
                      <ScanLine className="w-3 h-3" /> Scans
                    </div>
                    <div className="font-semibold tabular-nums">{s.total_scans}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Alerts generated
                    </div>
                    <div className="font-semibold tabular-nums">{s.alerts_generated}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Avg occupancy</div>
                    <div className="font-semibold tabular-nums">{s.avg_occupancy_pct.toFixed(0)}%</div>
                  </div>
                </div>

                {(s.top_shelf || s.bottom_shelf) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {s.top_shelf && (
                      <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-muted-foreground">Top shelf:</span>
                        <span className="font-medium">{s.top_shelf.shelf_id}</span>
                        <span className="ml-auto tabular-nums font-semibold">{s.top_shelf.units_sold} sold</span>
                      </div>
                    )}
                    {s.bottom_shelf && (
                      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                        <ArrowDownRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Lowest shelf:</span>
                        <span className="font-medium">{s.bottom_shelf.shelf_id}</span>
                        <span className="ml-auto tabular-nums font-semibold">{s.bottom_shelf.units_sold} sold</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {data.summary && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm leading-relaxed">
                {data.summary}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function StoreComparison() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<{ granularity: "month" | "year"; key: string; label: string } | null>(null);

  // This used to be a one-shot fetch in a plain useEffect, which meant it
  // never learned about new scans -- a manual or auto-scan invalidates the
  // query cache, but there was no query here to invalidate. Moving it into
  // react-query puts it on the same cache as everything else, so it
  // refetches the moment a scan comes in from any page, not just on mount.
  const {
    data: rows = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: getCompareStoresQueryKey(),
    queryFn: () => compareStores(session?.accessToken),
    enabled: !!session?.accessToken,
  });
  const error = queryError instanceof Error ? queryError.message : queryError ? "Failed to load comparison." : null;

  const chartData = rows.map((r) => ({
    name: r.store_name,
    "Health Score": r.avg_health_score,
    "Occupancy %": r.avg_occupancy_pct,
  }));
  const salesSeriesToday = buildSalesSeries(rows, "sales_trend_today");
  const salesSeriesDaily = buildSalesSeries(rows, "sales_trend_daily");
  const salesSeriesWeekly = buildSalesSeries(rows, "sales_trend_weekly");
  const salesSeriesMonthly = buildSalesSeries(rows, "sales_trend_monthly");
  // Same monthly buckets as the chart above, just newest-first and with a
  // row total, for the Sales History table.
  const monthlyHistoryRows: Record<string, string | number>[] = [...salesSeriesMonthly].reverse().map((point) => {
    const total = rows.reduce((sum, r) => sum + (Number(point[r.store_name]) || 0), 0);
    return { ...point, __total: total };
  });

  // Roll the monthly rows up into one entry per year (store totals + grand
  // total for that year), newest year first, so History opens on whole-year
  // figures and each year can be expanded to see its individual months.
  const yearlyHistoryGroups = (() => {
    const years = new Map<string, { months: typeof monthlyHistoryRows; totals: Record<string, number>; grandTotal: number }>();
    monthlyHistoryRows.forEach((point) => {
      const year = (point.date as string).slice(0, 4);
      if (!years.has(year)) years.set(year, { months: [], totals: {}, grandTotal: 0 });
      const group = years.get(year)!;
      group.months.push(point);
      rows.forEach((r) => {
        const val = Number(point[r.store_name]) || 0;
        group.totals[r.store_name] = (group.totals[r.store_name] || 0) + val;
      });
      group.grandTotal += point.__total as number;
    });
    return Array.from(years.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([year, group]) => ({ year, ...group }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Stores</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No stores found on this account yet.
          </CardContent>
        </Card>
      ) : rows.length === 1 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You only have one store so far. Add another from the Stores page to compare them.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Health &amp; Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorHealthScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOccupancyPct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<HealthOccupancyTooltip />} cursor={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Health Score"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHealthScore)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Occupancy %"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOccupancyPct)"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Estimated Units Sold Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-4">
                  <SalesLineChart data={salesSeriesToday} rows={rows} labelFormatter={formatHourLabel} chartKey="today" />
                </TabsContent>
                <TabsContent value="daily" className="mt-4">
                  <SalesLineChart data={salesSeriesDaily} rows={rows} labelFormatter={formatDayLabel} chartKey="daily" />
                </TabsContent>
                <TabsContent value="weekly" className="mt-4">
                  <SalesLineChart data={salesSeriesWeekly} rows={rows} labelFormatter={formatWeekLabel} chartKey="weekly" />
                </TabsContent>
                <TabsContent value="monthly" className="mt-4">
                  <SalesLineChart data={salesSeriesMonthly} rows={rows} labelFormatter={formatMonthLabel} chartKey="monthly" />
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <Accordion type="multiple" defaultValue={[yearlyHistoryGroups[0]?.year].filter(Boolean)} className="rounded-lg border px-4">
                    {yearlyHistoryGroups.map((group) => (
                      <AccordionItem key={group.year} value={group.year} className="last:border-b-0">
                        <AccordionTrigger>
                          <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                            <span className="font-semibold">{group.year}</span>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {rows.map((r, i) => (
                                <span key={r.store_id} className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                                  />
                                  {r.store_name}: <span className="font-medium text-foreground">{group.totals[r.store_name] || 0}</span>
                                </span>
                              ))}
                              <span className="font-semibold text-foreground">Year total: {group.grandTotal}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex items-center justify-between px-1 pb-3">
                            <p className="text-xs text-muted-foreground">Click a month below for a detailed comparison, or compare the whole year at once.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPeriod({ granularity: "year", key: group.year, label: group.year })}
                            >
                              Compare full year
                            </Button>
                          </div>
                          <div className="overflow-hidden rounded-lg border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="w-[140px]">Month</TableHead>
                                  {rows.map((r, i) => (
                                    <TableHead key={r.store_id} className="text-right">
                                      <span
                                        className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                                        style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                                      />
                                      {r.store_name}
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-right font-semibold">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.months.map((point, idx) => (
                                  <TableRow
                                    key={point.date as string}
                                    className={`cursor-pointer hover:bg-muted/40 ${idx === 0 && group === yearlyHistoryGroups[0] ? "bg-primary/5" : ""}`}
                                    onClick={() =>
                                      setSelectedPeriod({
                                        granularity: "month",
                                        key: point.date as string,
                                        label: formatMonthLabel(point.date as string),
                                      })
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {formatMonthLabel(point.date as string)}
                                      {idx === 0 && group === yearlyHistoryGroups[0] && (
                                        <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5">
                                          Latest
                                        </Badge>
                                      )}
                                    </TableCell>
                                    {rows.map((r) => (
                                      <TableCell key={r.store_id} className="text-right tabular-nums">
                                        {point[r.store_name]}
                                      </TableCell>
                                    ))}
                                    <TableCell className="text-right font-semibold tabular-nums">
                                      {point.__total as number}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <PeriodDetailDialog
            period={selectedPeriod}
            rows={rows}
            onClose={() => setSelectedPeriod(null)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Metrics</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-4">
                  <MetricsTable rows={rows} getMetrics={(row) => row.metrics_today} />
                </TabsContent>
                <TabsContent value="weekly" className="mt-4">
                  <MetricsTable rows={rows} getMetrics={(row) => row.metrics_week} />
                </TabsContent>
                <TabsContent value="monthly" className="mt-4">
                  <MetricsTable rows={rows} getMetrics={(row) => row.metrics_month} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
