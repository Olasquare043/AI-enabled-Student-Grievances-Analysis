"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logoutUser, updateMyProfile } from "@/lib/api";
import type { UserProfileUpdateRequest, UserRead } from "@/lib/types";

type AppWorkspaceLayoutProps = {
  children: ReactNode;
};

export function AppWorkspaceLayout({ children }: AppWorkspaceLayoutProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const me = await getCurrentUser();
        setCurrentUser(me);
        setAuthError(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to validate current session";
        if (message.toLowerCase().includes("not authenticated")) {
          router.replace("/login");
          return;
        }
        setAuthError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void verifySession();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  };

  const handleProfileUpdate = async (payload: UserProfileUpdateRequest) => {
    const updatedUser = await updateMyProfile(payload);
    setCurrentUser(updatedUser);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-8 md:px-8">
        <div className="surface-card w-full rounded-2xl p-6 text-sm">
          <p className="mb-3 font-semibold text-foreground">
            Unable to load dashboard session
          </p>
          <p className="mb-4 text-muted-foreground">
            {authError ?? "Session could not be resolved. Please sign in again."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/login">Go to login</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      currentUser={currentUser}
      onLogout={handleLogout}
      onProfileUpdate={handleProfileUpdate}
    >
      {children}
    </AppShell>
  );
}
