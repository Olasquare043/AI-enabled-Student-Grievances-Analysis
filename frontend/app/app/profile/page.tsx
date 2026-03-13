"use client";

import { ShieldCheck, Sparkles, UserRound } from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { DashboardProfile } from "@/components/dashboard/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPrimaryRole } from "@/lib/roles";

export default function DashboardProfilePage() {
  const { currentUser, onProfileUpdate } = useAppShellContext();
  const primaryRole = getPrimaryRole(currentUser.roles);

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <DashboardProfile currentUser={currentUser} onProfileUpdate={onProfileUpdate} />
      </div>
      <div className="space-y-6 xl:col-span-2">
        <Card className="surface-card rounded-[2rem]">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-primary" />
              Access snapshot
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Your current role determines which areas of the workspace remain visible in the sidebar.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {primaryRole ? (
              <div
                key={primaryRole.id}
                className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4"
              >
                <p className="font-medium capitalize">{primaryRole.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {primaryRole.name === "admin"
                    ? "Full access to analytics, operations, profile management, and bulk import workflows."
                    : primaryRole.name === "staff"
                      ? "Access to operational routing, analytics, and shared grievance workflows."
                      : "Access to personal grievance tracking, analysis, and profile management."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-[2rem]">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-primary" />
              Profile impact
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Accurate profile data improves how cases are interpreted, routed, and resolved.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
              <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <UserRound className="size-4 text-primary" />
                Better routing context
              </p>
              Faculty, department, and level provide stronger context for staff triage and reporting.
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4">
              Phone number and academic identity help teams follow up faster when clarification is required.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
