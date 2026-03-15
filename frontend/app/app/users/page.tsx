"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  LoaderCircle,
  Mail,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldUser,
  Trash2,
  UserCog,
  UserRoundCog,
  Users,
} from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import {
  UserCreateModal,
  UserDeleteModal,
  UserEditModal,
} from "@/components/dashboard/user-create-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { listDepartments } from "@/lib/operations-api";
import { getPrimaryRole } from "@/lib/roles";
import { assignUserRole, createUser, deleteUser, listUsers, updateUser } from "@/lib/user-api";
import { cn } from "@/lib/utils";
import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
  DepartmentRead,
  RoleName,
  UserRead,
} from "@/lib/types";

const ROLE_OPTIONS: RoleName[] = ["student", "staff", "admin"];
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

type SortKey = "name" | "email" | "role" | "matric" | "faculty" | "department" | "created_at";
type SortState = { key: SortKey; direction: "asc" | "desc" };

function resolvePrimaryRole(user: UserRead): RoleName {
  return getPrimaryRole(user.roles)?.name ?? "student";
}

function resolveUserName(user: UserRead) {
  const combined = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return combined || "Unnamed user";
}

function resolveUserSearchBlob(user: UserRead, roleName: RoleName) {
  return [
    resolveUserName(user),
    user.email,
    user.matric_number,
    user.faculty,
    user.department,
    roleName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function compareValues(left: string, right: string, direction: "asc" | "desc") {
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeCsvCell(value: string | null | undefined) {
  const normalized = value ?? "";
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function buildUserExport(users: UserRead[]) {
  const headers = ["Name", "Email", "Role", "Matric", "Faculty", "Department", "Created"];
  const rows = users.map((user) =>
    [
      resolveUserName(user),
      user.email,
      resolvePrimaryRole(user),
      user.matric_number,
      user.faculty,
      user.department,
      formatDate(user.created_at),
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function roleBadgeTone(roleName: RoleName) {
  if (roleName === "admin") return "border-amber-500 bg-amber-500 text-white";
  if (roleName === "staff") return "border-cyan-500 bg-cyan-500 text-white";
  return "border-blue-600 bg-blue-600 text-white";
}

function RoleBadge({ roleName }: { roleName: RoleName }) {
  const Icon = roleName === "admin" ? ShieldCheck : roleName === "staff" ? UserRoundCog : ShieldUser;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
        roleBadgeTone(roleName),
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {roleName}
    </span>
  );
}

function StatCard({
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
  sortKey: SortKey;
  sortState: SortState;
  onSort: (key: SortKey) => void;
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

export default function WorkspaceUsersPage() {
  const { currentUser, isAdmin } = useAppShellContext();
  const toast = useToast();
  const [users, setUsers] = useState<UserRead[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, RoleName>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<RoleName>("staff");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [roleFilter, setRoleFilter] = useState<RoleName | "all">("all");
  const [sortState, setSortState] = useState<SortState>({ key: "created_at", direction: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRead[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRead | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRead | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const selectedUserSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const counts = useMemo(
    () =>
      users.reduce(
        (acc, user) => {
          const role = resolvePrimaryRole(user);
          if (role === "admin") acc.admin += 1;
          else if (role === "staff") acc.staff += 1;
          else acc.student += 1;
          return acc;
        },
        { admin: 0, staff: 0, student: 0 },
      ),
    [users],
  );

  const loadUsers = async (refresh = false) => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const [records, activeDepartments] = await Promise.all([
        listUsers(),
        listDepartments(true),
      ]);
      setUsers(records);
      setDepartments(activeDepartments);
      setDraftRoles(Object.fromEntries(records.map((user) => [user.id, resolvePrimaryRole(user)])));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load users";
      toast.error("User access unavailable", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadUsers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => setPage(1), [deferredSearchQuery, roleFilter, pageSize]);

  useEffect(() => {
    setSelectedUserIds((current) =>
      current.filter((userId) => users.some((user) => user.id === userId)),
    );
  }, [users]);

  const rows = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const role = resolvePrimaryRole(user);
      if (roleFilter !== "all" && role !== roleFilter) return false;
      return !query || resolveUserSearchBlob(user, role).includes(query);
    });

    return [...filtered].sort((left, right) => {
      const leftRole = resolvePrimaryRole(left);
      const rightRole = resolvePrimaryRole(right);
      if (sortState.key === "name") return compareValues(resolveUserName(left), resolveUserName(right), sortState.direction);
      if (sortState.key === "email") return compareValues(left.email, right.email, sortState.direction);
      if (sortState.key === "role") return compareValues(leftRole, rightRole, sortState.direction);
      if (sortState.key === "matric") return compareValues(left.matric_number ?? "", right.matric_number ?? "", sortState.direction);
      if (sortState.key === "faculty") return compareValues(left.faculty ?? "", right.faculty ?? "", sortState.direction);
      if (sortState.key === "department") return compareValues(left.department ?? "", right.department ?? "", sortState.direction);
      return compareValues(left.created_at, right.created_at, sortState.direction);
    });
  }, [deferredSearchQuery, roleFilter, sortState, users]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedUsers = users.filter((user) => selectedUserSet.has(user.id));
  const selectablePageUserIds = paginatedRows
    .filter((user) => user.id !== currentUser.id)
    .map((user) => user.id);
  const allPageSelected =
    selectablePageUserIds.length > 0 &&
    selectablePageUserIds.every((userId) => selectedUserSet.has(userId));
  const somePageSelected = selectablePageUserIds.some((userId) => selectedUserSet.has(userId));
  const bulkEligibleUsers = selectedUsers.filter(
    (user) => user.id !== currentUser.id && resolvePrimaryRole(user) !== bulkRole,
  );

  const handleSort = (key: SortKey) => {
    setSortState((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "created_at" ? "desc" : "asc" },
    );
  };

  const handleCreateUser = async (payload: AdminUserCreateRequest) => {
    setIsCreatingUser(true);
    try {
      const created = await createUser(payload);
      setUsers((current) => [created, ...current]);
      setDraftRoles((current) => ({ ...current, [created.id]: resolvePrimaryRole(created) }));
      setPage(1);
      toast.success("User created", `${created.email} is ready in the workspace.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create user";
      toast.error("User creation failed", message);
      throw error;
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUser = async (payload: AdminUserUpdateRequest) => {
    if (!editingUser) return;
    setIsUpdatingUser(true);
    try {
      const updated = await updateUser(editingUser.id, payload);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setDraftRoles((current) => ({ ...current, [updated.id]: resolvePrimaryRole(updated) }));
      toast.success("User updated", `${updated.email} has been refreshed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update user";
      toast.error("User update failed", message);
      throw error;
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      await deleteUser(deletingUser.id);
      setUsers((current) => current.filter((user) => user.id !== deletingUser.id));
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[deletingUser.id];
        return next;
      });
      setSelectedUserIds((current) => current.filter((userId) => userId !== deletingUser.id));
      setDeletingUser(null);
      toast.success("User deleted", `${deletingUser.email} has been removed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete user";
      toast.error("Delete failed", message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleRoleSave = async (user: UserRead) => {
    const nextRole = draftRoles[user.id];
    if (!nextRole || nextRole === resolvePrimaryRole(user)) return;
    setBusyUserId(user.id);
    try {
      const updated = await assignUserRole(user.id, { role_name: nextRole });
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDraftRoles((current) => ({ ...current, [user.id]: resolvePrimaryRole(updated) }));
      toast.success("Role updated", `${updated.email} is now assigned as ${nextRole}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update role";
      toast.error("Role update failed", message);
    } finally {
      setBusyUserId(null);
    }
  };

  const togglePageSelection = () => {
    const next = new Set(selectedUserIds);
    if (allPageSelected) selectablePageUserIds.forEach((id) => next.delete(id));
    else selectablePageUserIds.forEach((id) => next.add(id));
    setSelectedUserIds(Array.from(next));
  };

  const handleBulkRoleSave = async () => {
    if (selectedUserIds.length === 0) {
      toast.info("No users selected", "Choose one or more users before applying a bulk role.");
      return;
    }
    if (bulkEligibleUsers.length === 0) {
      toast.info("Nothing to update", `Selected users already have the ${bulkRole} role.`);
      return;
    }
    setIsBulkSaving(true);
    try {
      const results = await Promise.allSettled(
        bulkEligibleUsers.map((user) => assignUserRole(user.id, { role_name: bulkRole })),
      );
      const updatedUsers = new Map<string, UserRead>();
      let failedCount = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") updatedUsers.set(result.value.id, result.value);
        else failedCount += 1;
      });
      if (updatedUsers.size > 0) {
        setUsers((current) => current.map((user) => updatedUsers.get(user.id) ?? user));
        setDraftRoles((current) => {
          const next = { ...current };
          for (const userId of updatedUsers.keys()) next[userId] = bulkRole;
          return next;
        });
        setSelectedUserIds((current) => current.filter((userId) => !updatedUsers.has(userId)));
      }
      if (updatedUsers.size > 0 && failedCount === 0) {
        toast.success("Bulk role update complete", `${updatedUsers.size} users assigned as ${bulkRole}.`);
      } else if (updatedUsers.size > 0) {
        toast.info("Bulk update finished with errors", `${updatedUsers.size} updated, ${failedCount} failed.`);
      }
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleExport = () => {
    const exportUsers = selectedUserIds.length > 0 ? selectedUsers : rows;
    if (exportUsers.length === 0) {
      toast.info("Nothing to export", "Adjust your filters or select at least one user first.");
      return;
    }
    const blob = new Blob([buildUserExport(exportUsers)], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      selectedUserIds.length > 0
        ? `selected-users-${new Date().toISOString().slice(0, 10)}.csv`
        : `filtered-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Export ready", `${exportUsers.length} users exported to CSV.`);
  };

  if (!isAdmin) {
    return (
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          User access management is available only to admin users.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading user access workspace...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <StatCard
            label="Total users"
            value={users.length}
            description="Accounts in the workspace."
            icon={Users}
            iconTone="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
            accentTone="bg-slate-900 dark:bg-slate-100"
          />
          <StatCard
            label="Students"
            value={counts.student}
            description="Personal casework accounts."
            icon={GraduationCap}
            iconTone="bg-blue-600 text-white dark:bg-blue-500 dark:text-white"
            accentTone="bg-blue-600 dark:bg-blue-500"
          />
          <StatCard
            label="Staff"
            value={counts.staff}
            description="Operational workflow users."
            icon={UserRoundCog}
            iconTone="bg-cyan-600 text-white dark:bg-cyan-500 dark:text-white"
            accentTone="bg-cyan-600 dark:bg-cyan-500"
          />
          <StatCard
            label="Admins"
            value={counts.admin}
            description="Admin-only workspace operators."
            icon={ShieldCheck}
            iconTone="bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950"
            accentTone="bg-amber-500 dark:bg-amber-400"
          />
        </div>

        <Card className="surface-card rounded-[2rem] border border-border/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCog className="size-5 text-primary" />
                  User role administration
                </CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Create, edit, remove, and reassign accounts from one admin workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary text-primary-foreground shadow-[0_18px_45px_rgba(14,165,233,0.22)] hover:bg-primary/92">
                  <Plus className="size-4" />
                  Add user
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void loadUsers(true)}
                  disabled={isRefreshing}
                  className="border border-emerald-600 bg-emerald-600 text-white shadow-[0_14px_35px_rgba(16,185,129,0.18)] hover:bg-emerald-500 dark:border-emerald-500 dark:bg-emerald-500 dark:text-white"
                >
                  {isRefreshing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_10rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, email, matric, faculty, department, or role" className="pl-9" />
              </div>
              <select className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleName | "all")}>
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((roleName) => <option key={roleName} value={roleName}>{roleName}</option>)}
              </select>
              <select className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))}>
                {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} rows</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0.02))] p-4 xl:flex-row xl:items-center xl:justify-between dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(15,23,42,0.12))]">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Bulk actions</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {selectedUserIds.length > 0
                    ? `${selectedUserIds.length} selected. ${bulkEligibleUsers.length} ready for ${bulkRole} reassignment.`
                    : "Select users from the current page or across pages to apply one role in bulk."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button variant="outline" size="sm" onClick={togglePageSelection} disabled={selectablePageUserIds.length === 0} className="border-border/80 bg-background/80 text-foreground hover:bg-background">
                  {allPageSelected ? "Clear page" : "Select page"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUserIds([])} disabled={selectedUserIds.length === 0} className="text-foreground/70 hover:bg-background/70 hover:text-foreground">
                  Clear selection
                </Button>
                <select className="h-9 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm" value={bulkRole} onChange={(event) => setBulkRole(event.target.value as RoleName)} disabled={isBulkSaving}>
                  {ROLE_OPTIONS.map((roleName) => <option key={roleName} value={roleName}>{roleName}</option>)}
                </select>
                <Button size="sm" onClick={() => void handleBulkRoleSave()} disabled={isBulkSaving || selectedUserIds.length === 0 || bulkEligibleUsers.length === 0} className="bg-primary text-primary-foreground shadow-[0_18px_45px_rgba(14,165,233,0.22)] hover:bg-primary/92">
                  {isBulkSaving ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldUser className="size-4" />}
                  {isBulkSaving ? "Applying..." : "Apply to selected"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleExport} disabled={rows.length === 0 && selectedUserIds.length === 0} className="border border-border/80 bg-background/80 text-foreground shadow-sm hover:bg-background">
                  <Download className="size-4" />
                  {selectedUserIds.length > 0 ? "Export selected" : "Export filtered"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-border/70 md:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border/70">
                    <th className="w-12 px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePageSelection}
                        disabled={selectablePageUserIds.length === 0}
                        ref={(node) => {
                          if (node) node.indeterminate = somePageSelected && !allPageSelected;
                        }}
                        className="size-4 rounded border-border bg-background text-primary"
                      />
                    </th>
                    <SortableHeader label="User" sortKey="name" sortState={sortState} onSort={handleSort} className="w-[34%]" />
                    <SortableHeader label="Role" sortKey="role" sortState={sortState} onSort={handleSort} className="w-[16%]" />
                    <SortableHeader label="Academic" sortKey="matric" sortState={sortState} onSort={handleSort} className="w-[28%]" />
                    <th className="w-[22%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? paginatedRows.map((user) => {
                    const primaryRole = resolvePrimaryRole(user);
                    const draftRole = draftRoles[user.id] ?? primaryRole;
                    const isCurrentUser = user.id === currentUser.id;
                    const isBusy = busyUserId === user.id || isBulkSaving || isUpdatingUser || isDeletingUser;
                    return (
                      <tr key={user.id} className="border-b border-border/60 bg-background/50 align-top last:border-b-0">
                        <td className="px-3 py-3.5">
                          <input type="checkbox" checked={selectedUserSet.has(user.id)} onChange={(event) => {
                            const next = new Set(selectedUserIds);
                            if (event.target.checked) {
                              next.add(user.id);
                            } else {
                              next.delete(user.id);
                            }
                            setSelectedUserIds(Array.from(next));
                          }} disabled={isCurrentUser || isBulkSaving} className="size-4 rounded border-border bg-background text-primary" />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="space-y-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">{resolveUserName(user)}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="size-3.5 shrink-0 text-primary" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="space-y-2">
                            <RoleBadge roleName={primaryRole} />
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <CalendarDays className="size-3.5 shrink-0 text-primary" />
                              <span>{formatDate(user.created_at)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="space-y-1.5 text-xs">
                            <p className="font-medium text-foreground">{user.matric_number || "No matric"}</p>
                            <div className="flex items-start gap-1.5 text-muted-foreground">
                              <GraduationCap className="mt-0.5 size-3.5 shrink-0 text-primary" />
                              <span className="leading-5">{[user.faculty, user.department].filter(Boolean).join(" / ") || "Faculty and department not set"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative min-w-0 flex-1">
                                <select className="h-9 w-full appearance-none rounded-xl border border-border/80 bg-background/90 px-3 pr-8 text-xs font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm" value={draftRole} onChange={(event) => setDraftRoles((current) => ({ ...current, [user.id]: event.target.value as RoleName }))} disabled={isCurrentUser || isBusy}>
                                  {ROLE_OPTIONS.map((roleName) => <option key={roleName} value={roleName}>{roleName}</option>)}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              </div>
                              <Button size="icon" className="size-9 rounded-xl bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(14,165,233,0.2)] hover:bg-primary/92" onClick={() => void handleRoleSave(user)} disabled={isCurrentUser || isBusy || draftRole === primaryRole}>
                                {busyUserId === user.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="icon" className="size-9 rounded-xl border-cyan-600 bg-cyan-600 text-white shadow-[0_10px_24px_rgba(8,145,178,0.16)] hover:bg-cyan-500 dark:border-cyan-500 dark:bg-cyan-500 dark:text-white" onClick={() => setEditingUser(user)} disabled={isDeletingUser || isUpdatingUser}>
                                <PencilLine className="size-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="size-9 rounded-xl border-destructive bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(220,38,38,0.16)] hover:bg-destructive/90" onClick={() => setDeletingUser(user)} disabled={isCurrentUser || isDeletingUser || isUpdatingUser}>
                                <Trash2 className="size-4" />
                              </Button>
                              <span className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">{isCurrentUser ? "Self delete blocked." : "Edit or remove."}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No users match the current search and filter combination.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 md:hidden">
              {paginatedRows.length > 0 ? paginatedRows.map((user) => {
                const primaryRole = resolvePrimaryRole(user);
                const draftRole = draftRoles[user.id] ?? primaryRole;
                const isCurrentUser = user.id === currentUser.id;
                const isBusy = busyUserId === user.id || isBulkSaving || isUpdatingUser || isDeletingUser;
                return (
                  <div key={user.id} className="rounded-[1.75rem] border border-border/70 bg-background/70 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-lg font-semibold tracking-tight">{resolveUserName(user)}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          <input type="checkbox" checked={selectedUserSet.has(user.id)} onChange={(event) => {
                            const next = new Set(selectedUserIds);
                            if (event.target.checked) {
                              next.add(user.id);
                            } else {
                              next.delete(user.id);
                            }
                            setSelectedUserIds(Array.from(next));
                          }} disabled={isCurrentUser || isBulkSaving} className="size-4 rounded border-border bg-background text-primary" />
                          Select
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <RoleBadge roleName={primaryRole} />
                        {user.matric_number ? <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">{user.matric_number}</span> : null}
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p>Faculty: {user.faculty || "Not set"}</p>
                        <p>Department: {user.department || "Not set"}</p>
                        <p>Created: {formatDate(user.created_at)}</p>
                      </div>
                      <select className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={draftRole} onChange={(event) => setDraftRoles((current) => ({ ...current, [user.id]: event.target.value as RoleName }))} disabled={isCurrentUser || isBusy}>
                        {ROLE_OPTIONS.map((roleName) => <option key={roleName} value={roleName}>{roleName}</option>)}
                      </select>
                      <Button className="bg-primary text-primary-foreground shadow-[0_16px_40px_rgba(14,165,233,0.2)] hover:bg-primary/92" onClick={() => void handleRoleSave(user)} disabled={isCurrentUser || isBusy || draftRole === primaryRole}>
                        {busyUserId === user.id ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldUser className="size-4" />}
                        {busyUserId === user.id ? "Saving..." : "Apply role"}
                      </Button>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" className="border-cyan-600 bg-cyan-600 text-white shadow-[0_10px_24px_rgba(8,145,178,0.16)] hover:bg-cyan-500 dark:border-cyan-500 dark:bg-cyan-500 dark:text-white" onClick={() => setEditingUser(user)} disabled={isDeletingUser || isUpdatingUser}>
                          <PencilLine className="size-4" />
                          Edit
                        </Button>
                        <Button type="button" variant="outline" className="border-destructive bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(220,38,38,0.16)] hover:bg-destructive/90" onClick={() => setDeletingUser(user)} disabled={isCurrentUser || isDeletingUser || isUpdatingUser}>
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No users match the current search and filter combination.</div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, rows.length)} of {rows.length} filtered users
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">Page {safePage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isCreateModalOpen ? (
        <UserCreateModal
          open={isCreateModalOpen}
          isSubmitting={isCreatingUser}
          departments={departments}
          onOpenChange={setIsCreateModalOpen}
          onSubmit={handleCreateUser}
        />
      ) : null}
      {editingUser ? (
        <UserEditModal
          open
          isSubmitting={isUpdatingUser}
          departments={departments}
          user={editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          onSubmit={handleUpdateUser}
        />
      ) : null}
      {deletingUser ? (
        <UserDeleteModal open isSubmitting={isDeletingUser} user={deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }} onConfirm={handleDeleteUser} />
      ) : null}
    </>
  );
}
