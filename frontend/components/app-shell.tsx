"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CircleUserRound,
  FileUp,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquareWarning,
  Route,
  Save,
  X,
} from "lucide-react";

import { listGrievances } from "@/lib/grievance-api";
import { getNlpProviderStatus } from "@/lib/nlp-api";
import { listOperationsQueue, listSlaBreaches } from "@/lib/operations-api";
import type { UserProfileUpdateRequest, UserRead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AppShellProps = {
  currentUser: UserRead;
  onLogout: () => void | Promise<void>;
  onProfileUpdate: (payload: UserProfileUpdateRequest) => Promise<void>;
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  matricNumber: string;
  phoneNumber: string;
  faculty: string;
  department: string;
  level: string;
};

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

type DashboardStats = {
  myTotalCount: number;
  myOpenCount: number;
  queueCount: number;
  activeBreachCount: number;
  providerLabel: string;
};

function navItemClass(isActive: boolean) {
  if (isActive) {
    return "flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-tint)] px-3 py-2 text-sm font-medium text-[var(--primary)]";
  }
  return "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface-tint)]";
}

export function AppShell({ currentUser, onLogout, onProfileUpdate }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(
    buildProfileForm(currentUser),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    setProfileForm(buildProfileForm(currentUser));
  }, [currentUser]);

  const roleNames = useMemo(
    () => currentUser.roles.map((role) => role.name).join(", "),
    [currentUser.roles],
  );

  const fullName = useMemo(() => {
    const combined = [currentUser.first_name, currentUser.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return combined || "Not set";
  }, [currentUser.first_name, currentUser.last_name]);

  const hasOperationalRole = useMemo(() => {
    const roles = new Set(currentUser.roles.map((role) => role.name));
    return roles.has("staff") || roles.has("admin");
  }, [currentUser.roles]);

  const isAdmin = useMemo(() => {
    const roles = new Set(currentUser.roles.map((role) => role.name));
    return roles.has("admin");
  }, [currentUser.roles]);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      setIsLoadingStats(true);
      setStatsError(null);
      try {
        const myCasesPromise = listGrievances({ mine: true });
        const queuePromise = hasOperationalRole
          ? listOperationsQueue()
          : Promise.resolve([]);
        const breachesPromise = hasOperationalRole
          ? listSlaBreaches()
          : Promise.resolve([]);
        const providerPromise = getNlpProviderStatus();

        const [myCases, queue, breaches, provider] = await Promise.all([
          myCasesPromise,
          queuePromise,
          breachesPromise,
          providerPromise,
        ]);

        const myOpenCount = myCases.filter(
          (item) => item.status === "open" || item.status === "in_progress",
        ).length;

        const providerLabel = provider.llm_enabled
          ? `${provider.provider.toUpperCase()} (${provider.model ?? "default model"})`
          : "NoOp baseline (LLM disabled)";

        if (!isMounted) {
          return;
        }

        setStats({
          myTotalCount: myCases.length,
          myOpenCount,
          queueCount: queue.length,
          activeBreachCount: breaches.length,
          providerLabel,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setStatsError(
          error instanceof Error ? error.message : "Unable to load dashboard metrics",
        );
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    };

    void loadStats();
    return () => {
      isMounted = false;
    };
  }, [currentUser.id, hasOperationalRole]);

  const updateProfileField = <T extends keyof ProfileFormState>(
    key: T,
    value: ProfileFormState[T],
  ) => {
    setProfileForm((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (saveState !== "idle") {
      setSaveState("idle");
    }
    if (saveError) {
      setSaveError(null);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
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
      setSaveState("saved");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Profile update failed";
      setSaveError(detail);
      setSaveState("idle");
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--border)] bg-white p-5 transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Operations Console</h2>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav className="mt-6 space-y-2">
          <Link
            href="/"
            className={navItemClass(pathname === "/")}
          >
            <Home className="size-4" />
            Home
          </Link>
          <Link
            href="/app"
            className={navItemClass(pathname === "/app")}
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/grievances"
            className={navItemClass(pathname.startsWith("/grievances"))}
          >
            <MessageSquareWarning className="size-4" />
            Grievances
          </Link>
          {hasOperationalRole ? (
            <Link
              href="/operations"
              className={navItemClass(pathname.startsWith("/operations"))}
            >
              <Route className="size-4" />
              Operations
            </Link>
          ) : null}
          {hasOperationalRole ? (
            <Link
              href="/analytics"
              className={navItemClass(pathname.startsWith("/analytics"))}
            >
              <BarChart3 className="size-4" />
              Analytics
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/imports"
              className={navItemClass(pathname.startsWith("/imports"))}
            >
              <FileUp className="size-4" />
              CSV Import
            </Link>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur-sm md:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="size-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Student Grievances Dashboard</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Welcome, {fullName}.
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => void onLogout()}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 md:px-8">
          <Card className="surface-card rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CircleUserRound className="size-5 text-[var(--primary)]" />
                Signed in user
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <p>
                <span className="font-medium text-[var(--foreground)]">Name:</span>{" "}
                {fullName}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Email:</span>{" "}
                {currentUser.email}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Roles:</span>{" "}
                {roleNames || "none"}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Matric:</span>{" "}
                {currentUser.matric_number || "Not set"}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Department:</span>{" "}
                {currentUser.department || "Not set"}
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Complete your profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={profileForm.firstName}
                      onChange={(event) =>
                        updateProfileField("firstName", event.target.value)
                      }
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={profileForm.lastName}
                      onChange={(event) =>
                        updateProfileField("lastName", event.target.value)
                      }
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="matric-number">Matric number</Label>
                    <Input
                      id="matric-number"
                      value={profileForm.matricNumber}
                      onChange={(event) =>
                        updateProfileField("matricNumber", event.target.value)
                      }
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Phone number</Label>
                    <Input
                      id="phone-number"
                      value={profileForm.phoneNumber}
                      onChange={(event) =>
                        updateProfileField("phoneNumber", event.target.value)
                      }
                      maxLength={30}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faculty">Faculty</Label>
                    <Input
                      id="faculty"
                      value={profileForm.faculty}
                      onChange={(event) =>
                        updateProfileField("faculty", event.target.value)
                      }
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={profileForm.department}
                      onChange={(event) =>
                        updateProfileField("department", event.target.value)
                      }
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      value={profileForm.level}
                      onChange={(event) =>
                        updateProfileField("level", event.target.value)
                      }
                      maxLength={32}
                    />
                  </div>
                </div>

                {saveError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
                    {saveError}
                  </p>
                ) : null}
                {saveState === "saved" ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Profile updated successfully.
                  </p>
                ) : null}

                <Button type="submit" disabled={saveState === "saving"}>
                  {saveState === "saving" ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save profile
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {statsError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
              {statsError}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Cases requiring attention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">
                  {isLoadingStats ? <LoaderCircle className="size-6 animate-spin" /> : (stats?.myOpenCount ?? 0)}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Open and in-progress grievances from your submissions.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/grievances">Open grievances</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">
                  {hasOperationalRole ? "Active SLA breaches" : "My submissions"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">
                  {isLoadingStats ? (
                    <LoaderCircle className="size-6 animate-spin" />
                  ) : hasOperationalRole ? (
                    (stats?.activeBreachCount ?? 0)
                  ) : (
                    (stats?.myTotalCount ?? 0)
                  )}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {hasOperationalRole
                    ? `Current breach signals across ${stats?.queueCount ?? 0} queued case(s).`
                    : "Total grievances submitted with your account."}
                </p>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={hasOperationalRole ? "/operations" : "/grievances"}>
                      {hasOperationalRole ? "Open operations" : "View submissions"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">AI provider status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {isLoadingStats ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    (stats?.providerLabel ?? "Unknown")
                  )}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Optional Groq acceleration with deterministic baseline fallback.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={hasOperationalRole ? "/analytics" : "/grievances"}>
                      {hasOperationalRole ? "Open analytics" : "Open grievances"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
