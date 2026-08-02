import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { RefreshCw, Download, FileText, Loader2, Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";
import {
  getFullStoreReport,
  getFullStoreReportQueryKey,
  downloadStoreReport,
  getPeriodComparison,
  getPeriodComparisonQueryKey,
  type StoreSalesTrendPoint,
  type FullStoreReport,
  type PeriodComparisonRow,
  type PeriodComparisonScope,
} from "@/lib/reports";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Builds a default zero-filled range for a period so the chart always has
 * something to plot, even before any scans have come in. */
function defaultTrendPoints(xLabel: string): StoreSalesTrendPoint[] {
  const now = new Date();
  let dates: string[] = [];
  if (xLabel === "Hour") {
    const currentHour = now.getHours();
    dates = Array.from({ length: currentHour + 1 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  } else if (xLabel === "Date") {
    dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
  } else if (xLabel === "Week") {
    dates = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (11 - i) * 7);
      return isoWeekKey(d);
    });
  } else if (xLabel === "Month") {
    dates = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  } else {
    dates = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - (4 - i)));
  }
  return dates.map((date) => ({ date, units_sold: 0, confirmed_units_sold: 0, in_progress_units_sold: 0 }));
}

function TrendChart({ data, xLabel }: { data: StoreSalesTrendPoint[]; xLabel: string }) {
  const chartData = data.length > 0 ? data : defaultTrendPoints(xLabel);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="colorTrendConfirmed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTrendInProgress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} interval={chartData.length > 15 ? Math.floor(chartData.length / 10) : 0} angle={-20} textAnchor="end" height={50} name={xLabel} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} cursor={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }} />
          <Area
            type="monotone" dataKey="confirmed_units_sold" name="Confirmed units sold" stackId="units"
            stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorTrendConfirmed)" strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
          <Area
            type="monotone" dataKey="in_progress_units_sold" name="In-progress units sold" stackId="units"
            stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorTrendInProgress)" strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearlyTrendChart({ data, xLabel }: { data: StoreSalesTrendPoint[]; xLabel: string }) {
  const chartData = data.length > 0 ? data : defaultTrendPoints(xLabel);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="colorConfirmedUnits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInProgressUnits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} name={xLabel} />
          <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
            cursor={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }}
          />
          <Area
            type="monotone" dataKey="confirmed_units_sold" name="Confirmed units sold" stackId="units"
            stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorConfirmedUnits)" strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
          <Area
            type="monotone" dataKey="in_progress_units_sold" name="In-progress units sold" stackId="units"
            stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorInProgressUnits)" strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Turns a raw period key ("2026-08-02", "2026-W32", "2026-08", "2026")
 * into something readable in a chart axis or table cell. */
