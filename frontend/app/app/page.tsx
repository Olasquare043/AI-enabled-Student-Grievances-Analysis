"use client";

import { useAppShellContext } from "@/components/app-shell";
import { DashboardOverview } from "@/components/dashboard/overview";
import { useWorkspaceData } from "@/components/dashboard/use-workspace-data";

export default function DashboardOverviewPage() {
  const { currentUser, hasOperationalRole } = useAppShellContext();
  const {
    stats,
    overview,
    myCases,
    isLoading,
    dashboardError,
    periodDays,
    setPeriodDays,
  } = useWorkspaceData(currentUser, hasOperationalRole, {
    includeAiBrief: false,
  });

  return (
    <div className="space-y-6">
      <DashboardOverview
        currentUser={currentUser}
        stats={stats}
        overview={overview}
        myCases={myCases}
        hasOperationalRole={hasOperationalRole}
        isLoading={isLoading}
        dashboardError={dashboardError}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
      />
    </div>
  );
}
