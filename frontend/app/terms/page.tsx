import Link from "next/link";
import { ArrowLeft, FileText, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
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
          <FileText className="size-3.5 text-[var(--primary)]" />
          Usage terms
        </div>
      </div>

      <Card className="surface-card rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Scale className="size-6 text-[var(--primary)]" />
            Terms of Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
          <p>
            The grievance platform is intended for legitimate academic support and institutional
            complaint management. Users must provide accurate information and use respectful,
            factual language while submitting or processing grievances.
          </p>
          <p>
            Role permissions are strictly enforced. Students may access only their own grievance
            records. Staff and admins are responsible for handling sensitive data according to
            internal governance and applicable institutional policy.
          </p>
          <p>
            Unauthorized access attempts, data manipulation, and misuse of administrative controls
            are prohibited and may result in account suspension and further disciplinary action.
          </p>
          <p>
            Institutional administrators retain responsibility for final policy, data retention,
            and compliance obligations in their deployment environment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
