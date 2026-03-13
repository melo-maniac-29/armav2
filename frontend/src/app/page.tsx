import Link from "next/link";
import React from "react";

const architectureSteps = [
  { num: "01", name: "Semantic Ingestion", desc: "Raw code transformed into a Neo4j knowledge graph and pgvector space. Every function and call is continuously indexed." },
  { num: "02", name: "Event Monitoring", desc: "Webhooks listen for Git push events, triggering delta-based codebase analysis using deep GPT-4o context." },
  { num: "03", name: "Anomaly Detection", desc: "Proactively identifies security flaws, logical regressions, and architectural debt before humans review." },
  { num: "04", name: "Sandboxed Patches", desc: "Generates semantic fixes, validates them in an isolated test environment, and opens targeted Pull Requests." },
];

const tickerItems = [
  "SYSTEM ONLINE", "NEO4J CONNECTED", "POSTGRES ACTIVE", "AST PARSING READY", "SANDBOX ISOLATED", "MODELS LOADED",
  "SYSTEM ONLINE", "NEO4J CONNECTED", "POSTGRES ACTIVE", "AST PARSING READY", "SANDBOX ISOLATED", "MODELS LOADED"
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
          @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-ticker { animation: ticker 20s linear infinite; }
          .animate-flow-r-1 { animation: flowRight 12s linear infinite; }
          .animate-flow-r-2 { animation: flowRight 18s linear infinite 3s; }
          .animate-flow-d-1 { animation: flowDown 15s linear infinite 1s; }
          .animate-flow-d-2 { animation: flowDown 22s linear infinite 6s; }
          .animate-flow-d-3 { animation: flowDown 19s linear infinite 4s; }
        `}</style>

        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.025] mix-blend-multiply z-0" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_40%,transparent_100%)] z-10" />
        
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

           {/* GPU Nodes */}
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

      <main className="relative z-30 w-full">
        {/* Hero Section */}
        <section className="pt-24 pb-32 md:pt-40 md:pb-48 px-6 md:px-12 max-w-[1600px] mx-auto min-h-[90vh] flex flex-col justify-center">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest text-black mb-10 px-4 py-2 border border-black/10 rounded-full bg-white/80 backdrop-blur-md shadow-sm self-start">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            System is fully operational
          </div>
          <h1 className="text-[4rem] md:text-[8rem] lg:text-[11.5rem] leading-[0.8] tracking-[-0.05em] font-medium text-black mb-12">
            CODEBASE<br />
            <span className="text-black/30 block mt-4">CONTROLLER.</span>
          </h1>
          
          <div className="grid md:grid-cols-2 gap-12 mt-20 md:mt-32 border-t border-black/10 pt-12 items-end">
            <p className="text-xl md:text-3xl text-black/60 font-medium leading-tight max-w-2xl tracking-tight">
              An autonomous intelligence layer. ARMA maps your repository into a graph, monitors every push, detects critical anomalies, and opens sandboxed Pull Requests to fix them.
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

        {/* Ticker Tape */}
        <div className="w-full border-y border-black/10 overflow-hidden bg-white/30 backdrop-blur-sm py-4">
          <div className="whitespace-nowrap flex w-[200%] animate-ticker">
            {tickerItems.map((item, i) => (
              <span key={i} className="mx-8 text-[10px] font-bold uppercase tracking-[0.3em] text-black/40">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Massive Architecture List */}
        <section className="py-32 md:py-48 px-6 md:px-12 max-w-[1600px] mx-auto border-b border-black/10">
          <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-black/50 mb-20 px-4 py-2 border border-black/10 rounded-full inline-block">
            System Architecture
          </div>
          
          <div className="flex flex-col w-full">
            {architectureSteps.map((step) => (
              <div key={step.num} className="group relative flex flex-col md:flex-row md:items-start justify-between py-16 border-t border-black/10 hover:bg-white/50 transition-colors duration-500 px-6 -mx-6">
                
                <div className="md:w-1/3 mb-8 md:mb-0">
                  <span className="text-black/30 font-mono text-2xl md:text-4xl block mb-4">{step.num}</span>
                  <h3 className="text-3xl md:text-5xl font-medium tracking-tight text-black group-hover:pl-4 transition-all duration-500">{step.name}</h3>
                </div>

                <div className="md:w-1/2">
                  <p className="text-xl md:text-2xl text-black/60 font-medium leading-relaxed tracking-tight group-hover:text-black transition-colors duration-500">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t border-black/10 w-full" />
          </div>
        </section>

        {/* Core Capabilities - Structural Grid Instead of Ball */}
        <section className="py-32 md:py-48 px-6 md:px-12 max-w-[1600px] mx-auto border-b border-black/10">
          <div className="grid lg:grid-cols-2 gap-20 items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-6xl md:text-[6rem] leading-[0.85] tracking-[-0.05em] font-medium text-black mb-10">
                  TRUE <br /> AUTONOMY.
                </h2>
                <p className="text-xl text-black/60 font-medium leading-relaxed max-w-lg">
                  Most tools simply wrap a prompt around your code. ARMA builds a native multidimensional graph of your software, operating continuously in the background to prevent regressions.
                </p>
              </div>
              <div className="hidden lg:block">
                 <div className="w-16 h-1 bg-black mb-6"></div>
                 <p className="text-xs uppercase tracking-[0.2em] font-bold text-black/40">Multi-database Architecture</p>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-px bg-black/10 border border-black/10">
                {[
                  { label: "State", val: "PostgreSQL" },
                  { label: "Vector", val: "pgvector" },
                  { label: "Graph", val: "Neo4j" },
                  { label: "Parsing", val: "Tree-sitter" },
                  { label: "Execution", val: "Docker Sandbox" },
                  { label: "Intelligence", val: "GPT-4o" },
                ].map((item, i) => (
                  <div key={i} className="bg-[#F9F9F9] p-8 md:p-12 flex flex-col group hover:bg-white transition-colors duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-black translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 mb-4">{item.label}</span>
                    <span className="text-lg md:text-2xl font-semibold text-black tracking-tight">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Refined Conclusion / Big CTA */}
        <section className="py-32 md:py-48 flex flex-col px-6 md:px-12 max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-16">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/40 mb-8 flex items-center gap-4">
                <span className="w-12 h-px bg-black/20"></span> Final Sequence
              </div>
              <h2 className="text-[5rem] md:text-[8rem] lg:text-[10rem] tracking-[-0.06em] font-medium text-black leading-[0.85]">
                DEPLOY<br />
                <span className="text-black/20">ARMA.</span>
              </h2>
            </div>
            
            <div className="pb-4">
              <Link href="/register" className="group relative overflow-hidden inline-flex bg-black text-white p-2 pr-8 rounded-full outline-none items-center gap-8 hover:shadow-2xl transition-all duration-500 w-full md:w-auto">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center relative z-10 group-hover:rotate-45 transition-transform duration-500 shadow-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                </div>
                <span className="text-sm font-bold uppercase tracking-[0.2em] relative z-10 group-hover:text-white transition-colors">Start Integration</span>
                <div className="absolute inset-0 bg-[#333] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-700 ease-out" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full max-w-[1600px] mx-auto px-6 md:px-12 py-12 border-t border-black/10 flex flex-col md:flex-row items-center justify-between text-[10px] font-bold text-black/40 uppercase tracking-[0.3em]">
        <div>© 2026 ARMA System. Architecture V3.</div>
        <div className="flex gap-8 mt-6 md:mt-0">
          <Link href="/" className="hover:text-black transition-colors">Documentation</Link>
          <Link href="/" className="hover:text-black transition-colors">Manifesto</Link>
          <Link href="/" className="hover:text-black transition-colors">GitHub</Link>
        </div>
      </footer>
    </div>
  );
}
