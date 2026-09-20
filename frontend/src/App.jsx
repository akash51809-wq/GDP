import { useEffect, useState } from "react";
import {
  LayoutDashboard, Ticket, Users, WalletCards, BarChart3, Settings,
  LogOut, TrainFront, ArrowUpRight, Plus, Search, CalendarDays,
  IndianRupee, Menu, X, ShieldCheck, RefreshCw, Database, CircleCheck,
  UserRound, MapPin, Clock3, CreditCard, ChevronRight
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="login-card">
        <div className="brand-mark"><TrainFront size={28} /></div>
        <div className="eyebrow">RAILWAY AGENT ERP</div>
        <h1>Your complete ticket business,<br /><span>in one place.</span></h1>
        <p className="muted">Manage tickets, parties, payments and ledgers in one premium workspace.</p>
        <form onSubmit={submit} className="login-form">
          <label>Email
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@example.com" autoComplete="username" />
          </label>
          <label>Password
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Enter your password" autoComplete="current-password" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>
            {loading ? "Signing in..." : "Secure Login"} <ArrowUpRight size={18} />
          </button>
        </form>
        <div className="secure-note"><ShieldCheck size={16} /> Secure session and role-based access</div>
      </section>
      <aside className="login-showcase">
        <div className="showcase-top"><span>RAILDESK</span><span>01 / 01</span></div>
        <div className="train-orbit"><TrainFront size={72} strokeWidth={1.2} /></div>
        <div>
          <div className="eyebrow">MANUAL BOOKING • PNR • LEDGER • REPORTS</div>
          <h2>Every business journey<br />clear and under control.</h2>
        </div>
        <div className="mini-stats">
          <div><b>Tickets</b><span>From booking to refund</span></div>
          <div><b>PNR</b><span>RailKit auto updates</span></div>
          <div><b>Cloud</b><span>PostgreSQL powered</span></div>
        </div>
      </aside>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [summary, setSummary] = useState({ partyCount: 0, ticketCount: 0, outstanding: "0.00", todayBookings: 0 });

  useEffect(() => {
    fetch(API + "/api/dashboard/summary", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSummary(d))
      .catch(() => {});
  }, []);

  const menu = [
    [LayoutDashboard, "Dashboard", "dashboard"],
    [Ticket, "Ticket Booking", "tickets"],
    [Users, "Party / Customer", "parties"],
    [WalletCards, "Ledger / Payments", "ledger"],
    [BarChart3, "Reports", "reports"],
    [Settings, "Settings", "settings"]
  ];

  function go(key) {
    setPage(key);
  }

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "open" : "closed")}>
        <div className="sidebar-brand"><div className="brand-mark small"><TrainFront size={20} /></div>{open && <div><b>RAILDESK</b><small>AGENT ERP</small></div>}</div>
        <nav>{menu.map(([Icon, label, key]) => <button key={key} onClick={() => go(key)} className={"nav-item " + (page === key ? "active" : "")}><Icon size={19} />{open && <span>{label}</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          {open && <div className="user-chip"><div className="avatar">{user.name?.[0] || "A"}</div><div><b>{user.name}</b><small>{user.role}</small></div></div>}
          <button className="nav-item logout" onClick={onLogout}><LogOut size={19} />{open && <span>Logout</span>}</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(v => !v)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
          <div className="topbar-title"><span>{page === "dashboard" ? "Overview" : menu.find(m => m[2] === page)?.[1]}</span><small>Railway Agent Business Workspace</small></div>
          <div className="top-actions"><button className="ghost-btn"><Search size={17} /></button><button className="primary-small" onClick={() => go("tickets")}><Plus size={17} /> New Ticket</button></div>
        </header>

        {page === "dashboard" && <DashboardHome user={user} summary={summary} onNavigate={go} />}
        {page === "tickets" && <PnrCenter />}
        {page === "parties" && <Placeholder title="Party / Customer" icon={<Users />} text="Next module: customer profiles, accounts and ticket history." />}
        {page === "ledger" && <Placeholder title="Ledger / Payments" icon={<WalletCards />} text="Next module: debit, credit, payments and digital ledger." />}
        {page === "reports" && <Placeholder title="Reports" icon={<BarChart3 />} text="Next module: booking, sales, outstanding and profit reports." />}
        {page === "settings" && <Placeholder title="Settings" icon={<Settings />} text="System settings and integrations will be added here." />}
      </section>
    </div>
  );
}

function DashboardHome({ user, summary, onNavigate }) {
  return (
    <main className="content">
      <div className="welcome">
        <div><div className="eyebrow">GOOD TO SEE YOU</div><h1>Hello, {user.name?.split(" ")[0]} <span>✦</span></h1><p>Take a look at today's tickets and party activity.</p></div>
        <div className="date-pill"><CalendarDays size={17} /> {new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</div>
      </div>

      <div className="metric-grid">
        <Metric icon={<Ticket />} label="Total Tickets" value={summary.ticketCount} trend="Current" />
        <Metric icon={<Users />} label="Total Parties" value={summary.partyCount} trend="Active records" />
        <Metric icon={<IndianRupee />} label="Outstanding" value={"₹" + summary.outstanding} trend="From ledger" />
        <Metric icon={<TrainFront />} label="Today's Bookings" value={summary.todayBookings} trend="Manual booking" />
      </div>

      <div className="dashboard-grid">
        <section className="glass-panel large-panel">
          <div className="panel-head"><div><div className="eyebrow">QUICK ACTIONS</div><h3>Get Started</h3></div></div>
          <div className="action-grid">
            <Action icon={<Ticket />} title="New Ticket" text="Create a manual railway ticket" onClick={() => onNavigate("tickets")} />
            <Action icon={<Users />} title="New Party" text="Create a customer account" onClick={() => onNavigate("parties")} />
            <Action icon={<WalletCards />} title="Record Payment" text="Add cash, UPI or UTR" onClick={() => onNavigate("ledger")} />
            <Action icon={<BarChart3 />} title="View Reports" text="Booking and ledger reports" onClick={() => onNavigate("reports")} />
          </div>
        </section>
        <section className="glass-panel side-panel">
          <div className="panel-head"><div><div className="eyebrow">SYSTEM</div><h3>System Status</h3></div></div>
          <div className="status-line"><span className="status-dot" /> Backend Connected</div>
          <div className="status-line"><span className="status-dot" /> Secure Session</div>
          <div className="status-line"><span className="status-dot" /> PostgreSQL Ready</div>
          <div className="status-line"><span className="status-dot" /> RailKit PNR Ready</div>
          <div className="coming">Ticket Booking में PNR डालते ही RailKit से विवरण लाकर database में सुरक्षित किया जा सकता है।</div>
        </section>
      </div>
    </main>
  );
}

function PnrCenter() {
  const [pnr, setPnr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [record, setRecord] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const res = await fetch(API + "/api/pnr/recent", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setRecent(data.records || []);
    }
  }

  useEffect(() => { loadRecent().catch(() => {}); }, []);

  async function fetchPnr(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setRecord(null);
    const clean = pnr.replace(/\D/g, "");
    if (clean.length !== 10) {
      setError("Please enter a 10-digit PNR.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API + "/api/pnr/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pnr: clean })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "PNR fetch failed.");
      setRecord(data.record);
      setNotice(data.message);
      setPnr(clean);
      await loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openRecord(item) {
    setPnr(item.pnr);
    setRecord(item);
    setNotice("This record was loaded from temporary storage.");
    setError("");
  }

  return (
    <main className="content">
      <div className="page-hero">
        <div>
          <div className="eyebrow">TICKET BOOKING • RAILKIT</div>
          <h1>PNR Center <span>✦</span></h1>
          <p>Enter a 10-digit PNR — fetch live details and save them immediately in temporary testing storage.</p>
        </div>
        <div className="integration-badge"><CircleCheck size={17} /> RailKit Integration</div>
      </div>

      <section className="glass-panel pnr-search-panel">
        <div className="pnr-search-copy">
          <div className="round-icon"><Ticket size={22} /></div>
          <div><b>Get PNR Details</b><span>PNR, train, journey, fare and passenger status</span></div>
        </div>
        <form className="pnr-form" onSubmit={fetchPnr}>
          <input value={pnr} onChange={e => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} placeholder="e.g. 5827194603" />
          <button className="primary-small fetch-btn" disabled={loading}>{loading ? <><RefreshCw size={16} className="spin" /> Fetching…</> : <><Search size={16} /> Fetch PNR</>}</button>
        </form>
        {error && <div className="error-box pnr-error">{error}</div>}
        {notice && !error && <div className="success-box"><CircleCheck size={15} /> {notice}</div>}
      </section>

      {record && <PnrResult record={record} />}

      <section className="glass-panel recent-panel">
        <div className="panel-head">
          <div><div className="eyebrow">DATABASE</div><h3>Recent PNR Records</h3></div>
          <button className="ghost-btn" onClick={() => loadRecent()} title="Refresh"><RefreshCw size={16} /></button>
        </div>
        {recent.length === 0 ? <div className="empty-state"><Database size={25} /><span>No PNR records have been saved yet.</span></div> :
          <div className="recent-list">{recent.map(item => (
            <button className="recent-row" key={item.id} onClick={() => openRecord(item)}>
              <div className="recent-pnr"><b>{item.pnr}</b><small>{item.trainNumber || "—"} {item.trainName || ""}</small></div>
              <div className="recent-route">{item.sourceCode || "—"} <ChevronRight size={13} /> {item.destinationCode || "—"}</div>
              <div className="recent-status">{item.chartStatus || "Status available"}<small>{item.passengerCount || 0} Passengers</small></div>
              <ArrowUpRight size={16} />
            </button>
          ))}</div>}
      </section>
    </main>
  );
}

function PnrResult({ record }) {
  const passengers = Array.isArray(record.passengers) ? record.passengers : [];
  return (
    <section className="pnr-result">
      <div className="pnr-result-head">
        <div><div className="eyebrow">LIVE PNR SNAPSHOT</div><h2>{record.pnr}</h2><span>{record.chartStatus || "PNR details fetched"}</span></div>
        <div className="fare-chip"><IndianRupee size={16} /> {record.fare ?? "—"}</div>
      </div>
      <div className="journey-grid">
        <InfoCard icon={<TrainFront />} label="Train" value={record.trainNumber ? record.trainNumber + " • " + (record.trainName || "") : "Not available"} />
        <InfoCard icon={<CalendarDays />} label="Journey" value={record.journeyDateText || "Not available"} />
        <InfoCard icon={<MapPin />} label="Route" value={(record.sourceName || record.sourceCode || "—") + " → " + (record.destinationName || record.destinationCode || "—")} />
        <InfoCard icon={<CreditCard />} label="Class / Quota" value={(record.travelClass || "—") + " / " + (record.quota || "—")} />
      </div>
      <div className="boarding-line"><MapPin size={15} /> Boarding: <b>{record.boardingName || record.boardingCode || "—"}</b><span>•</span><Clock3 size={15} /> Passengers: <b>{record.passengerCount}</b></div>
      <div className="passenger-table">
        <div className="passenger-head"><span>Passengers</span><span>Booking Status</span><span>Current Status</span></div>
        {passengers.length ? passengers.map((p, i) => (
          <div className="passenger-row" key={i}>
            <div className="passenger-name"><div className="mini-avatar"><UserRound size={14} /></div><b>{p.serialNumber || "Passenger " + (i + 1)}</b></div>
            <span>{p.booking?.details || p.booking?.status || "—"}</span>
            <span className="current-status">{p.current?.details || p.current?.status || "—"}</span>
          </div>
        )) : <div className="empty-state small"><Users size={20} /><span>Passenger details are not available.</span></div>}
      </div>
      <div className="saved-strip"><Database size={15} /> This PNR record is saved in temporary storage <span>•</span> Last fetch: {record.fetchedAt ? new Date(record.fetchedAt).toLocaleString("en-IN") : "now"}</div>
    </section>
  );
}

function InfoCard({ icon, label, value }) {
  return <div className="info-card"><div className="info-icon">{icon}</div><div><small>{label}</small><b>{value}</b></div></div>;
}

function Placeholder({ title, icon, text }) {
  return <main className="content"><section className="glass-panel placeholder-page"><div className="placeholder-icon">{icon}</div><div className="eyebrow">MODULE</div><h1>{title}</h1><p>{text}</p><div className="coming">We will add this module step by step with the same premium design and backend.</div></section></main>;
}

function Metric({ icon, label, value, trend }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{trend}</small></div></div>;
}
function Action({ icon, title, text, onClick }) {
  return <button className="action-card" onClick={onClick}><div className="action-icon">{icon}</div><div><b>{title}</b><span>{text}</span></div><ArrowUpRight size={17} /></button>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(API + "/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.user && setUser(d.user))
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    await fetch(API + "/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setUser(null);
  }

  if (checking) return <div className="loading-screen"><TrainFront size={34} /><span>RAILDESK is loading…</span></div>;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
