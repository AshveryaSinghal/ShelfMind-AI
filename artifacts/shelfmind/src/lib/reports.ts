import { apiBase, authRequest, readableError } from "@/lib/auth";
import type { StoreSalesTrendPoint, ShelfPeriodTotal } from "@/lib/stores";

export type { StoreSalesTrendPoint };

export interface StoreSummary {
  shelves_scanned?: number;
  total_scans?: number;
  avg_health_score?: number;
  avg_occupancy_pct?: number;
  active_alerts?: number;
}

export interface ReportPeriodSummary {
  period: "today" | "week" | "month";
  shelves_scanned: number;
  total_scans: number;
  avg_health_score: number;
  avg_occupancy_pct: number;
  avg_utilization_pct: number;
  estimated_units_sold: number;
  confirmed_units_sold: number;
  restock_alerts: number;
  active_alerts: number;
}

export interface ShelfPerformanceRow {
  shelf_id: string;
  units_sold_total: number;
  units_sold_confirmed: number;
  units_sold_in_progress: number;
  restock_events_detected: number;
  health_trend: "improving" | "declining" | "stable";
  avg_health_score: number | null;
  demand_score: number | null;
}

export interface FullStoreReport {
  has_data: boolean;
  generated_at: string;
  store_name: string | null;
  store_summary: StoreSummary;
  executive_summary?: string;
  today?: { hourly: StoreSalesTrendPoint[]; total_units_sold: number };
  daily?: { periods: number; trend: StoreSalesTrendPoint[]; total_units_sold: number };
  weekly?: { periods: number; trend: StoreSalesTrendPoint[]; total_units_sold: number };
  monthly?: { periods: number; trend: StoreSalesTrendPoint[]; total_units_sold: number };
  yearly?: { periods: number; trend: StoreSalesTrendPoint[]; total_units_sold: number };
  summary_today?: ReportPeriodSummary;
  summary_week?: ReportPeriodSummary;
  summary_month?: ReportPeriodSummary;
  shelf_performance?: ShelfPerformanceRow[];
}

// `/report/full` and `/report/download` aren't in the OpenAPI spec (same
// situation as `/stores/compare`), so they don't have generated
// react-query hooks -- fetched by hand the same way that page does.
export async function getFullStoreReport(accessToken: string | undefined): Promise<FullStoreReport> {
  return authRequest(accessToken, "GET", "/report/full");
}

export function getFullStoreReportQueryKey() {
  return ["/report/full"] as const;
}

/** One row in a same-store period comparison: one day within a week, one
 * week within a month, one month within a year, or one year within the
 * past decade -- see `PeriodComparisonScope`. */
export interface PeriodComparisonRow {
  period: string;
  granularity: "day" | "week" | "month" | "year";
  total_scans: number;
  shelves_active: number;
  avg_health_score: number;
  avg_occupancy_pct: number;
  units_sold: number;
  alerts_generated: number;
  top_shelf: ShelfPeriodTotal | null;
  bottom_shelf: ShelfPeriodTotal | null;
  pct_change_vs_prev: number | null;
}

export type PeriodComparisonScope = "week" | "month" | "year" | "decade";

export interface PeriodComparison {
  scope: PeriodComparisonScope;
  sub_granularity: "day" | "week" | "month" | "year";
  container_label: string;
  rows: PeriodComparisonRow[];
  best_period: string | null;
  worst_period: string | null;
  summary: string;
}

/** Compares a store against itself across the sub-periods of one
 * container: the 7 days of this week, the weeks of this month, the
 * months of this year, or the last 10 years. Backs the "compare" view
 * under each tab of the Store Report page's Units Sold History card. */
export async function getPeriodComparison(
  accessToken: string | undefined,
  scope: PeriodComparisonScope,
): Promise<PeriodComparison> {
  return authRequest(accessToken, "GET", `/report/compare?scope=${scope}`);
}

export function getPeriodComparisonQueryKey(scope: PeriodComparisonScope) {
  return ["/report/compare", scope] as const;
}

/** Triggers a browser download of the structured HTML report. Not a JSON
 * endpoint, so it bypasses `authRequest` and handles the file response
 * (and its filename, read off Content-Disposition) directly. */
export async function downloadStoreReport(accessToken: string | undefined): Promise<void> {
  const res = await fetch(`${apiBase()}/api/shelfmind/report/download`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw readableError(res.status, body);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] ?? "shelfmind-report.html";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
