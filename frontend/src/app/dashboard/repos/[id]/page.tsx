"use client";

import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/auth";
import { reposApi, RepoFileOut, RepoOut } from "@/lib/api";

export default function RepoOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [files, setFiles] = useState<RepoFileOut[] | null>(null);
  const [repo, setRepo] = useState<RepoOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(async ({ id }) => {
      const access = tokenStore.getAccess();
      if (!access) return;
      const [r, f] = await Promise.allSettled([
        reposApi.get(access, id),
        reposApi.files(access, id),
      ]);
      if (r.status === "fulfilled") setRepo(r.value);
      if (f.status === "fulfilled") setFiles(f.value);
      setLoading(false);
    });
  }, [params]);

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  if (!repo) {
    return <p className="text-red-400 text-sm">Repository not found.</p>;
  }

  if (repo.status !== "ready") {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-3xl mb-3">⏳</p>
        <p className="font-medium text-gray-400">
          {repo.status === "error" ? "Analysis failed" : "Analysis in progress…"}
        </p>
        {repo.error_msg && (
          <p className="text-sm text-red-400 mt-2">{repo.error_msg}</p>
        )}
        {repo.status !== "error" && (
          <p className="text-sm mt-1">This page will refresh automatically.</p>
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
  const langs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const total = files?.length ?? 0;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Overview</h2>
        <dl className="space-y-2">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Repository</dt>
            <dd className="text-white font-medium">{repo.full_name}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Default branch</dt>
            <dd className="text-white">{repo.default_branch}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Files parsed</dt>
            <dd className="text-white font-medium">{total.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Connected</dt>
            <dd className="text-gray-400">{new Date(repo.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Language breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Languages</h2>
        {langs.length === 0 ? (
          <p className="text-gray-500 text-sm">No language data.</p>
        ) : (
          <ul className="space-y-2">
            {langs.map(([lang, count]) => (
              <li key={lang} className="flex items-center gap-2 text-sm">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-gray-300 w-28 truncate">{lang}</span>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round((count / total) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-500 w-8 text-right">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhook setup */}
      {repo.webhook_secret && (
        <div className="sm:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Webhook Setup</h2>
          <p className="text-xs text-gray-500 mb-3">
            Add this webhook to your GitHub repo (Settings → Webhooks → Add webhook) to trigger automatic
            analysis on every push.
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Payload URL</p>
              <code className="block bg-gray-800 rounded px-3 py-2 text-xs text-indigo-300 select-all break-all">
                http://localhost:8000/webhooks/github
              </code>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Secret</p>
              <code className="block bg-gray-800 rounded px-3 py-2 text-xs text-indigo-300 select-all break-all">
                {repo.webhook_secret}
              </code>
            </div>
            <p className="text-xs text-gray-600">Content type: <span className="text-gray-500">application/json</span> · Events: <span className="text-gray-500">Just the push event</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
