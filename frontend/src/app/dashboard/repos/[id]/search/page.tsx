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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Semantic Code Search</h2>
        <p className="text-sm text-gray-400">
          Ask in plain English — search finds the most relevant code using vector embeddings.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. authentication middleware, database connection pooling…"
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-sm text-gray-400">No results found. Try a different query or re-index the repo.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-indigo-400 bg-indigo-900/40 border border-indigo-800 rounded px-1.5 py-0.5 shrink-0">
                    {r.chunk_type}
                  </span>
                  <span className="text-sm font-medium text-white truncate">{r.chunk_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-gray-400 truncate max-w-[220px]">{r.file_path}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.similarity >= 0.85
                        ? "bg-green-900/50 text-green-300"
                        : r.similarity >= 0.7
                        ? "bg-yellow-900/40 text-yellow-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {(r.similarity * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <pre className="text-xs text-gray-300 px-4 py-3 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                {r.chunk_text}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
