"use client";

import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/auth";
import { reposApi, RepoFileOut } from "@/lib/api";

const LANG_COLOR: Record<string, string> = {
  Python: "text-blue-400", TypeScript: "text-blue-300", JavaScript: "text-yellow-300",
  Go: "text-cyan-400", Rust: "text-orange-400", Java: "text-red-400",
  "C#": "text-purple-400", "C++": "text-pink-400", C: "text-pink-300",
  Ruby: "text-red-300", PHP: "text-indigo-300", Swift: "text-orange-300",
  Kotlin: "text-purple-300", Markdown: "text-gray-400", JSON: "text-gray-400",
  YAML: "text-gray-400", HTML: "text-orange-300", CSS: "text-blue-300",
  Shell: "text-green-400",
};

export default function RepoFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const [files, setFiles] = useState<RepoFileOut[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    params.then(async ({ id }) => {
      const access = tokenStore.getAccess();
      if (!access) return;
      try {
        const data = await reposApi.files(access, id);
        setFiles(data);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const filtered = (files ?? []).filter((f) =>
    f.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {files === null ? "" : `${filtered.length} / ${files.length} files`}
        </span>
        <input
          type="search"
          placeholder="Filter files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading files…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {search ? "No files match your filter." : "No files found."}
        </p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Path</th>
                <th className="px-4 py-3 text-left">Language</th>
                <th className="px-4 py-3 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-300">{f.path}</td>
                  <td className="px-4 py-2.5">
                    {f.language ? (
                      <span className={`text-xs font-medium ${LANG_COLOR[f.language] ?? "text-gray-400"}`}>
                        {f.language}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                    {f.size_bytes != null ? formatBytes(f.size_bytes) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
