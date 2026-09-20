import { CalendarDays, Ticket, Users, WalletCards, BarChart3, TrainFront, IndianRupee } from "lucide-react";
import { Metric, Action } from "../components/DashboardParts";
import "./DashboardPage.css";

export default function DashboardPage({ user, summary, onNavigate }) {
  return (
    <main className="content dashboard-page">
      <div className="welcome">
        <div>
          <div className="eyebrow">GOOD TO SEE YOU</div>
          <h1>Hello, {user.name?.split(" ")[0]} <span>✦</span></h1>
          <p>Take a look at today's tickets and party activity.</p>
        </div>
        <div className="date-pill">
          <CalendarDays size={17} />
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>

      <div className="metric-grid">
        <Metric icon={<Ticket />} label="Total Tickets" value={summary.ticketCount} trend="Current" />
        <Metric icon={<Users />} label="Total Parties" value={summary.partyCount} trend="Active records" />
        <Metric icon={<IndianRupee />} label="Outstanding" value={"₹" + summary.outstanding} trend="From ledger" />
        <Metric icon={<TrainFront />} label="Today's Bookings" value={summary.todayBookings} trend="Manual booking" />
      </div>

      <div className="dashboard-grid">
        <section className="glass-panel large-panel">
          <div className="panel-head">
            <div><div className="eyebrow">QUICK ACTIONS</div><h3>Get Started</h3></div>
          </div>
          <div className="action-grid">
            <Action icon={<Ticket />} title="New Ticket" text="Create a manual railway ticket" onClick={() => onNavigate("tickets")} />
            <Action icon={<Users />} title="New Party" text="Create a customer account" onClick={() => onNavigate("parties")} />
            <Action icon={<WalletCards />} title="Record Payment" text="Add cash, UPI or UTR" onClick={() => onNavigate("ledger")} />
            <Action icon={<BarChart3 />} title="View Reports" text="Booking and ledger reports" onClick={() => onNavigate("reports")} />
          </div>
        </section>
        <section className="glass-panel side-panel">
          <div className="panel-head">
            <div><div className="eyebrow">SYSTEM</div><h3>System Status</h3></div>
          </div>
          <div className="status-line"><span className="status-dot" /> Backend Connected</div>
          <div className="status-line"><span className="status-dot" /> Secure Session</div>
          <div className="status-line"><span className="status-dot" /> PostgreSQL Ready</div>
          <div className="status-line"><span className="status-dot" /> RailKit PNR Ready</div>
          <div className="coming">Enter a PNR in Ticket Booking to fetch details from RailKit and save them in temporary testing storage.</div>
        </section>
      </div>
    </main>
  );
}
