import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";

export function useSession() {
  const [state, setState] = useState({ loading: true, authenticated: false, ownerExists: false, username: null });

  const refresh = useCallback(async () => {
    try {
      const r = await api.get("/api/session");
      setState({ loading: false, ...r });
    } catch {
      setState({ loading: false, authenticated: false, ownerExists: false, username: null });
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauth = () => setState((s) => ({ ...s, authenticated: false }));
    window.addEventListener("unauthenticated", onUnauth);
    return () => window.removeEventListener("unauthenticated", onUnauth);
  }, [refresh]);

  const login = async (username, password) => {
    await api.post("/api/login", { username, password });
    await refresh();
  };
  const setup = async (username, password) => {
    await api.post("/api/setup", { username, password });
    await refresh();
  };
  const logout = async () => {
    try { await api.post("/api/logout", {}); } catch {}
    await refresh();
  };

  return { ...state, refresh, login, setup, logout };
}
