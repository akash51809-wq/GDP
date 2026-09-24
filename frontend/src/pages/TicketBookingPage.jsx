import { useEffect, useState } from "react";
import { Ticket, Plus, CalendarDays, Hash, IndianRupee, UserRound, X, Save, RotateCcw, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import "./TicketBookingPage.css";
import { API } from "../apiConfig";

function go(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function authHeaders() {
  const token = localStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

export default function TicketBookingPage() {
  const [parties, setParties] = useState([]);
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pnr, setPnr] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });

  async function loadParties() {
    setLoading(true);
    try {
      const res = await fetch(API + "/api/parties", { credentials: "include", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load parties.");
      setParties(data.parties || []);
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadParties(); }, []);

  const filteredParties = parties.filter(p => {
    const q = partySearch.trim().toLowerCase();
    if (!q) return true;
    return [p.customerName, p.whatsapp, p.email, p.city].some(v => String(v || "").toLowerCase().includes(q));
  }).slice(0, 8);

  function selectParty(party) {
    setSelectedParty(party);
    setPartySearch(party.customerName);
    setNotice({ type: "", text: "" });
  }

  function resetForm() {
    setSelectedParty(null);
    setPartySearch("");
    setBookingDate(new Date().toISOString().slice(0, 10));
    setPnr("");
    setAmount("");
    setNotice({ type: "", text: "" });
  }

  async function saveBooking(e) {
    e.preventDefault();
    if (!selectedParty) return setNotice({ type: "error", text: "Please choose a party first." });
    if (!pnr.trim()) return setNotice({ type: "error", text: "Please enter PNR number." });
    if (!amount || Number(amount) < 0) return setNotice({ type: "error", text: "Please enter a valid ticket amount." });

    setSaving(true);
    setNotice({ type: "", text: "" });
    try {
      const res = await fetch(API + "/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          partyId: selectedParty.id,
          partyName: selectedParty.customerName,
          bookingDate,
          pnr: pnr.trim(),
          amount: Number(amount)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not save ticket.");
      setNotice({ type: "success", text: "Ticket booking saved successfully." });
      setPnr("");
      setAmount("");
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content ticket-booking-page">
      <div className="ticket-booking-hero">
        <div>
          <div className="eyebrow">BOOKING CENTER</div>
          <h1><Ticket size={23} /> New Ticket Booking <span>✦</span></h1>
          <p>Choose a party, enter booking details and save the ticket in a few steps.</p>
        </div>
        <button className="ticket-back" onClick={() => go("/dashboard")}><ArrowLeft size={14} /> Back</button>
      </div>
      <form className="ticket-booking-card" onSubmit={saveBooking}>
        <section className="ticket-section">
          <div className="ticket-section-title"><span>01</span><div><b>Choose Party</b><small>Select an existing party or add a new one</small></div></div>
          <div className="party-picker">
            <div className={"party-picker-input " + (selectedParty ? "selected" : "")}>
              <UserRound size={16} />
              <input value={partySearch} onChange={e => { setPartySearch(e.target.value); setSelectedParty(null); }} placeholder="Type party name, WhatsApp, email or city..." autoComplete="off" />
              {partySearch && <button type="button" onClick={() => { setPartySearch(""); setSelectedParty(null); }}><X size={14} /></button>}
            </div>
            <button type="button" className="add-new-party" onClick={() => go("/party/add")}><Plus size={15} /> Add New Party</button>
          </div>
          {selectedParty && <div className="selected-party"><div className="selected-avatar">{selectedParty.customerName?.[0] || "P"}</div><div><b>{selectedParty.customerName}</b><small>{selectedParty.partyType || "Customer"} • {selectedParty.city || "City not set"} • {selectedParty.whatsapp || "No WhatsApp"}</small></div><CheckCircle2 size={17} /></div>}
          {!selectedParty && partySearch.trim() && (
            <div className="party-results">
              {loading ? <div className="party-result-empty"><RefreshCw size={15} className="spin" /> Loading parties...</div> :
               filteredParties.length ? filteredParties.map(p => (
                <button type="button" className="party-result" key={p.id} onClick={() => selectParty(p)}>
                  <span className="result-avatar">{p.customerName?.[0] || "P"}</span>
                  <span><b>{p.customerName}</b><small>{p.partyType || "Customer"} • {p.whatsapp || p.email || p.city || "No contact"}</small></span>
                </button>
               )) : <div className="party-result-empty">No matching party found. Use <b>Add New Party</b> to create one.</div>}
            </div>
          )}
          {!loading && parties.length === 0 && !partySearch && <div className="party-empty-note">No parties added yet. <button type="button" onClick={() => go("/party/add")}>＋ Add New Party</button></div>}
        </section>
        <section className="ticket-section">
          <div className="ticket-section-title"><span>02</span><div><b>Booking Details</b><small>Date, PNR and ticket amount</small></div></div>
          <div className="ticket-fields">
            <label className="ticket-field"><span><CalendarDays size={13} /> Booking Date</span><input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required /></label>
            <label className="ticket-field"><span><Hash size={13} /> PNR Number</span><input value={pnr} onChange={e => setPnr(e.target.value)} placeholder="Enter PNR number" maxLength={30} required /></label>
            <label className="ticket-field amount-field"><span><IndianRupee size={13} /> Ticket Amount</span><div><b>₹</b><input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></div></label>
          </div>
        </section>
        {notice.text && <div className={"ticket-notice " + notice.type}>{notice.text}</div>}
        <div className="ticket-actions"><button type="button" className="ticket-reset" onClick={resetForm} disabled={saving}><RotateCcw size={14} /> Reset</button><button type="submit" className="ticket-save" disabled={saving || loading}><Save size={15} /> {saving ? "Saving..." : "Save Booking"}</button></div>
      </form>
    </main>
  );
}
