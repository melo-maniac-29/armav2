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
  has_openai_key: boolean;
  openai_api_base: string | null;
  embed_api_base: string | null;
  embedding_model: string | null;
  analysis_model: string | null;
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

  saveOpenAIKey: (token: string, openai_key: string) =>
    request<SettingsResponse>("/settings/openai-key", {
      method: "PUT",
      body: JSON.stringify({ openai_key }),
    }, token),

  deleteOpenAIKey: (token: string) =>
    request<SettingsResponse>("/settings/openai-key", {
      method: "DELETE",
    }, token),

  saveApiBase: (token: string, api_base: string) =>
    request<SettingsResponse>("/settings/openai-api-base", {
      method: "PUT",
      body: JSON.stringify({ api_base }),
    }, token),

  saveEmbedApiBase: (token: string, embed_api_base: string) =>
    request<SettingsResponse>("/settings/embed-api-base", {
      method: "PUT",
      body: JSON.stringify({ embed_api_base }),
    }, token),

  saveEmbeddingModel: (token: string, embedding_model: string) =>
    request<SettingsResponse>("/settings/embedding-model", {
      method: "PUT",
      body: JSON.stringify({ embedding_model }),
    }, token),

  saveAnalysisModel: (token: string, analysis_model: string) =>
    request<SettingsResponse>("/settings/analysis-model", {
      method: "PUT",
      body: JSON.stringify({ analysis_model }),
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
  webhook_secret: string | null;
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

  reindex: (token: string, id: string) =>
    request<{ detail: string }>(`/repos/${id}/reindex`, { method: "POST" }, token),
};

// --- Issues ---
export interface IssueOut {
  id: string;
  repo_id: string;
  run_id: string;
  file_path: string;
  line_number: number | null;
  severity: "info" | "warning" | "error" | "critical";
  issue_type: "bug" | "security" | "performance" | "style" | "other";
  title: string;
  description: string;
  status: "open" | "dismissed" | "fixed";
  created_at: string;
}

export interface IssueListResponse {
  issues: IssueOut[];
  total: number;
  by_severity: Record<string, number>;
}

export const issuesApi = {
  analyze: (token: string, repoId: string) =>
    request<{ detail: string; repo_id: string }>(
      `/repos/${repoId}/analyze`,
      { method: "POST" },
      token
    ),

  list: (token: string, repoId: string, params?: { status?: string; severity?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("issue_status", params.status);
    if (params?.severity) qs.set("severity", params.severity);
    const q = qs.toString() ? `?${qs}` : "";
    return request<IssueListResponse>(`/repos/${repoId}/issues${q}`, {}, token);
  },

  patch: (token: string, repoId: string, issueId: string, issueStatus: string) =>
    request<IssueOut>(
      `/repos/${repoId}/issues/${issueId}`,
      { method: "PATCH", body: JSON.stringify({ status: issueStatus }) },
      token
    ),

  fix: (token: string, repoId: string, issueId: string) =>
    request<PrJobOut>(`/repos/${repoId}/issues/${issueId}/fix`, { method: "POST" }, token),
};

// --- PR Jobs ---
export interface PrJobOut {
  id: string;
  repo_id: string;
  issue_id: string;
  branch_name: string | null;
  patch_text: string | null;
  status: "pending" | "generating" | "sandboxing" | "pushing" | "pr_opened" | "failed";
  error_msg: string | null;
  sandbox_log: string | null;
  sandbox_result: "passed" | "failed" | "skipped" | null;
  github_pr_number: number | null;
  github_pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrJobListResponse {
  jobs: PrJobOut[];
  total: number;
}

export const prJobsApi = {
  list: (token: string, repoId: string) =>
    request<PrJobListResponse>(`/repos/${repoId}/pr-jobs`, {}, token),

  get: (token: string, repoId: string, jobId: string) =>
    request<PrJobOut>(`/repos/${repoId}/pr-jobs/${jobId}`, {}, token),
};

// --- Feature Requests ---
export interface FeatureRequestOut {
  id: string;
  repo_id: string;
  user_id: string;
  description: string;
  branch_name: string | null;
  plan_json: string | null;
  patches_json: string | null;
  status: "pending" | "planning" | "coding" | "sandboxing" | "pushing" | "pr_opened" | "failed";
  error_msg: string | null;
  sandbox_log: string | null;
  sandbox_result: "passed" | "failed" | "skipped" | null;
  github_pr_number: number | null;
  github_pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureRequestListResponse {
  requests: FeatureRequestOut[];
  total: number;
}

export const featureRequestsApi = {
  list: (token: string, repoId: string) =>
    request<FeatureRequestListResponse>(`/repos/${repoId}/feature-requests`, {}, token),

  get: (token: string, repoId: string, frId: string) =>
    request<FeatureRequestOut>(`/repos/${repoId}/feature-requests/${frId}`, {}, token),

  create: (token: string, repoId: string, description: string) =>
    request<FeatureRequestOut>(
      `/repos/${repoId}/feature-requests`,
      { method: "POST", body: JSON.stringify({ description }) },
      token,
    ),
};

// --- Dashboard ---
export interface DashboardSummary {
  repos_total: number;
  issues_open: number;
  prs_opened: number;
}

export const dashboardApi = {
  summary: (token: string) =>
    request<DashboardSummary>("/dashboard/summary", {}, token),
};

// --- Search ---
export interface SearchResult {
  file_path: string;
  chunk_name: string;
  chunk_type: string;
  chunk_text: string;
  similarity: number;
}

export const searchApi = {
  query: (token: string, repoId: string, q: string, limit = 10) =>
    request<SearchResult[]>(
      `/repos/${repoId}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {},
      token
    ),
};
