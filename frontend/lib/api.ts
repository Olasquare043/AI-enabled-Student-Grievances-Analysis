import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserProfileUpdateRequest,
  UserRead,
} from "@/lib/types";

export const REQUEST_TIMEOUT_MS = 25000;

function normalizeApiBaseUrl(apiBaseUrl: string) {
  if (apiBaseUrl.startsWith("/")) {
    return apiBaseUrl.replace(/\/$/, "");
  }

  try {
    const normalizedUrl = new URL(apiBaseUrl);
    if (normalizedUrl.hostname === "localhost") {
      normalizedUrl.hostname = "127.0.0.1";
    }
    return normalizedUrl.toString().replace(/\/$/, "");
  } catch {
    return apiBaseUrl.replace(/\/$/, "");
  }
}

export function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    return normalizeApiBaseUrl(apiBaseUrl);
  }
  return "/api";
}

// The free hosting tier puts the API to sleep when idle; waking takes up to a
// minute. Safe requests (reads and login) are retried through that window.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_ATTEMPTS = 4;
const RETRY_DELAY_MS = 5000;

function isRetryable(path: string, options: RequestInit) {
  const method = (options.method ?? "GET").toUpperCase();
  return method === "GET" || path === "/auth/login";
}

class RetryableRequestError extends Error {}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const attempts = isRetryable(path, options) ? RETRY_ATTEMPTS : 1;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await apiRequestOnce<T>(path, options);
    } catch (error) {
      if (!(error instanceof RetryableRequestError) || attempt >= attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export function warmUpBackend() {
  void fetch(`${getApiBaseUrl()}/health`, { cache: "no-store" }).catch(() => undefined);
}

async function apiRequestOnce<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const apiBaseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RetryableRequestError(
        `Request timed out. The server may be waking up; please retry in a moment.`,
      );
    }
    throw new RetryableRequestError(
      `Unable to reach backend API at ${apiBaseUrl}. Ensure the backend service is running and retry.`,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const isJsonResponse = contentType?.includes("application/json");
  const payload = isJsonResponse ? await response.json() : null;

  if (!response.ok) {
    const detail = payload?.detail ?? "Request failed";
    if (RETRYABLE_STATUS.has(response.status)) {
      throw new RetryableRequestError(detail);
    }
    throw new Error(detail);
  }

  return payload as T;
}

export async function registerUser(payload: RegisterRequest): Promise<UserRead> {
  return apiRequest<UserRead>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginRequest): Promise<TokenResponse> {
  const tokenPayload = await apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(tokenPayload.access_token);
  return tokenPayload;
}

export async function getCurrentUser(): Promise<UserRead> {
  return apiRequest<UserRead>("/auth/me");
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>("/auth/logout", {
    method: "POST",
  });
  clearAccessToken();
}

export async function updateMyProfile(
  payload: UserProfileUpdateRequest,
): Promise<UserRead> {
  return apiRequest<UserRead>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
