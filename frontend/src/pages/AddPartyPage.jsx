import { useState } from "react";
import { ArrowLeft, Save, UserPlus, RotateCcw } from "lucide-react";
import "./AddPartyPage.css";
import { API } from "../apiConfig";

const initialForm = {
  customerName: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  partyType: "Customer",
  status: "ACTIVE",
  balance: "0"
};

export default function AddPartyPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setNotice({ type: "", text: "" });
  }

  function goBack() {
    window.history.pushState({}, "", "/party");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setNotice({ type: "", text: "" });

    try {
      const res = await fetch(API + "/api/parties", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          balance: Number(form.balance || 0)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not create party.");

      setNotice({ type: "success", text: "Party created successfully." });
      setForm(initialForm);

      setTimeout(() => goBack(), 700);
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content add-party-page">
      <div className="add-party-hero">
        <div>
          <div className="eyebrow">PARTY / CUSTOMER</div>
          <h1><UserPlus size={25} /> Add Party</h1>
          <p>Create a customer account without affecting any other module.</p>
        </div>
        <button className="compact-back" onClick={goBack}>
          <ArrowLeft size={15} /> Back to Party Center
        </button>
      </div>

      <form className="add-party-card" onSubmit={submit}>
        <div className="form-section-title">
          <span>01</span>
          <div><b>Basic Information</b><small>Customer identity and account type</small></div>
        </div>

        <div className="form-grid">
          <label className="field full">
            <span>Customer Name *</span>
            <input required minLength={2} maxLength={120} value={form.customerName} onChange={e => update("customerName", e.target.value)} placeholder="Enter customer name" />
          </label>

          <label className="field">
            <span>WhatsApp</span>
            <input maxLength={20} value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="+91 98765 43210" />
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email" maxLength={160} value={form.email} onChange={e => update("email", e.target.value)} placeholder="customer@email.com" />
          </label>

          <label className="field">
            <span>Party Type</span>
            <select value={form.partyType} onChange={e => update("partyType", e.target.value)}>
              <option>Customer</option>
              <option>Corporate</option>
              <option>Agent</option>
              <option>Supplier</option>
              <option>Other</option>
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={e => update("status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>

        <div className="form-section-title">
          <span>02</span>
          <div><b>Contact & Account</b><small>Address and opening balance</small></div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>City</span>
            <input maxLength={80} value={form.city} onChange={e => update("city", e.target.value)} placeholder="City" />
          </label>

          <label className="field">
            <span>Opening Balance</span>
            <input type="number" step="0.01" value={form.balance} onChange={e => update("balance", e.target.value)} placeholder="0.00" />
          </label>

          <label className="field full">
            <span>Address</span>
            <textarea maxLength={300} rows={3} value={form.address} onChange={e => update("address", e.target.value)} placeholder="Full address" />
          </label>
        </div>

        {notice.text && <div className={"add-party-notice " + notice.type}>{notice.text}</div>}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => setForm(initialForm)} disabled={saving}>
            <RotateCcw size={15} /> Reset
          </button>
          <button type="submit" className="save-party-btn" disabled={saving}>
            <Save size={16} /> {saving ? "Saving..." : "Save Party"}
          </button>
        </div>
      </form>
    </main>
  );
}