function formatPeriodLabel(period: string, granularity: PeriodComparisonRow["granularity"]): string {
  if (granularity === "day") {
    const d = new Date(`${period}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  if (granularity === "week") {
    const [, week] = period.split("-W");
    return `Week ${parseInt(week, 10)}`;
  }
  if (granularity === "month") {
    const [year, month] = period.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  return period;
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

/** Compares a store against itself across the sub-periods of one
 * container -- the 7 days of this week, the weeks of this month, the
 * months of this year, or the last 10 years. Shared by the Weekly,
 * Monthly, and Yearly comparison views on this page. */
function PeriodComparisonPanel({ scope, itemLabel }: { scope: PeriodComparisonScope; itemLabel: string }) {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: getPeriodComparisonQueryKey(scope),
    queryFn: () => getPeriodComparison(session?.accessToken, scope),
    enabled: !!session,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const rows = data.rows;
  const hasAnyData = rows.some((r) => r.total_scans > 0);
  const chartData = rows.map((r) => ({
    label: formatPeriodLabel(r.period, r.granularity),
    units_sold: r.units_sold,
    isBest: r.period === data.best_period,
    isWorst: r.period === data.worst_period,
  }));

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Comparing every {itemLabel} in <span className="font-medium text-foreground">{data.container_label}</span>.
      </p>

      {!hasAnyData ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No scans yet for this period.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="units_sold" name="Units sold" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isBest ? "hsl(var(--primary))" : d.isWorst ? "hsl(var(--destructive))" : "hsl(var(--chart-2))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {data.summary && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm leading-relaxed">{data.summary}</CardContent>
            </Card>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="capitalize">{itemLabel}</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">vs Prev</TableHead>
                  <TableHead className="text-right">Avg Health</TableHead>
                  <TableHead className="text-right">Avg Occupancy</TableHead>
                  <TableHead>Top Shelf</TableHead>
                  <TableHead className="text-right">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.period}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatPeriodLabel(r.period, r.granularity)}
                        {r.period === data.best_period && (
                          <Trophy className="h-3.5 w-3.5 text-amber-500" aria-label="Best period" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.total_scans > 0 ? (
                        <Badge variant={r.period === data.best_period ? "default" : "secondary"}>{r.units_sold}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">no scans</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right"><GrowthBadge pct={r.pct_change_vs_prev} /></TableCell>
                    <TableCell className="text-right">{r.total_scans > 0 ? `${r.avg_health_score}/100` : "—"}</TableCell>
                    <TableCell className="text-right">{r.total_scans > 0 ? `${r.avg_occupancy_pct}%` : "—"}</TableCell>
                    <TableCell>
                      {r.top_shelf ? (
                        <span>{r.top_shelf.shelf_id} <span className="text-muted-foreground">({r.top_shelf.units_sold})</span></span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{r.alerts_generated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function healthTrendVariant(trend: string): "default" | "secondary" | "destructive" | "outline" {
  if (trend === "improving") return "default";
  if (trend === "declining") return "destructive";
  return "secondary";
}

export default function StoreReport() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [kpiPeriod, setKpiPeriod] = useState<"today" | "week" | "month">("today");

  const { data: report, isLoading, isFetching } = useQuery<FullStoreReport>({
    queryKey: getFullStoreReportQueryKey(),
    queryFn: () => getFullStoreReport(session?.accessToken),
    enabled: !!session,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getFullStoreReportQueryKey() });
  };

  const handleDownload = async () => {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadStoreReport(session?.accessToken);
    } catch (err: any) {
      setDownloadError(err?.message ?? "Could not download the report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Report</h1>
          <p className="text-muted-foreground mt-1">
            {report?.generated_at ? `Generated ${formatDate(report.generated_at, session?.timezone)}` : "Today, daily, and monthly history in one place."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={isFetching} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading || !report?.has_data} className="gap-2">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Report
          </Button>
        </div>
      </div>

      {downloadError && (
        <p className="text-sm text-destructive">{downloadError}</p>
      )}

      {isLoading || !report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : !report.has_data ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No scan history yet. Upload shelf images to generate a report.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Store Summary</CardTitle>
                  <CardDescription>
                    Today resets at local midnight, Weekly resets each Monday, Monthly resets on the 1st.
                  </CardDescription>
                </div>
                <Tabs value={kpiPeriod} onValueChange={(v) => setKpiPeriod(v as "today" | "week" | "month")}>
                  <TabsList>
                    <TabsTrigger value="today">Today</TabsTrigger>
                    <TabsTrigger value="week">Weekly</TabsTrigger>
                    <TabsTrigger value="month">Monthly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const s =
                  kpiPeriod === "today" ? report.summary_today
                  : kpiPeriod === "week" ? report.summary_week
                  : report.summary_month;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Kpi label="Shelves Scanned" value={s?.shelves_scanned ?? 0} />
                    <Kpi label="Total Scans" value={s?.total_scans ?? 0} />
                    <Kpi label="Avg Health Score" value={`${s?.avg_health_score ?? 0}/100`} />
                    <Kpi label="Avg Occupancy" value={`${s?.avg_occupancy_pct ?? 0}%`} />
                    <Kpi label="Active Alerts" value={s?.active_alerts ?? 0} />
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-md">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Executive Summary</CardTitle>
                  <CardDescription>Plain-language overview of the current store state</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
                {(report.executive_summary ?? "").split("\n").map((line, i) => (
                  <p key={i} className="leading-relaxed">{line}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Units Sold History</CardTitle>
              <CardDescription>Estimated from scan history. Confirmed cycles vs. still-depleting shelves.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today ({report.today?.total_units_sold ?? 0})</TabsTrigger>
                  <TabsTrigger value="daily">Last 30 Days ({report.daily?.total_units_sold ?? 0})</TabsTrigger>
                  <TabsTrigger value="weekly">Last 12 Weeks ({report.weekly?.total_units_sold ?? 0})</TabsTrigger>
                  <TabsTrigger value="monthly">Last 12 Months ({report.monthly?.total_units_sold ?? 0})</TabsTrigger>
                </TabsList>
                <TabsContent value="today">
                  <TrendChart data={report.today?.hourly ?? []} xLabel="Hour" />
                </TabsContent>
                <TabsContent value="daily">
                  <TrendChart data={report.daily?.trend ?? []} xLabel="Date" />
                </TabsContent>
                <TabsContent value="weekly">
                  <TrendChart data={report.weekly?.trend ?? []} xLabel="Week" />
                  <PeriodComparisonPanel scope="week" itemLabel="day" />
                </TabsContent>
                <TabsContent value="monthly">
                  <TrendChart data={report.monthly?.trend ?? []} xLabel="Month" />
                  <PeriodComparisonPanel scope="month" itemLabel="week" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yearly Overview</CardTitle>
              <CardDescription>Estimated units sold per year, last 5 years of scan history.</CardDescription>
            </CardHeader>
            <CardContent>
              <YearlyTrendChart data={report.yearly?.trend ?? []} xLabel="Year" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yearly Comparison</CardTitle>
              <CardDescription>Compare this year's months against each other, or compare the past 10 years.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="by-month">
                <TabsList>
                  <TabsTrigger value="by-month">This Year by Month</TabsTrigger>
                  <TabsTrigger value="by-year">Past 10 Years</TabsTrigger>
                </TabsList>
                <TabsContent value="by-month">
                  <PeriodComparisonPanel scope="year" itemLabel="month" />
                </TabsContent>
                <TabsContent value="by-year">
                  <PeriodComparisonPanel scope="decade" itemLabel="year" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shelf Performance</CardTitle>
              <CardDescription>Ranked by total estimated units sold, all-time</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shelf</TableHead>
                    <TableHead className="text-right">Total Sold</TableHead>
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">In Progress</TableHead>
                    <TableHead className="text-right">Restocks</TableHead>
                    <TableHead className="text-right">Health Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.shelf_performance ?? []).map((s) => (
                    <TableRow key={s.shelf_id}>
                      <TableCell className="font-medium">{s.shelf_id}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{s.units_sold_total}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.units_sold_confirmed}</TableCell>
                      <TableCell className="text-right">{s.units_sold_in_progress}</TableCell>
                      <TableCell className="text-right">{s.restock_events_detected}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={healthTrendVariant(s.health_trend)} className="capitalize">
                          {s.health_trend}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
