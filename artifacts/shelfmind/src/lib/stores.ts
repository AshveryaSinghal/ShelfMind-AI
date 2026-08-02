import { authRequest } from "@/lib/auth";

export interface OwnedStore {
  id: number;
  slug: string;
  name: string;
  owner_user_id: number | null;
  address: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  created_at?: string;
}

export interface StoreSalesTrendPoint {
  date: string;
  units_sold: number;
  confirmed_units_sold: number;
  in_progress_units_sold: number;
}

export interface StorePeriodMetrics {
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

export interface StoreComparisonRow {
  store_id: number;
  store_name: string;
  address: string | null;
  country: string | null;
  timezone: string;
  shelves_scanned: number;
  total_scans: number;
  avg_health_score: number;
  avg_occupancy_pct: number;
  avg_utilization_pct: number;
  restock_alerts: number;
  active_alerts: number;
  estimated_units_sold: number;
  confirmed_units_sold: number;
  sales_trend_today: StoreSalesTrendPoint[];
  sales_trend_daily: StoreSalesTrendPoint[];
  sales_trend_weekly: StoreSalesTrendPoint[];
  sales_trend_monthly: StoreSalesTrendPoint[];
  metrics_today: StorePeriodMetrics;
  metrics_week: StorePeriodMetrics;
  metrics_month: StorePeriodMetrics;
}

export interface ShelfPeriodTotal {
  shelf_id: string;
  units_sold: number;
}

export interface StorePeriodBreakdown {
  store_id: number;
  store_name: string;
  period: string;
  granularity: "month" | "year";
  total_scans: number;
  shelves_active: number;
  avg_health_score: number;
  avg_occupancy_pct: number;
  units_sold: number;
  alerts_generated: number;
  top_shelf: ShelfPeriodTotal | null;
  bottom_shelf: ShelfPeriodTotal | null;
}

export interface PeriodComparisonResult {
  period: string;
  granularity: "month" | "year";
  period_label: string;
  stores: StorePeriodBreakdown[];
  summary: string;
}

export interface SwitchStoreResult {
  access_token: string;
  token_type: string;
  store_id: number;
  store_name: string;
  timezone: string;
}

export async function listMyStores(accessToken: string | undefined): Promise<OwnedStore[]> {
  return authRequest(accessToken, "GET", "/stores");
}

export async function addStore(
  accessToken: string | undefined,
  input: { store_name: string; country?: string; address?: string; latitude?: number; longitude?: number },
): Promise<OwnedStore> {
  return authRequest(accessToken, "POST", "/stores", input);
}

export async function switchStore(
  accessToken: string | undefined,
  storeId: number,
): Promise<SwitchStoreResult> {
  return authRequest(accessToken, "POST", `/stores/${storeId}/switch`);
}

export async function compareStores(accessToken: string | undefined): Promise<StoreComparisonRow[]> {
  return authRequest(accessToken, "GET", "/stores/compare");
}

// Drill-down comparison for one specific month ("2026-07") or year
// ("2026") -- backs the dialog shown when a user clicks a row in the
// Sales History table on the Compare Stores page.
export async function compareStoresPeriod(
  accessToken: string | undefined,
  granularity: "month" | "year",
  periodKey: string,
): Promise<PeriodComparisonResult> {
  return authRequest(
    accessToken,
    "GET",
    `/stores/compare/period?granularity=${granularity}&period_key=${encodeURIComponent(periodKey)}`,
  );
}

export function getCompareStoresPeriodQueryKey(granularity: "month" | "year", periodKey: string) {
  return ["/stores/compare/period", granularity, periodKey] as const;
}

// `/stores/compare` isn't in the OpenAPI spec, so it never got a generated
// react-query hook the way every other endpoint does -- this page was
// fetching it once in a plain useEffect instead, completely outside the
// query cache. That meant nothing (a manual scan, an auto-scan, anything)
// could ever tell this page new data was available; it only refreshed on a
// full remount. Giving it a real query key lets it join the same
// invalidation flow as everything else.
export function getCompareStoresQueryKey() {
  return ["/stores/compare"] as const;
}
