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
  const limit = 30;

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) return;
    setLoading(true);
    Promise.all([
      commitsApi.list(token, id, limit, offset),
      offset === 0 ? commitsApi.hotspots(token, id, 10) : Promise.resolve(null),
    ]).then(([listRes, hotRes]) => {
      setCommits(listRes.commits);
      setTotal(listRes.total);
      if (hotRes) setHotspots(hotRes.hotspots);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, offset]);

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const short = (hash: string) => hash.slice(0, 7);

  return (
    <div className="space-y-8">
      {/* Commit list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Commit History</h2>
          <span className="text-sm text-gray-400">{total} total commits</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : commits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No commits indexed yet.</div>
        ) : (
          <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 overflow-hidden">
            {commits.map((c) => (
              <div key={c.id} className="flex items-start gap-4 px-4 py-3 bg-gray-900 hover:bg-gray-850 transition">
                <code className="text-xs text-purple-400 font-mono mt-1 w-16 shrink-0">{short(c.hash)}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{c.message ?? "(no message)"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.author_name ?? "unknown"} · {fmt(c.committed_at)}
                    &nbsp;·&nbsp;
                    <span className="text-green-400">+{c.additions}</span>
                    {" "}
                    <span className="text-red-400">-{c.deletions}</span>
                    &nbsp;·&nbsp;{c.files_changed} file{c.files_changed !== 1 ? "s" : ""}
                  </p>
                </div>
                {c.is_bug_fix && (
                  <span className="text-xs font-medium bg-orange-900/40 text-orange-300 border border-orange-700 rounded px-2 py-0.5 shrink-0">
                    bug fix
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > limit && (
          <div className="flex gap-3 mt-4 justify-center">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-1.5 text-sm rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500 self-center">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-4 py-1.5 text-sm rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Hotspots */}
      {hotspots.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Hotspot Files</h2>
          <p className="text-sm text-gray-400 mb-3">Files with the most churn (most frequently modified)</p>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">File</th>
                  <th className="px-4 py-2 text-right">Commits</th>
                  <th className="px-4 py-2 text-right">Churn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {hotspots.map((h, i) => (
                  <tr key={h.file_path} className="bg-gray-900 hover:bg-gray-850">
                    <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-200 font-mono text-xs">{h.file_path}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{h.commit_count}</td>
                    <td className="px-4 py-2 text-right text-orange-400">{h.churn.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
