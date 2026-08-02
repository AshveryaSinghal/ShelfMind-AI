import { useListShelves } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercentage, formatDate, getHealthColorClass, getRestockingPriorityColorClass } from "@/lib/formatters";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Shelves() {
  const { data: shelves, isLoading } = useListShelves();
  const { session } = useAuth();
  const [search, setSearch] = useState("");

  const filteredShelves = shelves?.filter(s =>
    s.shelf_id.toLowerCase().includes(search.toLowerCase()) ||
    (s.health_label && s.health_label.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitored Shelves</h1>
          <p className="text-muted-foreground mt-1">Real-time status of all your tracked retail spaces.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shelves..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shelf ID</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Restocking Priority</TableHead>
                  <TableHead>Last Scan</TableHead>
                  <TableHead className="text-right">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShelves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No shelves found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShelves.map((shelf) => (
                    <TableRow key={shelf.shelf_id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <Link href={`/shelves/${shelf.shelf_id}`} className="text-primary hover:underline">
                          {shelf.shelf_id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getHealthColorClass(shelf.health_score || 0)}>
                          {shelf.health_label || "Unknown"} ({Math.round(shelf.health_score || 0)})
                        </Badge>
                      </TableCell>
                      <TableCell>{formatPercentage(shelf.occupancy_pct)}</TableCell>
                      <TableCell>
                        {shelf.restocking_priority ? (
                          <Badge variant="outline" className={getRestockingPriorityColorClass(shelf.restocking_priority)}>
                            {shelf.restocking_priority}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(shelf.last_scan_at, session?.timezone)}
                      </TableCell>
                      <TableCell className="text-right">
                        {shelf.active_alert_count > 0 ? (
                          <Badge variant="destructive" className="rounded-full">
                            {shelf.active_alert_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
