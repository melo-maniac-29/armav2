"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { issuesApi, IssueOut, IssueListResponse, ApiError } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  critical: { badge: "bg-red-900/60 text-red-300 border-red-700",    label: "Critical" },
  error:    { badge: "bg-orange-900/60 text-orange-300 border-orange-700", label: "Error" },
  warning:  { badge: "bg-yellow-900/60 text-yellow-300 border-yellow-700", label: "Warning" },
  info:     { badge: "bg-blue-900/60 text-blue-300 border-blue-700",  label: "Info" },
};

const TYPE_STYLES: Record<string, string> = {
  bug:         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  security:    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  performance: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  style:       "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  other:       "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function IssuesPage() {
  const params = useParams<{ id: string }>();
  const repoId = params?.id ?? "";

  const router = useRouter();
  const [data, setData] = useState<IssueListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!repoId) return;
    const access = tokenStore.getAccess();
    if (!access) return;
    try {
      const res = await issuesApi.list(access, repoId, {
        status: filterStatus === "all" ? undefined : filterStatus,
        severity: filterSeverity === "all" ? undefined : filterSeverity,
      });
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [repoId, filterStatus, filterSeverity]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleAnalyze() {
    setAnalyzeError(null);
    setAnalyzing(true);
    // Remember current run_id so we can detect when a NEW analysis completes
    const prevRunId = data?.issues[0]?.run_id ?? null;
    try {
      const access = tokenStore.getAccess()!;
      await issuesApi.analyze(access, repoId);
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > 300_000) { setAnalyzing(false); return; }
        const res = await issuesApi.list(access, repoId).catch(() => null);
        if (!res) { setTimeout(poll, 4000); return; }
        const newRunId = res.issues[0]?.run_id ?? null;
        // New run complete when run_id changed, or first-ever run produced results
        const isDone = prevRunId === null
          ? res.issues.length > 0
          : (newRunId !== null && newRunId !== prevRunId);
        if (isDone) {
          setData(res);
          setAnalyzing(false);
        } else {
          setTimeout(poll, 4000);
        }
      };
      setTimeout(poll, 4000);
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Failed to start analysis.");
      setAnalyzing(false);
    }
  }

  async function handleDismiss(issue: IssueOut) {
    const access = tokenStore.getAccess()!;
    const next = issue.status === "open" ? "dismissed" : "open";
    try {
      await issuesApi.patch(access, repoId, issue.id, next);
      load();
    } catch { /* ignore */ }
  }

  async function handleFix(issue: IssueOut) {
    setFixError(null);
    setFixingId(issue.id);
    try {
      const access = tokenStore.getAccess()!;
      await issuesApi.fix(access, repoId, issue.id);
      router.push(`/dashboard/repos/${repoId}/fixes`);
    } catch (err) {
      setFixError(err instanceof ApiError ? err.message : "Failed to start fix.");
      setFixingId(null);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const severities = ["critical", "error", "warning", "info"] as const;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Severity summary cards */}
          {data && severities.map((s) => {
            const count = data.by_severity[s] ?? 0;
            const style = SEVERITY_STYLES[s];
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 cursor-pointer transition-opacity ${style.badge} ${filterSeverity === s ? "opacity-100 ring-2 ring-white/30" : "opacity-70 hover:opacity-100"}`}
                onClick={() => setFilterSeverity(filterSeverity === s ? "all" : s)}
              >
                {count} {style.label}
              </span>
            );
          })}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {analyzing ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Analyzing… (~45s)
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
              Run Analysis
            </>
          )}
        </button>
      </div>

      {analyzeError && (
        <p className="text-sm text-red-400 mb-4">{analyzeError}</p>
      )}
      {fixError && (
        <p className="text-sm text-red-400 mb-4">{fixError}</p>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(["open", "dismissed", "fixed", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {filterSeverity !== "all" && (
          <button
            onClick={() => setFilterSeverity("all")}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Issue list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.issues.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            {data?.total === 0 && filterStatus === "open"
              ? "No open issues. Click \"Analyze with GPT-4o\" to scan this repo."
              : "No issues match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.issues.map((issue) => {
            const sev = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
            const typ = TYPE_STYLES[issue.issue_type] ?? TYPE_STYLES.other;
            const isOpen = expanded.has(issue.id);
            return (
              <div
                key={issue.id}
                className={`rounded-xl border p-4 transition-opacity ${issue.status === "dismissed" ? "opacity-50" : ""} border-gray-700 bg-gray-800/50`}
              >
                <div className="flex items-start gap-3">
                  {/* Severity dot */}
                  <span className={`mt-0.5 flex-shrink-0 inline-flex items-center border rounded-full px-2 py-0.5 text-xs font-semibold ${sev.badge}`}>
                    {sev.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${typ}`}>
                        {issue.issue_type}
                      </span>
                      <span className="text-xs text-gray-500 font-mono truncate">
                        {issue.file_path}{issue.line_number ? `:${issue.line_number}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleExpand(issue.id)}
                      className="mt-1 text-sm font-medium text-gray-100 text-left hover:text-white transition-colors"
                    >
                      {issue.title}
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                        {issue.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {issue.status === "open" && (
                      <button
                        onClick={() => handleFix(issue)}
                        disabled={fixingId === issue.id}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-medium px-2.5 py-1 rounded transition-colors"
                      >
                        {fixingId === issue.id ? "Starting…" : "Auto Fix"}
                      </button>
                    )}
                    {issue.status === "fixed" && (
                      <span className="text-xs text-emerald-400 font-medium">✓ Fixed</span>
                    )}
                    {issue.status !== "fixed" && (
                      <button
                        onClick={() => handleDismiss(issue)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {issue.status === "dismissed" ? "Reopen" : "Dismiss"}
                      </button>
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
