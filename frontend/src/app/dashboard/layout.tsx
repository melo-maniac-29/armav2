"use client";
import AuthGuard from "@/components/auth-guard";
import Sidebar from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden bg-[#F9F9F9] text-[#111] font-sans selection:bg-black selection:text-white">
          <Sidebar email={user.email} />
          <main className="flex-1 overflow-y-auto relative z-10">{children}</main>
        </div>
      )}
    </AuthGuard>
  );
}
