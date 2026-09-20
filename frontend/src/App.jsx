import { useEffect, useState } from "react";
import {
  LayoutDashboard, Ticket, Users, WalletCards, BarChart3, Settings,
  LogOut, TrainFront, ArrowUpRight, Plus, Search, CalendarDays,
  IndianRupee, Menu, X, ShieldCheck, RefreshCw, Database, CircleCheck,
  UserRound, MapPin, Clock3, CreditCard, ChevronRight, SlidersHorizontal, ArrowDownAZ, Download, MoreHorizontal, Pencil, Eye, UserPlus, Mail, MessageCircle, CheckCircle2, XCircle, ChevronLeft, ChevronDown
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
        {page === "parties" && <PartyCenter />}
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
          <div className="coming">Enter a PNR in Ticket Booking to fetch details from RailKit and save them in temporary testing storage.</div>
        </section>
      </div>
    </main>
  );
}


function PartyCenter() {
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("NAME_ASC");
  const [pageNo, setPageNo] = useState(1);
  const [pageSize] = useState(8);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadParties() {
    setLoading(true);
    try {
      const res = await fetch(API + "/api/parties", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load parties.");
      setParties(data.parties || []);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadParties(); }, []);

  const filtered = parties
    .filter(p => filter === "ALL" || p.status === filter)
    .filter(p => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [p.customerName, p.whatsapp, p.email, p.address, p.city, p.partyType]
        .some(v => String(v || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sort === "NAME_DESC") return b.customerName.localeCompare(a.customerName);
      if (sort === "BALANCE_HIGH") return Number(b.balance || 0) - Number(a.balance || 0);
      if (sort === "BALANCE_LOW") return Number(a.balance || 0) - Number(b.balance || 0);
      if (sort === "NEWEST") return new Date(b.createdAt) - new Date(a.createdAt);
      return a.customerName.localeCompare(b.customerName);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageNo, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeCount = parties.filter(p => p.status === "ACTIVE").length;
  const outstanding = parties.reduce((sum, p) => sum + Number(p.balance || 0), 0);

  function changeSearch(value) {
    setSearch(value);
    setPageNo(1);
  }

  function exportCsv() {
    const headers = ["Customer Name","WhatsApp","Email","Address","Status","Balance"];
    const rows = filtered.map(p => [p.customerName,p.whatsapp,p.email,p.address,p.status,p.balance]);
    const csv = [headers, ...rows].map(row => row.map(v => '"' + String(v ?? "").replaceAll('"','""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raildesk-parties.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="content party-content">
      <div className="page-hero party-hero">
        <div>
          <div className="eyebrow">CUSTOMER MANAGEMENT</div>
          <h1>Party Center <span>✦</span></h1>
          <p>Manage customer accounts, contact details and outstanding balances from one compact workspace.</p>
        </div>
        <button className="primary-small party-add-btn"><UserPlus size={16} /> Create Party</button>
      </div>

      <div className="party-metrics">
        <div className="party-stat"><div className="party-stat-icon"><Users size={17}/></div><div><small>Total Parties</small><b>{parties.length}</b></div></div>
        <div className="party-stat"><div className="party-stat-icon green"><CheckCircle2 size={17}/></div><div><small>Active</small><b>{activeCount}</b></div></div>
        <div className="party-stat"><div className="party-stat-icon amber"><IndianRupee size={17}/></div><div><small>Outstanding</small><b>₹{outstanding.toLocaleString("en-IN", {minimumFractionDigits:2})}</b></div></div>
      </div>

      <section className="glass-panel party-panel">
        <div className="party-toolbar">
          <div className="party-search">
            <Search size={16}/>
            <input value={search} onChange={e => changeSearch(e.target.value)} placeholder="Search customer, WhatsApp, email or city..." />
            {search && <button onClick={() => changeSearch("")}><X size={14}/></button>}
          </div>
          <div className="party-tools">
            <button className={"compact-tool " + (showFilters ? "selected" : "")} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15}/> Filter</button>
            <label className="compact-tool"><ArrowDownAZ size={15}/> Sort
              <select value={sort} onChange={e => {setSort(e.target.value);setPageNo(1);}}>
                <option value="NAME_ASC">Name A–Z</option>
                <option value="NAME_DESC">Name Z–A</option>
                <option value="BALANCE_HIGH">Balance High</option>
                <option value="BALANCE_LOW">Balance Low</option>
                <option value="NEWEST">Newest</option>
              </select>
            </label>
            <button className="compact-tool" onClick={exportCsv}><Download size={15}/> Export</button>
          </div>
        </div>

        {showFilters && <div className="party-filter-row">
          <button className={filter === "ALL" ? "filter-chip active" : "filter-chip"} onClick={() => {setFilter("ALL");setPageNo(1);}}>All</button>
          <button className={filter === "ACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => {setFilter("ACTIVE");setPageNo(1);}}>Active</button>
          <button className={filter === "INACTIVE" ? "filter-chip active" : "filter-chip"} onClick={() => {setFilter("INACTIVE");setPageNo(1);}}>Inactive</button>
          <span>{filtered.length} matching records</span>
        </div>}

        <div className="party-table-wrap">
          <div className="party-table party-table-head">
            <span>Customer Name</span><span>WhatsApp</span><span>Email</span><span>Address</span><span>Status</span><span>Actions</span><span className="balance-head">Balance</span>
          </div>
          {loading ? <div className="party-empty"><RefreshCw className="spin" size={21}/><span>Loading parties...</span></div> :
           visible.length === 0 ? <div className="party-empty"><Users size={23}/><b>No parties found</b><span>Try another search or create a new party.</span></div> :
           visible.map(p => (
            <div className="party-table party-row" key={p.id}>
              <div className="party-person"><div className="party-avatar">{p.customerName?.[0] || "P"}</div><div><b>{p.customerName}</b><small>{p.partyType || "Customer"} • {p.city || "—"}</small></div></div>
              <div className="party-contact"><MessageCircle size={13}/>{p.whatsapp || "—"}</div>
              <div className="party-contact"><Mail size={13}/><span title={p.email}>{p.email || "—"}</span></div>
              <div className="party-address" title={p.address}>{p.address || "—"}{p.city ? ", " + p.city : ""}</div>
              <div><span className={"party-status " + String(p.status || "").toLowerCase()}>{p.status === "ACTIVE" ? <CheckCircle2 size={12}/> : <XCircle size={12}/>} {p.status}</span></div>
              <div className="party-actions"><button title="View"><Eye size={14}/></button><button title="Edit"><Pencil size={14}/></button><button title="More"><MoreHorizontal size={15}/></button></div>
              <div className={"party-balance " + (Number(p.balance || 0) > 0 ? "due" : Number(p.balance || 0) < 0 ? "advance" : "")}>₹{Number(p.balance || 0).toLocaleString("en-IN", {minimumFractionDigits:2})}</div>
            </div>
           ))}
        </div>

        <div className="party-footer">
          <span>Showing {visible.length ? ((safePage-1)*pageSize+1) : 0}–{Math.min(safePage*pageSize, filtered.length)} of {filtered.length}</span>
          <div className="pagination">
            <button disabled={safePage <= 1} onClick={() => setPageNo(v => Math.max(1,v-1))}><ChevronLeft size={14}/></button>
            {Array.from({length: Math.min(totalPages, 5)}, (_, i) => {
              const n = i + 1;
              return <button key={n} className={safePage === n ? "active" : ""} onClick={() => setPageNo(n)}>{n}</button>;
            })}
            <button disabled={safePage >= totalPages} onClick={() => setPageNo(v => Math.min(totalPages,v+1))}><ChevronRight size={14}/></button>
          </div>
        </div>
      </section>
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
  const journey = record.journey || {};
  const booking = record.booking || {};
  const chart = record.chart || {};

  return (
    <section className="pnr-result">
      <div className="pnr-result-head">
        <div>
          <div className="eyebrow">LIVE PNR SNAPSHOT</div>
          <h2>{record.pnr}</h2>
          <span>{chart.status || record.chartStatus || "PNR details fetched"}</span>
        </div>
        <div className="fare-chip"><IndianRupee size={16} /> ₹{record.fare ?? booking.fare ?? "—"}</div>
      </div>

      <div className="pnr-overview">
        <div className="pnr-train-block">
          <div className="round-icon"><TrainFront size={23} /></div>
          <div>
            <small>TRAIN</small>
            <strong>{record.trainNumber || "—"} • {record.trainName || "Train name unavailable"}</strong>
          </div>
        </div>
        <div className="route-block">
          <div><b>{record.sourceCode || journey.source?.code || "—"}</b><span>{record.sourceName || journey.source?.name || "Source unavailable"}</span></div>
          <div className="route-line"><span></span><ChevronRight size={15} /><span></span></div>
          <div><b>{record.destinationCode || journey.destination?.code || "—"}</b><span>{record.destinationName || journey.destination?.name || "Destination unavailable"}</span></div>
        </div>
      </div>

      <div className="journey-grid">
        <InfoCard icon={<CalendarDays />} label="Journey Date" value={record.journeyDateText || journey.dateOfJourney || "Not available"} />
        <InfoCard icon={<CreditCard />} label="Class / Quota" value={(record.travelClass || journey.class || "—") + " / " + (record.quota || journey.quota || "—")} />
        <InfoCard icon={<MapPin />} label="Boarding Point" value={(record.boardingName || journey.boardingPoint?.name || "—") + " (" + (record.boardingCode || journey.boardingPoint?.code || "—") + ")"} />
        <InfoCard icon={<Clock3 />} label="Arrival" value={journey.arrivalDate || "Not available"} />
        <InfoCard icon={<MapPin />} label="Distance" value={journey.distance != null ? journey.distance + " km" : "Not available"} />
        <InfoCard icon={<IndianRupee />} label="Ticket Fare" value={booking.ticketFare != null ? "₹" + booking.ticketFare : "Not available"} />
        <InfoCard icon={<IndianRupee />} label="Total Fare" value={booking.fare != null ? "₹" + booking.fare : record.fare != null ? "₹" + record.fare : "Not available"} />
        <InfoCard icon={<CalendarDays />} label="Booking Date" value={booking.bookingDate || "Not available"} />
      </div>

      <div className="boarding-line">
        <MapPin size={15} /> Boarding: <b>{record.boardingName || journey.boardingPoint?.name || record.boardingCode || journey.boardingPoint?.code || "—"}</b>
        <span>•</span>
        <Users size={15} /> Passengers: <b>{record.passengerCount ?? passengers.length}</b>
        <span>•</span>
        <CircleCheck size={15} /> Chart: <b>{chart.status || record.chartStatus || "Not available"}</b>
      </div>

      <div className="passenger-table">
        <div className="passenger-head"><span>Passenger</span><span>Booking Status</span><span>Current Status</span></div>
        {passengers.length ? passengers.map((p, i) => (
          <div className="passenger-row" key={i}>
            <div className="passenger-name">
              <div className="mini-avatar"><UserRound size={14} /></div>
              <div><b>{p.serialNumber || "Passenger " + (i + 1)}</b><small>{p.coachPosition != null ? "Coach Position: " + p.coachPosition : ""}</small></div>
            </div>
            <span>
              {p.booking?.details || p.booking?.status || "—"}
              {p.booking?.coach ? " • " + p.booking.coach : ""}
              {p.booking?.berthNo ? " • Berth " + p.booking.berthNo : ""}
              {p.booking?.berthCode ? " [" + p.booking.berthCode + "]" : ""}
            </span>
            <span className="current-status">
              {p.current?.details || p.current?.status || "—"}
              {p.current?.coach ? " • " + p.current.coach : ""}
              {p.current?.berthNo ? " • Berth " + p.current.berthNo : ""}
              {p.current?.berthCode ? " [" + p.current.berthCode + "]" : ""}
            </span>
          </div>
        )) : <div className="empty-state small"><Users size={20} /><span>Passenger details are not available.</span></div>}
      </div>

      <div className="saved-strip">
        <Database size={15} /> This PNR record is saved in temporary testing storage
        <span>•</span> Last fetch: {record.fetchedAt ? new Date(record.fetchedAt).toLocaleString("en-IN") : "now"}
      </div>
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
