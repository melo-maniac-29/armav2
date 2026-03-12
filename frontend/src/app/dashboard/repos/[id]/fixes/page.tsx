"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { prJobsApi, PrJobOut, PrJobListResponse } from "@/lib/api";

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending:    { badge: "bg-gray-700 text-gray-400 border-gray-600",       label: "Pending" },
  generating: { badge: "bg-blue-900/50 text-blue-300 border-blue-700",    label: "Generating" },
  sandboxing: { badge: "bg-yellow-900/50 text-yellow-300 border-yellow-700", label: "Sandboxing" },
  pushing:    { badge: "bg-indigo-900/50 text-indigo-300 border-indigo-700", label: "Pushing" },
  pr_opened:  { badge: "bg-green-900/50 text-green-300 border-green-700",   label: "PR Opened" },
  merged:     { badge: "bg-purple-900/50 text-purple-300 border-purple-700", label: "Merged ✓" },
  failed:     { badge: "bg-red-900/50 text-red-300 border-red-700",         label: "Failed" },
};

const SANDBOX_STYLE: Record<string, string> = {
  passed:  "text-green-400",
  failed:  "text-red-400",
  skipped: "text-gray-400",
};

const ACTIVE_STATUSES = new Set(["pending", "generating", "sandboxing", "pushing"]);

export default function FixesPage() {
  const params = useParams<{ id: string }>();
  const repoId = params?.id ?? "";

  const [data, setData] = useState<PrJobListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!repoId) return;
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const res = await prJobsApi.list(access, repoId);
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Poll while any job is active
  useEffect(() => {
    if (!data) return;
    const hasActive = data.jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    if (!hasActive) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [data, load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Auto-Fix Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            ARMA-generated fixes — each job creates a GitHub PR.
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            No fix jobs yet. Go to <strong>Issues</strong> and click{" "}
            <span className="text-emerald-400">Auto Fix</span> on any open issue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.jobs.map((job) => {
            const st = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending;
            const isActive = ACTIVE_STATUSES.has(job.status);
            const isExpanded = expanded.has(job.id);

            return (
              <div
                key={job.id}
                className="rounded-xl border border-gray-700 bg-gray-800/50 p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Status badge */}
                  <span
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.badge}`}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    )}
                    {st.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Branch name */}
                    <p className="text-sm font-medium text-gray-100 font-mono truncate">
                      {job.branch_name ?? "—"}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                      <span>Issue: {job.issue_id.slice(0, 8)}</span>
                      {job.sandbox_result && (
                        <span className={SANDBOX_STYLE[job.sandbox_result] ?? ""}>
                          Tests: {job.sandbox_result}
                        </span>
                      )}
                      <span>{new Date(job.created_at).toLocaleString()}</span>
                    </div>

                    {/* Error */}
                    {job.error_msg && (
                      <p className="mt-1 text-xs text-red-400">{job.error_msg}</p>
                    )}

                    {/* GitHub PR link */}
                    {job.github_pr_url && (
                      <a
                        href={job.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        PR #{job.github_pr_number} →
                      </a>
                    )}
                  </div>

                  {/* Expand sandbox log */}
                  {job.sandbox_log && (
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isExpanded ? "Hide log" : "Show log"}
                    </button>
                  )}
                </div>

                {/* Sandbox log */}
                {isExpanded && job.sandbox_log && (
                  <pre className="mt-3 p-3 bg-gray-900 rounded-lg text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap">
                    {job.sandbox_log}
                  </pre>
                )}

                {/* Patch preview */}
                {isExpanded && job.patch_text && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Fixed file snippet:</p>
                    <pre className="p-3 bg-gray-900 rounded-lg text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                      {job.patch_text.slice(0, 2000)}
                      {job.patch_text.length > 2000 ? "\n…" : ""}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
