"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Command Center", icon: "01." },
  { href: "/dashboard/repos", label: "Workspaces", icon: "02." },
  { href: "/dashboard/settings", label: "Configuration", icon: "03." },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  function logout() {
    tokenStore.clear();
    router.replace("/login");
  }

  return (
    <aside className={`shrink-0 bg-[#F9F9F9] border-r border-black/10 flex flex-col font-sans transition-all duration-300 relative opacity-100 ${isOpen ? "w-64" : "w-16"}`}>
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3.5 top-8 bg-white border border-black/20 shadow-md rounded-full w-7 h-7 flex items-center justify-center text-[10px] hover:scale-110 hover:border-black transition-all z-50 text-black/60 hover:text-black"
        title="Toggle Sidebar"
      >
        {isOpen ? "◀" : "▶"}
      </button>

      {/* Logo */}
      <div className={`py-8 border-b border-black/10 flex items-center transition-all ${isOpen ? "px-8 justify-between" : "px-0 justify-center"}`}>
        <Link href="/" className="text-2xl font-black text-black tracking-tighter">
          {isOpen ? "ARMA." : "A."}
        </Link>
        {isOpen && <span className="text-[10px] font-bold text-black/40 uppercase tracking-[0.2em] border border-black/10 px-2 py-0.5 whitespace-nowrap">v3</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-8 flex flex-col">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-baseline gap-4 py-4 font-bold uppercase tracking-[0.1em] transition-all duration-300 relative group overflow-hidden ${
                isOpen ? "px-8 text-sm" : "px-0 justify-center text-xs"
              } ${
                active
                  ? "text-black bg-black/5"
                  : "text-black/40 hover:text-black hover:bg-white"
              }`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-black transition-transform duration-300 ${active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"}`} />
              <span className={`font-mono tracking-widest ${active ? "text-black/60" : "text-black/30 group-hover:text-black/50"} transition-colors text-[10px]`}>
                {icon}
              </span>
              {isOpen && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={`py-8 border-t border-black/10 bg-white/50 backdrop-blur-sm transition-all ${isOpen ? "px-8" : "px-2"}`}>
        {isOpen ? (
          <div className="mb-4 overflow-hidden">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-black/40 mb-1 whitespace-nowrap">Active Agent</p>
            <p className="text-sm text-black font-mono truncate">{email}</p>
          </div>
        ) : (
          <div className="mb-4 flex justify-center">
            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center border border-black/10 font-bold text-xs uppercase text-black" title={email}>
              {email.charAt(0)}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title="Terminate Session"
          className={`w-full flex items-center py-3 border border-black/10 hover:border-black rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] text-black/60 hover:text-black hover:bg-black/5 transition-all group overflow-hidden ${isOpen ? "justify-between px-4" : "justify-center px-0"}`}
        >
          {isOpen && <span className="whitespace-nowrap">Terminate</span>}
          <span className="font-mono group-hover:translate-x-1 transition-transform text-xs">→</span>
        </button>
      </div>
    </aside>
  );
}
