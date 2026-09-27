import { Radar, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsTopicTrendsResponse, TopicTrendSeries } from "@/lib/types";

function Sparkline({ series, weeks }: { series: TopicTrendSeries; weeks: string[] }) {
  const width = 220;
  const height = 44;
  const max = Math.max(...series.weekly_counts, 1);
  const step = series.weekly_counts.length > 1 ? width / (series.weekly_counts.length - 1) : width;
  const points = series.weekly_counts
    .map((value, index) => `${(index * step).toFixed(1)},${(height - 4 - (value / max) * (height - 8)).toFixed(1)}`)
    .join(" ");
  const alertIndexes = new Set(series.alert_weeks.map((week) => weeks.indexOf(week)));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-full max-w-[220px] text-sky-600 dark:text-sky-400"
      role="img"
      aria-label={`Weekly volume for ${series.label}`}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.8" points={points} />
      {series.weekly_counts.map((value, index) =>
        alertIndexes.has(index) ? (
          <circle
            key={index}
            cx={index * step}
            cy={height - 4 - (value / max) * (height - 8)}
            r="3.5"
            className="fill-red-600 dark:fill-red-400"
          >
            <title>{`Spike: ${value} grievances in week of ${weeks[index]}`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}

export function TopicTrends({ data }: { data: AnalyticsTopicTrendsResponse }) {
  const topics = data.topics.slice(0, 12);

  return (
    <Card className="surface-card rounded-[2rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radar className="size-5 text-primary" />
          Root-cause topics and early warnings (LDA)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Latent themes discovered across all grievances in the last {data.period_days} days. Red dots mark weeks
          where a theme spiked. {data.method}.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.alerts.length > 0 ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200">
              <TriangleAlert className="size-4" />
              {data.alerts.length} emerging-issue alert{data.alerts.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-1 text-sm">
              {data.alerts.slice(0, 5).map((alert) => (
                <li key={`${alert.topic_id}-${alert.week_start}`}>
                  Week of {alert.week_start}: <strong>{alert.label}</strong> — {alert.count} grievances
                  (threshold {alert.threshold})
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No unusual spikes detected in this window.</p>
        )}

        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No topic assignments are available yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((topic) => (
              <div
                key={topic.topic_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    Topic {topic.topic_id}: {topic.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{topic.top_words.join(", ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.count} grievances · {topic.share_percent}%
                  </p>
                </div>
                <Sparkline series={topic} weeks={data.weeks} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
