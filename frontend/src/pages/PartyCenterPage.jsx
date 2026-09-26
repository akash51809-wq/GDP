import { useEffect, useState } from "react";
import {
  Users, Search, X, SlidersHorizontal, ArrowDownAZ, Download, MoreHorizontal,
  Pencil, Eye, UserPlus, Mail, MessageCircle, CheckCircle2, XCircle, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, IndianRupee
} from "lucide-react";
import "./PartyCenterPage.css";
import { API } from "../apiConfig";

export default function PartyCenterPage() {
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

  async function deleteParty(party) {
    const confirmed = window.confirm(`Delete "${party.customerName}" permanently from the database?`);
    if (!confirmed) return;

    setNotice("");
    try {
      const res = await fetch(API + "/api/parties/" + encodeURIComponent(party.id), {
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not delete party.");

      setParties(prev => prev.filter(item => item.id !== party.id));
      setNotice(data.message || "Party deleted successfully.");
    } catch (err) {
      setNotice(err.message);
    }
  }

  function exportCsv() {
    const headers = ["Customer Name","WhatsApp","Email","Address","Status","Balance"];
    const rows = filtered.map(p => [p.customerName,p.whatsapp,p.email,p.address,p.status,p.balance]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => '"' + String(v ?? "").replaceAll('"','""') + '"').join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raildesk-parties.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="content party-content party-center-page">
      <div className="page-hero party-hero">
        <div>
          <div className="eyebrow">CUSTOMER MANAGEMENT</div>
          <h1>Party Center <span>✦</span></h1>
          <p>Manage customer accounts, contact details and outstanding balances from one compact workspace.</p>
        </div>
        <button className="primary-small party-add-btn" onClick={() => { window.history.pushState({}, "", "/party/add"); window.dispatchEvent(new PopStateEvent("popstate")); }}><UserPlus size={16} /> Create Party</button>
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
              <div className="party-actions"><button title="View"><Eye size={14}/></button><button title="Edit"><Pencil size={14}/></button><button title="More"><MoreHorizontal size={15}/></button><button title="Delete customer" onClick={() => deleteParty(p)}><Trash2 size={14}/></button></div>
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

      {notice && <div className="party-notice">{notice}</div>}
    </main>
  );
}
