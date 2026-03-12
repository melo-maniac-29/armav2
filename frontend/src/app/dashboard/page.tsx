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
      label: "Connected Repos",
      value: summary?.repos_total ?? "—",
      desc: "repositories indexed",
      href: "/dashboard/repos",
      color: "text-indigo-400",
    },
    {
      label: "Open Issues",
      value: summary?.issues_open ?? "—",
      desc: "across all repos",
      href: "/dashboard/repos",
      color: summary?.issues_open ? "text-orange-400" : "text-white",
    },
    {
      label: "PRs Raised",
      value: summary?.prs_opened ?? "—",
      desc: "auto-fix PRs opened",
      href: "/dashboard/repos",
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-8">
        {summary
          ? `${summary.repos_total} repo${summary.repos_total !== 1 ? "s" : ""} connected`
          : "Welcome to ARMA. Connect a repo to get started."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {cards.map(({ label, value, desc, href, color }) => (
          <Link
            key={label}
            href={href}
            className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors group"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-2 ${color} group-hover:opacity-90`}>{value}</p>
            <p className="text-xs text-gray-600 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
        <Link
          href="/dashboard/repos"
          className="bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-xl p-5 transition-colors"
        >
          <h2 className="text-sm font-semibold text-white mb-1">Repositories</h2>
          <p className="text-xs text-gray-500">Browse and connect GitHub repos, trigger analysis, view files.</p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-xl p-5 transition-colors"
        >
          <h2 className="text-sm font-semibold text-white mb-1">Settings</h2>
          <p className="text-xs text-gray-500">Configure API keys, LLM endpoints, and embedding models.</p>
        </Link>
      </div>
    </div>
  );
}

