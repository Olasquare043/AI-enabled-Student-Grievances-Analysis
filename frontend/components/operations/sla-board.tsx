"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  LoaderCircle,
  Route,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  DepartmentRead,
  OperationalGrievanceItem,
  SLABreachSummary,
  SLAEvaluationResponse,
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
  isEvaluating: boolean;
  lastEvaluation: SLAEvaluationResponse | null;
};

type QueueSectionKey = "unrouted" | "routed";
type QueueSortKey =
  | "title"
  | "student"
  | "owner"
  | "category"
  | "department"
  | "created_at"
  | "breach";
type SortState = { key: QueueSortKey; direction: "asc" | "desc" };
type TableState = {
  search: string;
  sort: SortState;
  page: number;
  pageSize: number;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function compareValues(left: string, right: string, direction: "asc" | "desc") {
  const result = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? result : -result;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeMinutes(totalMinutes: number) {
  if (totalMinutes >= 1440) {
    return `${Math.round(totalMinutes / 1440)}d`;
  }
  if (totalMinutes >= 60) {
    return `${Math.round(totalMinutes / 60)}h`;
  }
  return `${Math.max(1, totalMinutes)}m`;
}

function formatDueContext(dueAt: string | null | undefined, status: string | null | undefined) {
  if (!dueAt) {
    return "Starts once the case is routed.";
  }

  const diffMinutes = Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);

  if (status === "breached") {
    return `${formatRelativeMinutes(Math.abs(diffMinutes))} overdue`;
  }
  if (status === "met") {
    return "Completed";
  }
  if (diffMinutes <= 0) {
    return "Due now";
  }
  return `Due in ${formatRelativeMinutes(diffMinutes)}`;
}

function resolveUserLabel(
  user: { first_name?: string | null; last_name?: string | null; email: string } | null | undefined,
) {
  if (!user) {
    return "Unassigned";
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.email;
}

function statusBadgeTone(status: string | null | undefined) {
  if (!status) {
    return "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950";
  }
  if (status === "pending") {
    return "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950";
  }
  if (status === "met") {
    return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
  }
  if (status === "breached") {
    return "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500";
  }
  return "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950";
}

function grievanceStatusTone(status: string) {
  if (status === "in_progress") {
    return "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500";
  }
  if (status === "resolved" || status === "closed") {
    return "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
  }
  return "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950";
}

function categoryTone(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("ict") || normalized.includes("network")) {
    return "border-cyan-600 bg-cyan-600 text-white dark:border-cyan-500 dark:bg-cyan-500";
  }
  if (normalized.includes("hostel")) {
    return "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500";
  }
  if (normalized.includes("bursary") || normalized.includes("fee")) {
    return "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950";
  }
  return "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500";
}

function buildQueueSearchBlob(item: OperationalGrievanceItem) {
  return [
    item.title,
    item.category,
    item.status,
    item.student.email,
    item.student.first_name,
    item.student.last_name,
    item.department?.name,
    item.assigned_to_user?.email,
    item.assigned_to_user?.first_name,
    item.assigned_to_user?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function routeRiskScore(item: OperationalGrievanceItem) {
  let score = item.escalation_count * 10;
  if (item.has_active_breach) score += 50;
  if (item.first_response_status === "breached") score += 25;
  if (item.resolution_status === "breached") score += 15;
  return score;
}

function sortQueueItems(items: OperationalGrievanceItem[], sortState: SortState) {
  return [...items].sort((left, right) => {
    if (sortState.key === "created_at") {
      return sortState.direction === "asc"
        ? new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        : new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }
    if (sortState.key === "breach") {
      const result = routeRiskScore(left) - routeRiskScore(right);
      return sortState.direction === "asc" ? result : -result;
    }

    const leftValue =
      sortState.key === "title"
        ? left.title
        : sortState.key === "student"
          ? resolveUserLabel(left.student)
          : sortState.key === "owner"
            ? resolveUserLabel(left.assigned_to_user)
          : sortState.key === "category"
            ? left.category
            : left.department?.name ?? "";
    const rightValue =
      sortState.key === "title"
        ? right.title
        : sortState.key === "student"
          ? resolveUserLabel(right.student)
          : sortState.key === "owner"
            ? resolveUserLabel(right.assigned_to_user)
          : sortState.key === "category"
            ? right.category
            : right.department?.name ?? "";
    return compareValues(leftValue, rightValue, sortState.direction);
  });
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  iconTone,
  accentTone,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconTone: string;
  accentTone: string;
}) {
  return (
    <Card className="surface-card overflow-hidden rounded-[1.45rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.5)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-2xl ring-1 ring-black/5 dark:ring-white/10",
              iconTone,
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className={cn("mt-4 h-1.5 rounded-full", accentTone)} />
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortState,
  onSort,
  className,
}: {
  label: string;
  sortKey: QueueSortKey;
  sortState: SortState;
  onSort: (key: QueueSortKey) => void;
  className?: string;
}) {
  const isActive = sortState.key === sortKey;

  return (
    <th className={cn("px-3 py-3 text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
      >
        <span>{label}</span>
        {isActive ? (
          sortState.direction === "asc" ? (
            <ArrowUpAZ className="size-3.5" />
          ) : (
            <ArrowDownAZ className="size-3.5" />
          )
        ) : (
          <ChevronDown className="size-3.5 opacity-60" />
        )}
      </button>
    </th>
  );
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
  isEvaluating,
  lastEvaluation,
}: SlaBoardProps) {
  const [routeState, setRouteState] = useState<Record<string, number>>({});
  const [routeBusyId, setRouteBusyId] = useState<string | null>(null);
  const [policyBusyDepartmentId, setPolicyBusyDepartmentId] = useState<number | null>(null);
  const [policyEdits, setPolicyEdits] = useState<
    Record<number, { firstResponseMinutes: number; resolutionMinutes: number; isActive: boolean }>
  >({});
  const [tableState, setTableState] = useState<Record<QueueSectionKey, TableState>>({
    unrouted: { search: "", sort: { key: "created_at", direction: "asc" }, page: 1, pageSize: 5 },
    routed: { search: "", sort: { key: "breach", direction: "desc" }, page: 1, pageSize: 10 },
  });

  const deferredUnroutedSearch = useDeferredValue(tableState.unrouted.search);
  const deferredRoutedSearch = useDeferredValue(tableState.routed.search);

  const policyByDepartmentId = useMemo(() => {
    const map = new Map<number, SLAPolicyRead>();
    for (const policy of policies) {
      map.set(policy.department_id, policy);
    }
    return map;
  }, [policies]);

  const unroutedQueue = useMemo(() => queue.filter((item) => item.department == null), [queue]);
  const routedQueue = useMemo(() => queue.filter((item) => item.department != null), [queue]);

  const filteredUnroutedRows = useMemo(() => {
    const normalizedSearch = deferredUnroutedSearch.trim().toLowerCase();
    const filtered = normalizedSearch
      ? unroutedQueue.filter((item) => buildQueueSearchBlob(item).includes(normalizedSearch))
      : unroutedQueue;
    return sortQueueItems(filtered, tableState.unrouted.sort);
  }, [deferredUnroutedSearch, tableState.unrouted.sort, unroutedQueue]);

  const filteredRoutedRows = useMemo(() => {
    const normalizedSearch = deferredRoutedSearch.trim().toLowerCase();
    const filtered = normalizedSearch
      ? routedQueue.filter((item) => buildQueueSearchBlob(item).includes(normalizedSearch))
      : routedQueue;
    return sortQueueItems(filtered, tableState.routed.sort);
  }, [deferredRoutedSearch, routedQueue, tableState.routed.sort]);

  const unroutedTotalPages = Math.max(1, Math.ceil(filteredUnroutedRows.length / tableState.unrouted.pageSize));
  const routedTotalPages = Math.max(1, Math.ceil(filteredRoutedRows.length / tableState.routed.pageSize));
  const safeUnroutedPage = Math.min(tableState.unrouted.page, unroutedTotalPages);
  const safeRoutedPage = Math.min(tableState.routed.page, routedTotalPages);
  const paginatedUnroutedRows = filteredUnroutedRows.slice(
    (safeUnroutedPage - 1) * tableState.unrouted.pageSize,
    safeUnroutedPage * tableState.unrouted.pageSize,
  );
  const paginatedRoutedRows = filteredRoutedRows.slice(
    (safeRoutedPage - 1) * tableState.routed.pageSize,
    safeRoutedPage * tableState.routed.pageSize,
  );

  const escalatedCount = breaches.filter((item) => item.escalation_count > 0).length;

  const resolveDepartmentForRow = (row: OperationalGrievanceItem) => {
    const fromState = routeState[row.id];
    if (fromState) return fromState;
    if (row.department?.id) return row.department.id;
    return departments[0]?.id ?? 0;
  };

  const handleRoute = async (grievanceId: string) => {
    const departmentId = routeState[grievanceId] ?? 0;
    if (!departmentId) return;
    setRouteBusyId(grievanceId);
    try {
      await onRoute(grievanceId, departmentId);
    } finally {
      setRouteBusyId(null);
    }
  };

  const policyFormState = (departmentId: number) => {
    const existingEdit = policyEdits[departmentId];
    if (existingEdit) return existingEdit;
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

  const updateTableState = (section: QueueSectionKey, next: Partial<TableState>) => {
    setTableState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...next,
      },
    }));
  };

  const handleSort = (section: QueueSectionKey, key: QueueSortKey) => {
    setTableState((current) => {
      const currentSort = current[section].sort;
      const nextDirection =
        currentSort.key === key && currentSort.direction === "asc" ? "desc" : "asc";

      return {
        ...current,
        [section]: {
          ...current[section],
          page: 1,
          sort: { key, direction: nextDirection },
        },
      };
    });
  };

  const renderQueueTable = ({
    section,
    title,
    description,
    rows,
    totalRows,
    page,
    totalPages,
    pageSize,
    sortState,
    searchValue,
    routeLabel,
    emptyState,
  }: {
    section: QueueSectionKey;
    title: string;
    description: string;
    rows: OperationalGrievanceItem[];
    totalRows: number;
    page: number;
    totalPages: number;
    pageSize: number;
    sortState: SortState;
    searchValue: string;
    routeLabel: string;
    emptyState: string;
  }) => (
    <Card className="surface-card overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.4)]">
      <CardHeader className="space-y-4 border-b border-border/70 pb-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {totalRows} case{totalRows === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) =>
                updateTableState(section, { page: 1, search: event.target.value })
              }
              placeholder="Search by case, student, category, or department"
              className="h-11 rounded-2xl border-border/80 bg-background/90 pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Page size
            </span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(event) =>
                  updateTableState(section, { page: 1, pageSize: Number(event.target.value) })
                }
                className="h-10 appearance-none rounded-xl border border-border/80 bg-background/90 px-3 pr-8 text-sm font-medium text-foreground shadow-sm"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="hidden md:block">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-background/45">
                <SortableHeader
                  label="Case"
                  sortKey="title"
                  sortState={sortState}
                  onSort={(key) => handleSort(section, key)}
                  className={section === "unrouted" ? "w-[34%]" : "w-[28%]"}
                />
                <SortableHeader
                  label={section === "unrouted" ? "Intake" : "Department"}
                  sortKey={section === "unrouted" ? "category" : "department"}
                  sortState={sortState}
                  onSort={(key) => handleSort(section, key)}
                  className={section === "unrouted" ? "w-[18%]" : "w-[16%]"}
                />
                <SortableHeader
                  label={section === "unrouted" ? "SLA Start" : "SLA Health"}
                  sortKey={section === "unrouted" ? "created_at" : "breach"}
                  sortState={sortState}
                  onSort={(key) => handleSort(section, key)}
                  className={section === "unrouted" ? "w-[20%]" : "w-[24%]"}
                />
                {section === "routed" ? (
                  <SortableHeader
                    label="Owner"
                    sortKey="owner"
                    sortState={sortState}
                    onSort={(key) => handleSort(section, key)}
                    className="w-[14%]"
                  />
                ) : null}
                <th
                  className={cn(
                    "px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground",
                    section === "unrouted" ? "w-[28%]" : "w-[18%]",
                  )}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((item) => {
                  const departmentValue = resolveDepartmentForRow(item);
                  const isBusy = routeBusyId === item.id || isRefreshing || isEvaluating;
                  const ownerLabel = resolveUserLabel(item.assigned_to_user);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border/60 bg-background/45 align-top last:border-b-0"
                    >
                      <td className="px-3 py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/app/grievances/${item.id}`}
                              className="text-sm font-semibold leading-5 text-foreground transition hover:text-primary"
                            >
                              {item.title}
                            </Link>
                            <Link
                              href={`/app/grievances/${item.id}`}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition hover:text-primary/80"
                            >
                              View
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <UserRound className="size-3.5 shrink-0 text-primary" />
                            <span className="truncate">{item.student.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <CalendarDays className="size-3.5 shrink-0 text-primary" />
                            <span>{formatDateTime(item.created_at)}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="space-y-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                              categoryTone(item.category),
                            )}
                          >
                            {item.category}
                          </span>
                          <div>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                grievanceStatusTone(item.status),
                              )}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </div>
                          {section === "routed" ? (
                            <p className="text-xs leading-5 text-muted-foreground">
                              {item.department?.name ?? "Unrouted"}
                            </p>
                          ) : (
                            <p className="text-xs leading-5 text-muted-foreground">
                              Awaiting departmental routing.
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        {section === "unrouted" ? (
                          <div className="rounded-2xl border border-amber-500 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-slate-900 shadow-[0_10px_24px_rgba(245,158,11,0.08)] dark:bg-slate-950 dark:text-amber-100">
                            <p className="font-semibold text-amber-800 dark:text-amber-200">SLA starts after routing</p>
                            <p className="mt-1">
                              Move this grievance into a department to start first-response and
                              resolution timers.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                  statusBadgeTone(item.first_response_status),
                                )}
                              >
                                First response
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                  statusBadgeTone(item.resolution_status),
                                )}
                              >
                                Resolution
                              </span>
                            </div>
                            <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                              <p>
                                First response:{" "}
                                {formatDueContext(item.first_response_due_at, item.first_response_status)}
                              </p>
                              <p>
                                Resolution:{" "}
                                {formatDueContext(item.resolution_due_at, item.resolution_status)}
                              </p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {item.has_active_breach ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-600 bg-rose-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white dark:border-rose-500 dark:bg-rose-500">
                                    <AlertTriangle className="size-3.5" />
                                    Breach active
                                  </span>
                                ) : null}
                                {item.escalation_count > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-orange-500 bg-orange-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-950 dark:border-orange-400 dark:bg-orange-400">
                                    <ShieldAlert className="size-3.5" />
                                    {item.escalation_count} escalation
                                    {item.escalation_count === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {section === "routed" ? (
                        <td className="px-3 py-3.5">
                          <div className="space-y-1.5 text-xs">
                            <p className="font-medium text-foreground">{ownerLabel}</p>
                            <p className="leading-5 text-muted-foreground">
                              {item.assigned_to_user?.email ?? "No specific assignee"}
                            </p>
                          </div>
                        </td>
                      ) : null}

                      <td className="px-3 py-3.5">
                        <div className="space-y-2.5">
                          <div className="relative">
                            <select
                              value={departmentValue}
                              onChange={(event) =>
                                setRouteState((current) => ({
                                  ...current,
                                  [item.id]: Number(event.target.value),
                                }))
                              }
                              className="h-10 w-full appearance-none rounded-xl border border-border/80 bg-background/90 px-3 pr-8 text-xs font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm"
                            >
                              {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
                          <Button
                            size="sm"
                            className="w-full rounded-xl bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(14,165,233,0.22)] hover:bg-primary/92"
                            onClick={() => void handleRoute(item.id)}
                            disabled={isBusy || departments.length === 0}
                          >
                            {routeBusyId === item.id ? (
                              <>
                                <LoaderCircle className="size-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Route className="size-4" />
                                {routeLabel}
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={section === "unrouted" ? 4 : 5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {emptyState}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {rows.length > 0 ? (
            rows.map((item) => {
              const departmentValue = resolveDepartmentForRow(item);
              const isBusy = routeBusyId === item.id || isRefreshing || isEvaluating;
              return (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
                >
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Link
                        href={`/app/grievances/${item.id}`}
                        className="text-base font-semibold tracking-tight text-foreground transition hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">{item.student.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                          categoryTone(item.category),
                        )}
                      >
                        {item.category}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                          grievanceStatusTone(item.status),
                        )}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Created: {formatDateTime(item.created_at)}</p>
                      <p>Department: {item.department?.name ?? "Unrouted"}</p>
                      <p>Owner: {resolveUserLabel(item.assigned_to_user)}</p>
                      {section === "routed" ? (
                        <>
                          <p>
                            First response:{" "}
                            {formatDueContext(item.first_response_due_at, item.first_response_status)}
                          </p>
                          <p>
                            Resolution:{" "}
                            {formatDueContext(item.resolution_due_at, item.resolution_status)}
                          </p>
                        </>
                      ) : (
                        <p>SLA timers begin when the case is routed.</p>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={departmentValue}
                        onChange={(event) =>
                          setRouteState((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value),
                          }))
                        }
                        className="h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-8 text-sm text-foreground"
                      >
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="bg-primary text-primary-foreground shadow-[0_16px_40px_rgba(14,165,233,0.2)] hover:bg-primary/92"
                        onClick={() => void handleRoute(item.id)}
                        disabled={isBusy || departments.length === 0}
                      >
                        {routeBusyId === item.id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Route className="size-4" />
                        )}
                        {section === "unrouted" ? "Route case" : "Re-route case"}
                      </Button>
                      <Button asChild variant="outline" className="border-border/80 bg-background/80">
                        <Link href={`/app/grievances/${item.id}`}>
                          <ExternalLink className="size-4" />
                          View case
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              {emptyState}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {totalRows === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalRows)} of{" "}
            {totalRows} filtered case{totalRows === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateTableState(section, { page: Math.max(1, page - 1) })}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateTableState(section, { page: Math.min(totalPages, page + 1) })
              }
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Active Cases"
          value={queue.length}
          description="Open plus in-progress grievances still being worked through operations."
          icon={Inbox}
          iconTone="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
          accentTone="bg-slate-900 dark:bg-slate-100"
        />
        <MetricCard
          label="Unrouted Intake"
          value={unroutedQueue.length}
          description="Cases waiting for a department before SLA timers can start."
          icon={Clock3}
          iconTone="bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950"
          accentTone="bg-amber-500 dark:bg-amber-400"
        />
        <MetricCard
          label="Routed Ops"
          value={routedQueue.length}
          description="Cases already in a department and actively tracked for response and resolution."
          icon={Route}
          iconTone="bg-sky-600 text-white dark:bg-sky-500 dark:text-white"
          accentTone="bg-sky-600 dark:bg-sky-500"
        />
        <MetricCard
          label="Active Breaches"
          value={breaches.length}
          description="Current SLA misses across routed cases after applying the latest deadline state."
          icon={ShieldAlert}
          iconTone="bg-rose-600 text-white dark:bg-rose-500 dark:text-white"
          accentTone="bg-rose-600 dark:bg-rose-500"
        />
      </div>

      <Card className="surface-card rounded-[1.75rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.4)]">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(2,132,199,0.16)] dark:border-sky-500 dark:bg-sky-500">
                SLA breach scan
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Run a live deadline sweep</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  This checks all routed active cases whose first-response or resolution timers are
                  due right now. New breaches are created immediately and escalation rules are
                  applied in the same run.
                </p>
              </div>
            </div>
            <Button
              className="rounded-2xl bg-amber-500 text-slate-950 shadow-[0_16px_40px_rgba(245,158,11,0.22)] hover:bg-amber-400"
              onClick={() => void onEvaluate()}
              disabled={isEvaluating || isRefreshing}
            >
              {isEvaluating ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Running scan...
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4" />
                  Run breach scan
                </>
              )}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Last run
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {lastEvaluation ? formatDateTime(lastEvaluation.evaluated_at) : "No manual scan yet"}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-600 bg-rose-600 px-4 py-3 shadow-[0_10px_24px_rgba(225,29,72,0.16)] dark:border-rose-500 dark:bg-rose-500">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100">
                New breaches
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {lastEvaluation?.new_breaches ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-orange-500 bg-orange-500 px-4 py-3 shadow-[0_10px_24px_rgba(249,115,22,0.16)] dark:border-orange-400 dark:bg-orange-400">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100 dark:text-slate-950">
                New escalations
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white dark:text-slate-950">
                {lastEvaluation?.new_escalations ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {renderQueueTable({
        section: "unrouted",
        title: "Unrouted intake",
        description:
          "This is the intake queue. Only cases without a department stay here. Route them once so SLA tracking can begin.",
        rows: paginatedUnroutedRows,
        totalRows: filteredUnroutedRows.length,
        page: safeUnroutedPage,
        totalPages: unroutedTotalPages,
        pageSize: tableState.unrouted.pageSize,
        sortState: tableState.unrouted.sort,
        searchValue: tableState.unrouted.search,
        routeLabel: "Route case",
        emptyState:
          "No unrouted intake cases match the current search. Newly submitted cases appear here until they are routed.",
      })}

      {renderQueueTable({
        section: "routed",
        title: "Routed operations",
        description:
          "These cases already belong to a department. Use this table to monitor deadlines, see active risk, and re-route when a case lands with the wrong team.",
        rows: paginatedRoutedRows,
        totalRows: filteredRoutedRows.length,
        page: safeRoutedPage,
        totalPages: routedTotalPages,
        pageSize: tableState.routed.pageSize,
        sortState: tableState.routed.sort,
        searchValue: tableState.routed.search,
        routeLabel: "Re-route case",
        emptyState:
          "No routed cases match the current search. Once a case is routed, it will move out of intake and appear here.",
      })}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-card rounded-[1.75rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.4)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-4">
            <div>
              <CardTitle className="text-lg">Breach Signals</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Current SLA misses only. Historical breach events no longer stay here once the case
                leaves the active state.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="inline-flex items-center rounded-full border border-rose-600 bg-rose-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white dark:border-rose-500 dark:bg-rose-500">
                {breaches.length} active
              </span>
              <span className="inline-flex items-center rounded-full border border-orange-500 bg-orange-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-950 dark:border-orange-400 dark:bg-orange-400">
                {escalatedCount} escalated
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {breaches.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500 bg-emerald-50 px-4 py-4 text-sm text-slate-900 dark:bg-slate-950 dark:text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  No active SLA breaches.
                </div>
                <p className="mt-2 leading-6">
                  Routed cases are currently within their active SLA windows.
                </p>
              </div>
            ) : (
              <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                {breaches.map((breach) => (
                  <div
                    key={breach.event_id}
                    className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_36px_rgba(2,6,23,0.3)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Link
                          href={`/app/grievances/${breach.grievance_id}`}
                          className="text-sm font-semibold leading-6 text-foreground transition hover:text-primary"
                        >
                          {breach.grievance_title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {breach.student.email} - {breach.department?.name ?? "Department pending"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                          breach.breach_type === "resolution"
                            ? "border-orange-500 bg-orange-500 text-slate-950 dark:border-orange-400 dark:bg-orange-400 dark:text-slate-950"
                            : "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500",
                        )}
                      >
                        {breach.breach_type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                      <p>Owner: {resolveUserLabel(breach.assigned_to_user)}</p>
                      <p>Status: {breach.grievance_status.replace("_", " ")}</p>
                      <p>Due: {formatDateTime(breach.due_at)}</p>
                      <p>Overdue: {formatRelativeMinutes(breach.breach_minutes)}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-600 bg-rose-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white dark:border-rose-500 dark:bg-rose-500">
                        <AlertTriangle className="size-3.5" />
                        Active breach
                      </span>
                      {breach.escalation_count > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-500 bg-orange-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-950 dark:border-orange-400 dark:bg-orange-400 dark:text-slate-950">
                          <ShieldAlert className="size-3.5" />
                          {breach.escalation_count} escalation
                          {breach.escalation_count === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-[1.75rem] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.4)]">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-lg">SLA Policies</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Department defaults for first response and final resolution windows.
            </p>
          </CardHeader>
          <CardContent className="max-h-[30rem] space-y-4 overflow-y-auto p-4 pr-3">
            {departments.map((department) => {
              const values = policyFormState(department.id);
              return (
                <div
                  key={department.id}
                  className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] dark:shadow-[0_16px_36px_rgba(2,6,23,0.28)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{department.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {department.code}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        values.isActive
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-slate-700 bg-slate-700 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
                      )}
                    >
                      {values.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`first-response-${department.id}`}>First response (min)</Label>
                      <Input
                        id={`first-response-${department.id}`}
                        type="number"
                        min={1}
                        value={values.firstResponseMinutes}
                        onChange={(event) =>
                          setPolicyEdits((current) => ({
                            ...current,
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
                          setPolicyEdits((current) => ({
                            ...current,
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

                  <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={values.isActive}
                      onChange={(event) =>
                        setPolicyEdits((current) => ({
                          ...current,
                          [department.id]: {
                            ...values,
                            isActive: event.target.checked,
                          },
                        }))
                      }
                      disabled={!canManagePolicies}
                      className="size-4 rounded border-border bg-background text-primary"
                    />
                    Policy active
                  </label>

                  {canManagePolicies ? (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="rounded-xl bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(14,165,233,0.22)] hover:bg-primary/92"
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
