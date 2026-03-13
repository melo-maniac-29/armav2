"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { githubApi, reposApi, GithubRepoItem, RepoOut, ApiError } from "@/lib/api";

type Tab = "connected" | "browse";

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-[#F9F9F9] text-black border-black border",
  cloning: "bg-blue-50 text-blue-600 border-blue-200 border",
  parsing: "bg-blue-50 text-blue-600 border-blue-200 border",
  indexing: "bg-blue-50 text-blue-600 border-blue-200 border",
  pending: "bg-[#F9F9F9] text-black/40 border-black/10 border",
  error: "bg-red-50 text-red-600 border-red-200 border",
};

function StatusBadge({ status }: { status: string }) {
  const pulse = status === "cloning" || status === "parsing" || status === "indexing";
  return (
    <span
      className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      {status}
    </span>
  );
}

export default function ReposPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("connected");
  const [connected, setConnected] = useState<RepoOut[]>([]);
  const [github, setGithub] = useState<GithubRepoItem[]>([]);
  const [loadingConnected, setLoadingConnected] = useState(true);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchConnected = useCallback(async () => {
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const data = await reposApi.list(access);
      setConnected(data);
    } catch {
      // silent
    } finally {
      setLoadingConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchConnected();
  }, [fetchConnected]);

  useEffect(() => {
    const processing = connected.filter(
      (r) => r.status === "pending" || r.status === "cloning" || r.status === "parsing" || r.status === "indexing"
    );
    if (processing.length === 0) return;
    const timer = setTimeout(fetchConnected, 3000);
    return () => clearTimeout(timer);
  }, [connected, fetchConnected]);

  async function loadGithub() {
    setLoadingGithub(true);
    setError(null);
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const data = await githubApi.repos(access);
      setGithub(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load GitHub repos");
    } finally {
      setLoadingGithub(false);
    }
  }

  function switchTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "browse" && github.length === 0) loadGithub();
  }

  async function handleConnect(repo: GithubRepoItem) {
    setConnecting(repo.id);
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const created = await reposApi.connect(access, {
        github_id: repo.id,
        full_name: repo.full_name,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
      });
      setConnected((prev) => [created, ...prev]);
      setTab("connected");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect repository");
    } finally {
      setConnecting(null);
    }
  }

  async function handleDelete(repo: RepoOut) {
    const access = tokenStore.getAccess();
    if (!access) return;
    const confirmed = window.confirm(`Delete the connection for ${repo.full_name}?`);
    if (!confirmed) return;

    setDeleting(repo.id);
    setError(null);
    try {
      await reposApi.delete(access, repo.id);
      setConnected((prev) => prev.filter((item) => item.id !== repo.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete repository");
    } finally {
      setDeleting(null);
    }
  }

  const connectedIds = new Set(connected.map((r) => r.github_id));
  const filteredGithub = github.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto font-sans">
      <div className="mb-12 border-b border-black/10 pb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-medium text-black mb-4 tracking-tight">WORKSPACES.</h1>
          <p className="text-sm font-medium text-black/50 max-w-lg">
            Manage connected repositories and initialize new analysis pipelines.
          </p>
        </div>
        <div className="flex bg-white border border-black/10 shadow-sm text-sm p-1 gap-1">
          {(["connected", "browse"] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => switchTab(item)}
              className={`px-6 py-2.5 font-bold uppercase tracking-[0.1em] text-[10px] transition-all ${
                tab === item ? "bg-black text-white" : "text-black/40 hover:text-black hover:bg-black/5"
              }`}
            >
              {item === "connected" ? `Active (${connected.length})` : "GitHub Setup"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-8 px-5 py-4 bg-red-50 border border-red-200 text-red-600 font-medium text-xs tracking-wide uppercase">
          {error}
        </div>
      )}

      {tab === "connected" && (
        <>
          {loadingConnected ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-8 h-8 flex items-center justify-center border border-black/10 rounded-full animate-spin border-t-black mb-4" />
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40">Loading Workspaces...</p>
            </div>
          ) : connected.length === 0 ? (
            <div className="text-center py-32 bg-white border border-black/10 border-dashed">
              <p className="text-4xl mb-6 text-black/20">⊞</p>
              <p className="font-medium text-black mb-2 text-xl tracking-tight">No Active Workspaces</p>
              <p className="text-sm mb-8 text-black/50">
                Initialize a GitHub repository to begin autonomous analysis.
              </p>
              <button
                onClick={() => switchTab("browse")}
                className="text-[10px] uppercase font-bold tracking-[0.2em] bg-black hover:bg-[#222] text-white px-8 py-4 transition-colors inline-block"
              >
                Browse Integrations
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {connected.map((repo) => (
                <div
                  key={repo.id}
                  className="bg-white border border-black/10 p-6 flex items-center justify-between gap-6 hover:border-black transition-all group shadow-sm"
                >
                  <Link href={`/dashboard/repos/${repo.id}`} className="min-w-0 flex-1">
                    <div className="min-w-0">
                      <p className="font-medium text-black tracking-tight text-lg mb-1 truncate group-hover:underline underline-offset-4 decoration-black/20">
                        {repo.full_name}
                      </p>
                      <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40">
                        Branch: {repo.default_branch}
                      </p>
                    </div>
                  </Link>
                  <div className="shrink-0 flex items-center gap-4">
                    <StatusBadge status={repo.status} />
                    <button
                      type="button"
                      onClick={() => handleDelete(repo)}
                      disabled={deleting === repo.id}
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 border border-red-200 px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {deleting === repo.id ? "Deleting..." : "Delete"}
                    </button>
                    <Link
                      href={`/dashboard/repos/${repo.id}`}
                      className="font-mono text-black/30 group-hover:text-black group-hover:translate-x-1 transition-all"
                    >
                      →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "browse" && (
        <>
          <div className="mb-8">
            <input
              type="search"
              placeholder="Filter available repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-xl px-4 py-4 bg-white border border-black/10 text-black placeholder-black/30 focus:outline-none focus:border-black transition-colors font-mono text-sm shadow-sm"
            />
          </div>

          {loadingGithub ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-8 h-8 flex items-center justify-center border border-black/10 rounded-full animate-spin border-t-black mb-4" />
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40">Fetching from GitHub...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredGithub.map((repo) => {
                const already = connectedIds.has(repo.id);
                return (
                  <div
                    key={repo.id}
                    className="bg-white border border-black/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-black/30 transition-all shadow-sm group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-black text-lg tracking-tight truncate">{repo.full_name}</span>
                        {repo.private && (
                          <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-black/40 border border-black/10 px-2 py-0.5 rounded-sm bg-[#F9F9F9]">
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-black/60 mb-3 truncate max-w-2xl">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-5">
                        {repo.language && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-black/20" />
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/50">
                              {repo.language}
                            </span>
                          </div>
                        )}
                        {repo.stargazers_count > 0 && (
                          <div className="flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-black/40">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span className="text-[10px] font-mono text-black/50">{repo.stargazers_count}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnect(repo)}
                      disabled={already || connecting === repo.id}
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] px-8 py-4 transition-all ${
                        already
                          ? "text-black/30 bg-[#F9F9F9] border border-black/10 cursor-not-allowed"
                          : "bg-black hover:bg-[#222] text-white disabled:opacity-50"
                      }`}
                    >
                      {already ? "Initialized" : connecting === repo.id ? "Connecting..." : "Initialize"}
                    </button>
                  </div>
                );
              })}
              {filteredGithub.length === 0 && !loadingGithub && (
                <div className="text-center py-20 text-black/40 text-[10px] uppercase font-bold tracking-[0.3em]">
                  No matching repositories found.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
