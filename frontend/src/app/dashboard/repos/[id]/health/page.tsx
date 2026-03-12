"use client";

import { useEffect, useState, use } from "react";
import { tokenStore } from "@/lib/auth";
import { healthApi, HealthResponse } from "@/lib/api";

function RiskBadge({ score }: { score: number }) {
  const color =
    score < 30
      ? "text-green-400 border-green-700 bg-green-900/30"
      : score < 60
      ? "text-yellow-400 border-yellow-700 bg-yellow-900/30"
      : "text-red-400 border-red-700 bg-red-900/30";
  const label = score < 30 ? "Low" : score < 60 ? "Medium" : "High";
  return (
    <div className={`inline-flex flex-col items-center justify-center border rounded-xl px-6 py-4 ${color}`}>
      <span className="text-4xl font-bold">{score}</span>
      <span className="text-xs mt-1 font-medium uppercase tracking-wide">{label} Risk</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function VelocityBar({ commits, max }: { commits: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((commits / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-6 text-right">{commits}</span>
    </div>
  );
}

export default function HealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) return;
    setLoading(true);
    healthApi
      .get(token, id)
      .then(setHealth)
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }
  if (error || !health) {
    return <div className="text-red-400 py-8 text-center">{error || "No health data available."}</div>;
  }

  const maxCommits = Math.max(...health.weekly_velocity.map((w) => w.commits), 1);

  const fmtWeek = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-8">
      {/* Risk + Overview */}
      <div className="flex flex-wrap gap-6 items-start">
        <RiskBadge score={health.risk_score} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
          <StatCard label="Total Commits" value={health.total_commits} />
          <StatCard
            label="Bug Fix Rate"
            value={`${(health.bug_fix_rate * 100).toFixed(1)}%`}
            sub={`${health.bug_fix_commits} bug-fix commits`}
          />
          <StatCard label="Open Issues" value={health.open_issues} sub={`${health.critical_issues} critical`} />
          <StatCard label="Symbols Indexed" value={health.symbols_indexed.toLocaleString()} />
          <StatCard label="Embeddings" value={health.embeddings_indexed.toLocaleString()} sub={`${health.files_indexed} files`} />
        </div>
      </div>

      {/* Weekly velocity */}
      {health.weekly_velocity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Weekly Commit Velocity (last 8 weeks)</h2>
          <div className="space-y-2 bg-gray-900 border border-gray-800 rounded-lg p-4">
            {health.weekly_velocity.map((w) => (
              <div key={w.week} className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
                <span className="text-xs text-gray-400">{fmtWeek(w.week)}</span>
                <VelocityBar commits={w.commits} max={maxCommits} />
                <span className="text-xs text-orange-400 w-12 text-right">
                  {w.bug_fixes > 0 ? `${w.bug_fixes} fix${w.bug_fixes !== 1 ? "es" : ""}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hotspots */}
      {health.hotspots.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">Hotspot Files</h2>
          <p className="text-sm text-gray-400 mb-3">Files with high churn that also have open issues</p>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <th className="px-4 py-2 text-left">File</th>
                  <th className="px-4 py-2 text-right">Commits</th>
                  <th className="px-4 py-2 text-right">Churn</th>
                  <th className="px-4 py-2 text-right">Open Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {health.hotspots.map((h) => (
                  <tr key={h.file_path} className="bg-gray-900 hover:bg-gray-850 transition">
                    <td className="px-4 py-2 font-mono text-xs text-gray-200 max-w-xs truncate">{h.file_path}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{h.commit_count}</td>
                    <td className="px-4 py-2 text-right text-orange-400">{h.churn.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      {h.open_issues > 0 ? (
                        <span className="text-red-400 font-medium">{h.open_issues}</span>
                      ) : (
                        <span className="text-gray-600">0</span>
                      )}
                    </td>
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
