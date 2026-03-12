"use client";
import AuthGuard from "@/components/auth-guard";
import Sidebar from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden bg-gray-950">
          <Sidebar email={user.email} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      )}
    </AuthGuard>
  );
}
