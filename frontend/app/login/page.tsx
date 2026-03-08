"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getCurrentUser, loginUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToastBanner } from "@/components/ui/toast-banner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        await getCurrentUser();
        if (isMounted) {
          router.replace("/app");
        }
      } catch {
        // No active session.
      }
    };

    void checkSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginUser({ email: email.trim(), password });
      const fallbackName = email.split("@")[0]?.trim() || email.trim();
      setSuccessToast(`Welcome back, ${fallbackName}. Login successful.`);
      await new Promise((resolve) => setTimeout(resolve, 650));
      router.replace("/app");
    } catch (submitError) {
      const detail =
        submitError instanceof Error ? submitError.message : "Login failed";
      setError(detail);
      setSuccessToast(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 md:px-8">
      {successToast ? <ToastBanner message={successToast} variant="success" /> : null}
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="surface-card hidden rounded-2xl border-2 lg:block">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back to the operations console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-[var(--muted-foreground)]">
            <p>
              Track grievance updates, monitor SLA health, and move quickly from triage to
              resolution with complete auditability.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="mb-1 flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <ShieldCheck className="size-4 text-[var(--primary)]" />
                  Secure by default
                </p>
                <p>JWT auth, role-based controls, and traceable actions.</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="mb-1 flex items-center gap-2 font-medium text-[var(--foreground)]">
                  <Sparkles className="size-4 text-[var(--primary)]" />
                  AI-ready workflow
                </p>
                <p>Baseline NLP works now; optional Groq can be enabled later.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="w-full max-w-xl space-y-3 lg:justify-self-end">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <Card className="surface-card w-full rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <LogIn className="size-6 text-[var(--primary)]" />
                Sign in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                {error ? (
                  <p
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]"
                  >
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
                <p className="text-sm text-[var(--muted-foreground)]">
                  New here?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
