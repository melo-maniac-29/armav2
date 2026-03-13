"use client";

import { useEffect, useState, use } from "react";
import { tokenStore } from "@/lib/auth";
import { commitsApi, CommitOut, HotspotOut } from "@/lib/api";

export default function CommitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [commits, setCommits] = useState<CommitOut[]>([]);
  const [total, setTotal] = useState(0);
  const [hotspots, setHotspots] = useState<HotspotOut[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const limit = 30;

  async function load(currentOffset = offset) {
    const token = tokenStore.getAccess();
    if (!token) return;
    setLoading(true);
    try {
      const [listRes, hotRes] = await Promise.all([
        commitsApi.list(token, id, limit, currentOffset),
        currentOffset === 0 ? commitsApi.hotspots(token, id, 10) : Promise.resolve(null),
      ]);
      setCommits(listRes.commits);
      setTotal(listRes.total);
      if (hotRes) setHotspots(hotRes.hotspots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReindex() {
    const token = tokenStore.getAccess();
    if (!token) return;
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await commitsApi.reindex(token, id);
      setReindexMsg(res.message);
      setOffset(0);
      await load(0);
    } catch (e: unknown) {
      setReindexMsg(e instanceof Error ? e.message : "Reindex failed.");
    } finally {
      setReindexing(false);
    }
  }

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const short = (hash: string) => hash.slice(0, 7);

  return (
    <div className="font-sans space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">COMMIT HISTORY</h2>
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             Monitoring repository evolution
           </p>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-mono tracking-tight text-black/50 bg-[#F9F9F9] border border-black/5 px-3 py-1.5 shadow-sm">
             {total} COMMITS INDEXED
          </span>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="flex items-center gap-2 bg-black hover:bg-[#222] disabled:opacity-50 text-white text-[10px] uppercase font-bold tracking-[0.2em] px-6 py-3 transition-colors shrink-0 shadow-sm"
          >
            {reindexing ? "Re-indexing..." : "Re-index"}
          </button>
        </div>
      </div>

      {reindexMsg && (
        <div className="text-xs text-emerald-600 bg-emerald-50 font-mono px-4 py-3 border border-emerald-200 flex">
           <span className="font-bold mr-2">SYS_MSG:</span> {reindexMsg}
        </div>
      )}

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        
        {/* Commit list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-white shadow-sm border border-black/5 animate-pulse" />
              ))}
            </div>
          ) : commits.length === 0 ? (
             <div className="text-center py-32 bg-white border border-dashed border-black/10">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Zero commits located.</p>
             </div>
          ) : (
            <div className="bg-white border border-black/10 shadow-sm flex flex-col">
              {commits.map((c) => (
                <div key={c.id} className="flex flex-col md:flex-row md:items-start gap-4 p-6 border-b border-black/10 hover:bg-black/5 transition-colors group last:border-0 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10 hidden md:block" />
                  
                  <div className="shrink-0 w-24">
                     <span className="text-[10px] font-mono tracking-widest text-black/40 bg-[#F9F9F9] border border-black/5 px-2 py-0.5">{short(c.hash)}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black tracking-tight mb-2 leading-snug">{c.message ?? "(no message)"}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-black/40 uppercase tracking-[0.1em]">
                      <span>{c.author_name ?? "unknown"}</span>
                      <span>{fmt(c.committed_at)}</span>
                      <div className="flex gap-2">
                         <span className="text-emerald-500 bg-emerald-50 border border-emerald-100 px-1 py-px font-mono shrink-0">+{c.additions}</span>
                         <span className="text-red-500 bg-red-50 border border-red-100 px-1 py-px font-mono shrink-0">-{c.deletions}</span>
                      </div>
                      <span className="font-mono text-[9px] lowercase bg-[#F9F9F9] border border-black/5 px-1 py-px">{c.files_changed} file{c.files_changed !== 1 ? "s" : ""} changed</span>
                    </div>
                  </div>
                  
                  {c.is_bug_fix && (
                    <div className="shrink-0 pt-2 md:pt-0">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 border bg-orange-50 text-orange-600 border-orange-200">
                        Bug Fix
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && total > limit && (
            <div className="flex justify-between items-center mt-8 pt-8 border-t border-black/10">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="text-[10px] uppercase font-bold tracking-[0.2em] border border-black/10 bg-white hover:bg-black hover:text-white px-6 py-3 transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
              >
                Previous Frame
              </button>
              <span className="text-[10px] font-mono tracking-widest text-black/40 uppercase">
                {offset + 1} - {Math.min(offset + limit, total)} OF {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="text-[10px] uppercase font-bold tracking-[0.2em] border border-black/10 bg-white hover:bg-black hover:text-white px-6 py-3 transition-colors disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
              >
                Next Frame
              </button>
            </div>
          )}
        </div>

        {/* Hotspots */}
        <div className="lg:col-span-1">
          {hotspots.length > 0 && (
            <div className="bg-white border border-black/10 p-6 shadow-sm sticky top-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
                 <span className="text-[10px] font-mono tracking-widest text-orange-500 animate-pulse">!</span>
                 <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Volatility Hotspots</h2>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/40 mb-6 leading-relaxed">
                Nodes exhibiting highest rate of evolutionary churn. Pay close semantic attention here.
              </p>
              
              <div className="space-y-4">
                {hotspots.map((h, i) => (
                  <div key={h.file_path} className="flex flex-col gap-2 border-b border-black/5 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-mono tracking-tight text-black border border-black/10 bg-[#F9F9F9] px-2 py-0.5 max-w-full truncate">{h.file_path}</span>
                      <span className="text-[10px] font-mono tracking-widest text-black/30 shrink-0">#{i + 1}</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">{h.commit_count} commits</span>
                      <span className="text-[10px] font-mono text-orange-600 bg-orange-50 px-2 border border-orange-100">{h.churn.toLocaleString()} lines</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
