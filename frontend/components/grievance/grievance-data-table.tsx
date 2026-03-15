"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  Clock3,
  FolderKanban,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GrievanceListItem, GrievanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type GrievanceDataTableProps = {
  grievances: GrievanceListItem[];
  title: string;
  description: string;
  emptyMessage: string;
  hasOperationalRole: boolean;
};

type SortKey =
  | "title"
  | "status"
  | "category"
  | "student"
  | "department"
  | "updated_at"
  | "created_at";

const STATUS_OPTIONS: Array<{ label: string; value: "all" | GrievanceStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20];

const statusBadgeClass: Record<GrievanceStatus, string> = {
  open: "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950",
  in_progress: "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500",
  resolved: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  closed: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveUserLabel(item: Pick<GrievanceListItem, "student">) {
  const fullName = [item.student.first_name, item.student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || item.student.email;
}

function resolveAssigneeLabel(item: Pick<GrievanceListItem, "assigned_to_user">) {
  if (!item.assigned_to_user) {
    return "Unassigned";
  }

  const fullName = [item.assigned_to_user.first_name, item.assigned_to_user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || item.assigned_to_user.email;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getComparableValue(item: GrievanceListItem, key: SortKey) {
  switch (key) {
    case "title":
      return item.title.toLowerCase();
    case "status":
      return item.status;
    case "category":
      return item.category;
    case "student":
      return resolveUserLabel(item).toLowerCase();
    case "department":
      return item.department?.name.toLowerCase() ?? "";
    case "created_at":
      return item.created_at;
    case "updated_at":
      return item.updated_at;
    default:
      return item.updated_at;
  }
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; direction: "asc" | "desc" };
  onToggle: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground",
        className,
      )}
      onClick={() => onToggle(sortKey)}
    >
      {label}
      <ArrowUpDown
        className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")}
      />
    </button>
  );
}

