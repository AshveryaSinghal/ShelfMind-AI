import { useParams } from "wouter";
import { useState } from "react";
import {
  useGetShelfHistory,
  getGetShelfHistoryQueryKey,
  useCompareShelfScans,
  getCompareShelfScansQueryKey,
  useGetShelfAlertHistory,
  getGetShelfAlertHistoryQueryKey,
  useGetShelfSalesEstimate,
  getGetShelfSalesEstimateQueryKey,
  type Alert
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatPercentage, formatDate, getHealthColorClass, getRestockingPriorityColorClass, getAlertSeverityColorClass, AlertIcon } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Minus, ChevronDown, ShoppingCart, PackageCheck } from "lucide-react";

function PerformanceTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const occupancy = payload.find((p: any) => p.dataKey === "occupancy")?.value;
  const health = payload.find((p: any) => p.dataKey === "health")?.value;
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-lg min-w-[180px]">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      {occupancy !== undefined && (
        <div className="text-sm font-semibold">Occupancy % : {occupancy.toFixed(2)}</div>
      )}
      {health !== undefined && (
        <div className="text-sm font-semibold mt-1">Health Score : {health.toFixed(1)}</div>
      )}
    </div>
  );
}

export default function ShelfDetail() {
  const { id } = useParams<{ id: string }>();
  const shelfId = id || "";
  const { session } = useAuth();

  const { data: history, isLoading: historyLoading } = useGetShelfHistory(shelfId, {
    query: { enabled: !!shelfId, queryKey: getGetShelfHistoryQueryKey(shelfId) }
  });

  const { data: comparison } = useCompareShelfScans(shelfId, {
    query: {
      enabled: !!shelfId,
      queryKey: getCompareShelfScansQueryKey(shelfId),
      retry: false,
    }
  });

  const { data: alertHistory, isLoading: alertHistoryLoading } = useGetShelfAlertHistory(shelfId, {
    query: { enabled: !!shelfId, queryKey: getGetShelfAlertHistoryQueryKey(shelfId) }
  });

  const { data: salesEstimate } = useGetShelfSalesEstimate(shelfId, {
    query: { enabled: !!shelfId, queryKey: getGetShelfSalesEstimateQueryKey(shelfId) }
  });

  const [alertHistoryOpen, setAlertHistoryOpen] = useState(false);

  if (historyLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const latestScan = history && history.length > 0 ? history[0] : null;
  const historyData = history ? [...history].reverse().map(scan => ({
    time: new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date(scan.timestamp).toLocaleDateString(),
    occupancy: scan.occupancy_pct,
    health: scan.health_score,
  })) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Shelf {shelfId}
            {latestScan && (
              <Badge variant="outline" className={getHealthColorClass(latestScan.health_score)}>
                {latestScan.health_label}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Last scanned: {latestScan ? formatDate(latestScan.timestamp, session?.timezone) : "Never"}
          </p>
        </div>
        {latestScan && latestScan.restocking_priority && (
          <Badge variant="outline" className={`px-4 py-1 text-sm font-medium ${getRestockingPriorityColorClass(latestScan.restocking_priority)}`}>
            Restock Priority: {latestScan.restocking_priority}
          </Badge>
        )}
      </div>

      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DeltaCard
            title="Occupancy"
            value={formatPercentage(latestScan?.occupancy_pct)}
            delta={comparison.occupancy_delta}
            suffix="%"
          />
          <DeltaCard
            title="Health Score"
            value={latestScan?.health_score?.toFixed(1) || "N/A"}
            delta={comparison.health_delta}
            suffix=" pts"
          />
          <DeltaCard
            title="Detections"
            value={latestScan?.detection_count?.toString() || "0"}
            delta={comparison.detection_count_delta}
            suffix=" items"
          />
          <DeltaCard
            title="Utilization"
            value={formatPercentage(comparison.utilization_delta ? 100 + comparison.utilization_delta : 100)} // Approximation for UI display
            delta={comparison.utilization_delta}
            suffix="%"
          />
        </div>
      )}

      {salesEstimate && salesEstimate.scan_count >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Units Sold</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesEstimate.total_estimated_units_sold}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {salesEstimate.confirmed_units_sold} confirmed
                {salesEstimate.estimated_units_sold_in_progress > 0 && (
                  <> &middot; {salesEstimate.estimated_units_sold_in_progress} in progress</>
                )}
                {" "}&middot; vision-based estimate, not POS data
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Times Restocked</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesEstimate.restock_events_detected}</div>
              <p className="text-xs text-muted-foreground mt-1">Detected restock events across all scans</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
            <CardDescription>Occupancy and Health over time</CardDescription>
          </CardHeader>
          <CardContent>
            {historyData.length > 0 ? (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip
                      content={<PerformanceTooltip />}
                      cursor={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone" dataKey="occupancy" name="Occupancy %"
                      stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorOccupancy)" strokeWidth={2}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                    <Area
                      type="monotone" dataKey="health" name="Health Score"
                      stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorHealth)" strokeWidth={2}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No history data available.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Scan Notes</CardTitle>
            <CardDescription>From the latest analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestScan?.report_text ? (
              <div className="text-sm prose dark:prose-invert">
                {latestScan.report_text}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">No detailed report for this scan.</p>
            )}

            {latestScan?.notes && (
              <div className="mt-6">
                <h4 className="font-medium mb-2 text-sm text-muted-foreground">User Notes</h4>
                <p className="text-sm bg-muted/50 p-3 rounded-md border">{latestScan.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          role="button"
          tabIndex={0}
          onClick={() => setAlertHistoryOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAlertHistoryOpen((v) => !v);
            }
          }}
          className="cursor-pointer select-none flex flex-row items-center justify-between gap-4 space-y-0"
        >
          <div>
            <CardTitle>Alert History</CardTitle>
            <CardDescription>
              Every alert raised for this shelf in the last 30 days, grouped by the scan that raised it.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
            {!alertHistoryLoading && alertHistory && alertHistory.length > 0 && (
              <Badge variant="secondary">{alertHistory.length}</Badge>
            )}
            <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${alertHistoryOpen ? "rotate-180" : ""}`} />
          </div>
        </CardHeader>
        {alertHistoryOpen && (
        <CardContent className="p-0">
          {alertHistoryLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !alertHistory || alertHistory.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
              No alerts have ever been raised for this shelf.
            </div>
          ) : (
            <Accordion type="multiple" className="px-2 sm:px-4">
              {groupAlertsByTimestamp(alertHistory).map((group) => (
                <AccordionItem key={group.timestamp} value={group.timestamp} className="border-b last:border-b-0">
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <AlertIcon severity={group.highestSeverity} className="h-5 w-5 shrink-0" />
                      <span className="font-medium">{formatDate(group.timestamp, session?.timezone)}</span>
                      <Badge variant="outline" className={getAlertSeverityColorClass(group.highestSeverity)}>
                        {group.highestSeverity.toUpperCase()}
                      </Badge>
                      <Badge variant="secondary" className="shrink-0">
                        {group.alerts.length} alert{group.alerts.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pb-4">
                      {group.alerts.map((alert, idx) => (
                        <div
                          key={`${alert.code}-${idx}`}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-md border bg-muted/30 px-3 py-2"
                        >
                          <Badge variant="outline" className={`shrink-0 ${getAlertSeverityColorClass(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                            {alert.code}
                          </code>
                          <span className="text-sm flex-1">{alert.message}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
        )}
      </Card>
    </div>
  );
}

