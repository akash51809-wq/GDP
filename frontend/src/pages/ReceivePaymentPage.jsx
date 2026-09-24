import { useEffect, useState } from "react";
import { WalletCards, Plus, Search, CalendarDays, IndianRupee, UserRound, X, Save, ArrowLeft, RefreshCw } from "lucide-react";
import "./ReceivePaymentPage.css";
import { API } from "../apiConfig";
const today = () => new Date().toISOString().slice(0, 10);

function go(path) { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }

export default function ReceivePaymentPage() {
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [party, setParty] = useState(null);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [pr, rr] = await Promise.all([
        fetch(API + "/api/payments/received", { credentials: "include" }),
        fetch(API + "/api/parties", { credentials: "include" })
      ]);
      const pd = await pr.json(), rd = await rr.json();
      if (!pr.ok) throw new Error(pd.message || "Could not load payments.");
      if (!rr.ok) throw new Error(rd.message || "Could not load parties.");
      setPayments(pd.payments || []); setParties(rd.parties || []);
    } catch (e) { setNotice(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const matches = parties.filter(p => {
    const q = search.trim().toLowerCase();
    return q && [p.customerName,p.whatsapp,p.email,p.city].some(v => String(v || "").toLowerCase().includes(q));
  }).slice(0, 8);

  function openAdd() {
    setParty(null); setSearch(""); setDate(today()); setAmount(""); setNotice(""); setShowAdd(true);
  }
  function save(e) {
    e.preventDefault();
    if (!party) return setNotice("Please choose a party.");
    if (!amount || Number(amount) <= 0) return setNotice("Please enter a valid amount.");
    setSaving(true); setNotice("");
    fetch(API + "/api/payments/received", {
      method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ partyId:party.id, partyName:party.customerName, date, amount:Number(amount) })
    }).then(async r => {
      const d=await r.json(); if(!r.ok) throw new Error(d.message || "Could not save payment.");
      setShowAdd(false); setAmount(""); await load();
    }).catch(e=>setNotice(e.message)).finally(()=>setSaving(false));
  }

  return <main className="content receive-payment-page">
    <div className="receive-hero">
      <div><div className="eyebrow">PAYMENT CENTER</div><h1><WalletCards size={23}/> Receive Payment <span>✦</span></h1><p>Record received payments against an existing party account.</p></div>
      <button className="receive-add-btn" onClick={openAdd}><Plus size={15}/> Add Payment</button>
    </div>

    {showAdd && <form className="receive-form" onSubmit={save}>
      <div className="receive-form-title"><span>01</span><div><b>Add Payment</b><small>Choose party, date and received amount</small></div><button type="button" onClick={()=>setShowAdd(false)}><X size={16}/></button></div>
      <div className="receive-fields">
        <div className="receive-party-field">
          <label><UserRound size={13}/> Choose Party</label>
          <div className="receive-party-input"><Search size={15}/><input value={search} onChange={e=>{setSearch(e.target.value);setParty(null)}} placeholder="Search party name, WhatsApp, email or city..."/>{search&&<button type="button" onClick={()=>{setSearch("");setParty(null)}}><X size={13}/></button>}</div>
          {party&&<div className="receive-selected"><span>{party.customerName[0]}</span><div><b>{party.customerName}</b><small>{party.partyType || "Customer"} • {party.whatsapp || party.city || "No contact"}</small></div></div>}
          {!party&&search&&<div className="receive-results">{matches.length ? matches.map(p=><button type="button" key={p.id} onClick={()=>{setParty(p);setSearch(p.customerName)}}><span>{p.customerName[0]}</span><div><b>{p.customerName}</b><small>{p.partyType || "Customer"} • {p.whatsapp || p.email || p.city || "No contact"}</small></div></button>) : <div className="receive-no-result">No party found.</div>}</div>}
        </div>
        <label><span><CalendarDays size={13}/> Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
        <label><span><IndianRupee size={13}/> Amount</span><div className="receive-amount"><b>₹</b><input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/></div></label>
      </div>
      {notice&&<div className="receive-notice">{notice}</div>}
      <div className="receive-actions"><button type="button" className="receive-cancel" onClick={()=>setShowAdd(false)}>Cancel</button><button className="receive-save" disabled={saving}>{saving?"Saving...":<><Save size={14}/> Save Payment</>}</button></div>
    </form>}

    <section className="receive-list-card">
      <div className="receive-list-head"><div><b>Received Payments</b><small>Payment history</small></div><span>{payments.length} Records</span></div>
      <div className="receive-table">
        <div className="receive-row receive-head"><span>Party Name</span><span>Date</span><span>Amount</span><span>Payment ID</span></div>
        {loading ? <div className="receive-empty"><RefreshCw size={18} className="spin"/> Loading payments...</div> :
        payments.length ? payments.map(p=><div className="receive-row" key={p.id}><div className="receive-party-name"><span>{p.partyName?.[0]||"P"}</span><b>{p.partyName}</b></div><span>{p.date}</span><strong>₹{Number(p.amount||0).toLocaleString("en-IN",{minimumFractionDigits:2})}</strong><code>{p.id}</code></div>) :
        <div className="receive-empty">No received payments yet. Click <b>Add Payment</b> to create one.</div>}
      </div>
    </section>
  </main>;
}
