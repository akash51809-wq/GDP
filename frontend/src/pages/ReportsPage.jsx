import { BarChart3, Ticket, Users, WalletCards, TrendingUp } from "lucide-react";
import "./ReportsPage.css";

export default function ReportsPage() {
  return (
    <main className="content reports-page">
      <div className="module-page-header"><div><div className="eyebrow">BUSINESS INTELLIGENCE</div><h1>Reports <span>✦</span></h1><p>Dedicated reporting workspace for bookings, sales, parties, outstanding and profit.</p></div></div>
      <section className="module-card-grid">
        <div className="module-card"><div className="module-icon blue"><Ticket size={20}/></div><small>BOOKING REPORT</small><b>Ticket Sales</b><span>Booking-wise sales, fare and journey summary.</span></div>
        <div className="module-card"><div className="module-icon green"><Users size={20}/></div><small>PARTY REPORT</small><b>Customer Summary</b><span>Customer activity, balance and transaction summary.</span></div>
        <div className="module-card"><div className="module-icon amber"><WalletCards size={20}/></div><small>LEDGER REPORT</small><b>Outstanding</b><span>Receivable and payable balances in one report.</span></div>
        <div className="module-card"><div className="module-icon purple"><TrendingUp size={20}/></div><small>PROFIT REPORT</small><b>Business Performance</b><span>Commission, margin and profitability analysis.</span></div>
      </section>
    </main>
  );
}
