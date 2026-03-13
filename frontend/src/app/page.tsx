import Link from "next/link";
import React from "react";

const phases = [
  {
    id: "00",
    title: "Repository Memory",
    desc: "Ingests raw code into a Neo4j knowledge graph and pgvector embeddings. Every function, call, and commit is mapped continuously.",
  },
  {
    id: "01",
    title: "Autonomous Detection",
    desc: "Analyzes high-churn files via GPT-4o on every push. Detects security flaws, bugs, and performance bottlenecks before you do.",
  },
  {
    id: "02",
    title: "Sandboxed Resolution",
    desc: "Generates precise AST-aware patches, runs your test suites in isolated environments, and ensures correctness before opening PRs.",
  },
  {
    id: "03",
    title: "Feature Generation",
    desc: "From natural language to merged code. ARMA plans the architecture, writes the implementation, and ships the full feature autonomously.",
  },
];

const features = [
  "Tree-sitter AST Parsing",
  "Neo4j Knowledge Graph",
  "pgvector Semantic Search",
  "GPT-4o Context Injection",
  "Isolated Test Sandbox",
  "Automated Git Push",
  "Evolution Multi-Metrics",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111] font-sans selection:bg-black selection:text-white overflow-x-hidden">
      {/* Background accents */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <style>{`
          @keyframes flowRight {
            0% { transform: translateX(-10vw); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(110vw); opacity: 0; }
          }
          @keyframes flowDown {
            0% { transform: translateY(-10vh); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(110vh); opacity: 0; }
          }
          .animate-flow-r-1 { animation: flowRight 12s linear infinite; }
          .animate-flow-r-2 { animation: flowRight 18s linear infinite 3s; }
          .animate-flow-d-1 { animation: flowDown 15s linear infinite 1s; }
          .animate-flow-d-2 { animation: flowDown 22s linear infinite 6s; }
          .animate-flow-d-3 { animation: flowDown 19s linear infinite 4s; }
        `}</style>

        {/* Subtle noise */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.025] mix-blend-multiply z-0"></div>
        {/* Fine grid mask */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_40%,transparent_100%)] z-10"></div>
        
        {/* Architectural compute routing lines */}
        <div className="absolute inset-0 z-20 overflow-hidden mix-blend-multiply opacity-50">
           {/* Vertical Traces */}
           <div className="absolute left-[20%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/10 to-transparent" />
           <div className="absolute left-[40%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
           <div className="absolute left-[70%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/10 to-transparent" />
           <div className="absolute left-[85%] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />

           {/* Horizontal Traces */}
           <div className="absolute top-[25%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent" />
           <div className="absolute top-[55%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />
           <div className="absolute top-[75%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent" />

           {/* Moving Data Nodes (GPU execution) */}
           <div className="absolute top-[25%] left-0 w-[3px] h-[3px] bg-black -mt-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-r-1" />
           <div className="absolute top-[55%] left-0 w-[3px] h-[3px] bg-black -mt-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-r-2" />
           <div className="absolute top-[75%] left-0 w-[3px] h-[3px] bg-black -mt-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-r-1" style={{ animationDelay: '8s' }} />

           <div className="absolute left-[20%] top-0 w-[3px] h-[3px] bg-black -ml-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-d-1" />
           <div className="absolute left-[40%] top-0 w-[3px] h-[3px] bg-black -ml-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-d-2" />
           <div className="absolute left-[70%] top-0 w-[3px] h-[3px] bg-black -ml-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-d-3" />
           <div className="absolute left-[85%] top-0 w-[3px] h-[3px] bg-black -ml-[1px] shadow-[0_0_12px_rgba(0,0,0,1)] animate-flow-d-1" style={{ animationDelay: '5s' }} />
        </div>
      </div>

      <nav className="relative z-30 flex items-center justify-between px-6 py-6 md:px-12 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="text-black font-black text-2xl tracking-tighter mix-blend-difference">ARMA.</div>
          <div className="px-2 py-0.5 border border-black/10 rounded-full text-[10px] font-bold tracking-widest text-[#111] uppercase bg-black/5 backdrop-blur-sm">
            V3.0.0
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors duration-300 font-bold">
            Sign In
          </Link>
          <Link href="/register" className="text-xs uppercase tracking-widest text-black border border-black/20 hover:border-black px-5 py-3 rounded-full transition-all duration-300 hover:bg-black hover:text-white font-bold backdrop-blur-sm bg-white/50">
            System Access
          </Link>
        </div>
      </nav>

      <main className="relative z-30 w-full max-w-[1600px] mx-auto px-6 md:px-12">
        {/* Hero */}
        <section className="pt-24 pb-32 md:pt-40 md:pb-48">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest text-black mb-10 px-4 py-2 border border-black/10 rounded-full bg-white/80 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            System is fully operational
          </div>
          <h1 className="text-[4rem] md:text-[8rem] lg:text-[11rem] leading-[0.85] tracking-[-0.05em] font-medium text-black mb-12">
            CODEBASE<br />
            <span className="text-black/30 block mt-2">CONSCIOUSNESS.</span>
          </h1>
          <div className="grid md:grid-cols-2 gap-12 mt-20 md:mt-32 border-t border-black/10 pt-12">
            <p className="text-xl md:text-3xl text-black/60 font-medium leading-tight max-w-2xl tracking-tight">
              ARMA doesn&apos;t just read code. It deeply understands it. By combining AST parsing, Neo4j knowledge graphs, and semantic vector search, it fixes bugs and ships features entirely autonomously.
            </p>
            <div className="flex flex-col items-start md:items-end justify-start">
              <Link href="/register" className="group relative overflow-hidden bg-black text-white px-8 py-5 rounded-full outline-none flex items-center gap-4 hover:scale-105 transition-transform duration-500 hover:shadow-2xl">
                <span className="text-sm font-bold uppercase tracking-widest relative z-10">Initialize Sequence</span>
                <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center relative z-10 group-hover:translate-x-1 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                </span>
                <div className="absolute inset-0 bg-[#333] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </Link>
            </div>
          </div>
        </section>

        {/* The Pipeline */}
        <section className="py-32 border-t border-black/10">
          <div className="flex flex-col md:flex-row justify-between items-start mb-24">
            <h2 className="text-5xl md:text-7xl lg:text-8xl tracking-[-0.04em] text-black font-medium leading-[0.9]">
              THE <br /> PIPELINE
            </h2>
            <p className="text-black/50 max-w-xs text-xs uppercase font-bold tracking-[0.2em] leading-loose mt-8 md:mt-0">
              A four-phase architecture engineered for zero-touch repository management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
            {phases.map((phase) => (
              <div key={phase.id} className="relative group">
                <div className="text-black/40 font-mono text-sm mb-6 tracking-widest font-bold">{phase.id}</div>
                <div className="h-[2px] bg-black/10 w-full mb-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-black translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-700 ease-out" />
                </div>
                <h3 className="text-2xl text-black font-bold mb-4 tracking-tight">{phase.title}</h3>
                <p className="text-black/60 text-base leading-relaxed font-medium">{phase.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bento/Tech Stack */}
        <section className="py-32">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-black/10 shadow-sm rounded-[2rem] p-10 md:p-16 flex flex-col justify-between min-h-[450px] relative overflow-hidden group hover:shadow-lg transition-shadow duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 w-full">
                <div className="flex justify-between items-start w-full">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-8">Core Infrastructure</div>
                  <div className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center text-black/30 group-hover:bg-black group-hover:text-white transition-colors duration-500 bg-black/5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  </div>
                </div>
                <h3 className="text-4xl md:text-6xl text-black font-semibold tracking-tight max-w-xl mb-6 mt-12 leading-[1.1]">
                  Multi-database Intelligence
                </h3>
                <p className="text-black/60 max-w-md leading-relaxed text-lg font-medium">
                  PostgreSQL powers the state and vector embeddings. Neo4j connects the AST symbols, calls, and imports. LLMs traverse this graph to reason like a senior engineer.
                </p>
              </div>
            </div>

            <div className="bg-white border border-black/10 shadow-sm rounded-[2rem] p-10 md:p-16 flex flex-col min-h-[450px] relative overflow-hidden group hover:shadow-lg transition-shadow duration-500">
               <div className="relative z-10 w-full h-full flex flex-col">
                 <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-auto">Capabilities</div>
                 <ul className="space-y-4 mt-16 w-full">
                    {features.map((f, i) => (
                      <li key={i} className="flex justify-between items-center text-sm font-bold tracking-wide text-black/80 border-b border-black/5 pb-4">
                        <span>{f}</span>
                        <span className="text-black/30">✓</span>
                      </li>
                    ))}
                 </ul>
               </div>
            </div>
          </div>
        </section>

        {/* Big CTA */}
        <section className="py-40 md:py-52 flex flex-col items-center text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 mb-8 border border-black/10 px-4 py-2 rounded-full">Zero Human Intervention</div>
          <h2 className="text-[4rem] md:text-[9rem] tracking-[-0.05em] font-medium text-black mb-12 leading-[0.85]">
            READY TO <br /> AUTOMATE?
          </h2>
          <Link href="/register" className="group relative overflow-hidden inline-flex bg-black text-white px-12 py-6 rounded-full text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform duration-500 items-center justify-center shadow-xl">
            <span className="relative z-10">Deploy ARMA</span>
            <div className="absolute inset-0 bg-[#333] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          </Link>
        </section>
      </main>

      <footer className="w-full max-w-[1600px] mx-auto px-6 md:px-12 py-12 border-t border-black/10 flex flex-col md:flex-row items-center justify-between text-[10px] font-bold text-black/40 uppercase tracking-[0.2em]">
        <div>© 2026 ARMA System. All Rights Reserved.</div>
        <div className="flex gap-8 mt-6 md:mt-0">
          <Link href="/" className="hover:text-black transition-colors">Documentation</Link>
          <Link href="/" className="hover:text-black transition-colors">Architecture</Link>
          <Link href="/" className="hover:text-black transition-colors">GitHub</Link>
        </div>
      </footer>
    </div>
  );
}
