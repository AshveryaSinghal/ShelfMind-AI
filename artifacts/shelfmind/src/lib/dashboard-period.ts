import { authRequest } from "@/lib/auth";
import type { StorePeriodMetrics } from "@/lib/stores";

export type DashboardPeriod = "today" | "week" | "month";

/** `/dashboard/period` isn't in the OpenAPI spec (same situation as
 * `/stores/compare` and `/report/full`), so it doesn't have a generated
 * react-query hook -- fetched by hand the same way those do. */
export async function getDashboardPeriodSummary(
  accessToken: string | undefined,
  period: DashboardPeriod,
): Promise<StorePeriodMetrics> {
  return authRequest(accessToken, "GET", `/dashboard/period?period=${period}`);
}

export function getDashboardPeriodQueryKey(period: DashboardPeriod) {
  return ["/dashboard/period", period] as const;
}
