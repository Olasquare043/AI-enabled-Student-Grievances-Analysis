"use client";

import { useState } from "react";
import { Bot, LoaderCircle, PencilLine, ShieldCheck, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { overrideGrievanceCategory } from "@/lib/grievance-api";
import type { GrievanceRead } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = ["academic", "bursary", "registry", "ict", "hostel", "security", "welfare"];

const priorityClass: Record<string, string> = {
  P1: "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500",
  P2: "border-orange-500 bg-orange-500 text-white dark:border-orange-400 dark:bg-orange-400 dark:text-slate-950",
  P3: "border-amber-400 bg-amber-400 text-slate-950",
  P4: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

const priorityMeaning: Record<string, string> = {
  P1: "Critical – act immediately",
  P2: "High – act today",
  P3: "Medium – within SLA",
  P4: "Low – routine",
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type AiTriagePanelProps = {
  grievance: GrievanceRead;
  canOverride: boolean;
  onUpdated: (grievance: GrievanceRead) => void;
};

export function AiTriagePanel({ grievance, canOverride, onUpdated }: AiTriagePanelProps) {
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const explanation = grievance.ai_explanation ?? {};

  if (!grievance.predicted_category && !grievance.priority) {
    return null;
  }

  const confidence = grievance.category_confidence ?? 0;
  const threshold = explanation.threshold ?? null;
  const terms = explanation.top_terms ?? [];
  const maxWeight = Math.max(...terms.map((item) => item.weight), 0.0001);
  const studentCategory = explanation.student_category;

  const handleOverride = async () => {
    if (!target) {
      return;
    }
    setIsSaving(true);
    try {
      const updated = await overrideGrievanceCategory(grievance.id, { category: target });
      onUpdated(updated);
      setTarget("");
      toast.success("Category corrected", "The correction has been recorded for model monitoring.");
    } catch (error) {
      toast.error("Correction failed", error instanceof Error ? error.message : "Unable to update category");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="surface-card rounded-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-5 text-primary" />
          AI triage decision
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Recorded when the grievance was submitted{explanation.model ? ` (${explanation.model})` : ""}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Predicted category
            </p>
            <p className="mt-1 text-lg font-semibold">
              {grievance.predicted_category ? titleCase(grievance.predicted_category) : "—"}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(confidence * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(confidence * 100)}% confidence
              {threshold !== null ? ` · auto-route threshold ${Math.round(threshold * 100)}%` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Priority</p>
            <div className="mt-1 flex items-center gap-2">
              {grievance.priority ? (
                <span className={cn("rounded-full border px-3 py-0.5 text-sm font-semibold", priorityClass[grievance.priority])}>
                  {grievance.priority}
                </span>
              ) : null}
              <span className="text-sm">{grievance.priority ? priorityMeaning[grievance.priority] : "—"}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Urgency {grievance.urgency_label ?? "unknown"} · tone {grievance.sentiment_label ?? "unknown"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
          {grievance.auto_routed ? (
            <>
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>
                Auto-routed to <strong>{grievance.department?.name ?? "department"}</strong> because confidence
                met the threshold.
              </span>
            </>
          ) : (
            <>
              <UserRoundCog className="size-4 text-amber-600" />
              <span>
                {grievance.department
                  ? `Routed to ${grievance.department.name} by staff.`
                  : "Held for human review: confidence was below the auto-route threshold."}
              </span>
            </>
          )}
          {studentCategory ? (
            <span className="text-xs text-muted-foreground">
              Student selected: {studentCategory === "other" ? "not sure" : titleCase(studentCategory)}.
            </span>
          ) : null}
        </div>

        {terms.length > 0 ? (
          <div>
            <p className="mb-2 font-medium">Why this category (words that pushed the decision)</p>
            <ul className="space-y-1.5">
              {terms.map((item) => (
                <li key={item.term} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-2">
                  <span className="truncate font-mono text-xs">{item.term}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span
                      className="block h-2 rounded-full bg-sky-600 dark:bg-sky-500"
                      style={{ width: `${Math.max(6, (item.weight / maxWeight) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">{item.weight.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Contribution = model weight × (term value − average term value), i.e. exact SHAP values for a linear model.
            </p>
          </div>
        ) : null}

        {explanation.topic_words && explanation.topic_words.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Topic #{grievance.topic_id}: {explanation.topic_words.join(", ")}
          </p>
        ) : null}

        {canOverride ? (
          <div className="space-y-2 border-t border-border/70 pt-3">
            <label className="flex items-center gap-2 font-medium" htmlFor="category-override">
              <PencilLine className="size-4" />
              Correct the category
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                id="category-override"
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">Current: {titleCase(grievance.category)}</option>
                {CATEGORIES.filter((item) => item !== grievance.category).map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={handleOverride} disabled={!target || isSaving}>
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Save correction
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Corrections are audited and feed the override-rate metric on the analytics page. Use Operations to re-route.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
