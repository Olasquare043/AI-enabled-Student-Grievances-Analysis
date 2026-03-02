"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CircleUserRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquareWarning,
  Route,
  Save,
  X,
} from "lucide-react";

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

export function AppShell({ currentUser, onLogout, onProfileUpdate }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(
    buildProfileForm(currentUser),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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
            href="/app"
            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-tint)] px-3 py-2 text-sm font-medium text-[var(--primary)]"
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/grievances"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface-tint)]"
          >
            <MessageSquareWarning className="size-4" />
            Grievances
          </Link>
          <Link
            href="/operations"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface-tint)]"
          >
            <Route className="size-4" />
            Operations
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface-tint)]"
          >
            <BarChart3 className="size-4" />
            Analytics
          </Link>
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
                        setProfileForm((prev) => ({
                          ...prev,
                          firstName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={profileForm.lastName}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          lastName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="matric-number">Matric number</Label>
                    <Input
                      id="matric-number"
                      value={profileForm.matricNumber}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          matricNumber: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Phone number</Label>
                    <Input
                      id="phone-number"
                      value={profileForm.phoneNumber}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phoneNumber: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faculty">Faculty</Label>
                    <Input
                      id="faculty"
                      value={profileForm.faculty}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          faculty: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={profileForm.department}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          department: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      value={profileForm.level}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          level: event.target.value,
                        }))
                      }
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Cases in review</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">0</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Track your submitted grievances and comments.
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
                <CardTitle className="text-base">Escalations pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">0</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Monitor routing and SLA signals in operations board.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/operations">Open operations</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">AI provider status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">NoOp</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Groq remains optional and disabled by default.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/analytics">Open analytics</Link>
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
