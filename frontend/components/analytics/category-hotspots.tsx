import { Building2, Layers3, School } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CategoryDistributionPoint,
  DepartmentHotspotPoint,
  FacultyHotspotPoint,
} from "@/lib/types";

type CategoryHotspotsProps = {
  categories: CategoryDistributionPoint[];
  departmentHotspots: DepartmentHotspotPoint[];
  facultyHotspots: FacultyHotspotPoint[];
};

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function CategoryHotspots({
  categories,
  departmentHotspots,
  facultyHotspots,
}: CategoryHotspotsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="surface-card rounded-[2rem]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="size-4 text-primary" />
            Top categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.slice(0, 6).map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{item.category}</span>
                <span className="text-muted-foreground">
                  {item.count} ({item.share_percent}%)
                </span>
              </div>
              <ProgressBar value={item.share_percent} />
            </div>
          ))}
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No category data available.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="surface-card rounded-[2rem]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" />
            Department hotspots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {departmentHotspots.slice(0, 6).map((item) => (
            <div
              key={`${item.department_id ?? "none"}-${item.department_name}`}
              className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm"
            >
              <p className="font-medium">{item.department_name}</p>
              <p className="text-muted-foreground">
                {item.grievance_count} grievances, {item.breach_count} breach event(s)
              </p>
              <p className="text-muted-foreground">
                Avg resolution:{" "}
                {item.avg_resolution_hours === null || item.avg_resolution_hours === undefined
                  ? "n/a"
                  : `${item.avg_resolution_hours}h`}
              </p>
            </div>
          ))}
          {departmentHotspots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No department data available.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="surface-card rounded-[2rem]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <School className="size-4 text-primary" />
            Faculty hotspots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {facultyHotspots.slice(0, 6).map((item) => (
            <div
              key={item.faculty}
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm"
            >
              <span>{item.faculty}</span>
              <span className="font-medium">{item.grievance_count}</span>
            </div>
          ))}
          {facultyHotspots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No faculty data available.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
