import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthSession {
  accessToken: string;
  username: string;
  storeId: number;
  storeName: string;
  timezone: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (
    username: string,
    password: string,
    storeName: string,
    email: string,
    country?: string,
    location?: { address?: string; latitude?: number; longitude?: number },
  ) => Promise<void>;
  logout: () => void;
  applyAccessToken: (accessToken: string) => void;
}

const STORAGE_KEY = "shelfmind-session";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function apiBase() {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? "";
}

export class ApiError extends Error {
  suggestions: string[];
  constructor(message: string, suggestions: string[] = []) {
    super(message);
    this.suggestions = suggestions;
  }
}

export function readableError(status: number, body: any): ApiError {
  const detail = body?.detail;
  if (detail && typeof detail === "object") {
    const message = detail.message || JSON.stringify(detail);
    return new ApiError(message, Array.isArray(detail.suggestions) ? detail.suggestions : []);
  }
  if (typeof detail === "string") return new ApiError(detail);
  if (body?.message) return new ApiError(body.message);
  if (status === 401) return new ApiError("Incorrect username or password.");
  return new ApiError(`Request failed (${status}).`);
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const res = await fetch(`${apiBase()}/api/shelfmind${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw readableError(res.status, body);
  }
  return body;
}

export async function checkUsernameAvailability(
  username: string,
): Promise<{ available: boolean; reason: string | null; suggestions: string[] }> {
  const res = await fetch(
    `${apiBase()}/api/shelfmind/auth/username-availability?username=${encodeURIComponent(username)}`,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) throw readableError(res.status, body);
  return body;
}

/** Authenticated JSON request helper for the profile pages (GET/PUT/POST). */
export async function authRequest(
  accessToken: string | undefined,
  method: "GET" | "PUT" | "POST",
  path: string,
  payload?: Record<string, unknown>,
) {
  const res = await fetch(`${apiBase()}/api/shelfmind${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw readableError(res.status, body);
  }
  return body;
}

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    setSession(loadSession());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => sessionRef.current?.accessToken ?? null);
  }, []);

  useEffect(() => {
    if (!session) return;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      if (response.status === 401 && url.includes("/api/shelfmind/")) {
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      }
      return response;
    };
    return () => {
      window.fetch = original;
    };
  }, [session]);

  const persist = (next: AuthSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  };

  const login = async (username: string, password: string) => {
    const body = await postJson("/auth/login", { username, password });

    const payload = JSON.parse(atob(body.access_token.split(".")[1]));
    persist({
      accessToken: body.access_token,
      username: payload.sub,
      storeId: payload.store_id,
      storeName: payload.store_name ?? "Your Store",
      timezone: payload.tz ?? "UTC",
    });
  };

  const signup = async (
    username: string,
    password: string,
    storeName: string,
    email: string,
    country?: string,
    location?: { address?: string; latitude?: number; longitude?: number },
  ) => {
    const body = await postJson("/auth/signup", {
      username,
      password,
      store_name: storeName,
      email,
      country,
      address: location?.address || undefined,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    persist({
      accessToken: body.access_token,
      username: body.username,
      storeId: body.store_id,
      storeName: body.store_name,
      timezone: body.timezone ?? "UTC",
    });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  /** Re-derives the session from a fresh access token (e.g. after a profile
   * update changes the timezone). Keeps the same decode logic as login/signup. */
  const applyAccessToken = (accessToken: string) => {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    persist({
      accessToken,
      username: payload.sub,
      storeId: payload.store_id,
      storeName: payload.store_name ?? sessionRef.current?.storeName ?? "Your Store",
      timezone: payload.tz ?? "UTC",
    });
  };

  const value = useMemo(
    () => ({ session, isAuthenticated: session !== null, isLoading, login, signup, logout, applyAccessToken }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
