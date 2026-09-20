import { useState } from "react";
import { ShieldCheck, PlugZap, Database, UserRound, MessageCircle, Mail, SlidersHorizontal, Save, RotateCcw } from "lucide-react";
import "./SettingsPage.css";

const initial = { whatsappUrl:"", whatsappToken:"", whatsappSender:"", whatsappEnabled:true, smtpHost:"", smtpPort:"587", smtpUser:"", smtpPassword:"", smtpFromName:"RailDesk", smtpFromEmail:"", smtpSecure:true, companyName:"RailDesk", currency:"INR", timezone:"Asia/Kolkata", dateFormat:"DD/MM/YYYY", phoneCountryCode:"+91", lowBalanceAlert:true, autoRefresh:true };

function Field({ label, hint, children }) {
  return <label className="setting-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function SettingsPage() {
  const [form,setForm]=useState(initial);
  const [active,setActive]=useState("whatsapp");
  const [saved,setSaved]=useState("");
  const change=(key,value)=>setForm(p=>({...p,[key]:value}));
  const save=(section)=>{setSaved(section);window.setTimeout(()=>setSaved(""),1800)};
  const reset=()=>setForm(initial);

  const tabs=[
    {id:"whatsapp",label:"WhatsApp",sub:"URL Integration",icon:MessageCircle,cls:"whatsapp"},
    {id:"email",label:"Email",sub:"SMTP Setting",icon:Mail,cls:"email"},
    {id:"general",label:"General",sub:"System Preferences",icon:SlidersHorizontal,cls:"general"}
  ];

  return (
    <main className="content settings-page">
      <div className="module-page-header settings-main-head">
        <div><div className="eyebrow">SYSTEM CONTROL</div><h1>Settings <span>✦</span></h1><p>Choose a setting category to manage its configuration.</p></div>
        <button className="settings-reset" onClick={reset}><RotateCcw size={13}/> Reset</button>
      </div>

      <section className="settings-tabs">
        {tabs.map(({id,label,sub,icon:Icon,cls})=>(
          <button key={id} className={"setting-tab "+cls+(active===id?" active":"")} onClick={()=>setActive(id)}>
            <div className="tab-icon"><Icon size={18}/></div>
            <div><small>{label.toUpperCase()}</small><b>{sub}</b><span>{active===id?"Currently selected":"Open settings"}</span></div>
            <i>›</i>
          </button>
        ))}
      </section>

      {active==="whatsapp" && <section className="settings-panel whatsapp-panel">
        <div className="settings-panel-head"><div className="panel-symbol"><MessageCircle size={19}/></div><div><small>WHATSAPP INTEGRATION</small><h2>WhatsApp URL Setting</h2><p>Configure the WhatsApp API endpoint used for sending messages.</p></div><span className="status-pill">● Enabled</span></div>
        <div className="settings-grid three">
          <Field label="WhatsApp API URL" hint="Example: https://api.example.com/send"><input value={form.whatsappUrl} onChange={e=>change("whatsappUrl",e.target.value)} placeholder="https://..." /></Field>
          <Field label="API Token / Key"><input type="password" value={form.whatsappToken} onChange={e=>change("whatsappToken",e.target.value)} placeholder="Enter API token" /></Field>
          <Field label="Sender / WhatsApp Number"><input value={form.whatsappSender} onChange={e=>change("whatsappSender",e.target.value)} placeholder="+91XXXXXXXXXX" /></Field>
        </div>
        <div className="settings-panel-foot"><label className="switch-row"><input type="checkbox" checked={form.whatsappEnabled} onChange={e=>change("whatsappEnabled",e.target.checked)}/><i></i><span>Enable WhatsApp notifications</span></label><button className="save-btn whatsapp-save" onClick={()=>save("WhatsApp")}><Save size={13}/> Save WhatsApp</button></div>
      </section>}

      {active==="email" && <section className="settings-panel email-panel">
        <div className="settings-panel-head"><div className="panel-symbol"><Mail size={19}/></div><div><small>EMAIL CONFIGURATION</small><h2>Email SMTP Setting</h2><p>Required details for sending invoices, reports and notifications by email.</p></div><span className="status-pill">● SMTP</span></div>
        <div className="settings-grid four">
          <Field label="SMTP Host" hint="Example: smtp.gmail.com"><input value={form.smtpHost} onChange={e=>change("smtpHost",e.target.value)} placeholder="smtp.example.com" /></Field>
          <Field label="SMTP Port"><input value={form.smtpPort} onChange={e=>change("smtpPort",e.target.value)} placeholder="587" /></Field>
          <Field label="SMTP Username / Email"><input value={form.smtpUser} onChange={e=>change("smtpUser",e.target.value)} placeholder="email@example.com" /></Field>
          <Field label="SMTP Password"><input type="password" value={form.smtpPassword} onChange={e=>change("smtpPassword",e.target.value)} placeholder="••••••••" /></Field>
          <Field label="From Name"><input value={form.smtpFromName} onChange={e=>change("smtpFromName",e.target.value)} placeholder="RailDesk" /></Field>
          <Field label="From Email"><input value={form.smtpFromEmail} onChange={e=>change("smtpFromEmail",e.target.value)} placeholder="noreply@example.com" /></Field>
          <Field label="Encryption"><select value={form.smtpSecure?"SSL/TLS":"None"} onChange={e=>change("smtpSecure",e.target.value==="SSL/TLS")}><option>SSL/TLS</option><option>None</option></select></Field>
        </div>
        <div className="settings-panel-foot"><span className="field-note">Gmail / Outlook / custom SMTP can be configured here.</span><button className="save-btn email-save" onClick={()=>save("Email SMTP")}><Save size={13}/> Save Email</button></div>
      </section>}

      {active==="general" && <section className="settings-panel general-panel">
        <div className="settings-panel-head"><div className="panel-symbol"><SlidersHorizontal size={19}/></div><div><small>APPLICATION PREFERENCES</small><h2>General Setting</h2><p>Basic business, regional and application behaviour settings.</p></div></div>
        <div className="settings-grid four">
          <Field label="Company / Agency Name"><input value={form.companyName} onChange={e=>change("companyName",e.target.value)} /></Field>
          <Field label="Currency"><select value={form.currency} onChange={e=>change("currency",e.target.value)}><option>INR</option><option>USD</option><option>EUR</option></select></Field>
          <Field label="Timezone"><select value={form.timezone} onChange={e=>change("timezone",e.target.value)}><option>Asia/Kolkata</option><option>UTC</option><option>Asia/Dubai</option></select></Field>
          <Field label="Date Format"><select value={form.dateFormat} onChange={e=>change("dateFormat",e.target.value)}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></Field>
          <Field label="Default Country Code"><input value={form.phoneCountryCode} onChange={e=>change("phoneCountryCode",e.target.value)} /></Field>
        </div>
        <div className="general-toggles">
          <label className="switch-row"><input type="checkbox" checked={form.lowBalanceAlert} onChange={e=>change("lowBalanceAlert",e.target.checked)}/><i></i><span>Low balance alerts</span></label>
          <label className="switch-row"><input type="checkbox" checked={form.autoRefresh} onChange={e=>change("autoRefresh",e.target.checked)}/><i></i><span>Auto refresh dashboard data</span></label>
        </div>
        <div className="settings-panel-foot"><span className="field-note">{saved ? saved+" settings saved." : "Changes are currently UI-local and ready for backend storage."}</span><button className="save-btn general-save" onClick={()=>save("General")}><Save size={13}/> Save General</button></div>
      </section>}

      {saved && <div className="settings-toast">✓ {saved} settings saved</div>}

      <section className="legacy-settings-cards">
        <div className="module-card"><div className="module-icon blue"><UserRound size={20}/></div><small>ACCOUNT</small><b>Profile Settings</b><span>Manage admin profile and business details.</span></div>
        <div className="module-card"><div className="module-icon green"><ShieldCheck size={20}/></div><small>SECURITY</small><b>Security & Access</b><span>Manage session and role access controls.</span></div>
        <div className="module-card"><div className="module-icon amber"><PlugZap size={20}/></div><small>INTEGRATIONS</small><b>RailKit Integration</b><span>Configure railway API integration settings.</span></div>
        <div className="module-card"><div className="module-icon purple"><Database size={20}/></div><small>DATA</small><b>Data & Storage</b><span>Future Firebase and storage configuration.</span></div>
      </section>
    </main>
  );
}