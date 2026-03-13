"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Filter,
  ListChecks,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { GrievanceForm } from "@/components/grievance/grievance-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  createGrievance,
  listGrievances,
  listTriageQueue,
} from "@/lib/grievance-api";
import type { GrievanceListItem, GrievanceStatus } from "@/lib/types";

const statusBadgeClass: Record<GrievanceStatus, string> = {
  open: "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950",
  in_progress: "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500",
  resolved: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  closed: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
};

export default function WorkspaceGrievancesPage() {
  const router = useRouter();
  const { currentUser, hasOperationalRole } = useAppShellContext();
  const toast = useToast();
  const [grievances, setGrievances] = useState<GrievanceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | GrievanceStatus>("all");
  const [viewMode, setViewMode] = useState<"mine" | "queue">("mine");

  const canUseQueue = useMemo(() => hasOperationalRole, [hasOperationalRole]);

  useEffect(() => {
    if (!canUseQueue && viewMode === "queue") {
      setViewMode("mine");
    }
  }, [canUseQueue, viewMode]);

  const loadPage = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const status = statusFilter === "all" ? undefined : statusFilter;
      const useQueue = viewMode === "queue" && hasOperationalRole;

      const items = useQueue
        ? await listTriageQueue({ status })
        : await listGrievances({ status, mine: true });

      setGrievances(items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load grievances";
      if (message.toLowerCase().includes("not authenticated")) {
        router.replace("/login");
        return;
      }
      toast.error("Grievance workspace unavailable", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, viewMode, currentUser.id]);

  const handleCreateGrievance = async (payload: {
    title: string;
    description: string;
    category: string;
    is_anonymous?: boolean;
  }) => {
    await createGrievance(payload);
    await loadPage(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading grievances...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Grievance intake and tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit new cases, track workflow progress, and monitor the records that matter to you.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadPage(true)} disabled={isRefreshing}>
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

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-primary" />
              Submit a new grievance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GrievanceForm onCreate={handleCreateGrievance} />
          </CardContent>
        </Card>

        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-primary" />
              Case list
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Filter className="size-4 text-muted-foreground" />
                Status
              </label>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | GrievanceStatus)
                }
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as "mine" | "queue")}
              >
                <option value="mine">My grievances</option>
                {canUseQueue ? <option value="queue">Triage queue</option> : null}
              </select>
            </div>

            <div className="space-y-3">
              {grievances.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  No grievances found for this filter.
                </p>
              ) : (
                grievances.map((grievance) => (
                  <article key={grievance.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{grievance.title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass[grievance.status]}`}
                      >
                        {grievance.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Category: {grievance.category}
                    </p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Created {new Date(grievance.created_at).toLocaleString()}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/grievances/${grievance.id}`}>Open details</Link>
                    </Button>
                  </article>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
