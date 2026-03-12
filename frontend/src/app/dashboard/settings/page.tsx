"use client";

import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/auth";
import { settingsApi, ApiError } from "@/lib/api";

export default function SettingsPage() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [pat, setPat] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const access = tokenStore.getAccess();
    if (!access) return;
    settingsApi.get(access).then((s) => setHasToken(s.has_github_token));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const access = tokenStore.getAccess()!;
      await settingsApi.savePat(access, pat.trim());
      setHasToken(true);
      setPat("");
      setMessage({ text: "GitHub token saved and verified.", ok: true });
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Failed to save token.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setMessage(null);
    setRemoving(true);
    try {
      const access = tokenStore.getAccess()!;
      await settingsApi.deletePat(access);
      setHasToken(false);
      setMessage({ text: "GitHub token removed.", ok: true });
    } catch {
      setMessage({ text: "Failed to remove token.", ok: false });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold mb-1">GitHub Personal Access Token</h2>
        <p className="text-sm text-gray-500 mb-4">
          Required for cloning private repos and opening pull requests. Generate a classic PAT with{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">repo</code> scope.
        </p>

        {hasToken === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : hasToken ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              GitHub Connected
            </span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={saving || !pat}
              className="self-start bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Token"}
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-3 text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
