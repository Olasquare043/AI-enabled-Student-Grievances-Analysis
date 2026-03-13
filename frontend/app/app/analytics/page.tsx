"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { CategoryHotspots } from "@/components/analytics/category-hotspots";
import { SlaCompliance } from "@/components/analytics/sla-compliance";
import { TopicClusters } from "@/components/analytics/topic-clusters";
import { TrendChart } from "@/components/analytics/trend-chart";
import { useAppShellContext } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { getAnalyticsOverview, getAnalyticsTopicClusters } from "@/lib/analytics-api";
import type {
  AnalyticsOverviewResponse,
  AnalyticsTopicClustersResponse,
} from "@/lib/types";

const PERIOD_OPTIONS = [7, 30, 90];

function MetricPanel({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger";
}) {
  const toneConfig =
    tone === "danger"
      ? {
          iconTone: "bg-rose-600 text-white dark:bg-rose-500 dark:text-white",
          accentTone: "bg-rose-600 dark:bg-rose-500",
        }
      : tone === "warning"
        ? {
            iconTone: "bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950",
            accentTone: "bg-amber-500 dark:bg-amber-400",
          }
        : {
            iconTone: "bg-sky-600 text-white dark:bg-sky-500 dark:text-white",
            accentTone: "bg-sky-600 dark:bg-sky-500",
          };

  return (
    <Card className="surface-card overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.5)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className={`flex size-11 items-center justify-center rounded-2xl ${toneConfig.iconTone}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className={`mt-4 h-1.5 rounded-full ${toneConfig.accentTone}`} />
      </CardContent>
    </Card>
  );
}

export default function WorkspaceAnalyticsPage() {
  const { hasOperationalRole } = useAppShellContext();
  const toast = useToast();
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [topicClusters, setTopicClusters] =
    useState<AnalyticsTopicClustersResponse | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const generatedAt = useMemo(() => {
    if (!overview) {
      return "";
    }
    return new Date(overview.generated_at).toLocaleString();
  }, [overview]);

  const loadAnalytics = async (refresh = false) => {
    if (!hasOperationalRole) {
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const [overviewData, clustersData] = await Promise.all([
        getAnalyticsOverview(periodDays),
        getAnalyticsTopicClusters(periodDays),
      ]);

      setOverview(overviewData);
      setTopicClusters(clustersData);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load analytics";
      toast.error("Analytics unavailable", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays, hasOperationalRole, toast]);

  if (!hasOperationalRole) {
    return (
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Analytics access is available only to staff and admin users.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Loading analytics dashboard...
        </div>
      </div>
    );
  }

  if (!overview || !topicClusters) {
    return (
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Analytics data is temporarily unavailable. Try refreshing the workspace.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden rounded-[2.25rem] border border-border/70 p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Monitor grievance demand, queue risk, and recurring issues from one analytics view.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                This workspace extends the shared dashboard with a leadership view for intake patterns,
                departmental hotspots, SLA pressure, and clustered complaint themes.
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Last generated: {generatedAt}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={periodDays === option ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setPeriodDays(option)}
              >
                Last {option} days
              </Button>
            ))}
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
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          title="Total grievances"
          value={String(overview.total_grievances)}
          description="All complaints observed in the selected reporting window."
          icon={BarChart3}
        />
        <MetricPanel
          title="Total backlog"
          value={String(overview.backlog.total_backlog)}
          description="Cases still open or actively in progress."
          icon={Clock3}
          tone="warning"
        />
        <MetricPanel
          title="Active breaches"
          value={String(overview.active_breaches)}
          description="Live SLA failures that need intervention."
          icon={ShieldAlert}
          tone="danger"
        />
        <MetricPanel
          title="Escalation events"
          value={String(overview.escalation_events)}
          description="Triggered escalations within the reporting window."
          icon={AlertTriangle}
          tone="warning"
        />
      </section>

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
