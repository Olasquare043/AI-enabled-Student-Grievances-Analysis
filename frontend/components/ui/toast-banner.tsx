import { CheckCircle2, XCircle } from "lucide-react";

type ToastBannerProps = {
  message: string;
  variant?: "success" | "error";
};

export function ToastBanner({ message, variant = "success" }: ToastBannerProps) {
  const isSuccess = variant === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-4 z-[100] flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

