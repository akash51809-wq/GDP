import { Settings, ShieldCheck, PlugZap, Database, UserRound } from "lucide-react";
import "./SettingsPage.css";

export default function SettingsPage() {
  return (
    <main className="content settings-page">
      <div className="module-page-header"><div><div className="eyebrow">SYSTEM CONTROL</div><h1>Settings <span>✦</span></h1><p>Configure account, security, integrations and application preferences.</p></div></div>
      <section className="module-card-grid">
        <div className="module-card"><div className="module-icon blue"><UserRound size={20}/></div><small>ACCOUNT</small><b>Profile Settings</b><span>Manage admin profile and business details.</span></div>
        <div className="module-card"><div className="module-icon green"><ShieldCheck size={20}/></div><small>SECURITY</small><b>Security & Access</b><span>Manage session and role access controls.</span></div>
        <div className="module-card"><div className="module-icon amber"><PlugZap size={20}/></div><small>INTEGRATIONS</small><b>RailKit Integration</b><span>Configure railway API integration settings.</span></div>
        <div className="module-card"><div className="module-icon purple"><Database size={20}/></div><small>DATA</small><b>Data & Storage</b><span>Future Firebase and storage configuration.</span></div>
      </section>
    </main>
  );
}
