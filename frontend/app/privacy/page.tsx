import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Button>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
          <Lock className="size-3.5 text-[var(--primary)]" />
          Privacy commitment
        </div>
      </div>

      <Card className="surface-card rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="size-6 text-[var(--primary)]" />
            Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
          <p>
            This platform is designed for educational grievance operations and stores only data
            required to authenticate users, manage grievances, and provide operational analytics.
          </p>
          <p>
            Personal profile details are editable by each user through the dashboard. Access to
            protected grievance records is controlled by role-based permissions (student, staff,
            admin) and every sensitive action is logged for accountability.
          </p>
          <p>
            Optional LLM functionality is feature-flagged. When disabled, the system uses baseline
            deterministic methods and does not require external AI provider calls.
          </p>
          <p>
            For institution-specific retention or governance requirements, contact your system
            administrator and update operational policy before production rollout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
