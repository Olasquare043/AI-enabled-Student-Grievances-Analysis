"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  ShieldCheck,
  UserRoundPlus,
  Workflow,
} from "lucide-react";

import { getCurrentUser, loginUser, registerUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (password !== confirmPassword) {
      toast.error("Registration failed", "Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanedFirstName = firstName.trim();
      const cleanedLastName = lastName.trim();
      const cleanedMatricNumber = matricNumber.trim().toUpperCase();

      await registerUser({
        email: email.trim(),
        first_name: cleanedFirstName,
        last_name: cleanedLastName,
        matric_number: cleanedMatricNumber,
        password,
      });
      await loginUser({ email: email.trim(), password });
      toast.success("Account created", `Welcome ${cleanedFirstName}, your account is ready.`);
      await new Promise((resolve) => setTimeout(resolve, 650));
      router.replace("/app");
    } catch (submitError) {
      const detail =
        submitError instanceof Error ? submitError.message : "Registration failed";
      toast.error("Registration failed", detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-start px-4 py-6 md:px-8 md:py-8 lg:items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="surface-card hidden rounded-2xl border-2 lg:block">
          <CardHeader>
            <CardTitle className="text-2xl">Create your grievance account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <p>
              Registration is lightweight and secure. You can complete extra academic profile
              details later inside the dashboard.
            </p>
            <p>
              Staff and admin accounts are provisioned from the internal admin workspace, not
              through this public registration page.
            </p>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
                <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Role-safe onboarding
                </p>
                <p>New users start as students with protected access boundaries.</p>
              </div>
              <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
                <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Workflow className="size-4 text-primary" />
                  Ready for workflow
                </p>
                <p>Submit grievances, track status changes, and collaborate through comments.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="w-full max-w-xl space-y-3 lg:justify-self-end">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <Card className="surface-card w-full rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <UserRoundPlus className="size-6 text-primary" />
                Register account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matric-number">Matric number</Label>
                  <Input
                    id="matric-number"
                    type="text"
                    value={matricNumber}
                    onChange={(event) => setMatricNumber(event.target.value)}
                    required
                    maxLength={50}
                  />
                </div>
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
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Already registered?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
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
