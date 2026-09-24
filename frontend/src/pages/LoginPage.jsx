import { useState } from "react";
import { TrainFront, ArrowUpRight, ShieldCheck } from "lucide-react";
import "./LoginPage.css";
import { API } from "../apiConfig";

export default function LoginPage({ onLogin }) {
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
      if (data.token) localStorage.setItem("raildesk_auth_token", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page login-module-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="login-card">
        <div className="brand-mark"><TrainFront size={28} /></div>
        <div className="eyebrow">RAILWAY AGENT ERP</div>
        <h1>Your complete ticket business,<br /><span>in one place.</span></h1>
        <p className="muted">Manage tickets, parties, payments and ledgers in one premium workspace.</p>
        <form onSubmit={submit} className="login-form">
          <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@example.com" autoComplete="username" /></label>
          <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Enter your password" autoComplete="current-password" /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>{loading ? "Signing in..." : "Secure Login"} <ArrowUpRight size={18} /></button>
        </form>
        <div className="secure-note"><ShieldCheck size={16} /> Secure session and role-based access</div>
      </section>
      <aside className="login-showcase">
        <div className="showcase-top"><span>RAILDESK</span><span>01 / 01</span></div>
        <div className="train-orbit"><TrainFront size={72} strokeWidth={1.2} /></div>
        <div><div className="eyebrow">MANUAL BOOKING • PNR • LEDGER • REPORTS</div><h2>Every business journey<br />clear and under control.</h2></div>
        <div className="mini-stats">
          <div><b>Tickets</b><span>From booking to refund</span></div>
          <div><b>PNR</b><span>RailKit auto updates</span></div>
          <div><b>Cloud</b><span>PostgreSQL powered</span></div>
        </div>
      </aside>
    </main>
  );
}
