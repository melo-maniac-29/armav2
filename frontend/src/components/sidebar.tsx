"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⬡" },
  { href: "/dashboard/repos", label: "Repositories", icon: "⊞" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    tokenStore.clear();
    router.replace("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white tracking-tight">ARMA</span>
        <p className="text-xs text-gray-500 mt-0.5">v3</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
        >
          <span className="text-base">→</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
