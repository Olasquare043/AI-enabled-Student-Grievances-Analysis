import { CalendarRange, LineChart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VolumeTrendPoint } from "@/lib/types";

type TrendChartProps = {
  totalGrievances: number;
  periodDays: number;
  points: VolumeTrendPoint[];
};

export function TrendChart({ totalGrievances, periodDays, points }: TrendChartProps) {
  const maxTotal = points.reduce((max, item) => Math.max(max, item.total), 0);

  return (
    <Card className="surface-card rounded-[2rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LineChart className="size-5 text-primary" />
          Complaint volume trend
        </CardTitle>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarRange className="size-4" />
          {totalGrievances} grievances in the last {periodDays} day(s)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {points.map((point) => {
            const widthPercent = maxTotal > 0 ? (point.total / maxTotal) * 100 : 0;
            return (
              <div
                key={point.date}
                className="grid grid-cols-[92px_1fr_48px] items-center gap-3 rounded-2xl border border-border/50 bg-background/70 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">{point.date}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${Math.max(widthPercent, point.total > 0 ? 3 : 0)}%` }}
                    role="presentation"
                  />
                </div>
                <span className="text-right text-xs font-medium">{point.total}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
