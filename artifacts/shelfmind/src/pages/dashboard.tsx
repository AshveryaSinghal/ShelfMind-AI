import { useGetDashboard, useGetPeakHours, useListShelves } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPercentage, getHealthColorClass } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";
import {
  getDashboardPeriodSummary,
  getDashboardPeriodQueryKey,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import { Activity, Bell, Box, ScanLine, Layers, PackageX, TrendingUp, ShieldCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const HEALTH_BUCKET_COLORS = {
  healthy: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  critical: "hsl(0 72% 51%)",
};

function StatCard({
  title,
  icon: Icon,
  value,
  subtitle,
}: {
  title: string;
  icon: React.ElementType;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const { data: dashboard, isLoading: dashboardLoading } = useGetDashboard();
  const { data: shelvesResponse, isLoading: shelvesLoading } = useListShelves();
  const { data: peakHours } = useGetPeakHours();

  const [period, setPeriod] = useState<DashboardPeriod | "all">("today");

  const { data: periodSummary, isLoading: periodLoading } = useQuery({
    queryKey: getDashboardPeriodQueryKey(period as DashboardPeriod),
    queryFn: () => getDashboardPeriodSummary(session?.accessToken, period as DashboardPeriod),
    enabled: !!session?.accessToken && period !== "all",
  });

  const shelves = shelvesResponse ?? [];

  if (dashboardLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Couldn't load the dashboard right now. Try refreshing the page.
      </div>
    );
  }

  // "All Time" keeps reading the plain all-time /dashboard summary (same
  // as before this feature existed); Today/Weekly/Monthly read from the
  // period-scoped endpoint instead, which genuinely resets at local
  // midnight / each Monday / the 1st of the month.
  const scans = period === "all" ? dashboard.total_scans : periodSummary?.total_scans ?? 0;
  const health = period === "all" ? dashboard.avg_health_score : periodSummary?.avg_health_score ?? 0;
  const occupancy = period === "all" ? dashboard.avg_occupancy_pct : periodSummary?.avg_occupancy_pct ?? 0;
  const restockAlerts = period === "all" ? (dashboard.restock_alerts ?? 0) : periodSummary?.restock_alerts ?? 0;
  const activeAlerts = period === "all" ? dashboard.active_alerts : periodSummary?.active_alerts ?? 0;
  const showPeriodSkeleton = period !== "all" && periodLoading;

  const healthColor = getHealthColorClass(health);

  const today = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const todaysPeakHours = isWeekend ? peakHours?.weekend_peak_hours : peakHours?.weekday_peak_hours;
  const todaysPeakLabel = isWeekend ? "Weekends (Sat–Sun)" : "Weekdays (Mon–Fri)";

  const shelfHealthChartData = shelves
    .slice()
    .sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0))
    .slice(0, 12)
    .map((s) => ({ shelf: s.shelf_id, health: Math.round(s.health_score ?? 0) }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-2 text-lg">Store-wide shelf performance and active alerts.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod | "all")}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {peakHours?.sufficient_data && todaysPeakHours && todaysPeakHours.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">Today's peak hours ({todaysPeakLabel}):</span>
            <div className="flex flex-wrap gap-1.5">
              {todaysPeakHours.map((h) => (
                <Badge key={h} variant="secondary" className="font-mono">{h}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Shelves"
          icon={Layers}
          value={dashboard.shelves_scanned}
          subtitle="Currently monitored"
        />
        <StatCard
          title="Total Scans"
          icon={ScanLine}
          value={showPeriodSkeleton ? <Skeleton className="h-9 w-12" /> : scans}
          subtitle={period === "all" ? `Products detected: ${dashboard.products_detected}` : `Scans this ${period === "today" ? "day" : period}`}
        />
        <StatCard
          title="Avg Shelf Health"
          icon={Activity}
          value={
            showPeriodSkeleton ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <>
                <span className={healthColor.split(" ")[0]}>{health.toFixed(1)}</span>
                <span className="text-lg text-muted-foreground font-normal ml-1">/ 100</span>
              </>
            )
          }
          subtitle={`Avg occupancy: ${formatPercentage(occupancy)}`}
        />
        <StatCard
          title="Restock Alerts"
          icon={Bell}
          value={showPeriodSkeleton ? <Skeleton className="h-9 w-8" /> : restockAlerts}
          subtitle="Shelves flagged High/Critical priority"
        />
        <StatCard
          title="Low Stock Products"
          icon={PackageX}
          value={dashboard.low_stock_products ?? 0}
          subtitle="Shelves below the sparse-stock threshold"
        />
        <StatCard
          title="Healthy Shelves"
          icon={ShieldCheck}
          value={dashboard.healthy_shelves ?? 0}
          subtitle="Health score at or above Good"
        />
        <StatCard
          title="Critical Shelves"
          icon={Box}
          value={dashboard.critical_shelves ?? 0}
          subtitle="Health score below Poor"
        />
        <StatCard
          title="Active Alerts"
          icon={TrendingUp}
          value={showPeriodSkeleton ? <Skeleton className="h-9 w-8" /> : activeAlerts}
          subtitle="Across all alert types"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shelf Health Comparison</CardTitle>
          <CardDescription>Lowest-scoring shelves (up to 12 shown). Spot which shelves are running empty first</CardDescription>
        </CardHeader>
        <CardContent>
          {shelfHealthChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No shelves scanned yet.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shelfHealthChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="shelf" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="health" name="Health score" radius={[4, 4, 0, 0]}>
                    {shelfHealthChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.health >= 70
                            ? HEALTH_BUCKET_COLORS.healthy
                            : entry.health >= 30
                              ? HEALTH_BUCKET_COLORS.warning
                              : HEALTH_BUCKET_COLORS.critical
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Shelf Health Overview</h2>

        <Card>
          {shelvesLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : shelves && shelves.length > 0 ? (
            <div className="divide-y">
              {shelves.slice(0, 5).map((shelf) => (
                <Link key={shelf.shelf_id} href={`/shelves/${shelf.shelf_id}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold shadow-sm ${getHealthColorClass(shelf.health_score || 0)}`}>
                        {Math.round(shelf.health_score || 0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-lg truncate">{shelf.shelf_id}</div>
                        <div className="text-sm text-muted-foreground">Occupancy: {formatPercentage(shelf.occupancy_pct)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-16 sm:pl-0">
                      {shelf.active_alert_count > 0 && (
                        <Badge variant="destructive" className="rounded-full">{shelf.active_alert_count} alerts</Badge>
                      )}
                      <Badge variant="outline" className={getHealthColorClass(shelf.health_score || 0)}>
                        {shelf.health_label || "Unknown"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
              {shelves.length > 5 && (
                <Link href="/shelves">
                  <div className="p-4 text-center text-sm text-primary hover:underline cursor-pointer font-medium">
                    View all {shelves.length} shelves
                  </div>
                </Link>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No shelves monitored yet.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
