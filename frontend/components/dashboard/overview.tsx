"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Clock3,
  LayoutDashboard,
  MessageSquareWarning,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";

import { GrievanceDataTable } from "@/components/grievance/grievance-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewResponse, GrievanceListItem, UserRead } from "@/lib/types";
import type { DashboardStats } from "@/components/dashboard/use-workspace-data";
import { cn } from "@/lib/utils";

type DashboardOverviewProps = {
  currentUser: UserRead;
  stats: DashboardStats | null;
  overview: AnalyticsOverviewResponse | null;
  myCases: GrievanceListItem[];
  hasOperationalRole: boolean;
  isLoading: boolean;
  dashboardError: string | null;
  periodDays: number;
  onPeriodChange: (periodDays: number) => void;
};

const PERIOD_OPTIONS = [7, 30, 90];

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetricCard({
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
  tone?: "default" | "warning" | "danger" | "ai";
}) {
  const toneConfig =
    tone === "danger"
      ? {
          iconTone: "bg-red-600 text-white dark:bg-red-500 dark:text-white",
          accentTone: "bg-red-600 dark:bg-red-500",
        }
      : tone === "warning"
        ? {
            iconTone: "bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950",
            accentTone: "bg-amber-500 dark:bg-amber-400",
          }
        : tone === "ai"
          ? {
              iconTone: "bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white",
              accentTone: "bg-indigo-600 dark:bg-indigo-500",
            }
          : {
              iconTone: "bg-blue-600 text-white dark:bg-blue-500 dark:text-white",
              accentTone: "bg-blue-600 dark:bg-blue-500",
            };

  return (
    <Card className="surface-card overflow-hidden rounded-[1.45rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.5)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p
              className={cn(
                "mt-1.5 font-semibold tracking-tight",
                value.length > 12 ? "text-xl" : "text-2xl",
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-2xl ring-1 ring-black/5 dark:ring-white/10",
              toneConfig.iconTone,
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className={cn("mt-4 h-1.5 rounded-full", toneConfig.accentTone)} />
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="space-y-4 p-8">
          <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-12 w-3/4 animate-pulse rounded-3xl bg-muted" />
          <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="surface-card rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-10 w-24 animate-pulse rounded-2xl bg-muted" />
              <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DashboardOverview({
  currentUser,
  stats,
  overview,
  myCases,
  hasOperationalRole,
  isLoading,
  dashboardError,
  periodDays,
  onPeriodChange,
}: DashboardOverviewProps) {
  const fullName = useMemo(() => {
    const combined = [currentUser.first_name, currentUser.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return combined || "Not set";
  }, [currentUser.first_name, currentUser.last_name]);

  const resolvedCount = myCases.filter(
    (item) => item.status === "resolved" || item.status === "closed",
  ).length;
  const resolutionCoverage =
    stats && stats.myTotalCount > 0
      ? Math.round((resolvedCount / stats.myTotalCount) * 100)
      : 0;
  const topCategories = Array.from(
    myCases.reduce<Map<string, number>>((map, item) => {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
      return map;
    }, new Map()).entries(),
  );

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (!stats) {
    return (
      <Card className="surface-card rounded-3xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {dashboardError ?? "Dashboard metrics are not available right now."}
        </CardContent>
      </Card>
    );
  }

  const quickLinks = [
    {
      href: "/app/analysis",
      label: "Open analysis",
      description: "Move from summary metrics into charts and trend views.",
      icon: BarChart3,
    },
    {
      href: "/app/profile",
      label: "Manage profile",
      description: "Keep identity and academic context current for better routing.",
      icon: UserRound,
    },
    {
      href: "/app/grievances",
      label: "Open grievance workspace",
      description: "Create, filter, and track cases from the same console.",
      icon: MessageSquareWarning,
    },
    ...(hasOperationalRole
      ? [
          {
            href: "/app/operations",
            label: "Review operations",
            description: "Handle routing, SLA risk, and escalations without context switching.",
            icon: LayoutDashboard,
          },
        ]
      : []),
  ];

  const categorySummary = Array.from(topCategories)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
  const isAdmin = currentUser.roles.some((role) => role.name === "admin");
  const showAiStatus = hasOperationalRole;
  const overviewBreachCount =
    overview?.sla_compliance.reduce((sum, item) => sum + item.breached_count, 0) ?? 0;
  const windowCaseValue = overview ? String(overview.total_grievances) : "Unavailable";
  const windowEscalationValue = overview ? String(overview.escalation_events) : "Unavailable";
  const windowBreachValue = overview ? String(overviewBreachCount) : "Unavailable";

  return (
    <div className="space-y-6">
      {dashboardError ? (
        <Card className="overflow-hidden rounded-[1.75rem] border border-orange-400 bg-orange-50 shadow-[0_18px_42px_rgba(249,115,22,0.18)] dark:border-orange-600 dark:bg-slate-950">
          <CardContent className="flex gap-3 p-4">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)]">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-orange-100">
                Some workspace panels are temporarily unavailable
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {dashboardError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="surface-card overflow-hidden rounded-[2rem] border border-border/70 p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-600 bg-sky-600 px-4 py-1.5 text-sm font-medium text-white shadow-[0_14px_32px_rgba(2,132,199,0.18)] dark:border-sky-500 dark:bg-sky-500">
              <Sparkles className="size-4" />
              {hasOperationalRole ? "Workspace summary" : "Student workspace"}
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {hasOperationalRole
                  ? `Welcome back, ${fullName}. Here is the current operating picture.`
                  : `Welcome back, ${fullName}. Here is your grievance snapshot.`}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {hasOperationalRole
                  ? "Use the overview to identify what needs attention first, then move into analysis, operations, or casework from the same layout."
                  : "Use the overview to see your case momentum, identify what still needs action, and jump directly into analysis or profile updates."}
              </p>
            </div>
          </div>
          {hasOperationalRole ? (
            <div className="flex flex-wrap items-center gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={periodDays === option ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => onPeriodChange(option)}
                >
                  Last {option} days
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "grid gap-4 md:grid-cols-2",
            showAiStatus ? "xl:grid-cols-4" : "xl:grid-cols-3",
          )}
        >
          <MetricCard
            title={hasOperationalRole ? "Cases in window" : "My active cases"}
            value={hasOperationalRole ? windowCaseValue : String(stats.myOpenCount)}
            description={
              hasOperationalRole
                ? `Total grievances created in the last ${periodDays} days.`
                : "Open and in-progress grievances that still need movement."
            }
            icon={hasOperationalRole ? BarChart3 : Clock3}
          />
          <MetricCard
            title={hasOperationalRole ? "Escalation events" : "Total submissions"}
            value={hasOperationalRole ? windowEscalationValue : String(stats.myTotalCount)}
            description={
              hasOperationalRole
                ? `Escalations triggered inside the last ${periodDays} days.`
                : "Everything you have submitted through the platform so far."
            }
            icon={hasOperationalRole ? LayoutDashboard : LayoutDashboard}
            tone="warning"
          />
          <MetricCard
            title={hasOperationalRole ? "Breached checkpoints" : "Resolution coverage"}
            value={hasOperationalRole ? windowBreachValue : `${resolutionCoverage}%`}
            description={
              hasOperationalRole
                ? `SLA checkpoints breached in the last ${periodDays} days.`
                : `${resolvedCount} of ${stats.myTotalCount} submitted grievances have reached a final outcome.`
            }
            icon={ShieldAlert}
            tone={hasOperationalRole ? "danger" : "default"}
          />
          {showAiStatus ? (
            <MetricCard
              title="AI enrichment"
              value={stats.aiEnrichmentEnabled ? "Enabled" : "Baseline only"}
              description="Optional summarization support for operational NLP, with deterministic fallback when unavailable."
              icon={BrainCircuit}
              tone="ai"
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="surface-card rounded-[2rem] xl:col-span-3">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Next workspace actions</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Break the dashboard into focused sections while keeping navigation inside one shared layout.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5 transition hover:border-sky-500/60 hover:bg-slate-50 dark:hover:bg-slate-950"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-[0_12px_28px_rgba(2,132,199,0.18)] dark:bg-sky-500">
                  <item.icon className="size-5" />
                </div>
                <p className="font-medium">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open section
                  <ArrowRight className="size-4" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-[2rem] xl:col-span-2">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Snapshot</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {hasOperationalRole
                ? "High-level signals from current backlog and compliance pressure."
                : "The current shape of your grievance history."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasOperationalRole ? (
              <>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Backlog in progress</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {overview?.backlog.total_backlog ?? 0}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open plus in-progress grievances still inside the active queue.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Escalation events</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {overview?.escalation_events ?? 0}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Triggered escalations within the current reporting window.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Overdue backlog</p>
                  <p className="mt-2 text-3xl font-semibold text-destructive">
                    {overview?.backlog.overdue_backlog ?? 0}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Cases already outside expected response windows.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Recent categories</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categorySummary.length > 0 ? (
                      categorySummary.map(([category, count]) => (
                        <span
                          key={category}
                          className="rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white dark:border-blue-500 dark:bg-blue-500"
                        >
                          {titleCase(category)} ({count})
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Categories will appear after your first submission.
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Resolved coverage</p>
                  <p className="mt-2 text-3xl font-semibold">{resolutionCoverage}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Share of your grievance history that has completed the workflow.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
                  <p className="text-sm text-muted-foreground">Current focus</p>
                  <p className="mt-2 text-lg font-semibold">
                    {stats.myOpenCount > 0 ? "Follow up on active cases" : "No open cases right now"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Visit grievances for updates or use profile to keep routing context complete.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <GrievanceDataTable
        grievances={myCases}
        hasOperationalRole={hasOperationalRole}
        title={hasOperationalRole ? "Grievance register" : "My grievance register"}
        description={
          hasOperationalRole
            ? isAdmin
              ? "Search, filter, and page through every grievance in the workspace without leaving the dashboard."
              : "Search, filter, and page through the grievances routed to your department or assigned directly to you."
            : "Search, filter, and page through your grievance history from the dashboard."
        }
        emptyMessage={
          hasOperationalRole
            ? isAdmin
              ? "No grievance records are available yet."
              : "No grievances are currently assigned to you or routed to your department."
            : "No grievance activity has been recorded yet. Start from the grievance workspace to create your first case."
        }
      />
    </div>
  );
}
