import { useEffect, useState } from "react";
import {
  Ticket, TrainFront, Search, RefreshCw, CircleCheck, Database, ChevronRight,
  CalendarDays, CreditCard, MapPin, Clock3, IndianRupee, Users, UserRound
} from "lucide-react";
import "./TicketBookingPage.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function InfoCard({ icon, label, value }) {
  return <div className="info-card"><div className="info-icon">{icon}</div><div><small>{label}</small><b>{value}</b></div></div>;
}

function PnrResult({ record }) {
  const passengers = Array.isArray(record.passengers) ? record.passengers : [];
  const journey = record.journey || {};
  const booking = record.booking || {};
  const chart = record.chart || {};

  return (
    <section className="pnr-result">
      <div className="pnr-result-head">
        <div>
          <div className="eyebrow">LIVE PNR SNAPSHOT</div>
          <h2>{record.pnr}</h2>
          <span>{chart.status || record.chartStatus || "PNR details fetched"}</span>
        </div>
        <div className="fare-chip"><IndianRupee size={16} /> ₹{record.fare ?? booking.fare ?? "—"}</div>
      </div>
      <div className="pnr-overview">
        <div className="pnr-train-block">
          <div className="round-icon"><TrainFront size={23} /></div>
          <div><small>TRAIN</small><strong>{record.trainNumber || "—"} • {record.trainName || "Train name unavailable"}</strong></div>
        </div>
        <div className="route-block">
          <div><b>{record.sourceCode || journey.source?.code || "—"}</b><span>{record.sourceName || journey.source?.name || "Source unavailable"}</span></div>
          <div className="route-line"><span></span><ChevronRight size={15} /><span></span></div>
          <div><b>{record.destinationCode || journey.destination?.code || "—"}</b><span>{record.destinationName || journey.destination?.name || "Destination unavailable"}</span></div>
        </div>
      </div>
      <div className="journey-grid">
        <InfoCard icon={<CalendarDays />} label="Journey Date" value={record.journeyDateText || journey.dateOfJourney || "Not available"} />
        <InfoCard icon={<CreditCard />} label="Class / Quota" value={(record.travelClass || journey.class || "—") + " / " + (record.quota || journey.quota || "—")} />
        <InfoCard icon={<MapPin />} label="Boarding Point" value={(record.boardingName || journey.boardingPoint?.name || "—") + " (" + (record.boardingCode || journey.boardingPoint?.code || "—") + ")"} />
        <InfoCard icon={<Clock3 />} label="Arrival" value={journey.arrivalDate || "Not available"} />
        <InfoCard icon={<MapPin />} label="Distance" value={journey.distance != null ? journey.distance + " km" : "Not available"} />
        <InfoCard icon={<IndianRupee />} label="Ticket Fare" value={booking.ticketFare != null ? "₹" + booking.ticketFare : "Not available"} />
        <InfoCard icon={<IndianRupee />} label="Total Fare" value={booking.fare != null ? "₹" + booking.fare : record.fare != null ? "₹" + record.fare : "Not available"} />
        <InfoCard icon={<CalendarDays />} label="Booking Date" value={booking.bookingDate || "Not available"} />
      </div>
      <div className="boarding-line">
        <MapPin size={15} /> Boarding: <b>{record.boardingName || journey.boardingPoint?.name || record.boardingCode || journey.boardingPoint?.code || "—"}</b>
        <span>•</span><Users size={15} /> Passengers: <b>{record.passengerCount ?? passengers.length}</b>
        <span>•</span><CircleCheck size={15} /> Chart: <b>{chart.status || record.chartStatus || "Not available"}</b>
      </div>
      <div className="passenger-table">
        <div className="passenger-head"><span>Passenger</span><span>Booking Status</span><span>Current Status</span></div>
        {passengers.length ? passengers.map((p, i) => (
          <div className="passenger-row" key={i}>
            <div className="passenger-name">
              <div className="mini-avatar"><UserRound size={14} /></div>
              <div><b>{p.serialNumber || "Passenger " + (i + 1)}</b><small>{p.coachPosition != null ? "Coach Position: " + p.coachPosition : ""}</small></div>
            </div>
            <span>{p.booking?.details || p.booking?.status || "—"}{p.booking?.coach ? " • " + p.booking.coach : ""}{p.booking?.berthNo ? " • Berth " + p.booking.berthNo : ""}{p.booking?.berthCode ? " [" + p.booking.berthCode + "]" : ""}</span>
            <span className="current-status">{p.current?.details || p.current?.status || "—"}{p.current?.coach ? " • " + p.current.coach : ""}{p.current?.berthNo ? " • Berth " + p.current.berthNo : ""}{p.current?.berthCode ? " [" + p.current.berthCode + "]" : ""}</span>
          </div>
        )) : <div className="empty-state small"><Users size={20} /><span>Passenger details are not available.</span></div>}
      </div>
      <div className="saved-strip">
        <Database size={15} /> This PNR record is saved in temporary testing storage
        <span>•</span> Last fetch: {record.fetchedAt ? new Date(record.fetchedAt).toLocaleString("en-IN") : "now"}
      </div>
    </section>
  );
}

