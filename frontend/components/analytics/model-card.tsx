import { FlaskConical } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsModelCardResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function pct(value?: number | null, digits = 1) {
  return value === undefined || value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ModelCard({ card }: { card: AnalyticsModelCardResponse }) {
  if (!card.available) {
    return (
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Trained models are not installed; the system is using the baseline centroid classifier.
        </CardContent>
      </Card>
    );
  }

  const detected = card.topics.events?.filter((event) => event.detected).length ?? 0;
  const planted = card.topics.events?.length ?? 0;

  return (
    <Card className="surface-card rounded-[2rem]">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FlaskConical className="size-5 text-primary" />
          AI model performance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Deployed model: <strong>{card.model}</strong>, trained on {card.trained_on.train ?? "?"} and tested on{" "}
          {card.trained_on.test ?? "?"} held-out grievances. Auto-routing threshold:{" "}
          {pct(card.auto_route_threshold, 0)} confidence.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Auto-routed"
            value={`${card.live.auto_route_rate_percent}%`}
            hint={`${card.live.auto_routed} of ${card.live.triaged_grievances} triaged grievances`}
          />
          <Stat
            label="Staff corrections"
            value={`${card.live.override_rate_percent}%`}
            hint={`${card.live.category_overrides} category overrides of auto-routed cases`}
          />
          <Stat
            label="Agrees with student"
            value={
              card.live.agreement_with_student_percent === null ||
              card.live.agreement_with_student_percent === undefined
                ? "—"
                : `${card.live.agreement_with_student_percent}%`
            }
            hint="Share of predictions matching the category the student picked"
          />
          <Stat
            label="Emerging issues found"
            value={`${detected}/${planted}`}
            hint={`Planted issues detected by LDA (k = ${card.topics.best_k ?? "?"}) in evaluation`}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="mb-2 text-left text-xs text-muted-foreground">
              Category classification on the held-out test set (macro averages).
            </caption>
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3 text-right">CV macro-F1</th>
                <th className="py-2 pr-3 text-right">Accuracy</th>
                <th className="py-2 pr-3 text-right">Precision</th>
                <th className="py-2 pr-3 text-right">Recall</th>
                <th className="py-2 text-right">Macro-F1</th>
              </tr>
            </thead>
            <tbody>
              {card.models.map((model) => (
                <tr
                  key={model.name}
                  className={cn(
                    "border-b border-border/40",
                    model.name === card.model && "bg-primary/10 font-semibold",
                  )}
                >
                  <td className="py-2 pr-3">
                    {model.name}
                    {model.name === card.model ? " (deployed)" : ""}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(model.cv_macro_f1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(model.accuracy)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(model.macro_precision)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(model.macro_recall)}</td>
                  <td className="py-2 text-right tabular-nums">{pct(model.macro_f1)}</td>
                </tr>
              ))}
              <tr className="text-muted-foreground">
                <td className="py-2 pr-3">Student self-selected category</td>
                <td className="py-2 pr-3 text-right">—</td>
                <td className="py-2 pr-3 text-right tabular-nums">{pct(card.student_self_selection_accuracy)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm">
            <p className="font-semibold">Urgency detection</p>
            <p className="mt-1 text-muted-foreground">
              Supervised model {pct(card.urgency.supervised?.accuracy)} accuracy (
              {pct(card.urgency.supervised?.within_one_level)} within one level) vs keyword rules{" "}
              {pct(card.urgency.lexicon?.accuracy)}.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm">
            <p className="font-semibold">Explanation faithfulness</p>
            <p className="mt-1 text-muted-foreground">
              Removing the top {card.explainability.k ?? 3} explained words lowers confidence by{" "}
              {pct(card.explainability.mean_prob_drop_shap)} vs {pct(card.explainability.mean_prob_drop_random)} for
              random words (Wilcoxon p{" "}
              {card.explainability.wilcoxon_p_value === undefined
                ? "n/a"
                : card.explainability.wilcoxon_p_value < 0.001
                  ? "< 0.001"
                  : `= ${card.explainability.wilcoxon_p_value.toFixed(3)}`}
              ).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
