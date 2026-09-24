import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, WalletCards, Users, IndianRupee } from "lucide-react";
import "./BalancePaymentPage.css";
import { API } from "../apiConfig";
function authHeaders(){const token=localStorage.getItem("raildesk_auth_token");return token?{Authorization:"Bearer "+token}:{}}
const money=v=>"₹"+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function BalancePaymentPage(){
 const [parties,setParties]=useState([]),[search,setSearch]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch(API+"/api/reports/balance-payments",{credentials:"include",headers:authHeaders()});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Unable to load balance list.");setParties(d.parties||[])}catch(e){setError(e.message||"Unable to load balance list.")}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return parties;return parties.filter(p=>[p.customerName,p.whatsapp,p.email,p.city].some(v=>String(v||"").toLowerCase().includes(q)))},[parties,search]);
 const total=parties.reduce((s,p)=>s+Number(p.balance||0),0);
 return <main className="content balance-payment-page">
  <div className="module-page-header balance-head"><div><div className="eyebrow">REPORTS / BALANCE PAYMENT</div><h1>Balance Payment <span>✦</span></h1><p>Parties with an outstanding balance and the amount currently due.</p></div><button className="balance-refresh" onClick={load} disabled={loading}><RefreshCw size={15} className={loading?"spin":""}/> Refresh</button></div>
  <section className="balance-stats"><div className="balance-stat"><div className="balance-stat-icon blue"><Users size={18}/></div><div><small>PARTIES WITH BALANCE</small><b>{parties.length}</b></div></div><div className="balance-stat"><div className="balance-stat-icon amber"><IndianRupee size={18}/></div><div><small>TOTAL OUTSTANDING</small><b>{money(total)}</b></div></div></section>
  <section className="balance-card"><div className="balance-toolbar"><div className="balance-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search party, WhatsApp, email or city..."/></div><span className="balance-count">{filtered.length} {filtered.length===1?"party":"parties"}</span></div>
   {error&&<div className="balance-error">{error}</div>}<div className="balance-table-wrap"><table className="balance-table"><thead><tr><th>#</th><th>Party / Customer</th><th>WhatsApp</th><th>City</th><th>Status</th><th className="amount-col">Balance Amount</th></tr></thead><tbody>
   {!loading&&filtered.length===0&&<tr><td colSpan="6" className="empty-balance"><WalletCards size={28}/><b>No outstanding balance found</b><span>All parties currently have zero balance.</span></td></tr>}
   {filtered.map((p,i)=><tr key={p.id}><td>{i+1}</td><td><b>{p.customerName}</b><small>{p.partyType||"Customer"}</small></td><td>{p.whatsapp||"—"}</td><td>{p.city||"—"}</td><td><span className={"balance-status "+(p.status==="ACTIVE"?"active":"inactive")}>{p.status}</span></td><td className="amount-col"><strong>{money(p.balance)}</strong></td></tr>)}
   {loading&&<tr><td colSpan="6" className="loading-balance">Loading balance list…</td></tr>}</tbody></table></div></section>
 </main>
}