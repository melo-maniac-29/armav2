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
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto font-sans">
      <div className="mb-12 border-b border-black/10 pb-8 relative">
        <h1 className="text-4xl md:text-5xl font-medium text-black mb-4 tracking-tight">CONFIGURATION.</h1>
        <p className="text-sm font-medium text-black/50 max-w-lg">Manage integrations and engine execution contexts.</p>
        {message && (
          <div className={`absolute top-0 right-0 px-4 py-3 border text-xs font-bold uppercase tracking-widest ${message.ok ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* GitHub Integration */}
        <section>
          <div className="flex items-center gap-3 mb-6 pb-2 border-b border-black/5">
             <span className="text-[10px] font-mono tracking-widest text-black/40">01.</span>
             <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Version Control Identity</h2>
          </div>
          
          <div className="bg-white border border-black/10 p-8 shadow-sm group hover:border-black transition-colors relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300" />
            <p className="text-xs text-black/60 font-medium mb-6 leading-relaxed">
              Required for source retrieval. Generate a PAT with <code className="bg-[#F9F9F9] border border-black/10 px-1.5 py-0.5 font-mono text-black font-bold">repo</code> and <code className="bg-[#F9F9F9] border border-black/10 px-1.5 py-0.5 font-mono text-black font-bold">admin:repo_hook</code> scopes.
            </p>
            
            {settings === null ? (
              <div className="animate-pulse flex h-12 bg-black/5 border border-black/10" />
            ) : settings.has_github_token ? (
              <div className="flex items-center justify-between border border-black/10 bg-[#F9F9F9] p-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
                    {checkIcon}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">Connected</span>
                </div>
                <button onClick={handleRemovePat} disabled={saving === "pat-del"} className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 hover:text-black hover:underline disabled:opacity-50">
                  {saving === "pat-del" ? "Terminating..." : "Terminate"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSavePat} className="flex gap-4">
                <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" required className="flex-1 bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors" />
                <button type="submit" disabled={saving === "pat" || !pat} className="shrink-0 bg-black hover:bg-[#222] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-8 disabled:opacity-50 transition-colors">
                  {saving === "pat" ? "Committing..." : "Commit"}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="row-span-2">
          <div className="flex items-center gap-3 mb-6 pb-2 border-b border-black/5">
             <span className="text-[10px] font-mono tracking-widest text-black/40">02.</span>
             <h2 className="text-sm font-bold text-black uppercase tracking-[0.2em]">Execution Engines</h2>
          </div>
          
          <div className="bg-white border border-black/10 shadow-sm p-8 group hover:border-black transition-colors relative space-y-10">
            <div className="absolute top-0 right-0 w-1 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom duration-300" />
            
            <div>
              <p className="text-xs text-black/60 font-medium mb-6 leading-relaxed">
                Connect API endpoints for Semantic Space generation and AST Analysis capabilities. Compatible with OpenAI, LM Studio, and generic inferences.
              </p>
            </div>

            {/* API Key */}
            <div className="pt-6 border-t border-black/5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-4">Core Provider Cryptography</label>
              {settings?.has_openai_key ? (
                <div className="flex items-center justify-between border border-black/10 bg-[#F9F9F9] p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
                      {checkIcon}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">Active</span>
                  </div>
                  <button onClick={handleRemoveOpenAIKey} disabled={saving === "ai-del"} className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 hover:text-black hover:underline disabled:opacity-50">
                    {saving === "ai-del" ? "Terminating..." : "Terminate"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveOpenAIKey} className="flex gap-4">
                  <input type="password" value={openAIKey} onChange={(e) => setOpenAIKey(e.target.value)} placeholder="sk-..." required className="flex-1 bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors" />
                  <button type="submit" disabled={saving === "ai" || !openAIKey} className="shrink-0 bg-black hover:bg-[#222] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-8 disabled:opacity-50 transition-colors">
                    {saving === "ai" ? "Committing..." : "Commit"}
                  </button>
                </form>
              )}
            </div>

            {/* API Base URL */}
            <div className="pt-6 border-t border-black/5">
              <label className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">Analysis Endpoint</span>
                <span className="text-[9px] font-mono text-black/30">Optional</span>
              </label>
              <form onSubmit={handleSaveApiBase} className="flex gap-4">
                <input type="url" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://localhost:5005/v1" className="flex-1 bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors" />
                <button type="submit" disabled={saving === "base"} className="shrink-0 bg-black hover:bg-[#222] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-8 disabled:opacity-50 transition-colors">
                  {saving === "base" ? "..." : "Save"}
                </button>
              </form>
            </div>

            {/* Embed API Base URL */}
            <div className="pt-6 border-t border-black/5">
              <label className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">Embedding Endpoint</span>
                <span className="text-[9px] font-mono text-black/30">Optional</span>
              </label>
              <form onSubmit={handleSaveEmbedApiBase} className="flex gap-4">
                <input type="url" value={embedApiBase} onChange={(e) => setEmbedApiBase(e.target.value)} placeholder="http://172.29.80.1:1234/v1" className="flex-1 bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors" />
                <button type="submit" disabled={saving === "embed-base"} className="shrink-0 bg-black hover:bg-[#222] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-8 disabled:opacity-50 transition-colors">
                  {saving === "embed-base" ? "..." : "Save"}
                </button>
              </form>
            </div>

            {/* Vector Space / Analysis Matrix Configuration*/}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-black/5">
               <div>
                 <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-2">Vector Tensor</label>
                 <form onSubmit={handleSaveEmbeddingModel}>
                   <input type="text" value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} placeholder="text-embedding-ada-002" className="w-full bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors mb-2" />
                   <button type="submit" disabled={saving === "embed" || !embeddingModel} className="w-full bg-black/5 hover:bg-black/10 text-black text-[10px] font-bold uppercase tracking-[0.2em] py-3 disabled:opacity-50 transition-colors">
                     {saving === "embed" ? "..." : "Lock Tensor"}
                   </button>
                 </form>
               </div>
               <div>
                 <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-2">AST Node</label>
                 <form onSubmit={handleSaveAnalysisModel}>
                   <input type="text" value={analysisModel} onChange={(e) => setAnalysisModel(e.target.value)} placeholder="gpt-4o" className="w-full bg-[#F9F9F9] border border-black/10 px-4 py-3 font-mono text-sm placeholder-black/20 focus:outline-none focus:border-black transition-colors mb-2" />
                   <button type="submit" disabled={saving === "analysis" || !analysisModel} className="w-full bg-black/5 hover:bg-black/10 text-black text-[10px] font-bold uppercase tracking-[0.2em] py-3 disabled:opacity-50 transition-colors">
                     {saving === "analysis" ? "..." : "Lock Node"}
                   </button>
                 </form>
               </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}

