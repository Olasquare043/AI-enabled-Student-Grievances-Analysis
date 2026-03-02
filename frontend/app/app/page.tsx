"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser, logoutUser, updateMyProfile } from "@/lib/api";
import type { UserProfileUpdateRequest, UserRead } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const me = await getCurrentUser();
        setCurrentUser(me);
      } catch {
        router.replace("/login");
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
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      currentUser={currentUser}
      onLogout={handleLogout}
      onProfileUpdate={handleProfileUpdate}
    />
  );
}