const SEVERITY_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1 };

function groupAlertsByTimestamp(alerts: Alert[]) {
  const byTimestamp = new Map<string, Alert[]>();
  for (const alert of alerts) {
    const list = byTimestamp.get(alert.timestamp) ?? [];
    list.push(alert);
    byTimestamp.set(alert.timestamp, list);
  }

  const groups = Array.from(byTimestamp.entries()).map(([timestamp, groupAlerts]) => {
    const highestSeverity = groupAlerts.reduce((worst, a) => {
      const aRank = SEVERITY_RANK[a.severity?.toLowerCase()] ?? 0;
      const worstRank = SEVERITY_RANK[worst?.toLowerCase()] ?? 0;
      return aRank > worstRank ? a.severity : worst;
    }, groupAlerts[0]?.severity ?? "info");
    return { timestamp, alerts: groupAlerts, highestSeverity };
  });

  return groups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function DeltaCard({ title, value, delta, suffix }: { title: string, value: string, delta: number, suffix: string }) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isNeutral = delta === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1 text-xs">
          {isPositive ? <ArrowUp className="h-3 w-3 text-green-500" /> :
           isNegative ? <ArrowDown className="h-3 w-3 text-red-500" /> :
           <Minus className="h-3 w-3 text-muted-foreground" />}
          <span className={isPositive ? "text-green-500 font-medium" : isNegative ? "text-red-500 font-medium" : "text-muted-foreground"}>
            {Math.abs(delta).toFixed(1)}{suffix}
          </span>
          <span className="text-muted-foreground ml-1">vs previous scan</span>
        </div>
      </CardContent>
    </Card>
  );
}
