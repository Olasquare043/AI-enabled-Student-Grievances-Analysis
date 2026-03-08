"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

import { getCurrentUser } from "@/lib/api";
import { importGrievancesCsv } from "@/lib/operations-api";
import type { GrievanceCSVImportResponse, UserRead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function isAdmin(user: UserRead | null) {
  if (!user) {
    return false;
  }
  return user.roles.some((role) => role.name === "admin");
}

export default function ImportsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<GrievanceCSVImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const me = await getCurrentUser();
        if (!isAdmin(me)) {
          router.replace("/app");
          return;
        }
        setCurrentUser(me);
      } catch {
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };
    void loadUser();
  }, [router]);

  const firstErrors = useMemo(() => result?.errors.slice(0, 25) ?? [], [result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Select a CSV file before upload.");
      return;
    }

    setError(null);
    setResult(null);
    setIsUploading(true);
    try {
      const response = await importGrievancesCsv(selectedFile);
      setResult(response);
    } catch (uploadError) {
      const detail =
        uploadError instanceof Error ? uploadError.message : "CSV import failed";
      setError(detail);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Loading import workspace...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">CSV Data Import</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Admin-only upload for bulk grievance ingestion through the live API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UploadCloud className="size-5 text-[var(--primary)]" />
              Upload grievance CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-xl border border-[var(--border)] bg-white/70 p-4">
                <label className="mb-2 block text-sm font-medium">CSV file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    setError(null);
                  }}
                  className="block w-full text-sm"
                />
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Required columns: <code>title</code>, <code>description</code>,{" "}
                  <code>category</code>. Optional: <code>is_anonymous</code>,{" "}
                  <code>student_email</code>.
                </p>
              </div>

              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-4" />
                      Upload CSV
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setResult(null);
                    setError(null);
                  }}
                >
                  <RefreshCw className="size-4" />
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="size-5 text-[var(--primary)]" />
              Template and rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <p>Use the prepared template to avoid formatting errors.</p>
            <Button asChild variant="outline">
              <a href="/grievances_import_template.csv" download>
                Download CSV template
              </a>
            </Button>
            <p>Maximum rows per upload: 5000.</p>
            <p>
              If <code>student_email</code> is provided, it must match an existing user email.
            </p>
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card className="surface-card mt-6 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Import result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-3">
                <p className="text-xs text-[var(--muted-foreground)]">Total rows</p>
                <p className="text-xl font-semibold">{result.total_rows}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-xs text-emerald-700">Imported</p>
                <p className="text-xl font-semibold text-emerald-700">{result.imported_count}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <p className="text-xs text-[var(--danger)]">Failed</p>
                <p className="text-xl font-semibold text-[var(--danger)]">{result.failed_count}</p>
              </div>
            </div>

            {firstErrors.length > 0 ? (
              <div className="space-y-2">
                <p className="font-medium">First {firstErrors.length} error(s)</p>
                <div className="space-y-2">
                  {firstErrors.map((item) => (
                    <p
                      key={`${item.row_number}-${item.message}`}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[var(--danger)]"
                    >
                      Row {item.row_number}: {item.message}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
