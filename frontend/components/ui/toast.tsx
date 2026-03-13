"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastRecord = ToastInput & {
  id: number;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastTone(variant: ToastVariant) {
  if (variant === "error") {
    return {
      icon: XCircle,
      wrapper:
        "border-destructive/25 bg-card/96 text-card-foreground shadow-[0_18px_50px_rgba(239,68,68,0.18)]",
      iconWrap: "bg-destructive text-destructive-foreground",
      accent: "bg-destructive",
    };
  }

  if (variant === "info") {
    return {
      icon: Info,
      wrapper:
        "border-primary/25 bg-card/96 text-card-foreground shadow-[0_18px_50px_rgba(14,165,233,0.18)]",
      iconWrap: "bg-primary text-primary-foreground",
      accent: "bg-primary",
    };
  }

  return {
    icon: CheckCircle2,
    wrapper:
      "border-emerald-500/25 bg-card/96 text-card-foreground shadow-[0_18px_50px_rgba(16,185,129,0.18)]",
    iconWrap: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white",
    accent: "bg-emerald-500",
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const toastIdRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ variant = "info", duration = 4200, ...toast }: ToastInput) => {
      const id = ++toastIdRef.current;
      const record: ToastRecord = {
        id,
        variant,
        duration,
        ...toast,
      };

      setToasts((current) => [...current, record]);

      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);

      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (title, message, duration) =>
        showToast({ title, message, duration, variant: "success" }),
      error: (title, message, duration) =>
        showToast({ title, message, duration, variant: "error" }),
      info: (title, message, duration) =>
        showToast({ title, message, duration, variant: "info" }),
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-4 top-4 z-[140] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-md"
      >
        {toasts.map((toast) => {
          const tone = toastTone(toast.variant);
          const Icon = tone.icon;

          return (
            <div
              key={toast.id}
              role={toast.variant === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto relative w-full overflow-hidden rounded-[1.35rem] border backdrop-blur-xl animate-fade-in",
                tone.wrapper,
              )}
            >
              <div className={cn("absolute inset-y-0 left-0 w-1.5", tone.accent)} />
              <div className="flex items-start gap-3 px-4 py-4">
                <div
                  className={cn(
                    "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl",
                    tone.iconWrap,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight">{toast.title}</p>
                  {toast.message ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{toast.message}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
