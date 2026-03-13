"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tokenStore } from "@/lib/auth";
import { dashboardApi, DashboardSummary } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const access = tokenStore.getAccess();
    if (!access) return;
    dashboardApi.summary(access).then(setSummary).catch(() => {});
  }, []);

  const cards = [
    {
      label: "Indexed Workspaces",
      value: summary?.repos_total ?? "—",
      desc: "Repositories mapped into vector and graph space",
      href: "/dashboard/repos",
    },
    {
      label: "Critical Anomalies",
      value: summary?.issues_open ?? "—",
      desc: "Detected regressions requiring attention",
      href: "/dashboard/repos",
      alert: (summary?.issues_open ?? 0) > 0,
    },
    {
      label: "Resolved Commits",
      value: summary?.prs_opened ?? "—",
      desc: "Automated sandboxed pull requests",
      href: "/dashboard/repos",
    },
  ];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto">
      <div className="mb-12 border-b border-black/10 pb-8 relative">
        <div className="absolute top-0 right-0 p-4 border border-black/10 bg-white/50 shadow-sm hidden sm:block">
            <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-black/40 mb-1">System Status</p>
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-mono font-medium tracking-tight">ONLINE</span>
            </div>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-medium text-black mb-4 tracking-tight">COMMAND CENTER.</h1>
        <p className="text-sm font-medium text-black/50 max-w-lg">
          {summary
            ? `Currently monitoring ${summary.repos_total} continuous integration ${summary.repos_total !== 1 ? "pipelines" : "pipeline"}.`
            : "System initialized. Waiting to connect a workspace."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {cards.map(({ label, value, desc, href, alert }) => (
          <Link
            key={label}
            href={href}
            className="bg-white border border-black/10 hover:border-black p-8 transition-all duration-300 group overflow-hidden relative shadow-sm hover:shadow-md"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-black translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300" />
            <div className="flex justify-between items-start mb-12">
                <p className="text-[10px] font-bold text-black/60 uppercase tracking-[0.2em]">{label}</p>
                {alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>}
            </div>
            <p className={`text-5xl font-medium tracking-tighter mb-4 transition-colors ${alert ? "text-red-500" : "text-black group-hover:text-black/70"}`}>{value}</p>
            <p className="text-xs font-medium text-black/40 leading-relaxed max-w-[80%] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 absolute bottom-8">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full">
        <Link
          href="/dashboard/repos"
          className="bg-white border border-black/10 p-8 hover:border-black transition-all group shadow-sm flex flex-col items-start"
        >
          <div className="w-12 h-12 bg-[#F9F9F9] border border-black/10 rounded-full flex items-center justify-center mb-8 group-hover:bg-black group-hover:text-white transition-colors duration-500">
             <span className="text-sm font-mono tracking-widest relative z-10 transition-colors">01</span>
          </div>
          <h2 className="text-xl font-medium text-black mb-2 tracking-tight">Workspace Connect</h2>
          <p className="text-sm text-black/50 font-medium">Link GitHub repositories to begin automatic semantic indexing and setup sandbox boundaries.</p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="bg-white border border-black/10 p-8 hover:border-black transition-all group shadow-sm flex flex-col items-start"
        >
          <div className="w-12 h-12 bg-[#F9F9F9] border border-black/10 rounded-full flex items-center justify-center mb-8 group-hover:bg-black group-hover:text-white transition-colors duration-500">
             <span className="text-sm font-mono tracking-widest relative z-10 transition-colors">02</span>
          </div>
          <h2 className="text-xl font-medium text-black mb-2 tracking-tight">Execution Engine</h2>
          <p className="text-sm text-black/50 font-medium">Configure deep-context GPT-4o keys, isolated Docker parameters, and pgvector thresholds.</p>
        </Link>
      </div>
    </div>
  );
}

