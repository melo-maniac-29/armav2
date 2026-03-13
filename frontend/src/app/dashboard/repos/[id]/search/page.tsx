"use client";

import { useState } from "react";
import { tokenStore } from "@/lib/auth";
import { searchApi, SearchResult, ApiError } from "@/lib/api";
import { useParams } from "next/navigation";

export default function SearchPage() {
  const params = useParams();
  const repoId = params.id as string;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const access = tokenStore.getAccess()!;
      const data = await searchApi.query(access, repoId, query.trim(), 15);
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Make sure embeddings have been generated (re-index the repo after saving your API key and embedding model).");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="font-sans space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">SEMANTIC SEARCH.</h2>
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             Explore architectural vectors via natural language queries
           </p>
        </div>
      </div>

      <div className="bg-white border border-black/10 shadow-sm p-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
           <span className="text-[10px] font-mono tracking-widest text-black/40">QUERY INPUT</span>
        </div>
        
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. authentication middleware, database connection pooling…"
            className="flex-1 bg-[#F9F9F9] border border-black/10 rounded-none px-6 py-4 font-sans text-sm text-black placeholder-black/30 focus:outline-none focus:border-black transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-8 py-4 bg-black hover:bg-[#222] disabled:opacity-40 disabled:hover:bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap"
          >
            {loading ? "Searching..." : "Execute Search"}
          </button>
        </form>
      </div>

      {error && (
         <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 flex max-w-4xl">
            <span className="font-bold mr-2 text-red-700">SYS_ERR:</span> {error}
         </div>
      )}

      {results !== null && results.length === 0 && (
         <div className="text-center py-32 bg-white border border-dashed border-black/10 max-w-4xl">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 max-w-md mx-auto leading-relaxed">System reports zero matches. Re-calibrate query or verify embeddings index is active.</p>
         </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between pb-4 border-b border-black/10">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-black/40">
              Extraction Results
            </h3>
            <span className="text-[10px] font-mono tracking-widest text-black/40">
              {results.length} MATCH{results.length !== 1 ? "ES" : ""}
            </span>
          </div>

          <div className="space-y-6">
            {results.map((r, i) => (
              <div key={i} className="bg-white border border-black/10 shadow-sm hover:border-black transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-black/5 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 shrink-0">
                      {r.chunk_type}
                    </span>
                    <span className="text-sm font-medium text-black truncate">{r.chunk_name}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[10px] text-black/40 font-mono truncate max-w-[200px]" title={r.file_path}>{r.file_path}</span>
                    <div className="w-px h-3 bg-black/10 hidden sm:block" />
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 border w-12 text-center text-black/60 bg-[#F9F9F9] border-black/10`}
                    >
                      {(r.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-[#F9F9F9] border-t border-black/5">
                   <pre className="text-[11px] text-black/70 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed font-mono selection:bg-black/10">
                     {r.chunk_text}
                   </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
