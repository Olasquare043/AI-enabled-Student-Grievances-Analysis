"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, House, LoaderCircle, RefreshCw } from "lucide-react";

import { CategoryHotspots } from "@/components/analytics/category-hotspots";
import { SlaCompliance } from "@/components/analytics/sla-compliance";
import { TopicClusters } from "@/components/analytics/topic-clusters";
import { TrendChart } from "@/components/analytics/trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/api";
import { getAnalyticsOverview, getAnalyticsTopicClusters } from "@/lib/analytics-api";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTopicClustersResponse,
  UserRead,
} from "@/lib/types";

const PERIOD_OPTIONS = [7, 30, 90];

function hasAnalyticsAccess(user: UserRead | null) {
  if (!user) {
    return false;
  }
  const roles = new Set(user.roles.map((role) => role.name));
  return roles.has("staff") || roles.has("admin");
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [topicClusters, setTopicClusters] = useState<AnalyticsTopicClustersResponse | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatedAt = useMemo(() => {
    if (!overview) {
      return "";
    }
    return new Date(overview.generated_at).toLocaleString();
  }, [overview]);

  const loadAnalytics = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const me = await getCurrentUser();
      if (!hasAnalyticsAccess(me)) {
        router.replace("/app");
        return;
      }

      const [overviewData, clustersData] = await Promise.all([
        getAnalyticsOverview(periodDays),
        getAnalyticsTopicClusters(periodDays),
      ]);

      setCurrentUser(me);
      setOverview(overviewData);
      setTopicClusters(clustersData);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load analytics";
      if (message.toLowerCase().includes("not authenticated")) {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, periodDays]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading analytics dashboard...
        </div>
      </div>
    );
  }

  if (!currentUser || !overview || !topicClusters) {
    return null;
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <BarChart3 className="size-7 text-[var(--primary)]" />
            Analytics Dashboard
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Leadership insights for grievance trends, SLA performance, and recurring root causes.
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Last generated: {generatedAt}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/">
              <House className="size-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => void loadAnalytics(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </header>

      <Card className="surface-card mb-4 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Reporting window</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={periodDays === option ? "default" : "outline"}
                onClick={() => setPeriodDays(option)}
              >
                Last {option} day(s)
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <TrendChart
          totalGrievances={overview.total_grievances}
          periodDays={overview.period_days}
          points={overview.volume_trend}
        />
        <CategoryHotspots
          categories={overview.category_distribution}
          departmentHotspots={overview.department_hotspots}
          facultyHotspots={overview.faculty_hotspots}
        />
        <SlaCompliance
          backlog={overview.backlog}
          resolution={overview.resolution}
          compliance={overview.sla_compliance}
          escalationEvents={overview.escalation_events}
          activeBreaches={overview.active_breaches}
        />
        <TopicClusters clusters={topicClusters.clusters} />
      </div>
    </div>
  );
}
