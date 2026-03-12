"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { reposApi, RepoOut } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  ready:   "bg-green-900/50 text-green-300 border-green-700",
  cloning: "bg-blue-900/50 text-blue-300 border-blue-700",
  parsing: "bg-blue-900/50 text-blue-300 border-blue-700",
  pending: "bg-gray-800 text-gray-400 border-gray-600",
  error:   "bg-red-900/50 text-red-300 border-red-700",
};

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Files",    segment: "files" },
  { label: "Issues",   segment: "issues" },
  { label: "Commits",  segment: "commits" },
  { label: "Health",   segment: "health" },
  { label: "Fixes",    segment: "fixes" },
  { label: "Features", segment: "features" },
  { label: "Search",   segment: "search" },
];

export default function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [repo, setRepo] = useState<RepoOut | null>(null);
  const [id, setId] = useState<string>("");
  const pathname = usePathname();

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
      const access = tokenStore.getAccess();
      if (!access) return;
      reposApi.get(access, id).then(setRepo).catch(() => {});
    });
  }, [params]);

  // Poll while still processing
  useEffect(() => {
    if (!id || !repo) return;
    if (repo.status === "ready" || repo.status === "error") return;
    const t = setTimeout(async () => {
      const access = tokenStore.getAccess();
      if (access) {
        const updated = await reposApi.get(access, id).catch(() => null);
        if (updated) setRepo(updated);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [id, repo]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/repos" className="text-sm text-gray-500 hover:text-gray-300 transition mb-2 inline-block">
          ← Repositories
        </Link>
        {repo ? (
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-semibold text-white">{repo.full_name}</h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-0.5 ${STATUS_STYLE[repo.status] ?? STATUS_STYLE.pending}`}
            >
              {(repo.status === "cloning" || repo.status === "parsing") && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              )}
              {repo.status}
            </span>
          </div>
        ) : (
          <div className="h-7 w-48 bg-gray-800 rounded animate-pulse mt-1" />
        )}
        {repo?.error_msg && (
          <p className="text-xs text-red-400 mt-1">{repo.error_msg}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 mb-6">
        {TABS.map(({ label, segment }) => {
          const href = `/dashboard/repos/${id}${segment ? `/${segment}` : ""}`;
          const active = segment === "" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                active
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
