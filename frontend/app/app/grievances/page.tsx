"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { GrievanceDataTable } from "@/components/grievance/grievance-data-table";
import { GrievanceForm } from "@/components/grievance/grievance-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createGrievance, listGrievances } from "@/lib/grievance-api";
import type { GrievanceListItem } from "@/lib/types";

export default function WorkspaceGrievancesPage() {
  const router = useRouter();
  const { currentUser, hasOperationalRole, isAdmin } = useAppShellContext();
  const toast = useToast();
  const [grievances, setGrievances] = useState<GrievanceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPage = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const items = await listGrievances(hasOperationalRole ? undefined : { mine: true });

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
  }, [currentUser.id, hasOperationalRole]);

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
      </div>

      <GrievanceDataTable
        grievances={grievances}
        hasOperationalRole={hasOperationalRole}
        title={hasOperationalRole ? "Operational grievance register" : "My grievance register"}
        description={
          hasOperationalRole
            ? isAdmin
              ? "Review every grievance in the workspace with search, status filtering, category filtering, sorting, and pagination."
              : "Review the grievances assigned to you or routed to your department with full table controls."
            : "Review your grievances with search, status filtering, category filtering, sorting, and pagination."
        }
        emptyMessage={
          hasOperationalRole
            ? isAdmin
              ? "No grievance records are available yet."
              : "No grievances are currently assigned to you or routed to your department."
            : "You have not submitted any grievances yet."
        }
      />
    </div>
  );
}
