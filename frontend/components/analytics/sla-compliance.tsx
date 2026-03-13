import { Gauge, ShieldAlert, TimerReset } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BacklogMetrics, ResolutionMetrics, SLACompliancePoint } from "@/lib/types";

type SlaComplianceProps = {
  backlog: BacklogMetrics;
  resolution: ResolutionMetrics;
  compliance: SLACompliancePoint[];
  escalationEvents: number;
  activeBreaches: number;
};

function percentColor(rate: number) {
  if (rate >= 85) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (rate >= 60) {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-rose-700 dark:text-rose-300";
}

export function SlaCompliance({
  backlog,
  resolution,
  compliance,
  escalationEvents,
  activeBreaches,
}: SlaComplianceProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="surface-card rounded-[2rem]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-primary" />
            SLA compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {compliance.map((item) => {
            const rate = Math.max(0, Math.min(100, item.compliance_rate_percent));
            return (
              <div
                key={item.breach_type}
                className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">
                    {item.breach_type.replace("_", " ")}
                  </span>
                  <span className={`font-semibold ${percentColor(rate)}`}>{rate}%</span>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Met: {item.met_count} | Breached: {item.breached_count}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="surface-card rounded-[2rem]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TimerReset className="size-4 text-primary" />
            Backlog and resolution metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Open</p>
            <p className="text-xl font-semibold">{backlog.open_count}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">In progress</p>
            <p className="text-xl font-semibold">{backlog.in_progress_count}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Total backlog</p>
            <p className="text-xl font-semibold">{backlog.total_backlog}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Overdue backlog</p>
            <p className="text-xl font-semibold text-destructive">{backlog.overdue_backlog}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Avg resolution</p>
            <p className="text-xl font-semibold">
              {resolution.avg_resolution_hours === null ||
              resolution.avg_resolution_hours === undefined
                ? "n/a"
                : `${resolution.avg_resolution_hours}h`}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Resolved in period</p>
            <p className="text-xl font-semibold">{resolution.resolved_count}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="text-muted-foreground">Escalation events</p>
            <p className="text-xl font-semibold">{escalationEvents}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm">
            <p className="flex items-center gap-1 text-muted-foreground">
              <ShieldAlert className="size-3.5" />
              Active breaches
            </p>
            <p className="text-xl font-semibold text-destructive">{activeBreaches}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
