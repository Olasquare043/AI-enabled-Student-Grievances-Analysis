"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  House,
  LayoutDashboard,
  LoaderCircle,
  RotateCw,
  UserRoundCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GrievanceComments } from "@/components/grievance/grievance-comments";
import { getCurrentUser } from "@/lib/api";
import {
  addGrievanceComment,
  assignGrievance,
  getGrievanceById,
  updateGrievanceStatus,
} from "@/lib/grievance-api";
import type { GrievanceRead, GrievanceStatus, UserRead } from "@/lib/types";

const statusBadgeClass: Record<GrievanceStatus, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
};

const allowedTransitions: Record<GrievanceStatus, GrievanceStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};

function hasOperationalRole(user: UserRead | null) {
  if (!user) {
    return false;
  }
  const roles = new Set(user.roles.map((role) => role.name));
  return roles.has("staff") || roles.has("admin");
}

export default function GrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const grievanceId = params.id;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [grievance, setGrievance] = useState<GrievanceRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<GrievanceStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const canOperate = useMemo(() => hasOperationalRole(currentUser), [currentUser]);

  const canComment = useMemo(() => {
    if (!currentUser || !grievance) {
      return false;
    }
    return canOperate || currentUser.id === grievance.student_id;
  }, [canOperate, currentUser, grievance]);

  const loadDetail = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const me = await getCurrentUser();
      const detail = await getGrievanceById(grievanceId);
      setCurrentUser(me);
      setGrievance(detail);
      setStatusTarget("");
      setResolutionNote(detail.resolution_note ?? "");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load grievance";
      if (message.toLowerCase().includes("not authenticated")) {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, grievanceId]);

  const handleAssignToMe = async () => {
    if (!currentUser) {
      return;
    }
    setError(null);
    setIsAssigning(true);
    try {
      const updated = await assignGrievance(grievanceId, {
        assignee_user_id: currentUser.id,
      });
      setGrievance(updated);
    } catch (assignError) {
      const message = assignError instanceof Error ? assignError.message : "Unable to assign";
      setError(message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget) {
      setError("Choose a target status before updating.");
      return;
    }

    setError(null);
    setIsUpdatingStatus(true);
    try {
      const updated = await updateGrievanceStatus(grievanceId, {
        status: statusTarget,
        resolution_note: resolutionNote.trim() || undefined,
      });
      setGrievance(updated);
      setStatusTarget("");
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Unable to update status";
      setError(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddComment = async (body: string) => {
    await addGrievanceComment(grievanceId, { body });
    const refreshed = await getGrievanceById(grievanceId);
    setGrievance(refreshed);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading grievance details...
        </div>
      </div>
    );
  }

  if (!grievance) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-[var(--danger)]">
          {error ?? "Unable to locate grievance"}
        </p>
      </div>
    );
  }

  const transitionOptions = allowedTransitions[grievance.status];

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <House className="size-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app">
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/grievances">
              <ArrowLeft className="size-4" />
              Back to grievances
            </Link>
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadDetail()}>
          <RotateCw className="size-4" />
          Reload
        </Button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{grievance.title}</CardTitle>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass[grievance.status]}`}
              >
                {grievance.status.replace("_", " ")}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {grievance.description}
            </p>

            <div className="grid gap-3 rounded-md border border-[var(--border)] bg-white p-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-[var(--foreground)]">Category:</span>{" "}
                {grievance.category}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Anonymous:</span>{" "}
                {grievance.is_anonymous ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Submitted:</span>{" "}
                {new Date(grievance.created_at).toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Assigned to:</span>{" "}
                {grievance.assigned_to_user?.email ?? "Unassigned"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Comments</h3>
              <GrievanceComments
                comments={grievance.comments}
                canComment={canComment}
                onAddComment={handleAddComment}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="surface-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {grievance.status_history.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No history available.</p>
              ) : (
                grievance.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-[var(--foreground)]">
                      {entry.from_status ? `${entry.from_status} -> ` : ""}
                      {entry.to_status}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{entry.note}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {canOperate ? (
            <Card className="surface-card rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Triage actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="secondary" onClick={handleAssignToMe} disabled={isAssigning}>
                  {isAssigning ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserRoundCheck className="size-4" />
                      Assign to me
                    </>
                  )}
                </Button>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Move status</label>
                  <select
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
                    value={statusTarget}
                    onChange={(event) => setStatusTarget(event.target.value as GrievanceStatus | "")}
                  >
                    <option value="">Select transition</option>
                    {transitionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution note</label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    placeholder="Provide resolution details for resolved/closed transitions"
                    value={resolutionNote}
                    onChange={(event) => setResolutionNote(event.target.value)}
                    maxLength={6000}
                  />
                </div>

                <Button onClick={handleUpdateStatus} disabled={isUpdatingStatus || !statusTarget}>
                  {isUpdatingStatus ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="size-4" />
                      Update status
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
