"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { featureRequestsApi, FeatureRequestOut, FeatureRequestListResponse } from "@/lib/api";

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending:    { badge: "bg-gray-700 text-gray-400 border-gray-600",           label: "Pending" },
  planning:   { badge: "bg-cyan-900/50 text-cyan-300 border-cyan-700",        label: "Planning" },
  coding:     { badge: "bg-blue-900/50 text-blue-300 border-blue-700",        label: "Coding" },
  sandboxing: { badge: "bg-yellow-900/50 text-yellow-300 border-yellow-700",  label: "Sandboxing" },
  pushing:    { badge: "bg-indigo-900/50 text-indigo-300 border-indigo-700",  label: "Pushing" },
  pr_opened:  { badge: "bg-green-900/50 text-green-300 border-green-700",     label: "PR Opened" },
  failed:     { badge: "bg-red-900/50 text-red-300 border-red-700",           label: "Failed" },
};

const SANDBOX_STYLE: Record<string, string> = {
  passed:  "text-green-400",
  failed:  "text-red-400",
  skipped: "text-gray-400",
};

const ACTIVE_STATUSES = new Set(["pending", "planning", "coding", "sandboxing", "pushing"]);

function PlanView({ planJson }: { planJson: string | null }) {
  const [open, setOpen] = useState(false);
  if (!planJson) return null;

  let items: { file_path: string; action: string; description: string }[] = [];
  try {
    items = JSON.parse(planJson);
  } catch {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 hover:text-white transition-colors"
      >
        {open ? "▾ Hide plan" : `▸ Show plan (${items.length} file${items.length !== 1 ? "s" : ""})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  item.action === "create"
                    ? "bg-green-900/40 text-green-300"
                    : "bg-blue-900/40 text-blue-300"
                }`}
              >
                {item.action}
              </span>
              <span className="font-mono text-gray-300">{item.file_path}</span>
              <span className="text-gray-500 truncate">{item.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FeaturesPage() {
  const params = useParams<{ id: string }>();
  const repoId = params?.id ?? "";

  const [data, setData] = useState<FeatureRequestListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!repoId) return;
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const res = await featureRequestsApi.list(access, repoId);
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

  // Poll while any request is active
  useEffect(() => {
    if (!data) return;
    const hasActive = data.requests.some((r) => ACTIVE_STATUSES.has(r.status));
    if (!hasActive) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [data, load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    setSubmitError(null);
    setSubmitting(true);
    const access = tokenStore.getAccess();
    if (!access) { setSubmitting(false); return; }
    try {
      await featureRequestsApi.create(access, repoId, trimmed);
      setDescription("");
      await load();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit feature request.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleLog(id: string) {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Submit form */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Request a Feature</h2>
        <p className="text-sm text-gray-500 mb-4">
          Describe what you want in plain English. ARMA will plan, write the code, and open a PR.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Add rate limiting to all API endpoints using a sliding window algorithm"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          {submitError && (
            <p className="text-xs text-red-400">{submitError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? "Submitting…" : "Submit Feature Request"}
            </button>
          </div>
        </form>
      </div>

      {/* Jobs list */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Feature Requests
        </h3>
        <button
          onClick={load}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.requests.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
          <p className="text-gray-500 text-sm">No feature requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.requests.map((fr) => {
            const st = STATUS_STYLE[fr.status] ?? STATUS_STYLE.pending;
            const isActive = ACTIVE_STATUSES.has(fr.status);
            const logExpanded = expandedLogs.has(fr.id);

            return (
              <div
                key={fr.id}
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
                    {/* Description */}
                    <p className="text-sm text-gray-100">{fr.description}</p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                      <span className="font-mono">{fr.branch_name ?? "—"}</span>
                      {fr.sandbox_result && (
                        <span className={SANDBOX_STYLE[fr.sandbox_result] ?? ""}>
                          Tests: {fr.sandbox_result}
                        </span>
                      )}
                      <span>{new Date(fr.created_at).toLocaleString()}</span>
                    </div>

                    {/* Error */}
                    {fr.error_msg && (
                      <p className="mt-1 text-xs text-red-400">{fr.error_msg}</p>
                    )}

                    {/* Plan */}
                    <PlanView planJson={fr.plan_json} />

                    {/* Sandbox log */}
                    {fr.sandbox_log && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleLog(fr.id)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {logExpanded ? "▾ Hide sandbox log" : "▸ Show sandbox log"}
                        </button>
                        {logExpanded && (
                          <pre className="mt-2 p-3 bg-gray-900 rounded-lg text-[11px] text-gray-300 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                            {fr.sandbox_log}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* GitHub PR link */}
                    {fr.github_pr_url && (
                      <a
                        href={fr.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                        </svg>
                        View PR #{fr.github_pr_number}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
