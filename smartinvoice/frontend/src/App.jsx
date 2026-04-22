import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import Login from "./screens/Login";
import SetupWizard from "./screens/SetupWizard";
import AppShell from "./components/AppShell";
import Dashboard from "./screens/Dashboard";
import InvoiceList from "./screens/InvoiceList";
import CreateInvoice from "./screens/CreateInvoice";
import InvoiceDetail from "./screens/InvoiceDetail";
import AIInsights from "./screens/AIInsights";

export default function App() {
  const session = useSession();

  if (session.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }
  if (!session.ownerExists) return <SetupWizard onSetup={session.setup} />;
  if (!session.authenticated) return <Login onLogin={session.login} />;

  return (
    <AppShell username={session.username} onLogout={session.logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<CreateInvoice />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/invoices/:id/edit" element={<CreateInvoice editMode />} />
        <Route path="/insights" element={<AIInsights />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
