"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BarChart3,
  FileUp,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Route,
  Users,
  X,
} from "lucide-react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { getPrimaryRole } from "@/lib/roles";
import type { UserProfileUpdateRequest, UserRead } from "@/lib/types";

type AppShellProps = {
  currentUser: UserRead;
  onLogout: () => void | Promise<void>;
  onProfileUpdate: (payload: UserProfileUpdateRequest) => Promise<void>;
  children: ReactNode;
};

type AppShellContextValue = {
  currentUser: UserRead;
  onProfileUpdate: (payload: UserProfileUpdateRequest) => Promise<void>;
  fullName: string;
  hasOperationalRole: boolean;
  isAdmin: boolean;
};

type RouteMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

function navItemClass(isActive: boolean) {
  if (isActive) {
    return "flex items-center gap-2 rounded-2xl border border-sky-600 bg-sky-600 px-3 py-2.5 text-sm font-medium text-white shadow-[0_14px_32px_rgba(2,132,199,0.22)] dark:border-sky-500 dark:bg-sky-500";
  }

  return "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-slate-900 dark:hover:text-sky-200";
}

function subNavItemClass(isActive: boolean) {
  if (isActive) {
    return "flex items-center gap-2 rounded-xl border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(2,132,199,0.18)] dark:border-sky-500 dark:bg-sky-500";
  }

  return "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-slate-900 dark:hover:text-sky-200";
}

function roleChipTone(roleName: string) {
  if (roleName === "admin") {
    return "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950";
  }
  if (roleName === "staff") {
    return "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500";
  }
  return "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500";
}

function resolveRouteMeta(
  pathname: string,
  hasOperationalRole: boolean,
  isAdmin: boolean,
): RouteMeta {
  if (pathname === "/app") {
    return {
      eyebrow: "Workspace overview",
      title: hasOperationalRole ? "Dashboard overview" : "Student overview",
      description: hasOperationalRole
        ? "Track queue pressure, personal workload, and workflow health from one command surface."
        : "See your grievance status, activity trends, and next actions in one workspace.",
    };
  }

  if (pathname === "/app/analysis") {
    return {
      eyebrow: "Analysis studio",
      title: hasOperationalRole ? "Operational analysis" : "Personal analysis",
      description: hasOperationalRole
        ? "Explore grievance trends, demand concentration, and recurring operational patterns."
        : "Review the visual breakdown of your grievance history, categories, and resolution progress.",
    };
  }

  if (pathname === "/app/profile") {
    return {
      eyebrow: "Profile management",
      title: "Profile and identity",
      description:
        "Maintain academic, contact, and role context so routing and decision-making stay accurate.",
    };
  }

  if (pathname === "/app/grievances") {
    return {
      eyebrow: "Case workspace",
      title: "Grievances",
      description:
        "Submit new cases, filter active records, and follow workflow progress without leaving the console.",
    };
  }

  if (pathname.startsWith("/app/grievances/")) {
    return {
      eyebrow: "Case workspace",
      title: "Grievance detail",
      description:
        "Review timeline events, collaborate in comments, and move cases through the workflow.",
    };
  }

  if (pathname === "/app/operations") {
    return {
      eyebrow: "Operations control",
      title: "Routing and SLA operations",
      description:
        "Manage queue routing, breach handling, escalation signals, and departmental SLA policy.",
    };
  }

  if (pathname === "/app/analytics") {
    return {
      eyebrow: "Executive analytics",
      title: "Analytics workspace",
      description:
        "Inspect intake trends, backlog risk, compliance performance, and theme clustering in one view.",
    };
  }

  if (pathname === "/app/imports") {
    return {
      eyebrow: "Administrative tools",
      title: isAdmin ? "CSV import center" : "Restricted workspace",
      description: isAdmin
        ? "Bulk ingest grievance data, validate upload quality, and inspect import outcomes."
        : "This workspace is available only to administrators.",
    };
  }

  if (pathname === "/app/users") {
    return {
      eyebrow: "Administrative tools",
      title: isAdmin ? "User role management" : "Restricted workspace",
      description: isAdmin
        ? "Review all user accounts, inspect effective access, and switch roles explicitly."
        : "This workspace is available only to administrators.",
    };
  }

  return {
    eyebrow: "Workspace",
    title: "Campus Pulse",
    description: "Workflows, insights, and profile controls in one console.",
  };
}

export function useAppShellContext() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShellContext must be used within AppShell");
  }
  return context;
}

