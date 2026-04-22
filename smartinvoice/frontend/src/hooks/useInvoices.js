import { useCallback } from "react";
import { api } from "../api/client";

export function useInvoices() {
  const list = useCallback(async (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k, v);
    const qs = q.toString();
    return api.get(`/api/invoices${qs ? `?${qs}` : ""}`);
  }, []);

  return {
    list,
    create: (payload) => api.post("/api/invoices", payload),
    get: (id) => api.get(`/api/invoices/${id}`),
    update: (id, payload) => api.patch(`/api/invoices/${id}`, payload),
    patchStatus: (id, status) => api.patch(`/api/invoices/${id}/status`, { status }),
    del: (id) => api.del(`/api/invoices/${id}`),
    recordPayment: (id, payload) => api.post(`/api/invoices/${id}/payments`, payload),
    pdfUrl: (id) => `/api/invoices/${id}/pdf`,
    csvUrl: (status) => `/api/invoices/export.csv${status ? `?status=${status}` : ""}`,
  };
}

export function useClients() {
  return {
    list: () => api.get("/api/clients"),
    create: (payload) => api.post("/api/clients", payload),
    get: (id) => api.get(`/api/clients/${id}`),
  };
}

export function useDashboard() {
  return { get: () => api.get("/api/dashboard") };
}

export function useInsights() {
  return { get: () => api.get("/api/insights") };
}
