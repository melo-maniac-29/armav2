"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { prJobsApi, PrJobListResponse } from "@/lib/api";

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending:    { badge: "bg-[#F9F9F9] text-black/40 border-black/10",       label: "Queued" },
  generating: { badge: "bg-blue-50 text-blue-600 border-blue-200",    label: "Synthesizing" },
  sandboxing: { badge: "bg-amber-50 text-amber-600 border-amber-200", label: "Sandboxing" },
  pushing:    { badge: "bg-indigo-50 text-indigo-600 border-indigo-200", label: "Pushing" },
  pr_opened:  { badge: "bg-emerald-50 text-emerald-600 border-emerald-200",   label: "PR Opened" },
  merged:     { badge: "bg-purple-50 text-purple-600 border-purple-200", label: "Merged" },
  failed:     { badge: "bg-red-50 text-red-600 border-red-200",         label: "Failed" },
};

const SANDBOX_STYLE: Record<string, string> = {
  passed:  "text-emerald-600",
  failed:  "text-red-600",
  skipped: "text-black/40",
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="font-sans space-y-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">AUTONOMOUS REMEDIATION.</h2>
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             Monitoring active patch synthesis & sandbox execution
           </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-white border border-black/10 hover:border-black text-black text-[10px] uppercase font-bold tracking-[0.2em] px-6 py-3 transition-all shrink-0 shadow-sm"
        >
          <span className="font-mono text-black/40 rotate-180">↻</span> Synchronize
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white border border-black/5 shadow-sm animate-pulse" />
          ))}
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <div className="text-center py-32 bg-white border border-dashed border-black/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 leading-relaxed max-w-sm mx-auto">
            Zero remediation pipelines active. Initiate a sequence from the Diagnostic Nodes panel.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.jobs.map((job) => {
            const st = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending;
            const isActive = ACTIVE_STATUSES.has(job.status);
            const isExpanded = expanded.has(job.id);

            return (
              <div
                key={job.id}
                className="bg-white border border-black/10 shadow-sm p-6 hover:border-black transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  {/* Status indicator */}
                  <div className="shrink-0 w-32 flex flex-col gap-2">
                     <span
                       className={`inline-flex items-center justify-center gap-2 border w-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${st.badge}`}
                     >
                       {isActive && (
                         <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                       )}
                       {st.label}
                     </span>
                     {job.sandbox_result && (
                       <span className={`text-[9px] font-bold text-center uppercase tracking-[0.2em] bg-[#F9F9F9] border border-black/5 px-2 py-1 ${SANDBOX_STYLE[job.sandbox_result] ?? ""}`}>
                         TEST: {job.sandbox_result}
                       </span>
                     )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black tracking-tight mb-3 font-mono">
                      {job.branch_name ?? "—"}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-[0.1em] text-black/40 bg-[#F9F9F9] border border-black/5 p-3">
                      <div className="flex items-center gap-2">
                         <span className="text-black/30">LIFECYCLE</span>
                         <span className="font-mono text-black">{new Date(job.created_at).toLocaleString()}</span>
                      </div>
                      <div className="w-px h-3 bg-black/10 hidden sm:block" />
                      <div className="flex items-center gap-2">
                         <span className="text-black/30">NODE ID</span>
                         <span className="font-mono text-black">{job.issue_id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {job.error_msg && (
                      <div className="mt-4 text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200">
                         <span className="font-bold mr-2 text-red-700">ERR:</span> {job.error_msg}
                      </div>
                    )}

                    {job.github_pr_url && (
                      <a
                        href={job.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white bg-black hover:bg-[#222] px-6 py-3 transition-all"
                      >
                        Launch PR #{job.github_pr_number} <span className="font-mono">→</span>
                      </a>
                    )}
                  </div>

                  {/* Expand toggle */}
                  {(job.sandbox_log || job.patch_text) && (
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
                    >
                      {isExpanded ? "Hide Telemetry" : "View Telemetry"}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-black/10 flex flex-col gap-6">
                    {/* Patch preview */}
                    {job.patch_text && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 block mb-3">Proposed Semantics Diff</span>
                        <pre className="p-6 bg-[#F9F9F9] border border-black/10 text-[11px] text-black/70 overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
                          {job.patch_text.slice(0, 2000)}
                          {job.patch_text.length > 2000 ? "\n...[truncated]" : ""}
                        </pre>
                      </div>
                    )}
                    
                    {/* Sandbox log */}
                    {job.sandbox_log && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 block mb-3">Sandbox Telemetry</span>
                        <pre className="p-6 bg-black text-white/70 text-[10px] overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed selection:bg-white/20">
                          {job.sandbox_log}
                        </pre>
                      </div>
                    )}
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
