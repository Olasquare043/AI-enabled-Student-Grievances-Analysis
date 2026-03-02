"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Route,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DepartmentRead,
  OperationalGrievanceItem,
  SLABreachSummary,
  SLAPolicyRead,
  SLAPolicyUpsertRequest,
} from "@/lib/types";

type SlaBoardProps = {
  queue: OperationalGrievanceItem[];
  breaches: SLABreachSummary[];
  departments: DepartmentRead[];
  policies: SLAPolicyRead[];
  canManagePolicies: boolean;
  onRoute: (grievanceId: string, departmentId: number) => Promise<void>;
  onEvaluate: () => Promise<void>;
  onUpdatePolicy: (
    departmentId: number,
    payload: SLAPolicyUpsertRequest,
  ) => Promise<void>;
  isRefreshing: boolean;
};

function statusBadgeClass(status: string | null | undefined) {
  if (!status) {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "met") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "breached") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function SlaBoard({
  queue,
  breaches,
  departments,
  policies,
  canManagePolicies,
  onRoute,
  onEvaluate,
  onUpdatePolicy,
  isRefreshing,
}: SlaBoardProps) {
  const [routeState, setRouteState] = useState<Record<string, number>>({});
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null);
  const [policyBusyDepartmentId, setPolicyBusyDepartmentId] = useState<number | null>(null);
  const [policyEdits, setPolicyEdits] = useState<
    Record<number, { firstResponseMinutes: number; resolutionMinutes: number; isActive: boolean }>
  >({});

  const activeBreachesCount = breaches.length;
  const escalatedCount = breaches.filter((item) => item.escalation_count > 0).length;
  const routedCount = queue.filter((item) => item.department !== null && item.department !== undefined)
    .length;

  const policyByDepartmentId = useMemo(() => {
    const map = new Map<number, SLAPolicyRead>();
    for (const policy of policies) {
      map.set(policy.department_id, policy);
    }
    return map;
  }, [policies]);

  const resolveDepartmentForRow = (row: OperationalGrievanceItem) => {
    const fromState = routeState[row.id];
    if (fromState) {
      return fromState;
    }
    if (row.department?.id) {
      return row.department.id;
    }
    return departments[0]?.id ?? 0;
  };

  const handleRoute = async (grievanceId: string) => {
    const departmentId = routeState[grievanceId] ?? 0;
    if (!departmentId) {
      return;
    }
    setRouteBusyId(grievanceId);
    try {
      await onRoute(grievanceId, departmentId);
    } finally {
      setRouteBusyId(null);
    }
  };

  const policyFormState = (departmentId: number) => {
    const existingEdit = policyEdits[departmentId];
    if (existingEdit) {
      return existingEdit;
    }

    const existingPolicy = policyByDepartmentId.get(departmentId);
    if (existingPolicy) {
      return {
        firstResponseMinutes: existingPolicy.first_response_minutes,
        resolutionMinutes: existingPolicy.resolution_minutes,
        isActive: existingPolicy.is_active,
      };
    }

    return {
      firstResponseMinutes: 180,
      resolutionMinutes: 4320,
      isActive: true,
    };
  };

  const handlePolicySubmit = async (departmentId: number) => {
    const values = policyFormState(departmentId);
    setPolicyBusyDepartmentId(departmentId);
    try {
      await onUpdatePolicy(departmentId, {
        first_response_minutes: values.firstResponseMinutes,
        resolution_minutes: values.resolutionMinutes,
        is_active: values.isActive,
      });
    } finally {
      setPolicyBusyDepartmentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Routed cases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{routedCount}</p>
            <p className="text-sm text-[var(--muted-foreground)]">Cases with department routing</p>
          </CardContent>
        </Card>
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Active breaches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{activeBreachesCount}</p>
            <p className="text-sm text-[var(--muted-foreground)]">SLA timers currently breached</p>
          </CardContent>
        </Card>
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Escalated cases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{escalatedCount}</p>
            <p className="text-sm text-[var(--muted-foreground)]">Breaches with escalation signals</p>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Operational Queue</CardTitle>
          <Button variant="secondary" onClick={() => void onEvaluate()} disabled={isRefreshing}>
            {isRefreshing ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Clock3 className="size-4" />
                Evaluate SLA
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-tint)]/50 px-3 py-4 text-sm text-[var(--muted-foreground)]">
              No queue items.
            </p>
          ) : (
            queue.map((item) => (
              <article key={item.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full border px-2 py-0.5 ${statusBadgeClass(item.first_response_status)}`}
                    >
                      first response: {item.first_response_status ?? "n/a"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 ${statusBadgeClass(item.resolution_status)}`}
                    >
                      resolution: {item.resolution_status ?? "n/a"}
                    </span>
                    {item.has_active_breach ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                        <AlertTriangle className="size-3" />
                        breach
                      </span>
                    ) : null}
                    {item.escalation_count > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-orange-700">
                        <ShieldAlert className="size-3" />
                        escalations: {item.escalation_count}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="text-xs text-[var(--muted-foreground)]">
                  Student: {item.student.email} · Category: {item.category.toUpperCase()} · Created: {" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                  Department: {item.department?.name ?? "Unrouted"} · Assigned to: {item.assigned_to_user?.email ?? "Unassigned"}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={resolveDepartmentForRow(item)}
                    onChange={(event) =>
                      setRouteState((prev) => ({
                        ...prev,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                    className="h-9 rounded-md border border-[var(--border)] bg-white px-2 text-sm"
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => void handleRoute(item.id)}
                    disabled={routeBusyId === item.id || departments.length === 0}
                  >
                    {routeBusyId === item.id ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Routing...
                      </>
                    ) : (
                      <>
                        <Route className="size-4" />
                        Route case
                      </>
                    )}
                  </Button>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Breach Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {breaches.length === 0 ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="mr-1 inline size-4" />
                No active SLA breaches.
              </p>
            ) : (
              breaches.map((breach) => (
                <div key={breach.event_id} className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm">
                  <p className="font-medium text-[var(--foreground)]">
                    {breach.breach_type.replace("_", " ")} breach · grievance {breach.grievance_id}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Breached by {breach.breach_minutes} minute(s) · escalations {breach.escalation_count}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">SLA Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departments.map((department) => {
              const values = policyFormState(department.id);
              return (
                <div key={department.id} className="rounded-md border border-[var(--border)] bg-white p-3">
                  <p className="mb-2 text-sm font-semibold">{department.name}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`first-response-${department.id}`}>First response (min)</Label>
                      <Input
                        id={`first-response-${department.id}`}
                        type="number"
                        min={1}
                        value={values.firstResponseMinutes}
                        onChange={(event) =>
                          setPolicyEdits((prev) => ({
                            ...prev,
                            [department.id]: {
                              ...values,
                              firstResponseMinutes: Number(event.target.value),
                            },
                          }))
                        }
                        disabled={!canManagePolicies}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`resolution-${department.id}`}>Resolution (min)</Label>
                      <Input
                        id={`resolution-${department.id}`}
                        type="number"
                        min={1}
                        value={values.resolutionMinutes}
                        onChange={(event) =>
                          setPolicyEdits((prev) => ({
                            ...prev,
                            [department.id]: {
                              ...values,
                              resolutionMinutes: Number(event.target.value),
                            },
                          }))
                        }
                        disabled={!canManagePolicies}
                      />
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.isActive}
                      onChange={(event) =>
                        setPolicyEdits((prev) => ({
                          ...prev,
                          [department.id]: {
                            ...values,
                            isActive: event.target.checked,
                          },
                        }))
                      }
                      disabled={!canManagePolicies}
                    />
                    Policy active
                  </label>
                  {canManagePolicies ? (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handlePolicySubmit(department.id)}
                        disabled={policyBusyDepartmentId === department.id}
                      >
                        {policyBusyDepartmentId === department.id ? (
                          <>
                            <LoaderCircle className="size-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save policy"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
