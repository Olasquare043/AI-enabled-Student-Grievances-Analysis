"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  AreaChart as AreaChartIcon,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardStats } from "@/components/dashboard/use-workspace-data";
import type {
  AnalyticsOverviewResponse,
  GrievanceListItem,
  NLPTextAnalysisResponse,
  TopicClusterInsight,
  UserRead,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardAnalysisProps = {
  currentUser: UserRead;
  stats: DashboardStats | null;
  overview: AnalyticsOverviewResponse | null;
  myCases: GrievanceListItem[];
  clusters: TopicClusterInsight[];
  aiBrief: NLPTextAnalysisResponse | null;
  hasOperationalRole: boolean;
  isLoading: boolean;
  dashboardError: string | null;
  periodDays: number;
  onPeriodChange: (periodDays: number) => void;
};

const PERIOD_OPTIONS = [7, 30, 90];
const CHART_COLORS = ["#0f8ec7", "#0f766e", "#f59e0b", "#ef4444", "#64748b"];
const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: "14px",
  color: "#f8fafc",
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function groupCasesByMonth(cases: GrievanceListItem[]) {
  const byMonth = new Map<string, { label: string; total: number }>();

  for (const item of cases) {
    const date = new Date(item.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
    const existing = byMonth.get(key);
    byMonth.set(key, {
      label,
      total: (existing?.total ?? 0) + 1,
    });
  }

  return [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([, value]) => value);
}

function summarizeStatuses(cases: GrievanceListItem[]) {
  const counts = new Map<string, number>();
  for (const item of cases) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }

  return [...counts.entries()].map(([name, value], index) => ({
    name: titleCase(name),
    value,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function summarizeCategories(cases: GrievanceListItem[]) {
  const counts = new Map<string, number>();
  for (const item of cases) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, value], index) => ({
      name: titleCase(name),
      value,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getEntityList(
  entities: Record<string, unknown>,
  key: string,
  limit = 5,
) {
  const value = entities[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, limit);
}

function providerVariant(provider: string) {
  return provider === "groq"
    ? "border-sky-700/40 bg-sky-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)]"
    : "border-slate-700/40 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] dark:bg-slate-100 dark:text-slate-950";
}

function categoryVariant(category: string) {
  switch (category.toLowerCase()) {
    case "bursary":
      return "border-amber-500/40 bg-amber-400 text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.18)]";
    case "academic":
      return "border-blue-700/40 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]";
    case "hostel":
      return "border-teal-700/40 bg-teal-600 text-white shadow-[0_10px_24px_rgba(13,148,136,0.18)]";
    case "ict":
      return "border-cyan-700/40 bg-cyan-600 text-white shadow-[0_10px_24px_rgba(8,145,178,0.18)]";
    case "registry":
      return "border-slate-700/40 bg-slate-700 text-white shadow-[0_10px_24px_rgba(51,65,85,0.18)]";
    case "security":
      return "border-rose-700/40 bg-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.18)]";
    case "welfare":
      return "border-emerald-700/40 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.18)]";
    default:
      return "border-slate-700/40 bg-slate-800 text-white shadow-[0_10px_24px_rgba(30,41,59,0.18)] dark:bg-slate-100 dark:text-slate-950";
  }
}

function urgencyVariant(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "critical") {
    return "border-red-700/40 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)]";
  }
  if (normalized === "high") {
    return "border-orange-700/40 bg-orange-500 text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]";
  }
  if (normalized === "medium") {
    return "border-amber-500/40 bg-amber-400 text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.18)]";
  }
  return "border-emerald-700/40 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.2)]";
}

function confidenceDescriptor(confidence: number) {
  if (confidence >= 0.7) {
    return {
      label: "Strong match",
      tone: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
      message: "The routing signal is strong enough to trust as the primary category.",
    };
  }

  if (confidence >= 0.45) {
    return {
      label: "Moderate match",
      tone: "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950",
      message: "The routing signal is usable, but neighboring categories are still plausible.",
    };
  }

  return {
    label: "Low match",
    tone: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
    message: "This is a weak routing cue, so manual review is still important.",
  };
}

function complianceDescriptor(rate: number, met: number, breached: number) {
  const totalTracked = met + breached;
  if (totalTracked === 0) {
    return {
      label: "No data",
      badgeTone: "border-slate-500/35 bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-950",
      barTone: "bg-slate-500",
      textTone: "text-slate-700 dark:text-slate-300",
      summary: "No SLA checkpoints were tracked in this reporting window.",
    };
  }

  if (met === 0 && breached > 0) {
    return {
      label: "At risk",
      badgeTone: "border-red-700/40 bg-red-600 text-white",
      barTone: "bg-red-600",
      textTone: "text-red-700 dark:text-red-300",
      summary: "All tracked SLA checkpoints breached in this reporting window.",
    };
  }

  if (breached === 0) {
    return {
      label: "Healthy",
      badgeTone: "border-emerald-700/35 bg-emerald-600 text-white",
      barTone: "bg-emerald-600",
      textTone: "text-emerald-700 dark:text-emerald-300",
      summary: "Every tracked SLA checkpoint was met in this reporting window.",
    };
  }

  if (rate >= 85) {
    return {
      label: "Healthy",
      badgeTone: "border-emerald-700/35 bg-emerald-600 text-white",
      barTone: "bg-emerald-600",
      textTone: "text-emerald-700 dark:text-emerald-300",
      summary: "Deadline performance is within the expected operating band.",
    };
  }

  if (rate >= 65) {
    return {
      label: "Watch",
      badgeTone: "border-amber-500/40 bg-amber-400 text-slate-950",
      barTone: "bg-amber-500",
      textTone: "text-amber-700 dark:text-amber-300",
      summary: "Performance is slipping and should be monitored closely.",
    };
  }

  return {
    label: "At risk",
    badgeTone: "border-red-700/40 bg-red-600 text-white",
    barTone: "bg-red-600",
    textTone: "text-red-700 dark:text-red-300",
    summary: "Too many deadlines are being missed in this reporting window.",
  };
}

function buildSentimentDescription(sentiment: NLPTextAnalysisResponse["sentiment"]) {
  const totalSignals = sentiment.positive_hits + sentiment.negative_hits;
  if (totalSignals === 0) {
    return "Rules-based readout: no explicit positive or negative wording was detected in the analyzed text.";
  }

  const signalParts: string[] = [];
  if (sentiment.positive_hits > 0) {
    signalParts.push(`${sentiment.positive_hits} positive cue${sentiment.positive_hits === 1 ? "" : "s"}`);
  }
  if (sentiment.negative_hits > 0) {
    signalParts.push(`${sentiment.negative_hits} negative cue${sentiment.negative_hits === 1 ? "" : "s"}`);
  }

  return `Rules-based readout from ${signalParts.join(" and ")}. Score ${sentiment.score.toFixed(2)}.`;
}

function tidySummaryText(summary: string) {
  return summary
    .replace(/\s+/g, " ")
    .replace(/(?:,\s*)?(?:and|or)\.$/i, ".")
    .trim();
}

function humanizeSignal(value: string) {
  return titleCase(value.replace(/[:_]/g, " "));
}

function InsightBadge({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]",
        tone,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
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
  tone?: "default" | "accent" | "danger" | "ai";
}) {
  const toneConfig =
    tone === "danger"
      ? {
          iconTone: "bg-red-600 text-white dark:bg-red-500 dark:text-white",
          accentTone: "bg-red-600 dark:bg-red-500",
        }
      : tone === "accent"
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

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("surface-card rounded-3xl", className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="size-5 text-primary" />
              {title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
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
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="surface-card rounded-3xl xl:col-span-3">
          <CardContent className="p-6">
            <div className="h-[320px] animate-pulse rounded-3xl bg-muted" />
          </CardContent>
        </Card>
        <Card className="surface-card rounded-3xl xl:col-span-2">
          <CardContent className="p-6">
            <div className="h-[320px] animate-pulse rounded-3xl bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardAnalysis({
  currentUser,
  stats,
  overview,
  myCases,
  clusters,
  aiBrief,
  hasOperationalRole,
  isLoading,
  dashboardError,
  periodDays,
  onPeriodChange,
}: DashboardAnalysisProps) {
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

  const resolvedCount = myCases.filter(
    (item) => item.status === "resolved" || item.status === "closed",
  ).length;
  const studentTrend = groupCasesByMonth(myCases);
  const studentStatusMix = summarizeStatuses(myCases);
  const studentCategoryMix = summarizeCategories(myCases);
  const responseCoverage =
    stats.myTotalCount > 0 ? Math.round((resolvedCount / stats.myTotalCount) * 100) : 0;

  const volumeTrend =
    overview?.volume_trend.map((item) => ({
      label: formatShortDate(item.date),
      total: item.total,
    })) ?? [];
  const categoryMix =
    overview?.category_distribution.slice(0, 6).map((item, index) => ({
      name: titleCase(item.category),
      value: item.count,
      share: item.share_percent,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    })) ?? [];
  const departmentHotspots =
    overview?.department_hotspots.slice(0, 6).map((item) => ({
      name:
        item.department_name.length > 16
          ? `${item.department_name.slice(0, 16)}...`
          : item.department_name,
      grievances: item.grievance_count,
      breaches: item.breach_count,
    })) ?? [];
  const complianceData =
    overview?.sla_compliance.map((item) => ({
      name: item.breach_type === "first_response" ? "First response" : "Resolution",
      rate: item.compliance_rate_percent,
      met: item.met_count,
      breached: item.breached_count,
      fill:
        item.compliance_rate_percent >= 85
          ? "#0f8ec7"
          : item.compliance_rate_percent >= 65
            ? "#f59e0b"
            : "#ef4444",
    })) ?? [];
  const facultyHotspots = overview?.faculty_hotspots.slice(0, 5) ?? [];
  const showAiStatus = hasOperationalRole;
  const aiKeywords = aiBrief ? getEntityList(aiBrief.entities, "keywords", 6) : [];
  const aiDepartments = aiBrief ? getEntityList(aiBrief.entities, "departments", 4) : [];
  const aiReasons = aiBrief?.urgency.reasons.slice(0, 3) ?? [];
  const aiSummary = aiBrief ? tidySummaryText(aiBrief.summary) : "";
  const confidenceSummary = aiBrief
    ? confidenceDescriptor(aiBrief.category_confidence)
    : null;
  const totalSlaMet = complianceData.reduce((sum, item) => sum + item.met, 0);
  const totalSlaBreached = complianceData.reduce((sum, item) => sum + item.breached, 0);
  const totalSlaTracked = totalSlaMet + totalSlaBreached;
  const overallComplianceRate =
    totalSlaTracked > 0 ? (totalSlaMet / totalSlaTracked) * 100 : 0;
  const overallComplianceSummary = complianceDescriptor(
    overallComplianceRate,
    totalSlaMet,
    totalSlaBreached,
  );
  const periodBreachCount = complianceData.reduce((sum, item) => sum + item.breached, 0);
  const periodCaseCountValue = overview ? String(overview.total_grievances) : "Unavailable";
  const periodEscalationValue = overview ? String(overview.escalation_events) : "Unavailable";
  const periodBreachValue = overview ? String(periodBreachCount) : "Unavailable";

  return (
    <div className="space-y-6">
      {dashboardError ? (
        <Card className="overflow-hidden rounded-[1.75rem] border border-orange-300 bg-orange-50 shadow-[0_18px_42px_rgba(249,115,22,0.14)] dark:border-orange-700 dark:bg-slate-950">
          <CardContent className="flex gap-3 p-4">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)]">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-orange-100">
                Some analysis panels are temporarily unavailable
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
              {hasOperationalRole ? "Operations pulse" : "Personal grievance insights"}
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {hasOperationalRole
                  ? "See queue pressure, SLA exposure, and recurring themes in one place."
                  : `Track your grievance activity, ${currentUser.first_name ?? "student"}.`}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {hasOperationalRole
                  ? "This dashboard combines live queue metrics, analytics summaries, and an AI-generated operations brief so staff can prioritize faster without leaving the workspace."
                  : "Your dashboard now includes visual summaries of complaint flow, status distribution, and category concentration to make follow-up easier."}
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
            value={hasOperationalRole ? periodCaseCountValue : String(stats.myOpenCount)}
            description={
              hasOperationalRole
                ? `Total grievances created in the last ${periodDays} days.`
                : "Open and in-progress grievances that still need movement."
            }
            icon={Activity}
          />
          <MetricCard
            title={hasOperationalRole ? "Escalation events" : "Total submissions"}
            value={hasOperationalRole ? periodEscalationValue : String(stats.myTotalCount)}
            description={
              hasOperationalRole
                ? `Escalations triggered inside the last ${periodDays} days.`
                : "Everything you have submitted through the platform so far."
            }
            icon={hasOperationalRole ? AlertTriangle : LayoutGrid}
            tone="accent"
          />
          <MetricCard
            title={hasOperationalRole ? "Breached checkpoints" : "Resolved and closed"}
            value={hasOperationalRole ? periodBreachValue : String(resolvedCount)}
            description={
              hasOperationalRole
                ? `SLA checkpoints breached in the last ${periodDays} days.`
                : "Cases that have reached a final outcome in your history."
            }
            icon={hasOperationalRole ? ShieldAlert : CheckCircle2}
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

      {hasOperationalRole ? (
        <>
          <SectionCard
            title="AI operations brief"
            description="A synthesized readout built from backlog, SLA compliance, hotspots, and recurring complaint themes."
            icon={Sparkles}
          >
            {aiBrief ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <InsightBadge
                      icon={BrainCircuit}
                      tone={providerVariant(aiBrief.provider)}
                      label={aiBrief.provider === "groq" ? "AI-assisted summary" : "Rules-based summary"}
                    />
                    <InsightBadge
                      icon={LayoutGrid}
                      tone={categoryVariant(aiBrief.predicted_category)}
                      label={`Route ${titleCase(aiBrief.predicted_category)}`}
                    />
                    <InsightBadge
                      icon={AlertTriangle}
                      tone={urgencyVariant(aiBrief.urgency.label)}
                      label={`Urgency ${titleCase(aiBrief.urgency.label)}`}
                    />
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">
                    The first badge shows how the summary was generated, the middle badge shows the strongest routing category candidate, and the urgency badge reflects the current risk score from the analysis engine.
                  </p>
                  <div className="rounded-[1.6rem] border border-border/70 bg-background/70 p-5 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
                    <p className="text-sm leading-7 text-foreground/90">{aiSummary}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Routing category confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">
                        {formatConfidence(aiBrief.category_confidence)}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Top routing suggestion: {titleCase(aiBrief.predicted_category)}
                      </p>
                      {confidenceSummary ? (
                        <>
                          <span
                            className={cn(
                              "mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                              confidenceSummary.tone,
                            )}
                          >
                            {confidenceSummary.label}
                          </span>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {confidenceSummary.message}
                          </p>
                        </>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {aiBrief.category_suggestions.slice(0, 3).map((item) => (
                          <span
                            key={item.label}
                            className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {titleCase(item.label)} {formatConfidence(item.score)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Sentiment signal
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">
                        {titleCase(aiBrief.sentiment.label)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {buildSentimentDescription(aiBrief.sentiment)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Recommended focus
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aiDepartments.length > 0 ? (
                        aiDepartments.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-medium text-white dark:border-sky-500 dark:bg-sky-500"
                          >
                            {titleCase(item)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No department hints detected.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Priority signals
                    </p>
                    <div className="mt-3 space-y-2">
                      {aiReasons.length > 0 ? (
                        aiReasons.map((reason) => (
                          <div
                            key={reason}
                            className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground"
                          >
                            {humanizeSignal(reason)}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No elevated urgency factors were flagged.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Keywords detected
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aiKeywords.length > 0 ? (
                        aiKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium"
                          >
                            {keyword}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Keyword extraction is empty for this window.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState message="The AI operations brief becomes available when operational analytics and NLP analysis complete successfully." />
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-5">
            <SectionCard
              title="Complaint volume"
              description="Daily intake across the reporting window."
              icon={AreaChartIcon}
              className="xl:col-span-3"
            >
              {volumeTrend.length > 0 ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeTrend}>
                      <defs>
                        <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f8ec7" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#0f8ec7" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#0f8ec7"
                        strokeWidth={3}
                        fill="url(#volumeFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No analytics volume data is available in the selected window." />
              )}
            </SectionCard>

            <SectionCard
              title="Category distribution"
            description="Where case demand is concentrating right now."
            icon={TrendingUp}
            className="xl:col-span-2"
          >
            {categoryMix.length > 0 ? (
                <div className="flex h-[360px] flex-col">
                  <div className="min-h-[220px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryMix}
                        innerRadius={72}
                        outerRadius={108}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {categoryMix.map((item) => (
                          <Cell key={item.name} fill={item.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid max-h-28 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {categoryMix.map((item) => (
                      <div
                        key={item.name}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="shrink-0 text-muted-foreground">{item.value} cases</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState message="Category analytics will appear here once cases are available." />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <SectionCard
              title="Department hotspots"
              description="Top departments by grievance load, with breach pressure layered in."
              icon={Clock3}
              className="xl:col-span-3"
            >
              {departmentHotspots.length > 0 ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentHotspots} barGap={10}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="grievances"
                        radius={[10, 10, 0, 0]}
                        fill="#0f8ec7"
                      />
                      <Bar dataKey="breaches" radius={[10, 10, 0, 0]} fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No routed department data is available yet." />
              )}
            </SectionCard>

            <SectionCard
              title="SLA compliance"
              description="Current rate of deadlines met versus breached."
              icon={ShieldAlert}
              className="xl:col-span-2"
            >
              {complianceData.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-[1.65rem] border border-border/70 bg-background/75 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Overall compliance
                        </p>
                        <p className="mt-2 text-4xl font-semibold tracking-tight">
                          {overallComplianceRate.toFixed(1)}%
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                          overallComplianceSummary.badgeTone,
                        )}
                      >
                        {overallComplianceSummary.label}
                      </span>
                    </div>
                    <p className={cn("mt-3 text-sm font-medium", overallComplianceSummary.textTone)}>
                      {overallComplianceSummary.summary}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {totalSlaTracked === 0
                        ? "No compliance events were available for the selected window."
                        : `${totalSlaMet} of ${totalSlaTracked} tracked SLA checkpoints were met in the selected window.`}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {complianceData.map((item) => {
                      const itemSummary = complianceDescriptor(item.rate, item.met, item.breached);

                      return (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.met + item.breached} checkpoints tracked
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-semibold">{item.rate.toFixed(1)}%</span>
                              <span
                                className={cn(
                                  "ml-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                  itemSummary.badgeTone,
                                )}
                              >
                                {itemSummary.label}
                              </span>
                            </div>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                itemSummary.barTone,
                              )}
                              style={{ width: `${Math.max(4, Math.min(item.rate, 100))}%` }}
                            />
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Met {item.met} deadline{item.met === 1 ? "" : "s"} and breached {item.breached}.
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState message="SLA compliance summaries are not available yet." />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <SectionCard
              title="Recurring themes"
              description="Clustered complaints to surface systemic issues quickly."
              icon={BrainCircuit}
              className="xl:col-span-3"
            >
              <div className="space-y-4">
                {clusters.slice(0, 4).map((cluster) => (
                  <div
                    key={cluster.cluster_id}
                    className="rounded-3xl border border-border/70 bg-background/70 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          Cluster #{cluster.cluster_id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cluster.size} grievance(s) with overlapping language patterns
                        </p>
                      </div>
                      <span className="rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-semibold text-white dark:border-sky-500 dark:bg-sky-500">
                        {cluster.member_ids.length} linked cases
                      </span>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {cluster.top_keywords.map((keyword) => (
                        <span
                          key={`${cluster.cluster_id}-${keyword}`}
                          className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {cluster.sample_titles.map((title, index) => (
                        <div
                          key={`${cluster.cluster_id}-${index}`}
                          className="rounded-2xl bg-card px-3 py-2 text-sm text-muted-foreground"
                        >
                          {title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {clusters.length === 0 ? (
                  <EmptyState message="No recurring topic clusters were detected in the current reporting window." />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Faculty hotspots"
              description="Faculties generating the highest case density."
              icon={AlertTriangle}
              className="xl:col-span-2"
            >
              <div className="space-y-3">
                {facultyHotspots.map((item) => (
                  <div
                    key={item.faculty}
                    className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{item.faculty}</p>
                      <span className="text-sm font-semibold">{item.grievance_count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{
                          width: `${Math.min(
                            100,
                            item.grievance_count * 12,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {facultyHotspots.length === 0 ? (
                  <EmptyState message="Faculty hotspot data is not available yet." />
                ) : null}
              </div>
            </SectionCard>
          </div>
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-5">
          <SectionCard
            title="Submission cadence"
            description="Monthly view of how your cases have accumulated over time."
            icon={AreaChartIcon}
            className="xl:col-span-3"
          >
            {studentTrend.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={studentTrend}>
                    <defs>
                      <linearGradient id="studentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f8ec7" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#0f8ec7" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#0f8ec7"
                      strokeWidth={3}
                      fill="url(#studentFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Your complaint history will chart here after your first submission." />
            )}
          </SectionCard>

          <SectionCard
            title="Status mix"
            description="How your current history is distributed across workflow states."
            icon={CheckCircle2}
            className="xl:col-span-2"
          >
            {studentStatusMix.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentStatusMix}
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {studentStatusMix.map((item) => (
                        <Cell key={item.name} fill={item.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {studentStatusMix.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-muted-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message="Status distribution will appear after your first case enters the workflow." />
            )}
          </SectionCard>

          <SectionCard
            title="Category concentration"
            description="The issues you submit most often, ranked by frequency."
            icon={TrendingUp}
            className="xl:col-span-3"
          >
            {studentCategoryMix.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentCategoryMix}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {studentCategoryMix.map((item) => (
                        <Cell key={item.name} fill={item.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Category breakdown will appear once you have submitted cases." />
            )}
          </SectionCard>

          <SectionCard
            title="Resolution coverage"
            description="Share of your case history that has reached a final outcome."
            icon={ShieldAlert}
            className="xl:col-span-2"
          >
            <div className="flex h-[320px] flex-col justify-between">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="30%"
                    outerRadius="95%"
                    data={[
                      {
                        name: "Resolved",
                        value: responseCoverage,
                        fill: "#0f8ec7",
                      },
                    ]}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={24} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                <p className="text-sm text-muted-foreground">Resolved and closed cases</p>
                <p className="mt-2 text-3xl font-semibold">{responseCoverage}%</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {resolvedCount} of {stats.myTotalCount} submitted grievances have completed the workflow.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
