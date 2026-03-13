import { BrainCircuit } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopicClusterInsight } from "@/lib/types";

type TopicClustersProps = {
  clusters: TopicClusterInsight[];
};

export function TopicClusters({ clusters }: TopicClustersProps) {
  return (
    <Card className="surface-card rounded-[2rem]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BrainCircuit className="size-5 text-primary" />
          Topic clusters and recurring themes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clusters.map((cluster) => (
          <div
            key={cluster.cluster_id}
            className="rounded-[1.5rem] border border-border/70 bg-background/70 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                Cluster #{cluster.cluster_id} ({cluster.size} grievance(s))
              </p>
              <p className="text-xs text-muted-foreground">
                Members: {cluster.member_ids.length}
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Keywords: {cluster.top_keywords.join(", ") || "n/a"}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {cluster.sample_titles.map((title, index) => (
                <li
                  key={`${cluster.cluster_id}-${index}`}
                  className="rounded-2xl bg-muted px-3 py-2"
                >
                  {title}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {clusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clusters available in the selected time window.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
