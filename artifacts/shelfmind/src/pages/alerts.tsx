import { useMemo } from "react";
import { Link } from "wouter";
import { useListAlerts, type Alert } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { formatDate, getAlertSeverityColorClass, AlertIcon } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";

const SEVERITY_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1 };

interface ShelfAlertGroup {
  shelfId: string;
  alerts: Alert[];
  highestSeverity: string;
}

function groupAlertsByShelf(alerts: Alert[]): ShelfAlertGroup[] {
  const byShelf = new Map<string, Alert[]>();
  for (const alert of alerts) {
    const list = byShelf.get(alert.shelf_id) ?? [];
    list.push(alert);
    byShelf.set(alert.shelf_id, list);
  }

  const groups: ShelfAlertGroup[] = Array.from(byShelf.entries()).map(([shelfId, shelfAlerts]) => {
    const highestSeverity = shelfAlerts.reduce((worst, a) => {
      const aRank = SEVERITY_RANK[a.severity?.toLowerCase()] ?? 0;
      const worstRank = SEVERITY_RANK[worst?.toLowerCase()] ?? 0;
      return aRank > worstRank ? a.severity : worst;
    }, shelfAlerts[0]?.severity ?? "info");
    return { shelfId, alerts: shelfAlerts, highestSeverity };
  });

  groups.sort((a, b) => {
    const rankDiff = (SEVERITY_RANK[b.highestSeverity?.toLowerCase()] ?? 0) - (SEVERITY_RANK[a.highestSeverity?.toLowerCase()] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return b.alerts.length - a.alerts.length;
  });

  return groups;
}

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlerts();
  const { session } = useAuth();

  const groups = useMemo(() => groupAlertsByShelf(alerts ?? []), [alerts]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Issues from each shelf's latest scan, grouped by shelf. Resolved once a newer scan comes back clean.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shelves with Alerts</CardTitle>
          <CardDescription>
            {groups.length > 0
              ? `${groups.length} shelf${groups.length === 1 ? "" : "s"} currently flagged.`
              : "Nothing currently flagged."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No active alerts. All shelves are healthy!
            </div>
          ) : (
            <Accordion type="multiple" className="px-2 sm:px-4">
              {groups.map((group) => (
                <AccordionItem key={group.shelfId} value={group.shelfId} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <AccordionTrigger className="flex-1 py-4 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <AlertIcon severity={group.highestSeverity} className="h-5 w-5 shrink-0" />
                        <span className="font-medium truncate">Shelf {group.shelfId}</span>
                        <Badge variant="outline" className={getAlertSeverityColorClass(group.highestSeverity)}>
                          {group.highestSeverity.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="shrink-0">
                          {group.alerts.length} alert{group.alerts.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <Link href={`/shelves/${group.shelfId}`}>
                      <Button variant="ghost" size="sm" className="gap-1 mr-2 shrink-0" title="View shelf details & full history">
                        View shelf <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
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
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDate(alert.timestamp, session?.timezone)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
