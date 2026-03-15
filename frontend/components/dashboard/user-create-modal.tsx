"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  UserRoundCog,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
  DepartmentRead,
  RoleName,
  UserRead,
} from "@/lib/types";

type UserFormState = {
  email: string;
  password: string;
  role_name: RoleName;
  first_name: string;
  last_name: string;
  matric_number: string;
  phone_number: string;
  faculty: string;
  department: string;
  level: string;
  is_active: boolean;
};

const DEFAULT_FORM: UserFormState = {
  email: "",
  password: "",
  role_name: "student",
  first_name: "",
  last_name: "",
  matric_number: "",
  phone_number: "",
  faculty: "",
  department: "",
  level: "",
  is_active: true,
};

const ROLE_OPTIONS: Array<{
  role: RoleName;
  title: string;
  description: string;
  icon: typeof GraduationCap;
}> = [
  {
    role: "student",
    title: "Student workspace",
    description: "Personal grievance tracking, analysis, and profile access.",
    icon: GraduationCap,
  },
  {
    role: "staff",
    title: "Operations staff",
    description: "Queue handling, routing, analytics, and casework operations.",
    icon: UserRoundCog,
  },
  {
    role: "admin",
    title: "Admin control",
    description: "Operations workspace plus user access and import tooling.",
    icon: ShieldCheck,
  },
];

function normalizeOptional(value: string) {
  const cleaned = value.trim();
  return cleaned || null;
}

function buildFormState(user?: UserRead | null): UserFormState {
  if (!user) {
    return DEFAULT_FORM;
  }

  return {
    email: user.email,
    password: "",
    role_name: user.roles[0]?.name ?? "student",
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    matric_number: user.matric_number ?? "",
    phone_number: user.phone_number ?? "",
    faculty: user.faculty ?? "",
    department: user.department ?? "",
    level: user.level ?? "",
    is_active: user.is_active,
  };
}

function resolveStaffDepartmentValue(value: string, departments: DepartmentRead[]) {
  return departments.some((department) => department.name === value || department.code === value)
    ? value
    : "";
}

function ModalShell({
  open,
  isSubmitting,
  onOpenChange,
  children,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onOpenChange(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSubmitting, onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close user modal"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={() => {
          if (!isSubmitting) {
            onOpenChange(false);
          }
        }}
      />
      {children}
    </div>
  );
}

