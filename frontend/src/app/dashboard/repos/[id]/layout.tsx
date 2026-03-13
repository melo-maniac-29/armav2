"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { ApiError, reposApi, RepoOut } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-[#F9F9F9] text-black border-black border",
  cloning: "bg-blue-50 text-blue-600 border-blue-200 border",
  parsing: "bg-blue-50 text-blue-600 border-blue-200 border",
  pending: "bg-[#F9F9F9] text-black/40 border-black/10 border",
  error: "bg-red-50 text-red-600 border-red-200 border",
};

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Files", segment: "files" },
  { label: "Issues", segment: "issues" },
  { label: "Commits", segment: "commits" },
  { label: "Health", segment: "health" },
  { label: "Fixes", segment: "fixes" },
  { label: "Features", segment: "features" },
  { label: "Search", segment: "search" },
];

export default function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [repo, setRepo] = useState<RepoOut | null>(null);
  const [id, setId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
      const access = tokenStore.getAccess();
      if (!access) return;
      reposApi.get(access, id).then(setRepo).catch(() => {});
    });
  }, [params]);

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

  async function handleDelete() {
    if (!repo) return;
    const access = tokenStore.getAccess();
    if (!access) return;
    const confirmed = window.confirm(`Delete the connection for ${repo.full_name}?`);
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await reposApi.delete(access, repo.id);
      router.push("/dashboard/repos");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete repository");
      setDeleting(false);
    }
  }

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto font-sans min-h-screen bg-[#F9F9F9]">
      <div className="mb-12">
        <Link
          href="/dashboard/repos"
          className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 hover:text-black transition-colors mb-6 flex items-center gap-2 group"
        >
          <span className="font-mono group-hover:-translate-x-1 transition-transform">←</span>
          Return to Workspaces
        </Link>
        {repo ? (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-black/10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-2">Active Workspace</p>
              <h1 className="text-4xl md:text-5xl font-medium text-black tracking-tight">{repo.full_name}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 ${STATUS_STYLE[repo.status] ?? STATUS_STYLE.pending}`}
              >
                {(repo.status === "cloning" || repo.status === "parsing") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
                {repo.status}
              </span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 border border-red-200 px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pb-8 border-b border-black/10 animate-pulse">
            <div className="w-32 h-3 bg-black/10 mb-4 rounded-full" />
            <div className="w-64 h-12 bg-black/5 rounded-sm" />
          </div>
        )}
        {repo?.error_msg && (
          <p className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 mt-4 inline-block">
            {repo.error_msg}
          </p>
        )}
        {deleteError && (
          <p className="text-xs text-red-500 bg-red-50 font-mono px-4 py-3 border border-red-200 mt-4 inline-block">
            {deleteError}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-b border-black/10 mb-8 overflow-x-auto pb-px hide-scrollbar">
        {TABS.map(({ label, segment }) => {
          const href = `/dashboard/repos/${id}${segment ? `/${segment}` : ""}`;
          const active = segment === "" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${
                active ? "border-black text-black bg-black/5" : "border-transparent text-black/40 hover:text-black hover:bg-black/5"
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
