import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const navStyle = {
  sidebar: {
    width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)",
    height: "100vh", position: "fixed", top: 0, left: 0, display: "flex", flexDirection: "column"
  },
  brand: { padding: "20px 18px", borderBottom: "1px solid var(--border)", fontSize: 17, fontWeight: 700 },
  brandAccent: { color: "var(--accent)" },
  label: { fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "var(--text-muted)",
    textTransform: "uppercase", padding: "18px 18px 6px" },
  link: { display: "flex", alignItems: "center", gap: 10, padding: "9px 18px",
    color: "var(--text-muted)", textDecoration: "none", fontSize: 14, borderLeft: "3px solid transparent" },
  linkActive: { background: "var(--accent-soft)", color: "var(--text)", borderLeftColor: "var(--accent)" },
  footer: { marginTop: "auto", padding: "16px 18px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" },
  main: { marginLeft: 220 },
  topbar: { background: "var(--surface)", borderBottom: "1px solid var(--border)",
    padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", top: 0, zIndex: 50 },
  content: { padding: 28 },
  avatar: { width: 32, height: 32, background: "var(--accent)", borderRadius: "50%",
    color: "#fff", fontSize: 13, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center" }
};

function Link({ to, icon, children, end, exclude }) {
  const { pathname } = useLocation();
  let active;
  if (end) {
    active = pathname === to;
  } else {
    const matches = pathname === to || pathname.startsWith(to + "/");
    const excluded = (exclude || []).some((e) => pathname === e || pathname.startsWith(e + "/"));
    active = matches && !excluded;
  }
  return (
    <NavLink to={to}
      style={active ? { ...navStyle.link, ...navStyle.linkActive } : navStyle.link}>
      <span style={{ width: 20, textAlign: "center" }}>{icon}</span>
      {children}
    </NavLink>
  );
}

export default function AppShell({ username, onLogout, children }) {
  return (
    <>
      <aside style={navStyle.sidebar}>
        <div style={navStyle.brand}>Smart<span style={navStyle.brandAccent}>Invoice</span></div>
        <div style={navStyle.label}>Main</div>
        <nav>
          <Link to="/" icon="📊" end>Dashboard</Link>
          <Link to="/invoices" icon="🧾" exclude={["/invoices/new"]}>Invoices</Link>
          <Link to="/invoices/new" icon="➕" end>New Invoice</Link>
        </nav>
        <div style={navStyle.label}>Intelligence</div>
        <nav>
          <Link to="/insights" icon="🤖">AI Insights</Link>
        </nav>
        <div style={navStyle.footer}>
          <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{username}</div>
          <button className="btn-ghost btn-sm" onClick={onLogout} style={{ marginTop: 8, width: "100%" }}>Logout</button>
        </div>
      </aside>
      <main style={navStyle.main}>
        <div style={navStyle.topbar}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>SmartInvoice</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <div style={navStyle.avatar}>{(username || "?").charAt(0).toUpperCase()}</div>
          </div>
        </div>
        <div style={navStyle.content}>{children}</div>
      </main>
    </>
  );
}