function UserFormModal({
  mode,
  open,
  isSubmitting,
  departments,
  user,
  onOpenChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  open: boolean;
  isSubmitting: boolean;
  departments: DepartmentRead[];
  user?: UserRead | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AdminUserCreateRequest | AdminUserUpdateRequest) => Promise<void>;
}) {
  const [form, setForm] = useState<UserFormState>(() => buildFormState(user));
  const [error, setError] = useState<string | null>(null);
  const roleHint = useMemo(
    () => ROLE_OPTIONS.find((option) => option.role === form.role_name),
    [form.role_name],
  );
  const isStaffRole = form.role_name === "staff";
  const isStudentRole = form.role_name === "student";
  const staffDepartmentValue = useMemo(
    () => resolveStaffDepartmentValue(form.department, departments),
    [departments, form.department],
  );

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    onOpenChange(false);
  };

  const handleChange = (field: keyof UserFormState, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const departmentValue = isStaffRole ? staffDepartmentValue : form.department;

    if (!firstName || !lastName || !email) {
      setError("First name, last name, and email are required.");
      return;
    }

    if (isStaffRole && !departmentValue.trim()) {
      setError("Staff accounts must be linked to an operational department.");
      return;
    }

    if (mode === "create" && password.length < 8) {
      setError("A temporary password with at least 8 characters is required.");
      return;
    }

    if (mode === "create") {
      await onSubmit({
        email,
        password,
        role_name: form.role_name,
        first_name: firstName,
        last_name: lastName,
        matric_number: normalizeOptional(form.matric_number) ?? undefined,
        phone_number: normalizeOptional(form.phone_number) ?? undefined,
        faculty: normalizeOptional(form.faculty) ?? undefined,
        department: normalizeOptional(departmentValue) ?? undefined,
        level: normalizeOptional(form.level) ?? undefined,
      });
    } else {
      await onSubmit({
        email,
        role_name: form.role_name,
        password: password || undefined,
        first_name: firstName,
        last_name: lastName,
        matric_number: normalizeOptional(form.matric_number),
        phone_number: normalizeOptional(form.phone_number),
        faculty: normalizeOptional(form.faculty),
        department: normalizeOptional(departmentValue),
        level: normalizeOptional(form.level),
        is_active: form.is_active,
      });
    }
    onOpenChange(false);
  };

  return (
    <ModalShell open={open} isSubmitting={isSubmitting} onOpenChange={onOpenChange}>
      <div className="relative z-10 my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-background/98 shadow-[0_32px_120px_rgba(15,23,42,0.35)] sm:max-h-[calc(100vh-3rem)]">
        <div className="relative shrink-0 overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.24),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] px-4 py-5 text-white sm:px-6 sm:py-6">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.05),transparent)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">
                <Sparkles className="size-3.5" />
                {mode === "create" ? "Access Studio" : "Account Editor"}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {mode === "create" ? "Add a new workspace user" : `Edit ${user?.email ?? "user"}`}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-200/90">
                  {mode === "create"
                    ? "Create a student, staff, or admin account from one polished control panel."
                    : "Update access, contact details, and academic context from the same refined admin modal."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-100 transition hover:bg-white/18"
              aria-label="Close user modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-3">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = form.role_name === option.role;

                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => handleChange("role_name", option.role)}
                    className={cn(
                      "rounded-[1.35rem] border p-4 text-left transition",
                      isActive
                        ? "border-sky-500 bg-slate-950 text-white shadow-[0_18px_45px_rgba(2,132,199,0.22)] dark:border-sky-400 dark:bg-slate-900"
                        : "border-border/70 bg-card hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-slate-950",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-3 inline-flex size-10 items-center justify-center rounded-2xl",
                        isActive
                          ? "bg-sky-500 text-white dark:bg-sky-400 dark:text-slate-950"
                          : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <p className={cn("text-sm font-semibold", isActive ? "text-white" : "text-foreground")}>
                      {option.title}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm leading-6",
                        isActive ? "text-slate-200" : "text-muted-foreground",
                      )}
                    >
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {roleHint ? (
              <div className="rounded-[1.2rem] border border-sky-500/40 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-200 dark:border-sky-400/40 dark:bg-slate-900">
                <span className="font-semibold text-white">{roleHint.title}:</span>{" "}
                {roleHint.description}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-first-name`}>First name</Label>
                <Input
                  id={`${mode}-user-first-name`}
                  value={form.first_name}
                  onChange={(event) => handleChange("first_name", event.target.value)}
                  placeholder="Aisha"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-last-name`}>Last name</Label>
                <Input
                  id={`${mode}-user-last-name`}
                  value={form.last_name}
                  onChange={(event) => handleChange("last_name", event.target.value)}
                  placeholder="Bello"
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-email`}>Email address</Label>
                <Input
                  id={`${mode}-user-email`}
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="user@school.edu"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-password`}>
                  {mode === "create" ? "Temporary password" : "Reset password"}
                </Label>
                <Input
                  id={`${mode}-user-password`}
                  type="password"
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder={mode === "create" ? "Minimum 8 characters" : "Leave blank to keep current"}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-matric`}>Matric number</Label>
                <Input
                  id={`${mode}-user-matric`}
                  value={form.matric_number}
                  onChange={(event) => handleChange("matric_number", event.target.value)}
                  placeholder="CSC/26/1024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-phone`}>Phone number</Label>
                <Input
                  id={`${mode}-user-phone`}
                  value={form.phone_number}
                  onChange={(event) => handleChange("phone_number", event.target.value)}
                  placeholder="+234..."
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-faculty`}>Faculty</Label>
                <Input
                  id={`${mode}-user-faculty`}
                  value={form.faculty}
                  onChange={(event) => handleChange("faculty", event.target.value)}
                  placeholder={isStudentRole ? "Science" : "Administration"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${mode}-user-department`}>
                  {isStaffRole ? "Operational department" : "Department"}
                </Label>
                {isStaffRole ? (
                  <div className="relative">
                    <select
                      id={`${mode}-user-department`}
                      value={staffDepartmentValue}
                      onChange={(event) => handleChange("department", event.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm text-foreground"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.name}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                ) : (
                  <Input
                    id={`${mode}-user-department`}
                    value={form.department}
                    onChange={(event) => handleChange("department", event.target.value)}
                    placeholder={isStudentRole ? "Computer Science" : "Platform Operations"}
                  />
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${mode}-user-level`}>
                  {isStudentRole ? "Level" : "Level or staff band"}
                </Label>
                <Input
                  id={`${mode}-user-level`}
                  value={form.level}
                  onChange={(event) => handleChange("level", event.target.value)}
                  placeholder={isStudentRole ? "500" : "Graduate, Level 2, or N/A"}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="mb-2 block">Account status</Label>
                <button
                  type="button"
                  onClick={() => handleChange("is_active", !form.is_active)}
                  className={cn(
                    "flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm font-medium transition",
                    form.is_active
                      ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                      : "border-slate-700 bg-slate-700 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-950",
                  )}
                >
                  <span>{form.is_active ? "Active account" : "Inactive account"}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                      form.is_active
                        ? "bg-white/15 text-white"
                        : "bg-white/15 text-white dark:bg-slate-950/10 dark:text-slate-950",
                    )}
                  >
                    {form.is_active ? "Enabled" : "Disabled"}
                  </span>
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[1.1rem] border border-destructive/40 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm leading-6 text-muted-foreground">
                {mode === "create"
                  ? "The account is created immediately and appears in the users table with the selected role."
                  : "Changes are saved immediately and reflected in the active users table."}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground shadow-[0_18px_45px_rgba(14,165,233,0.22)] hover:bg-primary/92"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {mode === "create" ? "Creating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      {mode === "create" ? <UserPlus className="size-4" /> : <ShieldCheck className="size-4" />}
                      {mode === "create" ? "Create user" : "Save changes"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

export function UserCreateModal(props: {
  open: boolean;
  isSubmitting: boolean;
  departments: DepartmentRead[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AdminUserCreateRequest) => Promise<void>;
}) {
  return (
    <UserFormModal
      key={`create-${props.open ? "open" : "closed"}`}
      mode="create"
      open={props.open}
      isSubmitting={props.isSubmitting}
      departments={props.departments}
      onOpenChange={props.onOpenChange}
      onSubmit={(payload) => props.onSubmit(payload as AdminUserCreateRequest)}
    />
  );
}

export function UserEditModal(props: {
  open: boolean;
  isSubmitting: boolean;
  departments: DepartmentRead[];
  user: UserRead | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AdminUserUpdateRequest) => Promise<void>;
}) {
  return (
    <UserFormModal
      key={`edit-${props.user?.id ?? "empty"}-${props.open ? "open" : "closed"}`}
      mode="edit"
      open={props.open}
      isSubmitting={props.isSubmitting}
      departments={props.departments}
      user={props.user}
      onOpenChange={props.onOpenChange}
      onSubmit={(payload) => props.onSubmit(payload as AdminUserUpdateRequest)}
    />
  );
}

export function UserDeleteModal({
  open,
  isSubmitting,
  user,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  isSubmitting: boolean;
  user: UserRead | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ModalShell open={open} isSubmitting={isSubmitting} onOpenChange={onOpenChange}>
      <div className="relative z-10 my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-background/98 shadow-[0_32px_120px_rgba(15,23,42,0.35)] sm:max-h-[calc(100vh-3rem)]">
        <div className="shrink-0 border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.9))] px-4 py-5 text-white sm:px-6 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-100">
                <AlertTriangle className="size-3.5" />
                Delete Account
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">Remove {user?.email ?? "user"}?</h2>
                <p className="text-sm leading-6 text-slate-200/90">
                  This permanently removes the account and its direct access to the workspace. Use this only when the user should no longer exist in the system.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) {
                  onOpenChange(false);
                }
              }}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-100 transition hover:bg-white/18"
              aria-label="Close delete modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-[1.3rem] border border-rose-400 bg-rose-50 px-4 py-4 dark:border-rose-700 dark:bg-rose-950/45">
            <p className="text-sm font-semibold text-slate-950 dark:text-rose-100">{user?.first_name || "This user"} will be removed.</p>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              The record disappears from the admin table immediately after confirmation.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground shadow-[0_18px_45px_rgba(239,68,68,0.22)] hover:bg-destructive/92"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete user
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
