"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { tokenStore } from "@/lib/auth";
import { githubApi, reposApi, GithubRepoItem, RepoOut, ApiError } from "@/lib/api";

type Tab = "connected" | "browse";

const STATUS_STYLE: Record<string, string> = {
  ready:   "bg-green-900/50 text-green-300 border-green-700",
  cloning: "bg-blue-900/50 text-blue-300 border-blue-700",
  parsing: "bg-blue-900/50 text-blue-300 border-blue-700",
  pending: "bg-gray-800 text-gray-400 border-gray-600",
  error:   "bg-red-900/50 text-red-300 border-red-700",
};

function StatusBadge({ status }: { status: string }) {
  const PULSE = status === "cloning" || status === "parsing";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}>
      {PULSE && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {status}
    </span>
  );
}

export default function ReposPage() {
  const [tab, setTab] = useState<Tab>("connected");
  const [connected, setConnected] = useState<RepoOut[]>([]);
  const [github, setGithub] = useState<GithubRepoItem[]>([]);
  const [loadingConnected, setLoadingConnected] = useState(true);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);
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

  // Poll repos that are still processing
  useEffect(() => {
    const processing = connected.filter(
      (r) => r.status === "pending" || r.status === "cloning" || r.status === "parsing"
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

  function switchTab(t: Tab) {
    setTab(t);
    if (t === "browse" && github.length === 0) loadGithub();
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

  const connectedIds = new Set(connected.map((r) => r.github_id));
  const filteredGithub = github.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Repositories</h1>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-sm">
          {(["connected", "browse"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-2 font-medium capitalize transition ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t === "connected" ? `Connected (${connected.length})` : "Browse GitHub"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Connected ── */}
      {tab === "connected" && (
        <>
          {loadingConnected ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : connected.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">⊞</p>
              <p className="font-medium text-gray-400 mb-1">No repositories connected yet</p>
              <p className="text-sm mb-4">Browse your GitHub repos and click Connect to get started.</p>
              <button
                onClick={() => switchTab("browse")}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Browse GitHub
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {connected.map((repo) => (
                <div
                  key={repo.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/repos/${repo.id}`}
                      className="font-medium text-white hover:text-indigo-400 transition truncate block"
                    >
                      {repo.full_name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{repo.default_branch}</p>
                  </div>
                  <StatusBadge status={repo.status} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Browse GitHub ── */}
      {tab === "browse" && (
        <>
          <div className="mb-4">
            <input
              type="search"
              placeholder="Filter repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {loadingGithub ? (
            <p className="text-gray-500 text-sm">Loading from GitHub…</p>
          ) : (
            <div className="grid gap-2">
              {filteredGithub.map((repo) => {
                const already = connectedIds.has(repo.id);
                return (
                  <div
                    key={repo.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{repo.full_name}</span>
                        {repo.private && (
                          <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5">private</span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {repo.language && (
                          <span className="text-xs text-gray-500">{repo.language}</span>
                        )}
                        {repo.stargazers_count > 0 && (
                          <span className="text-xs text-gray-500">★ {repo.stargazers_count}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnect(repo)}
                      disabled={already || connecting === repo.id}
                      className={`shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition ${
                        already
                          ? "text-green-400 border border-green-700 bg-green-900/30 cursor-default"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                      }`}
                    >
                      {already ? "Connected" : connecting === repo.id ? "Connecting…" : "Connect"}
                    </button>
                  </div>
                );
              })}
              {filteredGithub.length === 0 && !loadingGithub && (
                <p className="text-gray-500 text-sm py-8 text-center">No repositories found.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
