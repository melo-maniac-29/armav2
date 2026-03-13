"use client";

import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/auth";
import { reposApi, RepoFileOut } from "@/lib/api";

const LANG_COLOR: Record<string, string> = {
  Python: "text-blue-600", TypeScript: "text-blue-500", JavaScript: "text-yellow-600",
  Go: "text-cyan-600", Rust: "text-orange-600", Java: "text-red-600",
  "C#": "text-purple-600", "C++": "text-pink-600", C: "text-pink-500",
  Ruby: "text-red-500", PHP: "text-indigo-500", Swift: "text-orange-500",
  Kotlin: "text-purple-500", Markdown: "text-black/40", JSON: "text-black/40",
  YAML: "text-black/40", HTML: "text-orange-500", CSS: "text-blue-500",
  Shell: "text-green-600",
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
    <div className="font-sans">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-8 border-b border-black/10 gap-6">
        <div>
           <h2 className="text-2xl font-medium text-black tracking-tight mb-2">FILE SYSTEM</h2>
           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
             {files === null ? "Initializing..." : `${filtered.length} OF ${files.length} NODES`}
           </span>
        </div>
        <input
          type="search"
          placeholder="Filter file path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-3 bg-white border border-black/10 text-sm font-mono text-black placeholder-black/30 focus:outline-none focus:border-black transition-colors w-full md:w-80 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-white border border-black/5 shadow-sm animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-32 bg-white border border-dashed border-black/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
            {search ? "Zero nodes match active query." : "Zero nodes located."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-black/10 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-black/10 text-[10px] font-bold text-black/40 uppercase tracking-[0.2em] bg-[#F9F9F9]">
                <th className="px-6 py-4 font-bold w-full">Node Path</th>
                <th className="px-6 py-4 font-bold whitespace-nowrap">Lexicon</th>
                <th className="px-6 py-4 font-bold text-right whitespace-nowrap">Mass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-black/5 transition-colors group"
                >
                  <td className="px-6 py-4 font-mono text-[11px] text-black tracking-tight max-w-0 truncate">
                      {f.path}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {f.language ? (
                      <span className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 border border-black/5 bg-[#F9F9F9] ${LANG_COLOR[f.language] ?? "text-black/50"}`}>
                        {f.language}
                      </span>
                    ) : (
                      <span className="text-[10px] text-black/20">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="text-[10px] font-mono tracking-tight text-black/50 group-hover:text-black transition-colors">
                        {f.size_bytes != null ? formatBytes(f.size_bytes) : "—"}
                    </span>
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
