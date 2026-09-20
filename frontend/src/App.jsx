import { useEffect, useState } from "react";
import {
  LayoutDashboard, Ticket, Users, WalletCards, BarChart3, Settings,
  LogOut, TrainFront, ArrowUpRight, Plus, Search, CalendarDays,
  IndianRupee, Menu, X, ShieldCheck
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
        <h1>आपका पूरा टिकट बिज़नेस,<br /><span>एक ही जगह।</span></h1>
        <p className="muted">टिकट, पार्टी, भुगतान और लेजर को एक प्रीमियम वर्कस्पेस में संभालें।</p>

        <form onSubmit={submit} className="login-form">
          <label>ईमेल
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@example.com" autoComplete="username" />
          </label>
          <label>पासवर्ड
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="अपना पासवर्ड डालें" autoComplete="current-password" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>
            {loading ? "प्रवेश हो रहा है..." : "सुरक्षित लॉगिन"} <ArrowUpRight size={18} />
          </button>
        </form>

        <div className="secure-note"><ShieldCheck size={16} /> सुरक्षित सत्र और भूमिका आधारित एक्सेस</div>
      </section>
      <aside className="login-showcase">
        <div className="showcase-top"><span>RAILDESK</span><span>०१ / ०१</span></div>
        <div className="train-orbit"><TrainFront size={72} strokeWidth={1.2} /></div>
        <div>
          <div className="eyebrow">MANUAL BOOKING • LEDGER • REPORTS</div>
          <h2>व्यवसाय की हर यात्रा<br />साफ़ और नियंत्रण में।</h2>
        </div>
        <div className="mini-stats">
          <div><b>टिकट</b><span>बुकिंग से रिफंड तक</span></div>
          <div><b>लेजर</b><span>हर भुगतान का हिसाब</span></div>
          <div><b>क्लाउड</b><span>Render + PostgreSQL</span></div>
        </div>
      </aside>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const [open, setOpen] = useState(true);
  const [summary, setSummary] = useState({ partyCount: 0, ticketCount: 0, outstanding: "0.00", todayBookings: 0 });

  useEffect(() => {
    fetch(API + "/api/dashboard/summary", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSummary(d))
      .catch(() => {});
  }, []);

  const menu = [
    [LayoutDashboard, "डैशबोर्ड"],
    [Ticket, "टिकट बुकिंग"],
    [Users, "पार्टी / ग्राहक"],
    [WalletCards, "लेजर / भुगतान"],
    [BarChart3, "रिपोर्ट्स"],
    [Settings, "सेटिंग्स"]
  ];

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (open ? "open" : "closed")}>
        <div className="sidebar-brand"><div className="brand-mark small"><TrainFront size={20} /></div>{open && <div><b>RAILDESK</b><small>AGENT ERP</small></div>}</div>
        <nav>{menu.map(([Icon, label], i) => <button key={label} className={"nav-item " + (i === 0 ? "active" : "")}><Icon size={19} />{open && <span>{label}</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          {open && <div className="user-chip"><div className="avatar">{user.name?.[0] || "A"}</div><div><b>{user.name}</b><small>{user.role}</small></div></div>}
          <button className="nav-item logout" onClick={onLogout}><LogOut size={19} />{open && <span>लॉगआउट</span>}</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(v => !v)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
          <div className="topbar-title"><span>ओवरव्यू</span><small>आज का बिज़नेस स्नैपशॉट</small></div>
          <div className="top-actions"><button className="ghost-btn"><Search size={17} /></button><button className="primary-small"><Plus size={17} /> नया टिकट</button></div>
        </header>

        <main className="content">
          <div className="welcome">
            <div><div className="eyebrow">GOOD TO SEE YOU</div><h1>नमस्ते, {user.name?.split(" ")[0]} <span>✦</span></h1><p>आज के टिकट और पार्टी गतिविधि पर एक नज़र डालिए।</p></div>
            <div className="date-pill"><CalendarDays size={17} /> {new Date().toLocaleDateString("hi-IN", { day:"2-digit", month:"short", year:"numeric" })}</div>
          </div>

          <div className="metric-grid">
            <Metric icon={<Ticket />} label="कुल टिकट" value={summary.ticketCount} trend="इस समय" />
            <Metric icon={<Users />} label="कुल पार्टी" value={summary.partyCount} trend="सक्रिय रिकॉर्ड" />
            <Metric icon={<IndianRupee />} label="बकाया" value={"₹" + summary.outstanding} trend="लेजर से" />
            <Metric icon={<TrainFront />} label="आज की बुकिंग" value={summary.todayBookings} trend="मैनुअल बुकिंग" />
          </div>

          <div className="dashboard-grid">
            <section className="glass-panel large-panel">
              <div className="panel-head"><div><div className="eyebrow">QUICK ACTIONS</div><h3>काम शुरू करें</h3></div></div>
              <div className="action-grid">
                <Action icon={<Ticket />} title="नया टिकट" text="मैनुअल रेलवे टिकट बनाएं" />
                <Action icon={<Users />} title="नई पार्टी" text="ग्राहक का खाता बनाएं" />
                <Action icon={<WalletCards />} title="भुगतान दर्ज करें" text="कैश, UPI या UTR जोड़ें" />
                <Action icon={<BarChart3 />} title="रिपोर्ट देखें" text="बुकिंग और लेजर रिपोर्ट" />
              </div>
            </section>
            <section className="glass-panel side-panel">
              <div className="panel-head"><div><div className="eyebrow">SYSTEM</div><h3>सिस्टम स्थिति</h3></div></div>
              <div className="status-line"><span className="status-dot" /> Backend Connected</div>
              <div className="status-line"><span className="status-dot" /> Secure Session</div>
              <div className="status-line"><span className="status-dot" /> PostgreSQL Ready</div>
              <div className="coming">अगला चरण: पार्टी और टिकट मॉड्यूल</div>
            </section>
          </div>
        </main>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, trend }) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{trend}</small></div></div>;
}
function Action({ icon, title, text }) {
  return <button className="action-card"><div className="action-icon">{icon}</div><div><b>{title}</b><span>{text}</span></div><ArrowUpRight size={17} /></button>;
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

  if (checking) return <div className="loading-screen"><TrainFront size={34} /><span>RAILDESK तैयार हो रहा है…</span></div>;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
