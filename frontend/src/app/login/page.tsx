"use client";
import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { tokenStore } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.login(email, password);
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm relative z-20 mt-12">
      <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-black mb-4">SYSTEM ACCESS</h1>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-black/40">Enter identity token</p>
      </div>

      <div className="bg-white border border-black/10 shadow-sm p-8 relative group overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-black translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300" />

        {registered && (
          <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-xs tracking-wide uppercase">
            Account created — sign in to continue
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-600 font-medium text-xs tracking-wide uppercase">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-black/60 mb-2">Email Address</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#F9F9F9] border border-black/10 text-black placeholder-black/20 focus:outline-none focus:border-black transition-colors font-mono text-sm"
              placeholder="identity@arma.com"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-black/60 mb-2">Password Hash</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F9F9F9] border border-black/10 text-black placeholder-black/20 focus:outline-none focus:border-black transition-colors font-mono text-sm"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-black hover:bg-[#222] disabled:bg-black/50 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 mt-4"
          >
            {loading ? "Authenticating..." : "Initialize Session"}
            {!loading && <span className="text-white/50">→</span>}
          </button>
        </form>

        <p className="text-center text-black/40 text-[10px] uppercase tracking-[0.1em] font-bold mt-8">
          New agent?{" "}
          <Link href="/register" className="text-black font-black hover:underline underline-offset-4 decoration-black/20 transition">
            Request access
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9] text-[#111] font-sans selection:bg-black selection:text-white px-6 relative overflow-hidden">

      {/* Background accents */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-multiply z-0"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_30%,transparent_100%)] z-10"></div>
      </div>

      <nav className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-6 md:px-12 w-full max-w-[1600px] mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="text-black font-black text-2xl tracking-tighter">ARMA.</div>
          <div className="px-2 py-0.5 border border-black/10 rounded-full text-[10px] font-bold tracking-widest text-[#111] uppercase bg-black/5">
            Log In
          </div>
        </Link>
        <Link href="/register" className="text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors duration-300 font-bold">
          Register
        </Link>
      </nav>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
