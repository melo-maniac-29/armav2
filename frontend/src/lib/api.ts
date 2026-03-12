const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth ---
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  is_active: boolean;
}

export const authApi = {
  register: (email: string, password: string) =>
    request<UserResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refresh_token: string) =>
    request<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  me: (token: string) =>
    request<UserResponse>("/auth/me", {}, token),
};

// --- Settings ---
export interface SettingsResponse {
  has_github_token: boolean;
}

export const settingsApi = {
  get: (token: string) =>
    request<SettingsResponse>("/settings", {}, token),

  savePat: (token: string, github_token: string) =>
    request<SettingsResponse>("/settings/github-token", {
      method: "PUT",
      body: JSON.stringify({ github_token }),
    }, token),

  deletePat: (token: string) =>
    request<SettingsResponse>("/settings/github-token", {
      method: "DELETE",
    }, token),
};