export function GrievanceDataTable({
  grievances,
  title,
  description,
  emptyMessage,
  hasOperationalRole,
}: GrievanceDataTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GrievanceStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "updated_at", direction: "desc" });

  const categories = useMemo(() => {
    return Array.from(new Set(grievances.map((item) => item.category)))
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({
        value: category,
        label: titleCase(category),
      }));
  }, [grievances]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const matchingRows = grievances.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.title,
        item.category,
        item.status,
        item.student.email,
        item.student.first_name,
        item.student.last_name,
        item.department?.name,
        item.department?.code,
        item.assigned_to_user?.email,
        item.assigned_to_user?.first_name,
        item.assigned_to_user?.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...matchingRows].sort((left, right) => {
      const leftValue = getComparableValue(left, sortState.key);
      const rightValue = getComparableValue(right, sortState.key);
      const directionMultiplier = sortState.direction === "asc" ? 1 : -1;

      if (leftValue < rightValue) {
        return -1 * directionMultiplier;
      }
      if (leftValue > rightValue) {
        return 1 * directionMultiplier;
      }
      return 0;
    });
  }, [categoryFilter, grievances, searchQuery, sortState, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (nextKey: SortKey) => {
    setPage(1);
    setSortState((current) => {
      if (current.key === nextKey) {
        return {
          key: nextKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key: nextKey,
        direction: nextKey === "updated_at" || nextKey === "created_at" ? "desc" : "asc",
      };
    });
  };

  const showingFrom = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, filteredRows.length);

  return (
    <Card className="surface-card rounded-[2rem] border border-border/70 shadow-[0_18px_42px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_48px_rgba(2,6,23,0.5)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-sm font-medium text-muted-foreground">
            {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.6fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder={
                hasOperationalRole
                  ? "Search by case, student, category, department, or assignee"
                  : "Search by case title, category, or status"
              }
              className="pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | GrievanceStatus);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All categories</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} per page
              </option>
            ))}
          </select>
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-border/70 md:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-slate-50/80 dark:bg-slate-950/70">
                  <tr className="border-b border-border/70">
                    <th className={cn("px-5 py-3 text-left", hasOperationalRole ? "w-[28%]" : "w-[34%]")}>
                      <SortHeader
                        label="Case"
                        sortKey="title"
                        currentSort={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    {hasOperationalRole ? (
                      <th className="w-[18%] px-5 py-3 text-left">
                        <SortHeader
                          label="Student"
                          sortKey="student"
                          currentSort={sortState}
                          onToggle={toggleSort}
                        />
                      </th>
                    ) : null}
                    <th className={cn("px-5 py-3 text-left", hasOperationalRole ? "w-[12%]" : "w-[15%]")}>
                      <SortHeader
                        label="Category"
                        sortKey="category"
                        currentSort={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    <th className="w-[12%] px-5 py-3 text-left">
                      <SortHeader
                        label="Status"
                        sortKey="status"
                        currentSort={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    {hasOperationalRole ? (
                      <th className="w-[16%] px-5 py-3 text-left">
                        <SortHeader
                          label="Department"
                          sortKey="department"
                          currentSort={sortState}
                          onToggle={toggleSort}
                        />
                      </th>
                    ) : null}
                    <th className="w-[14%] px-5 py-3 text-left">
                      <SortHeader
                        label="Updated"
                        sortKey="updated_at"
                        currentSort={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    <th className="w-[12%] px-5 py-3 text-left">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Action
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/70 align-top last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3.5 text-primary" />
                              Created {formatTimestamp(item.created_at)}
                            </span>
                            {hasOperationalRole ? (
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="size-3.5 text-primary" />
                                {resolveAssigneeLabel(item)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      {hasOperationalRole ? (
                        <td className="px-5 py-4">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-foreground">{resolveUserLabel(item)}</p>
                            <p className="truncate text-muted-foreground">{item.student.email}</p>
                          </div>
                        </td>
                      ) : null}
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-semibold text-white dark:border-sky-500 dark:bg-sky-500">
                          {titleCase(item.category)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            statusBadgeClass[item.status],
                          )}
                        >
                          {titleCase(item.status)}
                        </span>
                      </td>
                      {hasOperationalRole ? (
                        <td className="px-5 py-4">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-foreground">
                              {item.department?.name ?? "Unrouted"}
                            </p>
                            <p className="text-muted-foreground">
                              {item.department?.code ?? "No department yet"}
                            </p>
                          </div>
                        </td>
                      ) : null}
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {formatTimestamp(item.updated_at)}
                      </td>
                      <td className="px-5 py-4">
                        <Button asChild size="sm" variant="outline" className="w-full justify-center">
                          <Link href={`/app/grievances/${item.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {pagedRows.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-base font-semibold leading-6 text-foreground">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-semibold text-white dark:border-sky-500 dark:bg-sky-500">
                          {titleCase(item.category)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            statusBadgeClass[item.status],
                          )}
                        >
                          {titleCase(item.status)}
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/grievances/${item.id}`}>Open</Link>
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {hasOperationalRole ? (
                      <>
                        <p className="flex items-start gap-2">
                          <UserRound className="mt-0.5 size-4 text-primary" />
                          <span>
                            {resolveUserLabel(item)} - {item.student.email}
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Building2 className="mt-0.5 size-4 text-primary" />
                          <span>
                            {item.department?.name ?? "Unrouted"} - {resolveAssigneeLabel(item)}
                          </span>
                        </p>
                      </>
                    ) : null}
                    <p className="flex items-start gap-2">
                      <FolderKanban className="mt-0.5 size-4 text-primary" />
                      <span>Created {formatTimestamp(item.created_at)}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 size-4 text-primary" />
                      <span>Updated {formatTimestamp(item.updated_at)}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredRows.length} record
                {filteredRows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                >
                  Prev
                </Button>
                <span className="min-w-[6.5rem] text-center font-medium text-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
