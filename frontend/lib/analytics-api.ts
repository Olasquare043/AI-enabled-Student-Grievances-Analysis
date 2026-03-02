import { apiRequest } from "@/lib/api";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTopicClustersResponse,
} from "@/lib/types";

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getAnalyticsOverview(periodDays = 30): Promise<AnalyticsOverviewResponse> {
  const query = buildQuery({ period_days: periodDays });
  return apiRequest<AnalyticsOverviewResponse>(`/analytics/overview${query}`);
}

export async function getAnalyticsTopicClusters(
  periodDays = 30,
): Promise<AnalyticsTopicClustersResponse> {
  const query = buildQuery({ period_days: periodDays });
  return apiRequest<AnalyticsTopicClustersResponse>(`/analytics/topic-clusters${query}`);
}
