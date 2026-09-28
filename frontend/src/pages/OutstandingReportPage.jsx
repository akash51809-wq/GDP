import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import "./OutstandingReportPage.css";
import { API } from "../apiConfig";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function authHeaders() {
  const token = sessionStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function OutstandingReportPage() {
  const [parties, setParties] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(API + "/api/parties", { credentials: "include", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      setParties(r.ok ? (d.parties || []) : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const dues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties.filter(p => Number(p.balance || 0) > 0 && (!q || String(p.customerName || "").toLowerCase().includes(q)));
  }, [parties, query]);

  const total = dues.reduce((sum, p) => sum + Number(p.balance || 0), 0);

  function download() {
    const rows = [["SL","Customer Name","Outstanding Amount"]];
    dues.forEach((p,i) => rows.push([i + 1, p.customerName || "", Number(p.balance || 0).toFixed(2)]));
    const csv = rows.map(row => row.map(v => JSON.stringify(String(v ?? ""))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "outstanding-report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="content outstanding-report-page">
      <div className="module-page-header outstanding-report-head">
        <div>
          <div className="eyebrow">REPORTS / OUTSTANDING</div>
          <h1>Outstanding <span>✦</span></h1>
          <p>Customers with pending dues only.</p>
        </div>
        <div className="outstanding-actions">
          <button onClick={load} disabled={loading}><RefreshCw size={14}/> {loading ? "Refreshing..." : "Refresh"}</button>
          {dues.length > 0 && <button onClick={download}><Download size={14}/> Download</button>}
        </div>
      </div>

      <section className="outstanding-summary">
        <div><span>PARTIES WITH DUES</span><b>{dues.length}</b></div>
        <div><span>TOTAL OUTSTANDING</span><b>{money(total)}</b></div>
        <label><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer..." /></label>
      </section>

      <section className="outstanding-card">
        <div className="outstanding-card-title"><span>OUTSTANDING CUSTOMERS</span><small>{dues.length} customer{dues.length === 1 ? "" : "s"}</small></div>
        <div className="outstanding-table-wrap">
          <table className="outstanding-table">
            <thead><tr><th>#</th><th>Customer Name</th><th>Outstanding</th></tr></thead>
            <tbody>
              {dues.length === 0 ? <tr><td colSpan="3" className="outstanding-empty">No outstanding dues found.</td></tr> :
                dues.map((p,i) => <tr key={p.id}><td>{i + 1}</td><td><b>{p.customerName}</b></td><td className="outstanding-amount">{money(p.balance)}</td></tr>)}
            </tbody>
            <tfoot><tr><td colSpan="2">TOTAL</td><td className="outstanding-amount">{money(total)}</td></tr></tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
