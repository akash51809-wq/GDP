import { useState, useEffect } from "react";
import {
  ShieldCheck,
  PlugZap,
  Database,
  UserRound,
  MessageCircle,
  Mail,
  SlidersHorizontal,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Lock,
  ExternalLink,
  Cloud
} from "lucide-react";
import { API } from "../apiConfig";
import "./SettingsPage.css";

const initial = {
  whatsappUrl: "",
  whatsappToken: "",
  whatsappSender: "",
  whatsappEnabled: true,
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  smtpFromName: "RailDesk",
  smtpFromEmail: "",
  smtpSecure: true,
  companyName: "RailDesk",
  currency: "INR",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  phoneCountryCode: "+91",
  lowBalanceAlert: true,
  autoRefresh: true
};

function authHeaders() {
  const token = localStorage.getItem("raildesk_auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {})
  };
}

function Field({ label, hint, children }) {
  return (
    <label className="setting-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState(initial);
  const [active, setActive] = useState("whatsapp");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

  const change = (key, value) => setForm(p => ({ ...p, [key]: value }));

  // Load live settings from MongoDB Atlas via protected backend API
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${API}/api/settings`, {
          headers: authHeaders(),
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.settings) {
            setForm(prev => ({
              ...prev,
              ...data.settings
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    async function loadGoogleStatus() {
      try {
        const res = await fetch(`${API}/api/google/status`, {
          headers: authHeaders(),
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          setGoogleStatus(data);
        }
      } catch (err) {
        console.error("Failed to load Google status:", err);
      }
    }

    loadSettings();
    loadGoogleStatus();
  }, []);

  const save = async (section) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSaved(section);
        window.setTimeout(() => setSaved(""), 2500);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setForm(initial);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(`${API}/api/google/auth-url`, {
        headers: authHeaders(),
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      alert("Failed to start Google OAuth flow: " + err.message);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm("Are you sure you want to disconnect Google Drive and Gmail?")) return;
    try {
      const res = await fetch(`${API}/api/google/disconnect`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include"
      });
      if (res.ok) {
        setGoogleStatus(prev => ({ ...prev, connected: false, driveReady: false, gmailReady: false }));
        setSaved("Google Disconnected");
        setTimeout(() => setSaved(""), 2000);
      }
    } catch (err) {
      alert("Failed to disconnect: " + err.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });

    if (!passwordForm.currentPassword) {
      return setPasswordMsg({ type: "error", text: "Please enter your current password." });
    }
    if (passwordForm.newPassword.length < 8) {
      return setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setPasswordMsg({ type: "error", text: "Passwords do not match." });
    }

    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Password changed successfully!" });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPasswordMsg({ type: "error", text: data?.message || "Failed to update password." });
      }
    } catch (err) {
      setPasswordMsg({ type: "error", text: "Connection error occurred." });
    }
  };

  const tabs = [
    { id: "whatsapp", label: "WhatsApp", sub: "URL Integration", icon: MessageCircle, cls: "whatsapp" },
    { id: "email", label: "Email", sub: "SMTP Setting", icon: Mail, cls: "email" },
    { id: "google", label: "Google Drive & Gmail", sub: "OAuth & Storage", icon: Cloud, cls: "google" },
    { id: "security", label: "Security & Passwords", sub: "AES-256 & Bcrypt", icon: ShieldCheck, cls: "security" },
    { id: "general", label: "General", sub: "System Preferences", icon: SlidersHorizontal, cls: "general" }
  ];

  return (
    <main className="content settings-page">
      <div className="module-page-header settings-main-head">
        <div>
          <div className="eyebrow">SYSTEM & SECURITY CONTROL</div>
          <h1>Settings & Integrations <span>✦</span></h1>
          <p>Manage WhatsApp, SMTP, Google Cloud Drive, and database credentials safely.</p>
        </div>
        <button className="settings-reset" onClick={reset}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <section className="settings-tabs" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {tabs.map(({ id, label, sub, icon: Icon, cls }) => (
          <button
            key={id}
            className={"setting-tab " + cls + (active === id ? " active" : "")}
            onClick={() => setActive(id)}
          >
            <div className="tab-icon"><Icon size={18} /></div>
            <div>
              <small>{label.toUpperCase()}</small>
              <b>{sub}</b>
              <span>{active === id ? "Currently selected" : "Open settings"}</span>
            </div>
            <i>›</i>
          </button>
        ))}
      </section>

      {/* WHATSAPP SETTINGS */}
      {active === "whatsapp" && (
        <section className="settings-panel whatsapp-panel">
          <div className="settings-panel-head">
            <div className="panel-symbol"><MessageCircle size={19} /></div>
            <div>
              <small>WHATSAPP INTEGRATION</small>
              <h2>WhatsApp Gateway Settings</h2>
              <p>Configure the WhatsApp API endpoint and authentication token.</p>
            </div>
            <span className="status-pill">
              {form.whatsappEnabled ? "● Enabled" : "○ Disabled"}
            </span>
          </div>
          <div className="settings-grid three">
            <Field label="WhatsApp API URL" hint="Example: https://api.example.com/send">
              <input
                value={form.whatsappUrl}
                onChange={e => change("whatsappUrl", e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="API Token / Key" hint="Encrypted with AES-256 at rest">
              <input
                type="password"
                value={form.whatsappToken}
                onChange={e => change("whatsappToken", e.target.value)}
                placeholder="Enter API token"
              />
            </Field>
            <Field label="Sender / WhatsApp Number">
              <input
                value={form.whatsappSender}
                onChange={e => change("whatsappSender", e.target.value)}
                placeholder="+91XXXXXXXXXX"
              />
            </Field>
          </div>
          <div className="settings-panel-foot">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={form.whatsappEnabled}
                onChange={e => change("whatsappEnabled", e.target.checked)}
              />
              <i></i>
              <span>Enable WhatsApp notifications</span>
            </label>
            <button className="save-btn whatsapp-save" disabled={loading} onClick={() => save("WhatsApp")}>
              <Save size={13} /> {loading ? "Saving..." : "Save WhatsApp"}
            </button>
          </div>
        </section>
      )}

      {/* EMAIL SMTP SETTINGS */}
      {active === "email" && (
        <section className="settings-panel email-panel">
          <div className="settings-panel-head">
            <div className="panel-symbol"><Mail size={19} /></div>
            <div>
              <small>EMAIL CONFIGURATION</small>
              <h2>Email SMTP Setting</h2>
              <p>Required details for sending invoices, tickets, and notifications by email.</p>
            </div>
            <span className="status-pill">● SMTP Active</span>
          </div>
          <div className="settings-grid four">
            <Field label="SMTP Host" hint="Example: smtp.gmail.com">
              <input
                value={form.smtpHost}
                onChange={e => change("smtpHost", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </Field>
            <Field label="SMTP Port">
              <input
                value={form.smtpPort}
                onChange={e => change("smtpPort", e.target.value)}
                placeholder="587"
              />
            </Field>
            <Field label="SMTP Username / Email">
              <input
                value={form.smtpUser}
                onChange={e => change("smtpUser", e.target.value)}
                placeholder="email@example.com"
              />
            </Field>
            <Field label="SMTP Password" hint="Encrypted at rest with AES-256-GCM">
              <input
                type="password"
                value={form.smtpPassword}
                onChange={e => change("smtpPassword", e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Field label="From Name">
              <input
                value={form.smtpFromName}
                onChange={e => change("smtpFromName", e.target.value)}
                placeholder="RailDesk"
              />
            </Field>
            <Field label="From Email">
              <input
                value={form.smtpFromEmail}
                onChange={e => change("smtpFromEmail", e.target.value)}
                placeholder="noreply@example.com"
              />
            </Field>
            <Field label="Encryption">
              <select
                value={form.smtpSecure ? "SSL/TLS" : "None"}
                onChange={e => change("smtpSecure", e.target.value === "SSL/TLS")}
              >
                <option>SSL/TLS</option>
                <option>None</option>
              </select>
            </Field>
          </div>
          <div className="settings-panel-foot">
            <span className="field-note">
              Passwords and tokens are encrypted before being written to MongoDB Atlas.
            </span>
            <button className="save-btn email-save" disabled={loading} onClick={() => save("Email SMTP")}>
              <Save size={13} /> {loading ? "Saving..." : "Save Email"}
            </button>
          </div>
        </section>
      )}

      {/* GOOGLE DRIVE & GMAIL INTEGRATION */}
      {active === "google" && (
        <section className="settings-panel general-panel">
          <div className="settings-panel-head">
            <div className="panel-symbol" style={{ color: "#38bdf8", background: "rgba(56,189,248,0.1)" }}>
              <Cloud size={19} />
            </div>
            <div>
              <small>GOOGLE CLOUD API INTEGRATION</small>
              <h2>Google Drive & Gmail Integration</h2>
              <p>Store uploaded QR ticket images in Google Drive and send automated emails via Gmail API.</p>
            </div>
            <span
              className="status-pill"
              style={{
                color: googleStatus.connected ? "#4ade80" : "#f87171",
                borderColor: googleStatus.connected ? "rgba(34,197,94,0.3)" : "rgba(248,113,113,0.3)"
              }}
            >
              {googleStatus.connected ? "● Connected" : "○ Not Connected"}
            </span>
          </div>

          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div style={{ background: "#091525", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "12px", padding: "16px" }}>
                <b style={{ color: "#f8fafc", display: "block", marginBottom: "6px" }}>Google Drive Storage</b>
                <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 10px" }}>
                  Used to store QR ticket scan JPG images automatically in your Google Drive cloud repository.
                </p>
                <span style={{ fontSize: "12px", fontWeight: "700", color: googleStatus.driveReady ? "#4ade80" : "#94a3b8" }}>
                  {googleStatus.driveReady ? "✓ Drive Uploads Ready" : "Requires Authorization"}
                </span>
              </div>

              <div style={{ background: "#091525", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "12px", padding: "16px" }}>
                <b style={{ color: "#f8fafc", display: "block", marginBottom: "6px" }}>Gmail API Notifications</b>
                <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 10px" }}>
                  Used to dispatch real-time passenger notices, payment receipts, and balance reports via official Gmail API.
                </p>
                <span style={{ fontSize: "12px", fontWeight: "700", color: googleStatus.gmailReady ? "#4ade80" : "#94a3b8" }}>
                  {googleStatus.gmailReady ? "✓ Gmail Dispatch Ready" : "Requires Authorization"}
                </span>
              </div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <b style={{ color: "#e2e8f0", fontSize: "14px" }}>
                  {googleStatus.connected ? "Authorized Account Active" : "No Active Google Account"}
                </b>
                <p style={{ color: "#64748b", fontSize: "13px", margin: "2px 0 0" }}>
                  Tokens are stored encrypted with AES-256-GCM in MongoDB Atlas. Client secrets are never sent to the browser.
                </p>
              </div>

              {googleStatus.connected ? (
                <button
                  onClick={handleDisconnectGoogle}
                  style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: "700", cursor: "pointer" }}
                >
                  Disconnect Account
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <ExternalLink size={14} /> Connect Google Account
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECURITY & PASSWORD CHANGE */}
      {active === "security" && (
        <section className="settings-panel email-panel">
          <div className="settings-panel-head">
            <div className="panel-symbol" style={{ color: "#4ade80", background: "rgba(34,197,94,0.1)" }}>
              <ShieldCheck size={19} />
            </div>
            <div>
              <small>SECURITY & ENCRYPTION</small>
              <h2>Security & Access Control</h2>
              <p>Bcrypt password hashing (12 rounds), AES-256-GCM token encryption, and CSRF protection.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} style={{ padding: "16px 20px" }}>
            <h3 style={{ fontSize: "15px", color: "#f8fafc", margin: "0 0 12px" }}>Change Account Password</h3>

            {passwordMsg.text && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "14px",
                  fontSize: "13px",
                  fontWeight: "600",
                  background: passwordMsg.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: passwordMsg.type === "success" ? "#86efac" : "#fca5a5",
                  border: `1px solid ${passwordMsg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                }}
              >
                {passwordMsg.text}
              </div>
            )}

            <div className="settings-grid three" style={{ padding: 0, marginBottom: "14px" }}>
              <Field label="Current Password">
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                  required
                />
              </Field>
              <Field label="New Password (min 8 chars)">
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  required
                />
              </Field>
              <Field label="Confirm New Password">
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-type new password"
                  required
                />
              </Field>
            </div>

            <button type="submit" className="save-btn general-save">
              <Lock size={13} /> Update Password
            </button>
          </form>
        </section>
      )}

      {/* GENERAL PREFERENCES */}
      {active === "general" && (
        <section className="settings-panel general-panel">
          <div className="settings-panel-head">
            <div className="panel-symbol"><SlidersHorizontal size={19} /></div>
            <div>
              <small>APPLICATION PREFERENCES</small>
              <h2>General Setting</h2>
              <p>Basic agency branding, regional formatting, and dashboard alerts.</p>
            </div>
          </div>
          <div className="settings-grid four">
            <Field label="Company / Agency Name">
              <input
                value={form.companyName}
                onChange={e => change("companyName", e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={e => change("currency", e.target.value)}>
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </Field>
            <Field label="Timezone">
              <select value={form.timezone} onChange={e => change("timezone", e.target.value)}>
                <option>Asia/Kolkata</option>
                <option>UTC</option>
                <option>Asia/Dubai</option>
              </select>
            </Field>
            <Field label="Date Format">
              <select value={form.dateFormat} onChange={e => change("dateFormat", e.target.value)}>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </Field>
            <Field label="Default Country Code">
              <input
                value={form.phoneCountryCode}
                onChange={e => change("phoneCountryCode", e.target.value)}
              />
            </Field>
          </div>
          <div className="general-toggles">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={form.lowBalanceAlert}
                onChange={e => change("lowBalanceAlert", e.target.checked)}
              />
              <i></i>
              <span>Low balance alerts</span>
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={form.autoRefresh}
                onChange={e => change("autoRefresh", e.target.checked)}
              />
              <i></i>
              <span>Auto refresh dashboard data</span>
            </label>
          </div>
          <div className="settings-panel-foot">
            <span className="field-note">
              {saved ? saved + " settings saved." : "Settings are synced directly to MongoDB Atlas."}
            </span>
            <button className="save-btn general-save" disabled={loading} onClick={() => save("General")}>
              <Save size={13} /> {loading ? "Saving..." : "Save General"}
            </button>
          </div>
        </section>
      )}

      {saved && <div className="settings-toast">✓ {saved} settings saved securely</div>}
    </main>
  );
}