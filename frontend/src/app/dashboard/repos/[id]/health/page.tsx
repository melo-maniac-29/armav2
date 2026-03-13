"use client";

import { useEffect, useState, use } from "react";
import { tokenStore } from "@/lib/auth";
import { healthApi, HealthResponse } from "@/lib/api";

function RiskBadge({ score }: { score: number }) {
  const color =
    score < 30
      ? "text-emerald-600 border-emerald-200 bg-emerald-50"
      : score < 60
      ? "text-orange-600 border-orange-200 bg-orange-50"
      : "text-red-600 border-red-200 bg-red-50";
  const label = score < 30 ? "Marginal" : score < 60 ? "Elevated" : "Critical";
  return (
    <div className={`flex flex-col items-center justify-center border px-8 py-6 shadow-sm shrink-0 w-48 ${color}`}>
      <span className="text-5xl font-medium tracking-tighter mb-1">{score}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{label} RISK</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-black/10 px-6 py-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="text-2xl font-medium text-black tracking-tight mb-1">{value}</div>
        <div className="text-[9px] font-bold text-black/40 uppercase tracking-[0.1em]">{label}</div>
      </div>
      {sub && <div className="text-[10px] text-black/50 mt-4 font-mono tracking-tight">{sub}</div>}
    </div>
  );
}

function VelocityBar({ commits, max }: { commits: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((commits / max) * 100);
  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex-1 bg-[#F9F9F9] border border-black/5 h-3 relative">
        <div className="bg-black/80 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-black/50 w-8 text-right shrink-0">{commits}</span>
    </div>
  );
}

export default function HealthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = tokenStore.getAccess();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    healthApi
      .get(token, id)
      .then((data) => {
        setHealth(data);
        setError("");
      })
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (!token) {
    return (
      <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 flex">
         <span className="font-bold mr-2">SYS_ERR:</span> Missing access token.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-6 mb-8">
           <div className="w-48 h-32 bg-white border border-black/5 shadow-sm animate-pulse shrink-0" />
           <div className="flex-1 grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 bg-white border border-black/5 shadow-sm animate-pulse" />
              ))}
           </div>
        </div>
        <div className="h-64 bg-white border border-black/5 shadow-sm animate-pulse" />
      </div>
    );
  }
  if (error || !health) {
    return (
      <div className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 flex">
         <span className="font-bold mr-2">SYS_ERR:</span> {error || "No health data available."}
      </div>
    );
  }

  const maxCommits = Math.max(...health.weekly_velocity.map((w) => w.commits), 1);

  const fmtWeek = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  };

  return (
    <div className="font-sans space-y-12">
      <div className="flex flex-col md:flex-row items-start justify-between pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">SYSTEM HEALTH</h2>
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             Architectural integrity metrics & volatility analysis
           </p>
        </div>
      </div>

      {/* Risk + Overview */}
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        <RiskBadge score={health.risk_score} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 flex-1">
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

      <div className="grid lg:grid-cols-2 gap-12 items-start pt-8 border-t border-black/10">
        
        {/* Weekly velocity */}
        {health.weekly_velocity.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
               <span className="text-[10px] font-mono tracking-widest text-black/40">01.</span>
               <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Velocity Index</h2>
            </div>
            <div className="space-y-1 bg-white border border-black/10 shadow-sm p-6">
              {health.weekly_velocity.map((w) => (
                <div key={w.week} className="flex items-center gap-4 py-2 border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors px-2 -mx-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-black/50 w-16 shrink-0">{fmtWeek(w.week)}</span>
                  <div className="flex-1">
                    <VelocityBar commits={w.commits} max={maxCommits} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-orange-600 w-16 text-right shrink-0">
                    {w.bug_fixes > 0 ? `${w.bug_fixes} FIX${w.bug_fixes !== 1 ? "ES" : ""}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hotspots */}
        {health.hotspots.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
               <span className="text-[10px] font-mono tracking-widest text-black/40">02.</span>
               <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Critical Hotspots</h2>
            </div>
            <div className="border border-black/10 shadow-sm overflow-hidden bg-white">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-black/10 text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">
                    <th className="px-6 py-4">Node Path</th>
                    <th className="px-6 py-4 text-right">Commits</th>
                    <th className="px-6 py-4 text-right">Churn</th>
                    <th className="px-6 py-4 text-right">Anomalies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {health.hotspots.map((h) => (
                    <tr key={h.file_path} className="hover:bg-black/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-[10px] text-black max-w-[200px] truncate" title={h.file_path}>
                         {h.file_path}
                      </td>
                      <td className="px-6 py-4 text-right text-[10px] font-mono text-black/60">{h.commit_count}</td>
                      <td className="px-6 py-4 text-right text-[10px] font-mono text-orange-600 bg-orange-50/50">{h.churn.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        {h.open_issues > 0 ? (
                          <span className="text-[10px] font-mono text-red-600 bg-red-50 px-2 py-0.5 border border-red-100">{h.open_issues}</span>
                        ) : (
                          <span className="text-[10px] font-mono text-black/20">—</span>
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
    </div>
  );
}
