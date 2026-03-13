"use client";

import { DashboardAnalysis } from "@/components/dashboard/analysis";
import { useAppShellContext } from "@/components/app-shell";
import { useWorkspaceData } from "@/components/dashboard/use-workspace-data";

export default function DashboardAnalysisPage() {
  const { currentUser, hasOperationalRole } = useAppShellContext();
  const {
    stats,
    overview,
    clusters,
    myCases,
    aiBrief,
    isLoading,
    dashboardError,
    periodDays,
    setPeriodDays,
  } = useWorkspaceData(currentUser, hasOperationalRole, {
    includeAiBrief: hasOperationalRole,
  });

  return (
    <div className="space-y-6">
      <DashboardAnalysis
        currentUser={currentUser}
        stats={stats}
        overview={overview}
        myCases={myCases}
        clusters={clusters}
        aiBrief={aiBrief}
        hasOperationalRole={hasOperationalRole}
        isLoading={isLoading}
        dashboardError={dashboardError}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
      />
    </div>
  );
}
