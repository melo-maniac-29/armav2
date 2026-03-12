"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { authApi, UserResponse, ApiError } from "@/lib/api";

interface AuthGuardProps {
  children: (user: UserResponse) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) {
      router.replace("/login");
      return;
    }
    authApi
      .me(token)
      .then(setUser)
      .catch(async (err) => {
        if (err instanceof ApiError && err.status === 401) {
          // try refresh
          const refresh = tokenStore.getRefresh();
          if (refresh) {
            try {
              const tokens = await authApi.refresh(refresh);
              tokenStore.set(tokens.access_token, tokens.refresh_token);
              const u = await authApi.me(tokens.access_token);
              setUser(u);
              return;
            } catch {}
          }
          tokenStore.clear();
          router.replace("/login");
        }
      })
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children(user)}</>;
}
