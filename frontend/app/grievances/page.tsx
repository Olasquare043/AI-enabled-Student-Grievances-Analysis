"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Filter,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GrievanceForm } from "@/components/grievance/grievance-form";
import { getCurrentUser } from "@/lib/api";
import {
  createGrievance,
  listGrievances,
  listTriageQueue,
} from "@/lib/grievance-api";
import type { GrievanceListItem, GrievanceStatus, UserRead } from "@/lib/types";

const statusBadgeClass: Record<GrievanceStatus, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
};

function hasOperationalRole(user: UserRead | null) {
  if (!user) {
    return false;
  }
  const roles = new Set(user.roles.map((role) => role.name));
  return roles.has("staff") || roles.has("admin");
}

export default function GrievancesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [grievances, setGrievances] = useState<GrievanceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | GrievanceStatus>("all");
  const [viewMode, setViewMode] = useState<"mine" | "queue">("mine");

  const canUseQueue = useMemo(() => hasOperationalRole(currentUser), [currentUser]);

  const loadPage = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const me = await getCurrentUser();
      setCurrentUser(me);

      const status = statusFilter === "all" ? undefined : statusFilter;
      const useQueue = viewMode === "queue" && hasOperationalRole(me);

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
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, statusFilter, viewMode]);

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading grievances...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Grievance Intake and Tracking</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Submit new cases, track status, and collaborate with staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/app">
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-[var(--primary)]" />
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
              <ListChecks className="size-5 text-[var(--primary)]" />
              Case list
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Filter className="size-4 text-[var(--muted-foreground)]" />
                Status
              </label>
              <select
                className="h-9 rounded-md border border-[var(--border)] bg-white px-2 text-sm"
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
                className="h-9 rounded-md border border-[var(--border)] bg-white px-2 text-sm"
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as "mine" | "queue")}
              >
                <option value="mine">My grievances</option>
                {canUseQueue ? <option value="queue">Triage queue</option> : null}
              </select>
            </div>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="space-y-3">
              {grievances.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-tint)]/50 px-3 py-4 text-sm text-[var(--muted-foreground)]">
                  No grievances found for this filter.
                </p>
              ) : (
                grievances.map((grievance) => (
                  <article
                    key={grievance.id}
                    className="rounded-lg border border-[var(--border)] bg-white p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{grievance.title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass[grievance.status]}`}
                      >
                        {grievance.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Category: {grievance.category}
                    </p>
                    <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                      Created {new Date(grievance.created_at).toLocaleString()}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/grievances/${grievance.id}`}>Open details</Link>
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
