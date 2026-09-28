import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, Image, Search, X } from "lucide-react";
import "./PaymentsReportPage.css";
import { API } from "../apiConfig";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function authHeaders() {
  const token = sessionStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function PaymentsReportPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);

  useEffect(() => {
    load();
    fetch(API + "/api/parties", { credentials: "include", headers: authHeaders() })
      .then(r => r.json()).then(d => setParties(d.parties || [])).catch(() => {});
  }, [partyId, date]);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (partyId) qs.set("partyId", partyId);
      if (date) qs.set("date", date);
      const r = await fetch(API + "/api/reports/payments?" + qs.toString(), { credentials: "include", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      setPayments(r.ok ? (d.payments || []) : []);
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties.filter(p => !q || [p.customerName, p.whatsapp, p.email].some(v => String(v || "").toLowerCase().includes(q)));
  }, [parties, query]);

  function downloadPayment(payment) {
    const copy = { ...payment };
    delete copy.attachmentData;
    const blob = new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payment-" + payment.id + ".json"; a.click(); URL.revokeObjectURL(url);
  }

  function showAttachment(payment) {
    if (!payment.attachmentData) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write("<title>Payment Attachment</title><body style='margin:0;background:#111;display:flex;align-items:center;justify-content:center'><img src='" + payment.attachmentData + "' style='max-width:100%;max-height:100vh;object-fit:contain'/></body>");
      win.document.close();
    }
  }

  function downloadAttachment(payment) {
    if (!payment.attachmentData) return;
    const a = document.createElement("a"); a.href = payment.attachmentData; a.download = payment.attachmentName || "payment-slip"; a.click();
  }

  function downloadAll() {
    const rows = [["SL","Date","Party","Payment ID","Amount","Attachment"]];
    payments.forEach((p,i) => rows.push([i+1,p.date,p.partyName,p.id,p.amount,p.attachmentName || ""]));
    const csv = rows.map(row => row.map(v => JSON.stringify(String(v ?? ""))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="received-payments.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="content payments-report-page">
      <div className="module-page-header payments-report-head">
        <div><div className="eyebrow">REPORTS / PAYMENTS</div><h1>Received Payments <span>✦</span></h1><p>Party-wise received payment details with date filter.</p></div>
        {payments.length > 0 && <button className="payments-download-top" onClick={downloadAll}><Download size={14}/> Download All</button>}
      </div>

      <section className="payments-report-filter">
        <div className="payment-filter-party"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search party..." /><select value={partyId} onChange={e=>setPartyId(e.target.value)}><option value="">All Parties</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.customerName}</option>)}</select></div>
        <label>DATE<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        
      </section>

      <section className="payments-report-card">
        <div className="payments-report-title"><span>RECEIVED PAYMENTS</span><small>{payments.length} payment{payments.length===1?"":"s"}</small></div>
        <div className="payments-report-table-wrap">
          <table className="payments-report-table">
            <thead><tr><th>#</th><th>Date</th><th>Party</th><th>Payment ID</th><th>Amount</th><th>Attachment</th><th>Actions</th></tr></thead>
            <tbody>
              {!payments.length ? <tr><td colSpan="7" className="payments-empty">No received payments found for the selected filters.</td></tr> :
                payments.map((p,i)=><tr key={p.id}>
                  <td>{i+1}</td><td>{p.date || "—"}</td><td><b>{p.partyName || "—"}</b></td><td><b>{p.id}</b></td><td className="payment-report-amount">{money(p.amount)}</td>
                  <td>{p.attachmentData ? <div className="payment-attachment-actions"><button title="Show attachment" onClick={()=>showAttachment(p)}><Image size={14}/> Show</button><button title="Download attachment" onClick={()=>downloadAttachment(p)}><FileDown size={14}/> Download</button></div> : "—"}</td>
                  <td><button className="payment-json-btn" onClick={()=>downloadPayment(p)}><Download size={14}/> Payment</button></td>
                </tr>)}
            </tbody>
            <tfoot><tr><td colSpan="4">TOTAL</td><td className="payment-report-amount">{money(payments.reduce((n,p)=>n+Number(p.amount||0),0))}</td><td colSpan="2"></td></tr></tfoot>
          </table>
        </div>
      </section>

      {attachment && <div onClick={()=>setAttachment(null)}><X /></div>}
    </main>
  );
}
