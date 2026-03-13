"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { getAnalyticsOverview, getAnalyticsTopicClusters } from "@/lib/analytics-api";
import { listGrievances } from "@/lib/grievance-api";
import { analyzeNlpText, getNlpProviderStatus } from "@/lib/nlp-api";
import type {
  AnalyticsOverviewResponse,
  GrievanceListItem,
  NLPTextAnalysisResponse,
  TopicClusterInsight,
  UserRead,
} from "@/lib/types";

export type DashboardStats = {
  myTotalCount: number;
  myOpenCount: number;
  queueCount: number;
  activeBreachCount: number;
  aiEnrichmentEnabled: boolean;
};

type DashboardPanelFailure = {
  label: string;
  message: string;
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function describeDashboardFailure(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load dashboard insights";
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function buildPartialLoadMessage(labels: string[]) {
  const subject = joinLabels(labels);
  return labels.length === 1
    ? `${subject} is temporarily unavailable. The rest of the workspace is still ready.`
    : `${subject} are temporarily unavailable. The rest of the workspace is still ready.`;
}

function getSettledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  failures: DashboardPanelFailure[],
) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  failures.push({
    label,
    message: describeDashboardFailure(result.reason),
  });
  return fallback;
}

function buildOperationsDigest(
  overview: AnalyticsOverviewResponse,
  clusters: TopicClusterInsight[],
  queueCount: number,
) {
  const breachedCheckpointCount = overview.sla_compliance.reduce(
    (sum, item) => sum + item.breached_count,
    0,
  );
  const topCategories = overview.category_distribution
    .slice(0, 3)
    .map(
      (item) =>
        `${titleCase(item.category)} ${item.count} cases (${item.share_percent.toFixed(1)}%)`,
    );
  const departmentSignals = overview.department_hotspots
    .slice(0, 3)
    .map(
      (item) =>
        `${item.department_name} with ${item.grievance_count} grievances and ${item.breach_count} breaches`,
    );
  const facultySignals = overview.faculty_hotspots
    .slice(0, 3)
    .map((item) => `${item.faculty} at ${item.grievance_count} cases`);
  const clusterSignals = clusters
    .slice(0, 3)
    .map(
      (cluster) =>
        `cluster ${cluster.cluster_id} with ${cluster.size} cases around ${cluster.top_keywords.slice(0, 4).join(", ")}`,
    );
  const complianceSignals = overview.sla_compliance.map((item) => {
    const label = item.breach_type === "first_response" ? "first response" : "resolution";
    return `${label} compliance ${item.compliance_rate_percent.toFixed(1)}%`;
  });

  return [
    `Operations summary for the last ${overview.period_days} days.`,
    `Total grievances ${overview.total_grievances}. Queue backlog ${overview.backlog.total_backlog}, with ${overview.backlog.open_count} open, ${overview.backlog.in_progress_count} in progress, and ${overview.backlog.overdue_backlog} overdue.`,
    `Breached SLA checkpoints ${breachedCheckpointCount}. Distinct breached cases ${overview.active_breaches}. Escalation events ${overview.escalation_events}.`,
    topCategories.length > 0 ? `Top categories: ${topCategories.join("; ")}.` : "",
    departmentSignals.length > 0
      ? `Department hotspots: ${departmentSignals.join("; ")}.`
      : "",
    facultySignals.length > 0 ? `Faculty hotspots: ${facultySignals.join("; ")}.` : "",
    complianceSignals.length > 0 ? `Compliance signals: ${complianceSignals.join("; ")}.` : "",
    clusterSignals.length > 0 ? `Recurring themes: ${clusterSignals.join("; ")}.` : "",
    overview.resolution.avg_resolution_hours != null
      ? `Average resolution time ${overview.resolution.avg_resolution_hours.toFixed(1)} hours.`
      : "",
    queueCount > 0 ? `Current routed queue count ${queueCount}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function useWorkspaceData(
  currentUser: UserRead,
  hasOperationalRole: boolean,
  options?: {
    includeAiBrief?: boolean;
  },
) {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [clusters, setClusters] = useState<TopicClusterInsight[]>([]);
  const [myCases, setMyCases] = useState<GrievanceListItem[]>([]);
  const [aiBrief, setAiBrief] = useState<NLPTextAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const includeAiBrief = options?.includeAiBrief ?? false;

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setDashboardError(null);
      setAiBrief(null);

      try {
        const requestResults = (await Promise.allSettled([
          listGrievances({ mine: true }),
          hasOperationalRole ? getNlpProviderStatus() : Promise.resolve(null),
          hasOperationalRole ? getAnalyticsOverview(periodDays) : Promise.resolve(null),
          hasOperationalRole ? getAnalyticsTopicClusters(periodDays) : Promise.resolve(null),
        ])) as [
          PromiseSettledResult<GrievanceListItem[]>,
          PromiseSettledResult<Awaited<ReturnType<typeof getNlpProviderStatus>> | null>,
          PromiseSettledResult<AnalyticsOverviewResponse | null>,
          PromiseSettledResult<Awaited<ReturnType<typeof getAnalyticsTopicClusters>> | null>,
        ];
        const failures: DashboardPanelFailure[] = [];
        const [
          myCasesResult,
          providerResult,
          overviewResult,
          clustersResult,
        ] = requestResults;
        const myCasesResponse = getSettledValue(
          myCasesResult,
          [],
          "your grievance history",
          failures,
        );
        const providerStatus = getSettledValue(
          providerResult,
          null,
          "AI provider status",
          failures,
        );
        const analyticsOverview = getSettledValue(
          overviewResult,
          null,
          "analytics overview",
          failures,
        );
        const analyticsClusters = getSettledValue(
          clustersResult,
          null,
          "topic clusters",
          failures,
        );
        let nextAiBrief: NLPTextAnalysisResponse | null = null;
        const queueCount = analyticsOverview?.backlog.total_backlog ?? 0;

        if (includeAiBrief && hasOperationalRole && analyticsOverview) {
          const digest = buildOperationsDigest(
            analyticsOverview,
            analyticsClusters?.clusters ?? [],
            queueCount,
          );

          if (digest.length >= 10) {
            try {
              nextAiBrief = await analyzeNlpText({
                text: digest,
                include_llm_enrichment: providerStatus?.llm_enabled ?? false,
              });
            } catch {
              if (providerStatus?.llm_enabled) {
                try {
                  nextAiBrief = await analyzeNlpText({
                    text: digest,
                    include_llm_enrichment: false,
                  });
                } catch {
                  nextAiBrief = null;
                }
              } else {
                nextAiBrief = null;
              }
            }
          }
        }

        if (!isMounted) {
          return;
        }

        const requestedPanelCount = hasOperationalRole ? 4 : 1;
        if (failures.length >= requestedPanelCount) {
          const primaryError =
            failures[0]?.message ?? "Unable to load dashboard insights";

          setMyCases([]);
          setStats(null);
          setOverview(null);
          setClusters([]);
          setAiBrief(null);
          setDashboardError(primaryError);
          toast.error("Workspace unavailable", primaryError);
          return;
        }

        const myOpenCount = myCasesResponse.filter(
          (item) => item.status === "open" || item.status === "in_progress",
        ).length;

        setMyCases(myCasesResponse);
        setStats({
          myTotalCount: myCasesResponse.length,
          myOpenCount,
          queueCount,
          activeBreachCount: analyticsOverview?.active_breaches ?? 0,
          aiEnrichmentEnabled: providerStatus?.llm_enabled ?? false,
        });
        setOverview(analyticsOverview);
        setClusters(analyticsClusters?.clusters ?? []);
        setAiBrief(nextAiBrief);

        if (failures.length > 0) {
          const partialMessage = buildPartialLoadMessage(
            failures.map((item) => item.label),
          );
          setDashboardError(partialMessage);
          toast.info("Workspace partially loaded", partialMessage);
        } else {
          setDashboardError(null);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDashboardError(
          error instanceof Error ? error.message : "Unable to load dashboard insights",
        );
        toast.error(
          "Workspace unavailable",
          error instanceof Error ? error.message : "Unable to load dashboard insights",
        );
        setAiBrief(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [currentUser.id, hasOperationalRole, includeAiBrief, periodDays, toast]);

  return {
    stats,
    overview,
    clusters,
    myCases,
    aiBrief,
    isLoading,
    dashboardError,
    periodDays,
    setPeriodDays,
  };
}
