const ACCESS_TOKEN_KEY = "grievance_access_token";

function isBrowser() {
  return typeof window !== "undefined";
}

export function setAccessToken(token: string) {
  if (!isBrowser()) {
    return;
  }
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  if (!isBrowser()) {
    return;
  }
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