export default function TicketBookingPage() {
  const [pnr, setPnr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [record, setRecord] = useState(null);
  const [recent, setRecent] = useState([]);

  async function loadRecent() {
    const res = await fetch(API + "/api/pnr/recent", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setRecent(data.records || []);
    }
  }

  useEffect(() => { loadRecent().catch(() => {}); }, []);

  async function fetchPnr(e) {
    e.preventDefault();
    setError(""); setNotice(""); setRecord(null);
    const clean = pnr.replace(/\D/g, "");
    if (clean.length !== 10) {
      setError("Please enter a 10-digit PNR.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API + "/api/pnr/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pnr: clean })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "PNR fetch failed.");
      setRecord(data.record);
      setNotice(data.message);
      setPnr(clean);
      await loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openRecord(item) {
    setPnr(item.pnr);
    setRecord(item);
    setNotice("This record was loaded from temporary storage.");
    setError("");
  }

  return (
    <main className="content ticket-booking-page">
      <div className="page-hero">
        <div><div className="eyebrow">TICKET BOOKING • RAILKIT</div><h1>PNR Center <span>✦</span></h1><p>Enter a 10-digit PNR — fetch live details and save them immediately in temporary testing storage.</p></div>
        <div className="integration-badge"><CircleCheck size={17} /> RailKit Integration</div>
      </div>

      <section className="glass-panel pnr-search-panel">
        <div className="pnr-search-copy">
          <div className="round-icon"><Ticket size={22} /></div>
          <div><b>Get PNR Details</b><span>PNR, train, journey, fare and passenger status</span></div>
        </div>
        <form className="pnr-form" onSubmit={fetchPnr}>
          <input value={pnr} onChange={e => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} placeholder="e.g. 5827194603" />
          <button className="primary-small fetch-btn" disabled={loading}>{loading ? <><RefreshCw size={16} className="spin" /> Fetching…</> : <><Search size={16} /> Fetch PNR</>}</button>
        </form>
        {error && <div className="error-box pnr-error">{error}</div>}
        {notice && !error && <div className="success-box"><CircleCheck size={15} /> {notice}</div>}
      </section>

      {record && <PnrResult record={record} />}

      <section className="glass-panel recent-panel">
        <div className="panel-head">
          <div><div className="eyebrow">DATABASE</div><h3>Recent PNR Records</h3></div>
          <button className="ghost-btn" onClick={() => loadRecent()} title="Refresh"><RefreshCw size={16} /></button>
        </div>
        {recent.length === 0 ? <div className="empty-state"><Database size={25} /><span>No PNR records have been saved yet.</span></div> :
          <div className="recent-list">{recent.map(item => (
            <button className="recent-row" key={item.id} onClick={() => openRecord(item)}>
              <div className="recent-pnr"><b>{item.pnr}</b><small>{item.trainNumber || "—"} {item.trainName || ""}</small></div>
              <div className="recent-route">{item.sourceCode || "—"} <ChevronRight size={13} /> {item.destinationCode || "—"}</div>
              <div className="recent-status">{item.chartStatus || "Status available"}<small>{item.passengerCount || 0} Passengers</small></div>
              <ArrowUpRightSafe />
            </button>
          ))}</div>}
      </section>
    </main>
  );
}

function ArrowUpRightSafe() {
  return <span className="recent-arrow">↗</span>;
}
