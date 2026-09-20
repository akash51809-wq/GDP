import { WalletCards, Plus, ArrowDownLeft, ArrowUpRight, ReceiptIndianRupee } from "lucide-react";
import "./LedgerPaymentsPage.css";

export default function LedgerPaymentsPage() {
  return (
    <main className="content ledger-payments-page">
      <div className="module-page-header"><div><div className="eyebrow">FINANCE MANAGEMENT</div><h1>Ledger / Payments <span>✦</span></h1><p>Manage customer debit, credit, payment and ledger entries from this dedicated module.</p></div><button className="primary-small"><Plus size={16}/> New Entry</button></div>
      <section className="module-card-grid">
        <div className="module-card"><div className="module-icon blue"><WalletCards size={20}/></div><small>LEDGER</small><b>Account Ledger</b><span>Customer-wise debit and credit tracking.</span></div>
        <div className="module-card"><div className="module-icon green"><ArrowDownLeft size={20}/></div><small>RECEIPTS</small><b>Payment Received</b><span>Record cash, UPI, bank and other receipts.</span></div>
        <div className="module-card"><div className="module-icon amber"><ArrowUpRight size={20}/></div><small>PAYMENTS</small><b>Payment Made</b><span>Track outgoing business payments.</span></div>
        <div className="module-card"><div className="module-icon purple"><ReceiptIndianRupee size={20}/></div><small>REPORTS</small><b>Day Book</b><span>View daily financial movement and balance.</span></div>
      </section>
    </main>
  );
}
