import {
  useGetDemandAnalytics,
  useGetAnalyticsReport,
  useGetStoreSalesEstimate,
  useGetPeakHours,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb, Info, ShoppingCart, Clock } from "lucide-react";

function PeakHoursColumn({ label, hours }: { label: string; hours: string[] }) {
  return (
    <div className="flex-1 min-w-[180px]">
      <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
      {hours.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not enough data yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {hours.map((h) => (
            <Badge key={h} variant="secondary" className="text-sm font-mono">
              {h}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingCard({
  label,
  shelfId,
  value,
  unit,
  breakdown,
}: {
  label: string;
  shelfId: string | null;
  value: number | null;
  unit: string;
  breakdown?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {shelfId ? (
          <>
            <div className="text-2xl font-bold truncate">{shelfId}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {value !== null ? `${value} ${unit}` : unit}
            </p>
            {breakdown && <p className="text-xs text-muted-foreground/80 mt-1">{breakdown}</p>}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Not enough data yet</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: demand, isLoading: demandLoading } = useGetDemandAnalytics();
  const { data: report, isLoading: reportLoading } = useGetAnalyticsReport();
  const { data: sales, isLoading: salesLoading } = useGetStoreSalesEstimate();
  const { data: peakHours, isLoading: peakHoursLoading } = useGetPeakHours();

  if (demandLoading || reportLoading || salesLoading || peakHoursLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const shelves = demand?.shelves ?? [];
  const rankings = demand?.rankings ?? [];
  const rankingByLabel = new Map(rankings.map((r) => [r.label, r]));

  const demandChartData = shelves
    .slice()
    .sort((a, b) => b.demand_score - a.demand_score)
    .slice(0, 10)
    .map((s) => ({ shelf: s.shelf_id, restocks: s.restock_recommendations, lowStock: s.low_stock_detections }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2 text-lg">Demand rankings and insights derived from scan history.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          Peak Selling Hours
        </h2>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-base">This Store's Peak Hours</CardTitle>
              <CardDescription>
                {peakHours?.source === "user"
                  ? "Set manually by the store owner"
                  : "Auto-detected from restock history"}
              </CardDescription>
            </div>
            <Badge variant={peakHours?.source === "user" ? "default" : "secondary"}>
              {peakHours?.source === "user" ? "Owner-configured" : "Auto-detected"}
            </Badge>
          </CardHeader>
          <CardContent>
            {!peakHours?.sufficient_data ? (
              <p className="text-sm text-muted-foreground">
                {peakHours?.note ?? "Not enough restock history yet to detect peak hours."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-8">
                <PeakHoursColumn label="Weekdays (Mon to Fri)" hours={peakHours.weekday_peak_hours} />
                <PeakHoursColumn label="Weekends (Sat to Sun)" hours={peakHours.weekend_peak_hours} />
              </div>
            )}
            {peakHours?.sufficient_data && peakHours?.note && (
              <p className="text-xs text-muted-foreground/80 mt-4">{peakHours.note}</p>
            )}
            {peakHours?.source === "auto" && peakHours?.sufficient_data && (
              <p className="text-xs text-muted-foreground/80 mt-4">
                Based on {peakHours.restock_events_analyzed} restock event
                {peakHours.restock_events_analyzed === 1 ? "" : "s"} across this store's scan history. Set peak
                windows manually on the Schedule page to override this.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          Estimated Units Sold
        </h2>

        {!sales || sales.shelves.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Not enough scan history yet to estimate units sold.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Estimated Units Sold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sales.total_estimated_units_sold}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sales.total_confirmed_units_sold}</div>
                  <p className="text-xs text-muted-foreground mt-1">Closed out by a subsequent restock</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sales.total_estimated_units_sold_in_progress}</div>
                  <p className="text-xs text-muted-foreground mt-1">Selling since the last restock</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Shelves by Estimated Units Sold</CardTitle>
                <CardDescription>Confirmed and in-progress units sold, per shelf</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sales.shelves.slice(0, 10).map((s) => ({
                        shelf: s.shelf_id,
                        confirmed: s.confirmed_units_sold,
                        inProgress: s.estimated_units_sold_in_progress,
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="shelf" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="confirmed" name="Confirmed units sold" stackId="units" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="inProgress" name="In-progress units sold" stackId="units" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales Estimate Per Shelf</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shelf</TableHead>
                      <TableHead className="text-right">Scans</TableHead>
                      <TableHead className="text-right">Restocks Detected</TableHead>
                      <TableHead className="text-right">Confirmed Sold</TableHead>
                      <TableHead className="text-right">In Progress</TableHead>
                      <TableHead className="text-right">Total Estimated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.shelves.map((s) => (
                      <TableRow key={s.shelf_id}>
                        <TableCell className="font-medium">{s.shelf_id}</TableCell>
                        <TableCell className="text-right">{s.scan_count}</TableCell>
                        <TableCell className="text-right">{s.restock_events_detected}</TableCell>
                        <TableCell className="text-right">{s.confirmed_units_sold}</TableCell>
                        <TableCell className="text-right">{s.estimated_units_sold_in_progress}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{s.total_estimated_units_sold}</Badge>
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

      {shelves.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No scan history yet. Run a few scans to unlock demand analytics.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RankingCard
              label="Highest Demand Shelf"
              shelfId={rankingByLabel.get("Highest Demand Shelf")?.shelf_id ?? null}
              value={rankingByLabel.get("Highest Demand Shelf")?.value ?? null}
              unit="demand score, restock this earliest, keep backup stock on hand"
              breakdown={(() => {
                const shelfId = rankingByLabel.get("Highest Demand Shelf")?.shelf_id;
                const shelf = shelves.find((s) => s.shelf_id === shelfId);
                return shelf
                  ? `= ${shelf.restock_recommendations} restocks x 2 + ${shelf.low_stock_detections} low-stock reading${shelf.low_stock_detections === 1 ? "" : "s"}`
                  : null;
              })()}
            />
            <RankingCard
              label="Most Frequently Restocked"
              shelfId={rankingByLabel.get("Most Frequently Restocked Shelf")?.shelf_id ?? null}
              value={rankingByLabel.get("Most Frequently Restocked Shelf")?.value ?? null}
              unit="restock recommendations"
            />
            <RankingCard
              label="Fastest Inventory Depletion"
              shelfId={rankingByLabel.get("Fastest Inventory Depletion")?.shelf_id ?? null}
              value={rankingByLabel.get("Fastest Inventory Depletion")?.value ?? null}
              unit="% occupancy lost / scan"
            />
            <RankingCard
              label="Least Frequently Restocked"
              shelfId={rankingByLabel.get("Least Frequently Restocked Shelf")?.shelf_id ?? null}
              value={rankingByLabel.get("Least Frequently Restocked Shelf")?.value ?? null}
              unit="restock recommendations, lower demand, can be deprioritized"
            />
            <RankingCard
              label="Slowest Inventory Depletion"
              shelfId={rankingByLabel.get("Slowest Inventory Depletion")?.shelf_id ?? null}
              value={rankingByLabel.get("Slowest Inventory Depletion")?.value ?? null}
              unit="% occupancy lost / scan"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Restock Frequency Per Shelf</CardTitle>
              <CardDescription>Top 10 shelves by restock recommendations and low-stock detections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="shelf" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="restocks" name="Restock recommendations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lowStock" name="Low stock detections" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-muted-foreground" />
              Analytics Report
            </h2>
            {!report?.sufficient_data ? (
              <Card>
                <CardContent className="p-6 text-muted-foreground text-sm">
                  {report?.note}
                </CardContent>
              </Card>
            ) : report.insights.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-muted-foreground text-sm">{report.note}</CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.insights.map((insight, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{insight.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-muted-foreground">{insight.reason}</p>
                      <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                        {insight.recommendation}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
