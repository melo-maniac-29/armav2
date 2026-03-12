"use client";
import Cookies from "js-cookie";

const ACCESS_TOKEN_KEY = "arma_access";
const REFRESH_TOKEN_KEY = "arma_refresh";

export const tokenStore = {
  getAccess: () => Cookies.get(ACCESS_TOKEN_KEY) ?? null,
  getRefresh: () => Cookies.get(REFRESH_TOKEN_KEY) ?? null,

  set: (access: string, refresh: string) => {
    Cookies.set(ACCESS_TOKEN_KEY, access, { expires: 1, sameSite: "Lax" });
    Cookies.set(REFRESH_TOKEN_KEY, refresh, { expires: 30, sameSite: "Lax" });
  },

  clear: () => {
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
  },
};
