import { useEffect, useMemo, useState } from "react";
import { Search, Download, RefreshCw, BookOpen, Ticket as TicketIcon, Image, X, FileDown } from "lucide-react";
import "./PartyLedgerPage.css";
import { API } from "../apiConfig";

const money = (value) => "₹" + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function authHeaders() {
  const token = sessionStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function PartyLedgerPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [query, setQuery] = useState("");
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketView, setTicketView] = useState(null);

  useEffect(() => {
    fetch(API + "/api/parties", { credentials: "include", headers: authHeaders() })
      .then(r => r.json())
      .then(d => setParties(d.parties || []))
      .catch(() => {});
  }, []);

  async function load(id = partyId) {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(API + "/api/reports/party-ledger/" + encodeURIComponent(id), {
        credentials: "include", headers: authHeaders()
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Unable to load ledger.");
      setLedger(d);
    } catch (e) {
      setError(e.message || "Unable to load ledger.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties.filter(p => !q || [p.customerName,p.whatsapp,p.email,p.city].some(v => String(v || "").toLowerCase().includes(q)));
  }, [parties, query]);

  function downloadLedger() {
    if (!ledger) return;
    const rows = [
      ["SL","Date","Type","Ticket / Payment Detail","Reference","DR","CR","Balance"],
      ...ledger.ledger.map(e => [e.sr,e.date,e.type === "TICKET" ? "Ticket Booking" : "Payment Received",e.description,e.reference,e.dr,e.cr,e.balance])
    ];
    const csv = rows.map(row => row.map(v => JSON.stringify(String(v ?? ""))).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=(ledger.party.customerName || "party")+"-ledger.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function downloadTicket(ticket) {
    const blob = new Blob([JSON.stringify(ticket, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="ticket-"+(ticket.pnr || ticket.id)+".json"; a.click(); URL.revokeObjectURL(url);
  }

  function openAttachment(payment) {
    if (!payment?.attachmentData) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write("<title>Payment Attachment</title><body style='margin:0;background:#111;display:flex;align-items:center;justify-content:center'><img src='"+payment.attachmentData+"' style='max-width:100%;max-height:100vh;object-fit:contain'/></body>");
      win.document.close();
    }
  }

  function downloadAttachment(payment) {
    if (!payment?.attachmentData) return;
    const a=document.createElement("a"); a.href=payment.attachmentData; a.download=payment.attachmentName || "payment-attachment"; a.click();
  }

  return (
    <main className="content party-ledger-page">
      <div className="module-page-header ledger-head">
        <div>
          <div className="eyebrow">REPORTS / LEDGER</div>
          <h1>Party Ledger <span>✦</span></h1>
          <p>Party-wise ticket DR, payment CR and complete running balance.</p>
        </div>
        {ledger && <button className="ledger-download-top" onClick={downloadLedger}><Download size={14}/> Download Ledger</button>}
      </div>

      <section className="ledger-filter compact">
        <div className="party-search">
          <Search size={15}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search party..." />
        </div>
        <select value={partyId} onChange={e=>{setPartyId(e.target.value);load(e.target.value)}}>
          <option value="">Choose Party</option>
          {filtered.map(p=><option key={p.id} value={p.id}>{p.customerName}</option>)}
        </select>
        <button className="ledger-refresh" onClick={()=>load()} disabled={!partyId || loading}><RefreshCw size={14}/> {loading ? "Loading..." : "Refresh"}</button>
      </section>

      {error && <div className="ledger-error">{error}</div>}
      {!ledger && !loading && <div className="ledger-empty"><BookOpen size={34}/><b>Choose a Party</b><span>Select a party above to view complete ticket and payment history.</span></div>}

      {ledger && <>
        <section className="party-summary">
          <div><small>PARTY</small><b>{ledger.party.customerName}</b><span>{ledger.party.whatsapp || ledger.party.email || ledger.party.city || "Customer"}</span></div>
          <div><small>TOTAL DR</small><b>{money(ledger.totalDr)}</b><span>Ticket Bookings</span></div>
          <div><small>TOTAL CR</small><b>{money(ledger.totalCr)}</b><span>Payments Received</span></div>
          <div><small>BALANCE</small><b>{money(ledger.balance)}</b><span>{ledger.balance > 0 ? "Amount Due" : ledger.balance < 0 ? "Advance" : "Settled"}</span></div>
        </section>

        <section className="ledger-card">
          <div className="ledger-title"><span>Complete Transaction Ledger</span><small>{ledger.ledger.length} entries</small></div>
          <div className="ledger-table-wrap">
            <table className="ledger-table detailed">
              <thead><tr><th>#</th><th>Date</th><th>Entry</th><th>Ticket / Payment Detail</th><th>DR</th><th>CR</th><th>Balance</th><th>Attachment</th><th>Actions</th></tr></thead>
              <tbody>
                {ledger.ledger.length === 0 ? <tr><td colSpan="9" className="ledger-empty-row">No transactions found.</td></tr> :
                ledger.ledger.map(e => {
                  const ticket=e.ticket, payment=e.payment;
                  return <tr key={e.id}>
                    <td>{e.sr}</td>
                    <td>{e.date}</td>
                    <td><span className={"entry-pill "+(e.type==="TICKET"?"dr-pill":"cr-pill")}>{e.type==="TICKET"?"DR":"CR"}</span><b>{e.description}</b></td>
                    <td>
                      {ticket ? <div className="ledger-detail"><b>PNR: {ticket.pnr || "—"}</b><span>Amount: {money(ticket.amount)}</span><span>{ticket.qrParsedData?.trainName || ticket.qrParsedData?.trainNumber || "Ticket details saved"}</span></div>
                      : <div className="ledger-detail"><b>Payment ID: {payment?.id || e.reference}</b><span>Received: {money(payment?.amount)}</span>{payment?.attachmentName && <span title={payment.attachmentName}>Slip: {payment.attachmentName}</span>}</div>}
                    </td>
                    <td className="amt dr">{e.dr ? money(e.dr) : "—"}</td>
                    <td className="amt cr">{e.cr ? money(e.cr) : "—"}</td>
                    <td className="amt balance">{money(e.balance)}</td>
                    <td>{payment?.attachmentData ? <div className="attachment-actions"><button title="Show attachment" onClick={()=>openAttachment(payment)}><Image size={14}/></button><button title="Download attachment" onClick={()=>downloadAttachment(payment)}><FileDown size={14}/></button></div> : "—"}</td>
                    <td>{ticket ? <div className="attachment-actions"><button title="Show ticket" onClick={()=>setTicketView(ticket)}><TicketIcon size={14}/></button><button title="Download ticket" onClick={()=>downloadTicket(ticket)}><Download size={14}/></button></div> : "—"}</td>
                  </tr>;
                })}
              </tbody>
              <tfoot><tr><td colSpan="4">TOTAL</td><td className="amt dr">{money(ledger.totalDr)}</td><td className="amt cr">{money(ledger.totalCr)}</td><td className="amt balance">{money(ledger.balance)}</td><td colSpan="2"></td></tr></tfoot>
            </table>
          </div>
        </section>
      </>}

      {ticketView && <div className="ticket-modal-backdrop" onClick={()=>setTicketView(null)}>
        <div className="ticket-modal" onClick={e=>e.stopPropagation()}>
          <div className="ticket-modal-head"><div><small>TICKET DETAILS</small><b>PNR {ticketView.pnr || "—"}</b></div><button onClick={()=>setTicketView(null)}><X size={17}/></button></div>
          <div className="ticket-detail-grid">
            <div><small>Booking Date</small><b>{ticketView.bookingDate || "—"}</b></div>
            <div><small>Amount</small><b>{money(ticketView.amount)}</b></div>
            <div><small>Status</small><b>{ticketView.status || "—"}</b></div>
            <div><small>QR Type</small><b>{ticketView.qrType || "—"}</b></div>
            <div><small>Train</small><b>{ticketView.qrParsedData?.trainName || ticketView.qrParsedData?.trainNumber || "—"}</b></div>
            <div><small>Journey Date</small><b>{ticketView.qrParsedData?.journeyDate || ticketView.qrParsedData?.journeyDateISO || "—"}</b></div>
            <div><small>From</small><b>{ticketView.qrParsedData?.fromStation || "—"}</b></div>
            <div><small>To</small><b>{ticketView.qrParsedData?.toStation || "—"}</b></div>
            <div><small>Class</small><b>{ticketView.qrParsedData?.travelClass || "—"}</b></div>
            <div><small>Passengers</small><b>{ticketView.qrParsedData?.passengerCount || "—"}</b></div>
          </div>
          <div className="ticket-modal-actions"><button onClick={()=>downloadTicket(ticketView)}><Download size={14}/> Download Ticket Data</button></div>
        </div>
      </div>}
    </main>
  );
}
