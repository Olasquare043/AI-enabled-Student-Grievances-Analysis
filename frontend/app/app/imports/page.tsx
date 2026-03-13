"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

import { useAppShellContext } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { importGrievancesCsv } from "@/lib/operations-api";
import type { GrievanceCSVImportResponse } from "@/lib/types";

export default function WorkspaceImportsPage() {
  const { isAdmin } = useAppShellContext();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<GrievanceCSVImportResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const firstErrors = useMemo(() => result?.errors.slice(0, 25) ?? [], [result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("Upload blocked", "Select a CSV file before upload.");
      return;
    }

    setResult(null);
    setIsUploading(true);
    try {
      const response = await importGrievancesCsv(selectedFile);
      setResult(response);
      if (response.failed_count > 0) {
        toast.error(
          "Import completed with issues",
          `${response.imported_count} row(s) imported and ${response.failed_count} row(s) failed.`,
        );
      } else {
        toast.success(
          "Import completed",
          `${response.imported_count} grievance row(s) were imported successfully.`,
        );
      }
    } catch (uploadError) {
      const detail =
        uploadError instanceof Error ? uploadError.message : "CSV import failed";
      toast.error("Import failed", detail);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="surface-card rounded-[2rem]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          CSV import is available only to admin users.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">CSV data import</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk ingest grievance records without leaving the shared workspace layout.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UploadCloud className="size-5 text-primary" />
              Upload grievance CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <label className="mb-2 block text-sm font-medium">CSV file</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                  }}
                  className="block w-full text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Required columns: <code>title</code>, <code>description</code>,{" "}
                  <code>category</code>. Optional: <code>is_anonymous</code>,{" "}
                  <code>student_email</code>.
                </p>
              </div>

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
              <FileSpreadsheet className="size-5 text-primary" />
              Template and rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
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
        <Card className="surface-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Import result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card px-3 py-3">
                <p className="text-xs text-muted-foreground">Total rows</p>
                <p className="text-xl font-semibold">{result.total_rows}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-xs text-emerald-700">Imported</p>
                <p className="text-xl font-semibold text-emerald-700">{result.imported_count}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <p className="text-xs text-destructive">Failed</p>
                <p className="text-xl font-semibold text-destructive">{result.failed_count}</p>
              </div>
            </div>

            {firstErrors.length > 0 ? (
              <div className="space-y-2">
                <p className="font-medium">First {firstErrors.length} error(s)</p>
                <div className="space-y-2">
                  {firstErrors.map((item) => (
                    <p
                      key={`${item.row_number}-${item.message}`}
                      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
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
