import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserProfileUpdateRequest,
  UserRead,
} from "@/lib/types";

export const REQUEST_TIMEOUT_MS = 15000;

export function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8000";
}

export async function apiRequest<T>(
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
      throw new Error(
        `Request timed out. Ensure backend is running at ${apiBaseUrl}.`,
      );
    }
    throw new Error(
      `Unable to reach backend API at ${apiBaseUrl}. Start backend server and retry.`,
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
