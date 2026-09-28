import { useState } from "react";
import { ArrowLeft, Save, UserPlus, RotateCcw, ChevronDown } from "lucide-react";
import "./AddPartyPage.css";
import { API } from "../apiConfig";

const initialForm = {
  customerName: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  balance: "0"
};

export default function AddPartyPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [showContactAccount, setShowContactAccount] = useState(false);
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

      setNotice({ type: "success", text: "Customer saved successfully." });
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
          <div className="eyebrow">CUSTOMER MANAGEMENT</div>
          <h1><UserPlus size={25} /> Create Customer</h1>
        </div>
        <button className="compact-back" onClick={goBack}>
          <ArrowLeft size={15} /> Back to Customer Management
        </button>
      </div>

      <form className="add-party-card" onSubmit={submit}>
        <div className="form-section-title">
          <span>01</span>
          <div>
            <b>Customer Information</b>
            <small>Only customer name is required</small>
          </div>
        </div>

        <div className="form-grid">
          <label className="field full">
            <span>Customer Name *</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.customerName}
              onChange={e => update("customerName", e.target.value)}
              placeholder="Enter customer name"
            />
          </label>
        </div>

        <button
          type="button"
          className={"optional-section-toggle " + (showContactAccount ? "open" : "")}
          onClick={() => setShowContactAccount(v => !v)}
          aria-expanded={showContactAccount}
        >
          <span>
            <b>Contact & Account</b>
            <small>Optional — WhatsApp, email, address, city and opening balance</small>
          </span>
          <ChevronDown size={18} />
        </button>

        {showContactAccount && (
          <div className="optional-account-fields">
            <div className="form-grid">
              <label className="field">
                <span>WhatsApp</span>
                <input
                  maxLength={20}
                  value={form.whatsapp}
                  onChange={e => update("whatsapp", e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  maxLength={160}
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  placeholder="customer@email.com"
                />
              </label>

              <label className="field">
                <span>City</span>
                <input
                  maxLength={80}
                  value={form.city}
                  onChange={e => update("city", e.target.value)}
                  placeholder="City"
                />
              </label>

              <label className="field">
                <span>Opening Balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.balance}
                  onChange={e => update("balance", e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <label className="field full">
                <span>Address</span>
                <textarea
                  maxLength={300}
                  rows={3}
                  value={form.address}
                  onChange={e => update("address", e.target.value)}
                  placeholder="Full address"
                />
              </label>
            </div>
          </div>
        )}

        {notice.text && <div className={"add-party-notice " + notice.type}>{notice.text}</div>}

        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={() => setForm(initialForm)} disabled={saving}>
            <RotateCcw size={15} /> Reset
          </button>
          <button type="submit" className="save-party-btn" disabled={saving}>
            <Save size={16} /> {saving ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </main>
  );
}
