import { useEffect, useState } from "react";
import {
  LayoutDashboard, Ticket, Users, WalletCards, CreditCard, BarChart3, Settings,
  LogOut, TrainFront, Plus, Search, Menu, X, QrCode
} from "lucide-react";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TicketBookingPage from "./pages/TicketBookingPage";
import PartyCenterPage from "./pages/PartyCenterPage";
import AddPartyPage from "./pages/AddPartyPage";
import LedgerPaymentsPage from "./pages/LedgerPaymentsPage";
import ReceivePaymentPage from "./pages/ReceivePaymentPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import BalancePaymentPage from "./pages/BalancePaymentPage";
import PartyLedgerPage from "./pages/PartyLedgerPage";
import QrScannerPage from "./pages/QrScannerPage";

import "./styles.css";
import { API } from "./apiConfig";

const menu = [
  [LayoutDashboard, "Dashboard", "dashboard", "/dashboard"],
  [Ticket, "Ticket Booking", "tickets", "/ticket-booking"],
  [Users, "Party / Customer", "parties", "/party"],
  [WalletCards, "Ledger / Payments", "ledger", "/ledger"],
  [CreditCard, "Receive Payment", "receive-payment", "/receive-payment"],
  [BarChart3, "Reports", "reports", "/reports"],
  [WalletCards, "Balance Payment", "balance-payment", "/reports/balance-payment"],
  [WalletCards, "Party Ledger", "party-ledger", "/reports/party-ledger"],
  [QrCode, "QR Scanner", "qr-scanner", "/qr-scanner"],
  [Settings, "Settings", "settings", "/settings"]
];

const ROUTES = {
  "/dashboard": "dashboard",
  "/ticket-booking": "tickets",
  "/tickets": "tickets",
  "/party": "parties",
  "/party/add": "party-add",
  "/user": "parties",
  "/user/add": "party-add",
  "/add-user": "party-add",
  "/ledger": "ledger",
  "/receive-payment": "receive-payment",
  "/reports": "reports",
  "/reports/balance-payment": "balance-payment",
  "/reports/party-ledger": "party-ledger",
  "/report": "reports",
  "/qr-scanner": "qr-scanner",
  "/settings": "settings"
};

function getRoute(pathname = window.location.pathname) {
  return ROUTES[pathname] || null;
}

function canonicalPath(key) {
  return menu.find(item => item[2] === key)?.[3] || "/dashboard";
}

function navigate(path, replace = false) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function authHeaders() {
  const token = localStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

function AppShell({ user, onLogout }) {
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(() => getRoute() || "dashboard");
  const [summary, setSummary] = useState({ partyCount: 0, ticketCount: 0, outstanding: "0.00", todayBookings: 0 });

  useEffect(() => {
    const handlePopState = () => {
      const route = getRoute();
      if (route) setPage(route);
      else navigate("/dashboard", true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const route = getRoute();
    if (!route) navigate("/dashboard", true);
    else setPage(route);
  }, []);

  useEffect(() => {
    fetch(API + "/api/dashboard/summary", { credentials: "include", headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSummary(d))
      .catch(() => {});
  }, []);

  function go(keyOrPath) {
    const path = keyOrPath.startsWith("/") ? keyOrPath : canonicalPath(keyOrPath);
    navigate(path);
  }

  function renderPage() {
    switch (page) {
      case "tickets": return <TicketBookingPage />;
      case "parties": return <PartyCenterPage />;
      case "party-add": return <AddPartyPage />;
      case "ledger": return <LedgerPaymentsPage />;
      case "receive-payment": return <ReceivePaymentPage />;
      case "reports": return <ReportsPage />;
      case "balance-payment": return <BalancePaymentPage />;
      case "party-ledger": return <PartyLedgerPage />;
      case "qr-scanner": return <QrScannerPage />;
      case "settings": return <SettingsPage />;
      case "dashboard":
      default: return <DashboardPage user={user} summary={summary} onNavigate={go} />;
    }
  }

  const currentTitle = page === "dashboard" ? "Overview"
    : page === "party-add" ? "Add Party / Customer"
    : page === "balance-payment" ? "Balance Payment"
    : menu.find(item => item[2] === page)?.[1] || "Overview";

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "open" : "closed")}>
        <div className="sidebar-brand">
          <div className="brand-mark small"><TrainFront size={20} /></div>
          {open && <div><b>RAILDESK</b><small>AGENT ERP</small></div>}
        </div>
        <nav>
          {menu.map(([Icon, label, key, path]) => (
            <button key={key} onClick={() => go(path)} className={"nav-item " + (page === key ? "active" : "")}>
              <Icon size={19} />{open && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {open && <div className="user-chip"><div className="avatar">{user.name?.[0] || "A"}</div><div><b>{user.name}</b><small>{user.role}</small></div></div>}
          <button className="nav-item logout" onClick={onLogout}><LogOut size={19} />{open && <span>Logout</span>}</button>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(v => !v)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
          <div className="topbar-title"><span>{currentTitle}</span><small>Railway Agent Business Workspace</small></div>
          <div className="top-actions">
            <button className="ghost-btn"><Search size={17} /></button>
            <button className="primary-small" onClick={() => go("/ticket-booking")}><Plus size={17} /> New Ticket</button>
          </div>
        </header>
        {renderPage()}
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(API + "/api/auth/me", { credentials: "include", headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) setUser(d.user);
        else if (window.location.pathname !== "/login") navigate("/login", true);
      })
      .catch(() => {
        if (window.location.pathname !== "/login") navigate("/login", true);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (!user && window.location.pathname !== "/login") navigate("/login", true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user]);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    navigate("/dashboard", true);
  }

  async function logout() {
    await fetch(API + "/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: authHeaders()
    }).catch(() => {});
    localStorage.removeItem("raildesk_auth_token");
    setUser(null);
    navigate("/login", true);
  }

  if (checking) return <div className="loading-screen"><TrainFront size={34} /><span>RAILDESK is loading…</span></div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;
  return <AppShell user={user} onLogout={logout} />;
}
