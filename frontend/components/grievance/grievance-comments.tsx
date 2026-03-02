"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle, MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { GrievanceCommentRead } from "@/lib/types";

type GrievanceCommentsProps = {
  comments: GrievanceCommentRead[];
  onAddComment: (body: string) => Promise<void>;
  canComment: boolean;
};

function formatAuthor(comment: GrievanceCommentRead) {
  const firstName = comment.user?.first_name?.trim();
  const lastName = comment.user?.last_name?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }
  return comment.user?.email ?? "Unknown user";
}

export function GrievanceComments({
  comments,
  onAddComment,
  canComment,
}: GrievanceCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const body = newComment.trim();
    if (!body) {
      setError("Comment cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddComment(body);
      setNewComment("");
    } catch (submitError) {
      const detail =
        submitError instanceof Error ? submitError.message : "Unable to post comment";
      setError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {sortedComments.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-tint)]/40 px-3 py-4 text-sm text-[var(--muted-foreground)]">
            No comments yet.
          </p>
        ) : (
          sortedComments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-[var(--border)] bg-white p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--foreground)]">{formatAuthor(comment)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{comment.body}</p>
            </article>
          ))
        )}
      </div>

      {canComment ? (
        <form className="space-y-2" onSubmit={handleSubmit}>
          <Label htmlFor="new-comment">Add comment</Label>
          <textarea
            id="new-comment"
            className="min-h-24 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            placeholder="Add context, updates, or follow-up questions"
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            maxLength={5000}
          />
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <MessageSquarePlus className="size-4" />
                Post comment
              </>
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
