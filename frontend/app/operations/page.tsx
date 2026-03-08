"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, House, LoaderCircle, RefreshCw } from "lucide-react";

import { SlaBoard } from "@/components/operations/sla-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/api";
import {
  listDepartments,
  listEscalationRules,
  listOperationsQueue,
  listSlaBreaches,
  listSlaPolicies,
  routeGrievance,
  upsertSlaPolicy,
  evaluateSla,
} from "@/lib/operations-api";
import type {
  DepartmentRead,
  EscalationRuleRead,
  OperationalGrievanceItem,
  SLABreachSummary,
  SLAPolicyRead,
  SLAPolicyUpsertRequest,
  UserRead,
} from "@/lib/types";

function hasOperationalRole(user: UserRead | null) {
  if (!user) {
    return false;
  }
  const roles = new Set(user.roles.map((role) => role.name));
  return roles.has("staff") || roles.has("admin");
}

function isAdmin(user: UserRead | null) {
  if (!user) {
    return false;
  }
  const roles = new Set(user.roles.map((role) => role.name));
  return roles.has("admin");
}

export default function OperationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [departments, setDepartments] = useState<DepartmentRead[]>([]);
  const [queue, setQueue] = useState<OperationalGrievanceItem[]>([]);
  const [breaches, setBreaches] = useState<SLABreachSummary[]>([]);
  const [policies, setPolicies] = useState<SLAPolicyRead[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManagePolicies = useMemo(() => isAdmin(currentUser), [currentUser]);

  const loadPage = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    setSuccess(null);

    try {
      const me = await getCurrentUser();
      if (!hasOperationalRole(me)) {
        router.replace("/app");
        return;
      }

      const [departmentList, queueItems, policyList, breachList, ruleList] = await Promise.all([
        listDepartments(true),
        listOperationsQueue(),
        listSlaPolicies(),
        listSlaBreaches(),
        listEscalationRules(),
      ]);

      setCurrentUser(me);
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
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleRoute = async (grievanceId: string, departmentId: number) => {
    await routeGrievance(grievanceId, { department_id: departmentId });
    await loadPage(true);
    setSuccess("Grievance routed successfully.");
  };

  const handleEvaluate = async () => {
    const result = await evaluateSla();
    await loadPage(true);
    setSuccess(
      `SLA evaluated: ${result.new_breaches} new breach(es), ${result.new_escalations} new escalation(s).`,
    );
  };

  const handleUpdatePolicy = async (
    departmentId: number,
    payload: SLAPolicyUpsertRequest,
  ) => {
    await upsertSlaPolicy(departmentId, payload);
    await loadPage(true);
    setSuccess("SLA policy updated.");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading operations board...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Routing, SLA and Escalation Board</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Monitor operational queue health and keep grievance response targets on track.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/">
              <House className="size-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Back to dashboard
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

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <SlaBoard
        queue={queue}
        breaches={breaches}
        departments={departments}
        policies={policies}
        canManagePolicies={canManagePolicies}
        onRoute={handleRoute}
        onEvaluate={handleEvaluate}
        onUpdatePolicy={handleUpdatePolicy}
        isRefreshing={isRefreshing}
      />

      <Card className="surface-card mt-6 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Escalation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {escalationRules.map((rule) => (
              <p key={rule.id} className="rounded-md border border-[var(--border)] bg-white px-3 py-2">
                {rule.breach_type} · {rule.severity} · role {rule.target_role} · threshold {" "}
                {rule.threshold_minutes} minute(s)
                {rule.department ? ` · ${rule.department.name}` : " · global"}
              </p>
            ))}
            {escalationRules.length === 0 ? (
              <p className="text-[var(--muted-foreground)]">No escalation rules configured.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
