"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PencilLine, Save, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { getPrimaryRole } from "@/lib/roles";
import type { UserProfileUpdateRequest, UserRead } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ProfileFormState = {
  firstName: string;
  lastName: string;
  matricNumber: string;
  phoneNumber: string;
  faculty: string;
  department: string;
  level: string;
};

type DashboardProfileProps = {
  currentUser: UserRead;
  onProfileUpdate: (payload: UserProfileUpdateRequest) => Promise<void>;
};

const editableFields: Array<{
  key: keyof ProfileFormState;
  label: string;
  id: string;
  maxLength: number;
}> = [
  { key: "firstName", label: "First name", id: "first-name", maxLength: 100 },
  { key: "lastName", label: "Last name", id: "last-name", maxLength: 100 },
  { key: "matricNumber", label: "Matric number", id: "matric-number", maxLength: 50 },
  { key: "phoneNumber", label: "Phone number", id: "phone-number", maxLength: 30 },
  { key: "faculty", label: "Faculty", id: "faculty", maxLength: 120 },
  { key: "department", label: "Department", id: "department", maxLength: 120 },
  { key: "level", label: "Level", id: "level", maxLength: 32 },
];

function buildProfileForm(user: UserRead): ProfileFormState {
  return {
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    matricNumber: user.matric_number ?? "",
    phoneNumber: user.phone_number ?? "",
    faculty: user.faculty ?? "",
    department: user.department ?? "",
    level: user.level ?? "",
  };
}

function roleTone(role: string) {
  if (role === "admin") {
    return "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950";
  }
  if (role === "staff") {
    return "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500";
  }
  return "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500";
}

export function DashboardProfile({
  currentUser,
  onProfileUpdate,
}: DashboardProfileProps) {
  const toast = useToast();
  const [activeView, setActiveView] = useState<"summary" | "edit">("summary");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(buildProfileForm(currentUser));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setProfileForm(buildProfileForm(currentUser));
  }, [currentUser]);

  const fullName = useMemo(() => {
    const combined = [currentUser.first_name, currentUser.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return combined || "Not set";
  }, [currentUser.first_name, currentUser.last_name]);
  const primaryRole = useMemo(() => getPrimaryRole(currentUser.roles), [currentUser.roles]);

  const completeness = useMemo(() => {
    const values = Object.values(profileForm);
    const completed = values.filter((value) => value.trim().length > 0).length;
    return Math.round((completed / values.length) * 100);
  }, [profileForm]);

  const updateProfileField = <T extends keyof ProfileFormState>(
    key: T,
    value: ProfileFormState[T],
  ) => {
    setProfileForm((previous) => ({
      ...previous,
      [key]: value,
    }));
    if (saveState !== "idle") {
      setSaveState("idle");
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("saving");

    try {
      await onProfileUpdate({
        first_name: profileForm.firstName,
        last_name: profileForm.lastName,
        matric_number: profileForm.matricNumber,
        phone_number: profileForm.phoneNumber,
        faculty: profileForm.faculty,
        department: profileForm.department,
        level: profileForm.level,
      });
      setSaveState("idle");
      toast.success("Profile updated", "Your profile was updated successfully.");
    } catch (error) {
      toast.error(
        "Profile update failed",
        error instanceof Error ? error.message : "Profile update failed",
      );
      setSaveState("idle");
    }
  };

  return (
    <Card className="surface-card rounded-[2rem]">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="size-5 text-primary" />
              Profile control
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Review identity data, role access, and profile completion from one panel.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border/70 bg-background/70 p-1">
            <button
              type="button"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                activeView === "summary"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setActiveView("summary")}
            >
              Overview
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                activeView === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setActiveView("edit")}
            >
              Edit
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeView === "summary" ? (
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-border/70 bg-background/70 p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">{fullName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{currentUser.email}</p>
                </div>
                <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-[0_14px_32px_rgba(2,132,199,0.18)] dark:bg-sky-500">
                  <ShieldCheck className="size-6" />
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {primaryRole ? (
                  <span
                    key={primaryRole.id}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                      roleTone(primaryRole.name),
                    )}
                  >
                    {primaryRole.name}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Matric</p>
                  <p className="mt-2 text-sm font-medium">
                    {currentUser.matric_number || "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                  <p className="mt-2 text-sm font-medium">
                    {currentUser.phone_number || "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Faculty</p>
                  <p className="mt-2 text-sm font-medium">
                    {currentUser.faculty || "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
                  <p className="mt-2 text-sm font-medium">
                    {currentUser.department || "Not set"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Level</p>
                  <p className="mt-2 text-sm font-medium">{currentUser.level || "Not set"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/70 bg-background/70 p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Profile completeness</p>
                  <p className="text-sm text-muted-foreground">
                    Keep your identity and academic context current for better routing quality.
                  </p>
                </div>
                <span className="rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(2,132,199,0.18)] dark:border-sky-500 dark:bg-sky-500">
                  {completeness}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 dark:border-sky-700 dark:bg-slate-900 dark:text-slate-100">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                Complete profiles help operations teams interpret grievances with the right departmental and faculty context.
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              {editableFields.map((field) => (
                <div
                  key={field.key}
                  className={cn("space-y-2", field.key === "level" && "md:col-span-2")}
                >
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    value={profileForm[field.key]}
                    maxLength={field.maxLength}
                    onChange={(event) => updateProfileField(field.key, event.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saveState === "saving"}>
                {saveState === "saving" ? (
                  <>
                    <PencilLine className="size-4 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save profile
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setActiveView("summary")}>
                Review summary
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
