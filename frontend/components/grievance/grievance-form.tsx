"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import type { GrievanceCreateRequest, GrievanceRead } from "@/lib/types";

type GrievanceFormProps = {
  onCreate: (payload: GrievanceCreateRequest) => Promise<GrievanceRead | void>;
};

// An empty value lets the AI triage model choose the category.
const categoryOptions: { value: string; label: string }[] = [
  { value: "", label: "Not sure – let the system decide" },
  { value: "academic", label: "Academic (results, lectures, exams)" },
  { value: "bursary", label: "Bursary (fees, payments, refunds)" },
  { value: "registry", label: "Registry (records, transcripts, clearance)" },
  { value: "ict", label: "ICT (portal, network, e-learning)" },
  { value: "hostel", label: "Hostel (accommodation, facilities)" },
  { value: "security", label: "Security (safety, theft, harassment)" },
  { value: "welfare", label: "Welfare (health, counselling, support)" },
];

export function GrievanceForm({ onCreate }: GrievanceFormProps) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: GrievanceCreateRequest = {
      title: title.trim(),
      description: description.trim(),
      category: category || undefined,
      is_anonymous: isAnonymous,
    };

    if (payload.title.length < 3) {
      toast.error("Submission blocked", "Title must be at least 3 characters.");
      return;
    }

    if (payload.description.length < 10) {
      toast.error("Submission blocked", "Description must be at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreate(payload);
      setTitle("");
      setDescription("");
      setCategory("");
      setIsAnonymous(false);
      toast.success(
        "Grievance submitted",
        created?.auto_routed && created.department
          ? `Automatically routed to ${created.department.name}.`
          : "Your grievance is in the intake queue for review by staff.",
      );
    } catch (submitError) {
      const detail =
        submitError instanceof Error ? submitError.message : "Failed to submit grievance";
      toast.error("Submission failed", detail);
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
        <Label htmlFor="grievance-category">Category (optional)</Label>
        <select
          id="grievance-category"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grievance-description">Description</Label>
        <textarea
          id="grievance-description"
          className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
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
        className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm"
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
