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

// --- GitHub ---
export interface GithubRepoItem {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  clone_url: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string | null;
}

export const githubApi = {
  repos: (token: string) =>
    request<GithubRepoItem[]>("/github/repos", {}, token),
};

// --- Repos ---
export interface RepoOut {
  id: string;
  github_id: number;
  full_name: string;
  default_branch: string;
  status: "pending" | "cloning" | "parsing" | "ready" | "error";
  error_msg: string | null;
  created_at: string;
}

export interface RepoFileOut {
  id: string;
  path: string;
  language: string | null;
  size_bytes: number | null;
}

export const reposApi = {
  list: (token: string) =>
    request<RepoOut[]>("/repos", {}, token),

  connect: (
    token: string,
    body: { github_id: number; full_name: string; clone_url: string; default_branch: string }
  ) => request<RepoOut>("/repos", { method: "POST", body: JSON.stringify(body) }, token),

  get: (token: string, id: string) =>
    request<RepoOut>(`/repos/${id}`, {}, token),

  delete: (token: string, id: string) =>
    request<void>(`/repos/${id}`, { method: "DELETE" }, token),

  files: (token: string, id: string) =>
    request<RepoFileOut[]>(`/repos/${id}/files`, {}, token),
};
