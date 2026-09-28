import { useEffect, useMemo, useState } from "react";
import { Download, Search, Ticket as TicketIcon, X } from "lucide-react";
import "./TicketsReportPage.css";
import { API } from "../apiConfig";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function authHeaders() {
  const token = sessionStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function TicketsReportPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ticketView, setTicketView] = useState(null);

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
      const r = await fetch(API + "/api/reports/tickets?" + qs.toString(), { credentials: "include", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      setTickets(r.ok ? (d.tickets || []) : []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties.filter(p => !q || [p.customerName, p.whatsapp, p.email].some(v => String(v || "").toLowerCase().includes(q)));
  }, [parties, query]);

  function downloadTicket(ticket) {
    const blob = new Blob([JSON.stringify(ticket, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ticket-" + (ticket.pnr || ticket.id) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    const blob = new Blob([JSON.stringify(tickets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "booked-tickets.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="content tickets-report-page">
      <div className="module-page-header tickets-report-head">
        <div>
          <div className="eyebrow">REPORTS / TICKETS</div>
          <h1>Booked Tickets <span>✦</span></h1>
          <p>Party-wise booked ticket details with date filter.</p>
        </div>
        {tickets.length > 0 && <button className="tickets-download-top" onClick={downloadAll}><Download size={14}/> Download All</button>}
      </div>

      <section className="tickets-report-filter">
        <div className="ticket-filter-party">
          <Search size={15}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search party..." />
          <select value={partyId} onChange={e => setPartyId(e.target.value)}>
            <option value="">All Parties</option>
            {filtered.map(p => <option key={p.id} value={p.id}>{p.customerName}</option>)}
          </select>
        </div>
        <label>DATE<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        
      </section>

      <section className="tickets-report-card">
        <div className="tickets-report-title"><span>BOOKED TICKETS</span><small>{tickets.length} ticket{tickets.length === 1 ? "" : "s"}</small></div>
        <div className="tickets-report-table-wrap">
          <table className="tickets-report-table">
            <thead><tr><th>#</th><th>Date</th><th>Party</th><th>PNR</th><th>Ticket Details</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {!tickets.length ? <tr><td colSpan="7" className="tickets-empty">No booked tickets found for the selected filters.</td></tr> :
                tickets.map((t, i) => {
                  const q = t.qrParsedData || {};
                  return <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td>{t.bookingDate || "—"}</td>
                    <td><b>{t.partyName || "—"}</b></td>
                    <td><b>{t.pnr || "—"}</b></td>
                    <td><div className="ticket-report-detail"><b>{q.trainName || q.trainNumber || "Ticket"}</b><span>{q.fromStation || "—"} → {q.toStation || "—"}</span><span>{q.journeyDate || q.journeyDateISO || ""} {q.travelClass ? "• " + q.travelClass : ""}</span></div></td>
                    <td className="ticket-report-amount">{money(t.amount)}</td>
                    <td><div className="ticket-report-actions"><button title="Show ticket" onClick={() => setTicketView(t)}><TicketIcon size={14}/> Show</button><button title="Download ticket data" onClick={() => downloadTicket(t)}><Download size={14}/> Download</button></div></td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
      </section>

      {ticketView && <div className="ticket-report-modal-backdrop" onClick={() => setTicketView(null)}>
        <div className="ticket-report-modal" onClick={e => e.stopPropagation()}>
          <div className="ticket-report-modal-head"><div><small>BOOKED TICKET</small><b>PNR {ticketView.pnr || "—"}</b></div><button onClick={() => setTicketView(null)}><X size={17}/></button></div>
          <div className="ticket-report-detail-grid">
            <div><small>Party</small><b>{ticketView.partyName || "—"}</b></div>
            <div><small>Booking Date</small><b>{ticketView.bookingDate || "—"}</b></div>
            <div><small>Amount</small><b>{money(ticketView.amount)}</b></div>
            <div><small>Status</small><b>{ticketView.status || "—"}</b></div>
            <div><small>Train</small><b>{ticketView.qrParsedData?.trainName || ticketView.qrParsedData?.trainNumber || "—"}</b></div>
            <div><small>Journey Date</small><b>{ticketView.qrParsedData?.journeyDate || ticketView.qrParsedData?.journeyDateISO || "—"}</b></div>
            <div><small>From</small><b>{ticketView.qrParsedData?.fromStation || "—"}</b></div>
            <div><small>To</small><b>{ticketView.qrParsedData?.toStation || "—"}</b></div>
            <div><small>Class</small><b>{ticketView.qrParsedData?.travelClass || "—"}</b></div>
            <div><small>Passengers</small><b>{ticketView.qrParsedData?.passengerCount || "—"}</b></div>
          </div>
          <div className="ticket-report-modal-actions"><button onClick={() => downloadTicket(ticketView)}><Download size={14}/> Download Ticket Data</button></div>
        </div>
      </div>}
    </main>
  );
}
