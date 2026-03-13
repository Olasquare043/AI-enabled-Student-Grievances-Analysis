import Link from "next/link";
import { ArrowLeft, Headset, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Button>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Headset className="size-3.5 text-primary" />
          Support channel
        </div>
      </div>

      <Card className="surface-card rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MessageSquareText className="size-6 text-primary" />
            Contact and Support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Need deployment support, policy configuration help, or technical troubleshooting for
            this grievance platform?
          </p>
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <p className="font-medium text-foreground">Official support channel</p>
            <p className="mt-1">
              Use the grievance portal for support requests so each issue is tracked with audit,
              routing, and SLA visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/register">Create account</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/grievances">Open grievances</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