export function AppShell({
  currentUser,
  onLogout,
  onProfileUpdate,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  const fullName = useMemo(() => {
    const combined = [currentUser.first_name, currentUser.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return combined || "Not set";
  }, [currentUser.first_name, currentUser.last_name]);

  const primaryRole = useMemo(() => getPrimaryRole(currentUser.roles), [currentUser.roles]);
  const hasOperationalRole = primaryRole?.name === "staff" || primaryRole?.name === "admin";
  const isAdmin = primaryRole?.name === "admin";
  const dashboardActive =
    pathname === "/app" || pathname === "/app/analysis" || pathname === "/app/profile";
  const routeMeta = resolveRouteMeta(pathname, hasOperationalRole, isAdmin);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      closeSidebar();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const handleSidebarNavCapture = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest("a")) {
      closeSidebar();
    }
  };

  const contextValue = useMemo<AppShellContextValue>(
    () => ({
      currentUser,
      onProfileUpdate,
      fullName,
      hasOperationalRole,
      isAdmin,
    }),
    [currentUser, fullName, hasOperationalRole, isAdmin, onProfileUpdate],
  );

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-background md:h-screen md:overflow-hidden">
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] md:hidden"
            onClick={closeSidebar}
          />
        ) : null}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[min(20rem,calc(100vw-1rem))] shrink-0 flex-col overflow-y-auto border-r border-border/70 bg-card/95 p-5 backdrop-blur-xl transition-transform duration-300 md:sticky md:inset-y-auto md:left-auto md:w-80 md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                Operations
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Campus Pulse</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Shared workspace for overview, analysis, profile, and operational casework.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <X className="size-5" />
            </Button>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-medium">{fullName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{currentUser.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryRole ? (
                <span
                  key={primaryRole.id}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${roleChipTone(primaryRole.name)}`}
                >
                  {primaryRole.name}
                </span>
              ) : null}
            </div>
          </div>

          <nav className="mt-6 space-y-6" onClickCapture={handleSidebarNavCapture}>
            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                General
              </p>
              <Link href="/" className={navItemClass(pathname === "/")} onClick={closeSidebar}>
                <Home className="size-4" />
                Home
              </Link>
            </div>

            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Dashboard
              </p>
              <Link href="/app" className={navItemClass(dashboardActive)} onClick={closeSidebar}>
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
              <div className="ml-5 space-y-1 border-l border-border/70 pl-3">
                <Link href="/app" className={subNavItemClass(pathname === "/app")} onClick={closeSidebar}>
                  Overview
                </Link>
                <Link
                  href="/app/analysis"
                  className={subNavItemClass(pathname === "/app/analysis")}
                  onClick={closeSidebar}
                >
                  Analysis
                </Link>
                <Link
                  href="/app/profile"
                  className={subNavItemClass(pathname === "/app/profile")}
                  onClick={closeSidebar}
                >
                  Profile
                </Link>
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Casework
              </p>
              <Link
                href="/app/grievances"
                className={navItemClass(pathname.startsWith("/app/grievances"))}
                onClick={closeSidebar}
              >
                <MessageSquareWarning className="size-4" />
                Grievances
              </Link>
              {hasOperationalRole ? (
                <Link
                  href="/app/operations"
                  className={navItemClass(pathname === "/app/operations")}
                  onClick={closeSidebar}
                >
                  <Route className="size-4" />
                  Operations
                </Link>
              ) : null}
              {hasOperationalRole ? (
                <Link
                  href="/app/analytics"
                  className={navItemClass(pathname === "/app/analytics")}
                  onClick={closeSidebar}
                >
                  <BarChart3 className="size-4" />
                  Analytics
                </Link>
              ) : null}
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Admin Tools
                </p>
                <Link href="/app/users" className={navItemClass(pathname === "/app/users")} onClick={closeSidebar}>
                  <Users className="size-4" />
                  User Access
                </Link>
                <Link
                  href="/app/imports"
                  className={navItemClass(pathname === "/app/imports")}
                  onClick={closeSidebar}
                >
                  <FileUp className="size-4" />
                  CSV Import
                </Link>
              </div>
            ) : null}
          </nav>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col md:h-screen md:min-h-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-1 md:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="size-5" />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    {routeMeta.eyebrow}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                    {routeMeta.title}
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {routeMeta.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:self-start">
                <ThemeSwitcher />
                <Button variant="ghost" onClick={() => void onLogout()}>
                  <LogOut className="size-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:min-h-0 md:overflow-y-auto md:px-8">
            {children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
