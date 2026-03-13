"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCheck,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Tags,
  UserRoundCheck,
} from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { GrievanceComments } from "@/components/grievance/grievance-comments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  addGrievanceComment,
  assignGrievance,
  getGrievanceById,
  updateGrievanceStatus,
} from "@/lib/grievance-api";
import { analyzeGrievance } from "@/lib/nlp-api";
import { cn } from "@/lib/utils";
import type {
  GrievanceRead,
  GrievanceStatus,
  NLPGrievanceAnalysisResponse,
} from "@/lib/types";

const statusBadgeClass: Record<GrievanceStatus, string> = {
  open: "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950",
  in_progress: "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500",
  resolved: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
  closed: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950",
};

const allowedTransitions: Record<GrievanceStatus, GrievanceStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEntityList(
  entities: Record<string, unknown>,
  key: string,
  limit = 5,
) {
  const value = entities[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, limit);
}

function providerBadge(provider: string) {
  return provider === "groq"
    ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
    : "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500";
}

function urgencyBadge(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500";
  }
  if (normalized === "medium") {
    return "border-amber-500 bg-amber-500 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950";
  }
  return "border-cyan-600 bg-cyan-600 text-white dark:border-cyan-500 dark:bg-cyan-500";
}

export default function WorkspaceGrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const grievanceId = params.id;
  const router = useRouter();
  const { currentUser, hasOperationalRole } = useAppShellContext();
  const toast = useToast();

  const [grievance, setGrievance] = useState<GrievanceRead | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<NLPGrievanceAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<GrievanceStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const canComment = useMemo(() => {
    if (!grievance) {
      return false;
    }
    return hasOperationalRole || currentUser.id === grievance.student_id;
  }, [currentUser.id, grievance, hasOperationalRole]);

  const loadDetail = async () => {
    setIsLoading(true);
    setIsAiLoading(true);
    try {
      const [detailResult, aiResult] = await Promise.allSettled([
        getGrievanceById(grievanceId),
        analyzeGrievance(grievanceId, true),
      ]);

      if (detailResult.status === "rejected") {
        throw detailResult.reason;
      }

      const detail = detailResult.value;
      setGrievance(detail);
      setError(null);
      setStatusTarget("");
      setResolutionNote(detail.resolution_note ?? "");
      setAiAnalysis(aiResult.status === "fulfilled" ? aiResult.value : null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load grievance";
      if (message.toLowerCase().includes("not authenticated")) {
        router.replace("/login");
        return;
      }
      setAiAnalysis(null);
      setError(message);
    } finally {
      setIsLoading(false);
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grievanceId]);

  const handleAssignToMe = async () => {
    setIsAssigning(true);
    try {
      const updated = await assignGrievance(grievanceId, {
        assignee_user_id: currentUser.id,
      });
      setGrievance(updated);
      setError(null);
      toast.success("Assignment complete", "This grievance is now assigned to you.");
    } catch (assignError) {
      const message = assignError instanceof Error ? assignError.message : "Unable to assign";
      toast.error("Assignment failed", message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget) {
      toast.error("Status update blocked", "Choose a target status before updating.");
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const updated = await updateGrievanceStatus(grievanceId, {
        status: statusTarget,
        resolution_note: resolutionNote.trim() || undefined,
      });
      setGrievance(updated);
      setError(null);
      setStatusTarget("");
      toast.success("Status updated", `The grievance moved to ${updated.status.replace("_", " ")}.`);
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Unable to update status";
      toast.error("Status update failed", message);
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading grievance details...
        </div>
      </div>
    );
  }

  if (!grievance) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {error ?? "Unable to locate grievance"}
        </p>
      </div>
    );
  }

  const transitionOptions = allowedTransitions[grievance.status];
  const aiKeywords = aiAnalysis ? getEntityList(aiAnalysis.entities, "keywords", 6) : [];
  const aiDepartments = aiAnalysis ? getEntityList(aiAnalysis.entities, "departments", 4) : [];
  const aiTopics = aiAnalysis ? getEntityList(aiAnalysis.entities, "topics", 4) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{grievance.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the case record, workflow timeline, and collaboration history in one place.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadDetail()}>
          <RotateCw className="size-4" />
          Reload
        </Button>
      </div>

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
            <p className="text-sm leading-relaxed text-muted-foreground">
              {grievance.description}
            </p>

            <div className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Category:</span>{" "}
                {grievance.category}
              </p>
              <p>
                <span className="font-medium text-foreground">Anonymous:</span>{" "}
                {grievance.is_anonymous ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium text-foreground">Submitted:</span>{" "}
                {new Date(grievance.created_at).toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-foreground">Assigned to:</span>{" "}
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
          <Card className="surface-card overflow-hidden rounded-2xl">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-5 text-primary" />
                    AI case brief
                  </CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Detailed analysis of the complaint narrative, likely routing context, and urgency signals.
                  </p>
                </div>
                {aiAnalysis ? (
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      providerBadge(aiAnalysis.provider),
                    )}
                  >
                    {aiAnalysis.provider === "groq" ? "LLM enriched" : "Baseline NLP"}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAiLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Generating case brief...
                </div>
              ) : aiAnalysis ? (
                <>
                  <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
                    <p className="text-sm leading-7 text-foreground/90">{aiAnalysis.summary}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Inferred category
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {titleCase(aiAnalysis.predicted_category)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {Math.round(aiAnalysis.category_confidence * 100)}% confidence
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Workflow signal
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                            urgencyBadge(aiAnalysis.urgency.label),
                          )}
                        >
                          {titleCase(aiAnalysis.urgency.label)} urgency
                        </span>
                        <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                          {titleCase(aiAnalysis.sentiment.label)} tone
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Submitted as {titleCase(aiAnalysis.source_category)}.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <BrainCircuit className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Likely touchpoints</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aiDepartments.length > 0 ? (
                          aiDepartments.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-sky-600 bg-sky-600 px-3 py-1 text-xs font-medium text-white dark:border-sky-500 dark:bg-sky-500"
                            >
                              {titleCase(item)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No department hints detected from the complaint text.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Tags className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Topics and keywords</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[...aiTopics, ...aiKeywords].slice(0, 8).length > 0 ? (
                          [...aiTopics, ...aiKeywords].slice(0, 8).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No additional keywords were extracted from this complaint.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                  AI analysis is not available for this grievance right now.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {grievance.status_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history available.</p>
              ) : (
                grievance.status_history.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {entry.from_status ? `${entry.from_status} -> ` : ""}
                      {entry.to_status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {hasOperationalRole ? (
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
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
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
                    className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="Provide resolution details for resolved or closed transitions"
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
