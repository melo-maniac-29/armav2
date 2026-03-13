"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { issuesApi, reposApi, IssueOut, IssueListResponse, ApiError } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  critical: { badge: "bg-red-50 text-red-600 border-red-200",    label: "Critical" },
  error:    { badge: "bg-orange-50 text-orange-600 border-orange-200", label: "Error" },
  warning:  { badge: "bg-yellow-50 text-yellow-600 border-yellow-200", label: "Warning" },
  info:     { badge: "bg-blue-50 text-blue-600 border-blue-200",  label: "Info" },
};

const TYPE_STYLES: Record<string, string> = {
  bug:         "bg-red-50 text-red-700 border-red-100",
  security:    "bg-purple-50 text-purple-700 border-purple-100",
  performance: "bg-orange-50 text-orange-700 border-orange-100",
  style:       "bg-[#F9F9F9] text-black/60 border-black/10",
  other:       "bg-[#F9F9F9] text-black/60 border-black/10",
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
    try {
      const access = tokenStore.getAccess()!;
      await issuesApi.analyze(access, repoId);
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > 300_000) {
          setAnalyzing(false);
          return;
        }
        const repo = await reposApi.get(access, repoId).catch(() => null);
        if (!repo) {
          setTimeout(poll, 4000);
          return;
        }
        if (repo.status !== "analyzing") {
          const res = await issuesApi.list(access, repoId, {
            status: filterStatus === "all" ? undefined : filterStatus,
            severity: filterSeverity === "all" ? undefined : filterSeverity,
          }).catch(() => null);
          if (res) {
            setData(res);
          }
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
    } catch {
      // ignore
    }
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const severities = ["critical", "error", "warning", "info"] as const;

  return (
    <div className="font-sans">
      {/* Header row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-8 border-b border-black/10 gap-6">
        <div className="flex gap-2 items-center flex-wrap">
          {/* Severity summary cards */}
          {data && severities.map((s) => {
            const count = data.by_severity[s] ?? 0;
            const style = SEVERITY_STYLES[s];
            return (
              <button
                key={s}
                className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-2 border transition-all ${style.badge} ${filterSeverity === s ? "ring-2 ring-black ring-offset-2" : "opacity-60 hover:opacity-100"}`}
                onClick={() => setFilterSeverity(filterSeverity === s ? "all" : s)}
              >
                {style.label}
                <span className="font-mono bg-white/50 px-1.5 py-0.5 ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-3 bg-black hover:bg-[#222] disabled:opacity-50 text-white text-[10px] uppercase font-bold tracking-[0.2em] px-6 py-3 transition-colors shrink-0 shadow-sm"
        >
          {analyzing ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />
              Scanning Vectors... (~45s)
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                 <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              Trigger Diagnostics
            </>
          )}
        </button>
      </div>

      {analyzeError && (
        <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 mb-6 flex">
           <span className="font-bold mr-2">SYS_ERR:</span> {analyzeError}
        </div>
      )}
      {fixError && (
        <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 mb-6 flex">
           <span className="font-bold mr-2">FIX_ERR:</span> {fixError}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-8 flex-wrap items-center">
        <div className="flex bg-white border border-black/10 shadow-sm p-1 gap-1 text-[10px] font-bold uppercase tracking-[0.1em]">
          {(["open", "dismissed", "fixed", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-6 py-2 transition-all ${filterStatus === s ? "bg-black text-white" : "text-black/40 hover:text-black hover:bg-black/5"}`}
            >
              {s}
            </button>
          ))}
        </div>
        {filterSeverity !== "all" && (
          <button
            onClick={() => setFilterSeverity("all")}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black flex items-center gap-2 border border-black/10 px-4 py-2 bg-white transition-colors"
          >
            <span className="font-mono text-[8px]">×</span> Reset Severity
          </button>
        )}
      </div>

      {/* Issue list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-black/5 shadow-sm animate-pulse" />
          ))}
        </div>
      ) : !data || data.issues.length === 0 ? (
        <div className="text-center py-32 bg-white border border-dashed border-black/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
            {data?.total === 0 && filterStatus === "open"
              ? "System reports zero anomalies. Run diagnostics."
              : "No diagnostic nodes match criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.issues.map((issue) => {
            const sev = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
            const typ = TYPE_STYLES[issue.issue_type] ?? TYPE_STYLES.other;
            const isOpen = expanded.has(issue.id);
            return (
              <div
                key={issue.id}
                className={`bg-white border p-6 transition-all shadow-sm hover:border-black ${issue.status === "dismissed" ? "opacity-50 grayscale border-black/10" : "border-black/20"}`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:gap-8 gap-4">
                  {/* Severity indicator */}
                  <div className="shrink-0 w-28 hidden md:block">
                     <span className={`inline-flex w-full justify-center items-center border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${sev.badge}`}>
                       {sev.label}
                     </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-3 md:hidden">
                       <span className={`inline-flex items-center border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${sev.badge}`}>
                         {sev.label}
                       </span>
                    </div>
                  
                    <div className="flex flex-col gap-1 mb-2">
                      <button
                        onClick={() => toggleExpand(issue.id)}
                        className="text-lg font-medium text-black text-left hover:underline underline-offset-4 decoration-black/20 transition-all font-sans tracking-tight"
                      >
                        {issue.title}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap mb-4">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 border ${typ}`}>
                        {issue.issue_type}
                      </span>
                      <span className="text-[10px] text-black/50 font-mono tracking-tight bg-[#F9F9F9] border border-black/5 px-2 py-0.5 truncate max-w-full">
                        {issue.file_path}{issue.line_number ? <span className="text-black/30">L{issue.line_number}</span> : ""}
                      </span>
                    </div>

                    
                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-black/5">
                        <p className="text-sm text-black/70 leading-relaxed font-sans max-w-4xl whitespace-pre-wrap">
                          {issue.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-center flex-row md:items-end gap-3 shrink-0 pt-2 md:pt-0 border-t border-black/5 md:border-none">
                    {issue.status === "open" && (
                      <button
                        onClick={() => handleFix(issue)}
                        disabled={fixingId === issue.id}
                        className="text-[10px] bg-black hover:bg-[#222] disabled:opacity-50 text-white font-bold uppercase tracking-[0.2em] px-6 py-3 transition-colors w-full md:w-auto text-center"
                      >
                        {fixingId === issue.id ? "Processing..." : "Auto-Remediate"}
                      </button>
                    )}
                    {issue.status === "fixed" && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 border border-emerald-200 px-4 py-2 w-full md:w-auto text-center">
                        ✓ Resolved
                      </span>
                    )}
                    {issue.status !== "fixed" && (
                      <button
                        onClick={() => handleDismiss(issue)}
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors px-4 py-2 border border-transparent hover:border-black/10 bg-white hover:bg-black/5 w-full md:w-auto text-center"
                      >
                        {issue.status === "dismissed" ? "Restore" : "Dismiss"}
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
