"use client";

import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/auth";
import { settingsApi, ApiError, SettingsResponse } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [pat, setPat] = useState("");
  const [openAIKey, setOpenAIKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [embedApiBase, setEmbedApiBase] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [analysisModel, setAnalysisModel] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const access = tokenStore.getAccess();
    if (!access) return;
    settingsApi.get(access).then((s) => {
      setSettings(s);
      setApiBase(s.openai_api_base ?? "");
      setEmbedApiBase(s.embed_api_base ?? "");
      setEmbeddingModel(s.embedding_model ?? "");
      setAnalysisModel(s.analysis_model ?? "");
    });
  }, []);

  function flash(text: string, ok: boolean) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleSavePat(e: React.FormEvent) {
    e.preventDefault();
    setSaving("pat");
    try {
      const s = await settingsApi.savePat(tokenStore.getAccess()!, pat.trim());
      setSettings(s);
      setPat("");
      flash("GitHub token saved and verified.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save token.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleRemovePat() {
    setSaving("pat-del");
    try {
      const s = await settingsApi.deletePat(tokenStore.getAccess()!);
      setSettings(s);
      flash("GitHub token removed.", true);
    } catch {
      flash("Failed to remove token.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveOpenAIKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving("ai");
    try {
      const s = await settingsApi.saveOpenAIKey(tokenStore.getAccess()!, openAIKey.trim());
      setSettings(s);
      setOpenAIKey("");
      flash("API key saved.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save key.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleRemoveOpenAIKey() {
    setSaving("ai-del");
    try {
      const s = await settingsApi.deleteOpenAIKey(tokenStore.getAccess()!);
      setSettings(s);
      flash("API key removed.", true);
    } catch {
      flash("Failed to remove key.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveApiBase(e: React.FormEvent) {
    e.preventDefault();
    setSaving("base");
    try {
      const s = await settingsApi.saveApiBase(tokenStore.getAccess()!, apiBase.trim());
      setSettings(s);
      flash("API base URL saved.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save URL.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveEmbedApiBase(e: React.FormEvent) {
    e.preventDefault();
    setSaving("embed-base");
    try {
      const s = await settingsApi.saveEmbedApiBase(tokenStore.getAccess()!, embedApiBase.trim());
      setSettings(s);
      flash("Embed API base URL saved.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save URL.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveEmbeddingModel(e: React.FormEvent) {
    e.preventDefault();
    setSaving("embed");
    try {
      const s = await settingsApi.saveEmbeddingModel(tokenStore.getAccess()!, embeddingModel.trim());
      setSettings(s);
      flash("Embedding model saved.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save model.", false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAnalysisModel(e: React.FormEvent) {
    e.preventDefault();
    setSaving("analysis");
    try {
      const s = await settingsApi.saveAnalysisModel(tokenStore.getAccess()!, analysisModel.trim());
      setSettings(s);
      flash("Analysis model saved.", true);
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Failed to save model.", false);
    } finally {
      setSaving(null);
    }
  }

  const checkIcon = (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* GitHub PAT */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold mb-1">GitHub Personal Access Token</h2>
        <p className="text-sm text-gray-500 mb-4">
          Required for cloning repos. Generate a classic PAT with{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">repo</code> and{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">admin:repo_hook</code> scopes.
        </p>
        {settings === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : settings.has_github_token ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              {checkIcon} GitHub Connected
            </span>
            <button onClick={handleRemovePat} disabled={saving === "pat-del"} className="text-sm text-red-600 hover:underline disabled:opacity-50">
              {saving === "pat-del" ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSavePat} className="flex flex-col gap-3">
            <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={saving === "pat" || !pat} className="self-start bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {saving === "pat" ? "Saving…" : "Save Token"}
            </button>
          </form>
        )}
      </section>

      {/* LLM Server Configuration */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-1">LLM Server</h2>
          <p className="text-sm text-gray-500">
            Configure your local or cloud OpenAI-compatible server (LM Studio, Ollama, OpenAI, etc.).
            The API key is encrypted; the URL and model names are stored as plain text.
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          {settings?.has_openai_key ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                {checkIcon} Key saved
              </span>
              <button onClick={handleRemoveOpenAIKey} disabled={saving === "ai-del"} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                {saving === "ai-del" ? "Removing…" : "Remove"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveOpenAIKey} className="flex gap-2">
              <input type="password" value={openAIKey} onChange={(e) => setOpenAIKey(e.target.value)} placeholder="sk-..." required className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={saving === "ai" || !openAIKey} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {saving === "ai" ? "Saving…" : "Save"}
              </button>
            </form>
          )}
        </div>

        {/* API Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chat API Base URL</label>
          <p className="text-xs text-gray-400 mb-2">For analysis / fix / feature LLM calls. e.g. http://localhost:5005/v1 (leave blank for OpenAI default)</p>
          <form onSubmit={handleSaveApiBase} className="flex gap-2">
            <input type="url" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://localhost:5005/v1" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={saving === "base"} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {saving === "base" ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        {/* Embed API Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Embed API Base URL</label>
          <p className="text-xs text-gray-400 mb-2">For embedding calls (LM Studio direct). e.g. http://172.29.80.1:1234/v1 — falls back to Chat API Base if blank</p>
          <form onSubmit={handleSaveEmbedApiBase} className="flex gap-2">
            <input type="url" value={embedApiBase} onChange={(e) => setEmbedApiBase(e.target.value)} placeholder="http://172.29.80.1:1234/v1" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={saving === "embed-base"} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {saving === "embed-base" ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        {/* Embedding Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Model</label>
          <p className="text-xs text-gray-400 mb-2">Used for semantic code search. e.g. text-embedding-ada-002, nomic-embed-text</p>
          <form onSubmit={handleSaveEmbeddingModel} className="flex gap-2">
            <input type="text" value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} placeholder="text-embedding-ada-002" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={saving === "embed" || !embeddingModel} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {saving === "embed" ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        {/* Analysis Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Model</label>
          <p className="text-xs text-gray-400 mb-2">Used for code review / issue detection. e.g. gpt-4, gpt-4o, deepseek-coder</p>
          <form onSubmit={handleSaveAnalysisModel} className="flex gap-2">
            <input type="text" value={analysisModel} onChange={(e) => setAnalysisModel(e.target.value)} placeholder="gpt-4" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={saving === "analysis" || !analysisModel} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {saving === "analysis" ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      </section>

      {message && (
        <p className={`text-sm font-medium ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

