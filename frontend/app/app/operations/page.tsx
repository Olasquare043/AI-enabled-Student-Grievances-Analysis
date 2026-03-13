"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { SlaBoard } from "@/components/operations/sla-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  evaluateSla,
  listDepartments,
  listEscalationRules,
  listOperationsQueue,
  listSlaBreaches,
  listSlaPolicies,
  routeGrievance,
  upsertSlaPolicy,
} from "@/lib/operations-api";
import type {
  DepartmentRead,
  EscalationRuleRead,
  OperationalGrievanceItem,
  SLABreachSummary,
  SLAEvaluationResponse,
  SLAPolicyRead,
  SLAPolicyUpsertRequest,
} from "@/lib/types";

export default function WorkspaceOperationsPage() {
  const router = useRouter();
  const { hasOperationalRole, isAdmin } = useAppShellContext();
  const toast = useToast();

  const [departments, setDepartments] = useState<DepartmentRead[]>([]);
  const [queue, setQueue] = useState<OperationalGrievanceItem[]>([]);
  const [breaches, setBreaches] = useState<SLABreachSummary[]>([]);
  const [policies, setPolicies] = useState<SLAPolicyRead[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<SLAEvaluationResponse | null>(null);

  const loadPage = async (refresh = false) => {
    if (!hasOperationalRole) {
      router.replace("/app");
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [departmentList, queueItems, policyList, breachList, ruleList] = await Promise.all([
        listDepartments(true),
        listOperationsQueue(),
        listSlaPolicies(),
        listSlaBreaches(),
        listEscalationRules(),
      ]);

      setDepartments(departmentList);
      setQueue(queueItems);
      setPolicies(policyList);
      setBreaches(breachList);
      setEscalationRules(ruleList);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load operations";
      if (message.toLowerCase().includes("not authenticated")) {
        router.replace("/login");
        return;
      }
      toast.error("Operations unavailable", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOperationalRole]);

  const handleRoute = async (grievanceId: string, departmentId: number) => {
    try {
      await routeGrievance(grievanceId, { department_id: departmentId });
      await loadPage(true);
      toast.success("Grievance routed", "The case was routed successfully.");
    } catch (routeError) {
      const message =
        routeError instanceof Error ? routeError.message : "Unable to route grievance";
      toast.error("Routing failed", message);
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const result = await evaluateSla();
      setLastEvaluation(result);
      await loadPage(true);
      toast.success(
        "SLA evaluation complete",
        result.new_breaches === 0 && result.new_escalations === 0
          ? "No due SLA deadlines were converted into new breaches during this scan."
          : `${result.new_breaches} new breach(es), ${result.new_escalations} new escalation(s).`,
      );
    } catch (evaluateError) {
      const message =
        evaluateError instanceof Error ? evaluateError.message : "Unable to evaluate SLA";
      toast.error("SLA evaluation failed", message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleUpdatePolicy = async (
    departmentId: number,
    payload: SLAPolicyUpsertRequest,
  ) => {
    try {
      await upsertSlaPolicy(departmentId, payload);
      await loadPage(true);
      toast.success("Policy updated", "The SLA policy was saved successfully.");
    } catch (policyError) {
      const message =
        policyError instanceof Error ? policyError.message : "Unable to update SLA policy";
      toast.error("Policy update failed", message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading operations board...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Routing, SLA, and escalation board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor queue health, manage routing, and keep response targets on track from one
            shared workspace.
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

      <SlaBoard
        queue={queue}
        breaches={breaches}
        departments={departments}
        policies={policies}
        canManagePolicies={isAdmin}
        onRoute={handleRoute}
        onEvaluate={handleEvaluate}
        onUpdatePolicy={handleUpdatePolicy}
        isRefreshing={isRefreshing}
        isEvaluating={isEvaluating}
        lastEvaluation={lastEvaluation}
      />

      <Card className="surface-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Escalation rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {escalationRules.map((rule) => (
              <p key={rule.id} className="rounded-md border border-border bg-card px-3 py-2">
                {rule.breach_type} - {rule.severity} - role {rule.target_role} - threshold{" "}
                {rule.threshold_minutes} minute(s)
                {rule.department ? ` - ${rule.department.name}` : " - global"}
              </p>
            ))}
            {escalationRules.length === 0 ? (
              <p className="text-muted-foreground">No escalation rules configured.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
