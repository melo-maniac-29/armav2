"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { reposApi, issuesApi, RepoFileOut, RepoOut, IssueListResponse } from "@/lib/api";

export default function RepoOverviewPage() {
  const params = useParams<{ id: string }>();
  const repoId = params?.id ?? "";

  const [files, setFiles] = useState<RepoFileOut[] | null>(null);
  const [repo, setRepo] = useState<RepoOut | null>(null);
  const [issues, setIssues] = useState<IssueListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;
    const access = tokenStore.getAccess();
    if (!access) return;
    Promise.allSettled([
      reposApi.get(access, repoId),
      reposApi.files(access, repoId),
      issuesApi.list(access, repoId, { status: "open" }),
    ]).then(([r, f, i]) => {
      if (r.status === "fulfilled") setRepo(r.value);
      if (f.status === "fulfilled") setFiles(f.value);
      if (i.status === "fulfilled") setIssues(i.value);
      setLoading(false);
    });
  }, [repoId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center font-sans">
         <div className="w-8 h-8 flex items-center justify-center border border-black/10 rounded-full animate-spin border-t-black mb-4"></div>
         <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40">Loading Layout...</p>
      </div>
    );
  }

  if (!repo) {
    return <p className="text-red-500 text-[10px] uppercase font-bold tracking-[0.2em] py-8 text-center bg-red-50 border border-red-200">Repository not found.</p>;
  }

  if (repo.status !== "ready") {
    return (
      <div className="text-center py-32 border border-black/10 border-dashed bg-[#F9F9F9] font-sans relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-black animate-pulse opacity-50"></div>
        <div className="w-12 h-12 flex items-center justify-center border border-black/10 rounded-full animate-spin border-t-black mx-auto mb-6"></div>
        <p className="font-bold tracking-tight text-xl mb-2">
          {repo.status === "error" ? "ANALYSIS FAILED" : "SYSTEM INITIALIZING"}
        </p>
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 mb-4">
          Parsing abstract syntax trees and generating embeddings...
        </p>
        {repo.error_msg && (
          <p className="text-xs text-red-500 font-mono bg-red-50 inline-block px-4 py-2 border border-red-200">{repo.error_msg}</p>
        )}
      </div>
    );
  }

  // Language breakdown
  const langCount: Record<string, number> = {};
  for (const f of files ?? []) {
    const lang = f.language ?? "Other";
    langCount[lang] = (langCount[lang] ?? 0) + 1;
  }
  const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = files?.length ?? 0;

  const severityOrder = ["critical", "error", "warning", "info"] as const;
  const severityColors: Record<string, string> = {
    critical: "bg-red-50 text-red-600 border-red-200",
    error:    "bg-orange-50 text-orange-600 border-orange-200",
    warning:  "bg-yellow-50 text-yellow-600 border-yellow-200",
    info:     "bg-blue-50 text-blue-600 border-blue-200",
  };
  const hasIssues = issues && issues.total > 0;

  return (
    <div className="grid md:grid-cols-2 gap-6 font-sans">
      {/* Stats */}
      <div className="bg-white border border-black/10 p-8 shadow-sm group hover:border-black transition-colors">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-black/10">
           <span className="text-[10px] font-mono tracking-widest text-black/40">01.</span>
           <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">System Architecture</h2>
        </div>
        <dl className="space-y-4">
          <div className="flex justify-between items-baseline border-b border-black/5 pb-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Repository</dt>
            <dd className="text-sm font-medium text-black truncate max-w-[60%]">{repo.full_name}</dd>
          </div>
          <div className="flex justify-between items-baseline border-b border-black/5 pb-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Default Target</dt>
            <dd className="text-xs font-mono text-black">{repo.default_branch}</dd>
          </div>
          <div className="flex justify-between items-baseline border-b border-black/5 pb-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Nodes Parsed</dt>
            <dd className="text-sm font-medium text-black">{total.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between items-baseline pb-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Timestamp</dt>
            <dd className="text-xs font-mono text-black/50">{new Date(repo.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Issues summary */}
      <div className="bg-white border border-black/10 p-8 shadow-sm group hover:border-black transition-colors">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10">
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono tracking-widest text-black/40">02.</span>
              <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Diagnostic Traces</h2>
           </div>
           <Link
             href={`/dashboard/repos/${repoId}/issues`}
             className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
           >
             View Details →
           </Link>
        </div>
        
        {!hasIssues ? (
          <div className="flex flex-col items-center justify-center py-6 border border-dashed border-black/10 bg-[#F9F9F9]">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 mb-3">System Nominal</p>
            <Link
              href={`/dashboard/repos/${repoId}/issues`}
              className="text-xs font-medium text-black underline underline-offset-4 decoration-black/20 hover:decoration-black transition-colors"
            >
              Trigger Manual Scan
            </Link>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-80px)] justify-center">
            <div className="flex items-baseline gap-4 mb-6">
                <p className="text-6xl font-medium tracking-tighter shrink-0">{issues.total}</p>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
                    Anomalies <br/>Detected
                </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {severityOrder.map((s) => {
                const count = issues.by_severity[s] ?? 0;
                if (!count) return null;
                return (
                  <span key={s} className={`text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 border ${severityColors[s]}`}>
                    {count} {s}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Language breakdown */}
      <div className="bg-white border border-black/10 p-8 shadow-sm group hover:border-black transition-colors">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-black/10">
           <span className="text-[10px] font-mono tracking-widest text-black/40">03.</span>
           <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Lexical Distribution</h2>
        </div>
        
        {langs.length === 0 ? (
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 py-8 text-center border border-dashed border-black/10">No Lexemes Identified.</p>
        ) : (
          <ul className="space-y-4">
            {langs.map(([lang, count]) => (
              <li key={lang} className="flex flex-col gap-1.5 w-full">
                <div className="flex items-baseline justify-between w-full">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/60 truncate">{lang}</span>
                  <span className="text-xs font-mono text-black/40">{count} FILES</span>
                </div>
                <div className="w-full h-1 bg-[#F9F9F9] overflow-hidden">
                  <div
                    className="h-full bg-black"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhook setup */}
      {repo.webhook_secret && (
        <div className="bg-white border border-black/10 p-8 shadow-sm group hover:border-black transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
             <div className="w-2 h-2 rounded-full bg-black/20 group-hover:bg-emerald-500 transition-colors animate-pulse"></div>
          </div>
          
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-black/10 pr-6">
             <span className="text-[10px] font-mono tracking-widest text-black/40">04.</span>
             <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Continuous Pipeline</h2>
          </div>
          
          <p className="text-sm text-black/60 mb-6 font-medium leading-relaxed">
            Attach this endpoint to your GitHub webhooks to trigger autonomic analysis upon every integration.
          </p>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-2">Endpoint URL</p>
              <code className="block bg-[#F9F9F9] border border-black/5 px-4 py-3 text-xs font-mono text-black select-all tracking-tight break-all">
                http://localhost:8000/webhooks/github
              </code>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-2">Cryptographic Secret</p>
              <code className="block bg-[#F9F9F9] border border-black/5 px-4 py-3 text-xs font-mono text-black select-all tracking-tight break-all">
                {repo.webhook_secret}
              </code>
            </div>
            <div className="flex items-center gap-4 border-t border-black/5 pt-4">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/30 mb-1">Content</span>
                    <span className="text-xs font-mono bg-black/5 px-2 py-0.5">application/json</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/30 mb-1">Trigger</span>
                    <span className="text-xs font-mono bg-black/5 px-2 py-0.5">Push Event</span>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
