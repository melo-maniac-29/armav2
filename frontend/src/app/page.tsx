import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">ARMA</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Sign in</Link>
          <Link href="/register" className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-950 border border-indigo-800 rounded-full px-3 py-1 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Autonomous · AI-powered · Open
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4 max-w-2xl leading-tight">
          Understand and improve your{" "}
          <span className="text-indigo-400">codebase automatically</span>
        </h1>

        <p className="text-gray-400 text-lg max-w-xl mb-10">
          ARMA connects to your GitHub repositories, detects bugs and security issues,
          then opens pull requests with AI-generated fixes — fully autonomous.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl transition text-sm"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-xl transition text-sm"
          >
            Sign in
          </Link>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 max-w-4xl w-full text-left">
          {[
            { icon: "🔍", title: "Issue Detection", desc: "Finds bugs, vulnerabilities, and code quality problems across your entire repo." },
            { icon: "🤖", title: "AI Fix Generation", desc: "GPT-4o writes targeted fixes with full context from your codebase graph." },
            { icon: "🔀", title: "Auto Pull Requests", desc: "Opens ready-to-merge PRs with tests, description, and impact analysis." },
            { icon: "📊", title: "Evolution Tracking", desc: "Memory of every change — track health, complexity, and risk over time." },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-sm mb-1">{f.title}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-600">
        ARMA — Autonomous Repository Memory &amp; Actions
      </footer>
    </div>
  );
}
