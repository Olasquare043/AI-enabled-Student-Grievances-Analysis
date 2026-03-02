"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, LoaderCircle, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GrievanceCreateRequest } from "@/lib/types";

type GrievanceFormProps = {
  onCreate: (payload: GrievanceCreateRequest) => Promise<void>;
};

const categoryOptions = [
  "ict",
  "bursary",
  "registry",
  "hostel",
  "security",
  "academic",
  "welfare",
  "other",
];

export function GrievanceForm({ onCreate }: GrievanceFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ict");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload: GrievanceCreateRequest = {
      title: title.trim(),
      description: description.trim(),
      category,
      is_anonymous: isAnonymous,
    };

    if (payload.title.length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }

    if (payload.description.length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(payload);
      setTitle("");
      setDescription("");
      setCategory("ict");
      setIsAnonymous(false);
    } catch (submitError) {
      const detail =
        submitError instanceof Error ? submitError.message : "Failed to submit grievance";
      setError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="grievance-title">Title</Label>
        <Input
          id="grievance-title"
          placeholder="Short summary of your grievance"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="grievance-category">Category</Label>
        <select
          id="grievance-category"
          className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grievance-description">Description</Label>
        <textarea
          id="grievance-description"
          className="min-h-28 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="Describe what happened and any timeline details"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          minLength={10}
          maxLength={6000}
        />
      </div>

      <label
        htmlFor="grievance-anonymous"
        className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-tint)]/40 p-3 text-sm"
      >
        <input
          id="grievance-anonymous"
          type="checkbox"
          className="mt-0.5 size-4"
          checked={isAnonymous}
          onChange={(event) => setIsAnonymous(event.target.checked)}
        />
        <span>
          Submit anonymously (staff can still resolve your case, but your identity is hidden in
          most views).
        </span>
      </label>

      {error ? (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <SendHorizonal className="size-4" />
            Submit grievance
          </>
        )}
      </Button>
    </form>
  );
}
