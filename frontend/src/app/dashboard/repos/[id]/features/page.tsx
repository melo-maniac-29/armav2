"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { featureRequestsApi, FeatureRequestListResponse } from "@/lib/api";

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending:    { badge: "bg-[#F9F9F9] text-black/40 border-black/10",           label: "Queued" },
  planning:   { badge: "bg-cyan-50 text-cyan-700 border-cyan-200",        label: "Planning" },
  coding:     { badge: "bg-blue-50 text-blue-700 border-blue-200",        label: "Coding" },
  sandboxing: { badge: "bg-amber-50 text-amber-700 border-amber-200",  label: "Sandboxing" },
  pushing:    { badge: "bg-indigo-50 text-indigo-700 border-indigo-200",  label: "Pushing" },
  pr_opened:  { badge: "bg-emerald-50 text-emerald-700 border-emerald-200",     label: "PR Opened" },
  merged:     { badge: "bg-purple-50 text-purple-700 border-purple-200",  label: "Merged" },
  failed:     { badge: "bg-red-50 text-red-700 border-red-200",           label: "Failed" },
};

const SANDBOX_STYLE: Record<string, string> = {
  passed:  "text-emerald-700",
  failed:  "text-red-700",
  skipped: "text-black/40",
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
    <div className="mt-4 pt-4 border-t border-black/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
      >
        {open ? "Hide blueprint" : `View architecture blueprint (${items.length} node${items.length !== 1 ? "s" : ""})`}
      </button>
      {open && (
        <ul className="mt-4 space-y-2 border-l-2 border-black/10 pl-4 py-2">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col md:flex-row md:items-baseline gap-2 text-sm font-sans mb-4 last:mb-0">
              <div className="flex items-center gap-3 shrink-0">
                 <span
                   className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-[0.2em] ${
                     item.action.toLowerCase() === "create" || item.action.toLowerCase() === "add"
                       ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                       : "bg-blue-50 text-blue-700 border-blue-200"
                   }`}
                 >
                   {item.action}
                 </span>
                 <span className="font-mono text-xs text-black tracking-tight">{item.file_path}</span>
              </div>
              <span className="text-black/60 text-sm leading-snug max-w-2xl">{item.description}</span>
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
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">FEATURE SYNTHESIS.</h2>
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             Instruct ARMA to autonomously construct and integrate new capabilities
           </p>
        </div>
      </div>

      {/* Submit form */}
      <div className="bg-white border border-black/10 shadow-sm p-8 hover:border-black transition-colors">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
           <span className="text-[10px] font-mono tracking-widest text-black/40">INPUT</span>
           <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Objective Specification</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the desired system behavior or capability. Ex: Implement a Redis-backed caching utility for the global state matrix."
            rows={4}
            className="w-full bg-[#F9F9F9] border border-black/10 rounded-none px-6 py-4 font-sans text-sm text-black placeholder-black/30 focus:outline-none focus:border-black transition-colors resize-none leading-relaxed"
          />
          {submitError && (
             <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 flex">
                <span className="font-bold mr-2 text-red-700">SYS_ERR:</span> {submitError}
             </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="px-8 py-3 bg-black hover:bg-[#222] disabled:opacity-40 disabled:hover:bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] transition-all"
            >
              {submitting ? "Synthesizing..." : "Initiate Build Sequence"}
            </button>
          </div>
        </form>
      </div>

      {/* Jobs list */}
      <div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-black/10">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-black/40">
            Active Integrations
          </h3>
          <button
            onClick={load}
            className="flex items-center gap-2 bg-white border border-black/10 hover:border-black text-black text-[10px] uppercase font-bold tracking-[0.2em] px-4 py-2 transition-all shadow-sm"
          >
            <span className="font-mono text-black/40 rotate-180">↻</span> Sync
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-white border border-black/5 shadow-sm animate-pulse" />
            ))}
          </div>
        ) : !data || data.requests.length === 0 ? (
          <div className="text-center py-32 bg-white border border-dashed border-black/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">System reports zero active feature modules.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.requests.map((fr) => {
              const st = STATUS_STYLE[fr.status] ?? STATUS_STYLE.pending;
              const isActive = ACTIVE_STATUSES.has(fr.status);
              const logExpanded = expandedLogs.has(fr.id);

              return (
                <div
                  key={fr.id}
                  className="bg-white border border-black/10 shadow-sm p-6 hover:border-black transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:gap-8 gap-4">
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
                       {fr.sandbox_result && (
                         <span className={`text-[9px] font-bold text-center uppercase tracking-[0.2em] bg-[#F9F9F9] border border-black/5 px-2 py-1 ${SANDBOX_STYLE[fr.sandbox_result] ?? ""}`}>
                           TEST: {fr.sandbox_result}
                         </span>
                       )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Description */}
                      <p className="text-sm text-black leading-relaxed mb-4">{fr.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-[0.1em] text-black/40 bg-[#F9F9F9] border border-black/5 p-3 mb-2">
                        <div className="flex items-center gap-2">
                           <span className="text-black/30">BRANCH</span>
                           <span className="font-mono text-black">{fr.branch_name ?? "—"}</span>
                        </div>
                        <div className="w-px h-3 bg-black/10 hidden sm:block" />
                        <div className="flex items-center gap-2">
                           <span className="text-black/30">LIFECYCLE</span>
                           <span className="font-mono text-black">{new Date(fr.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {fr.error_msg && (
                        <div className="mt-4 text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200">
                           <span className="font-bold mr-2 text-red-700">ERR:</span> {fr.error_msg}
                        </div>
                      )}

                      <PlanView planJson={fr.plan_json} />

                      {fr.sandbox_log && (
                        <div className="mt-4 pt-4 border-t border-black/10">
                          <button
                            onClick={() => toggleLog(fr.id)}
                            className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
                          >
                            {logExpanded ? "Hide Telemetry" : "View Sandbox Telemetry"}
                          </button>
                          {logExpanded && (
                            <pre className="mt-4 p-6 bg-black text-white/70 text-[10px] overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed selection:bg-white/20">
                              {fr.sandbox_log}
                            </pre>
                          )}
                        </div>
                      )}

                      {fr.github_pr_url && (
                        <div className="mt-6 pt-6 border-t border-black/10">
                            <a
                              href={fr.github_pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white bg-black hover:bg-[#222] px-6 py-3 transition-all"
                            >
                              Launch Payload PR #{fr.github_pr_number} <span className="font-mono text-white/50">→</span>
                            </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
