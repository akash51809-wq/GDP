import { useEffect, useMemo, useState } from "react";
import { Search, Download, Mail, MessageCircle, RefreshCw, BookOpen } from "lucide-react";
import "./PartyLedgerPage.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders() {
  const token = localStorage.getItem("raildesk_auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

const money = (value) =>
  "₹" + Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PartyLedgerPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [query, setQuery] = useState("");
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API + "/api/parties", {
      credentials: "include",
      headers: authHeaders(),
    })
      .then((response) => response.json())
      .then((data) => setParties(data.parties || []))
      .catch(() => {});
  }, []);

  async function load(id = partyId) {
    if (!id) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        API + "/api/reports/party-ledger/" + encodeURIComponent(id),
        {
          credentials: "include",
          headers: authHeaders(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to load ledger.");
      }

      setLedger(data);
    } catch (err) {
      setError(err.message || "Unable to load ledger.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return parties.filter((party) => {
      if (!q) return true;

      return [
        party.customerName,
        party.whatsapp,
        party.email,
        party.city,
      ].some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });
  }, [parties, query]);

  function download() {
    if (!ledger) return;

    const rows = [
      ["Date", "Description", "Reference", "DR", "CR", "Balance"],
      ...ledger.ledger.map((entry) => [
        entry.date,
        entry.description,
        entry.reference,
        entry.dr,
        entry.cr,
        entry.balance,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => JSON.stringify(String(value ?? ""))).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (ledger.party.customerName || "party") + "-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function email() {
    if (!ledger) return;

    const subject = encodeURIComponent(
      "Party Ledger - " + ledger.party.customerName
    );

    const body = encodeURIComponent(
      "Party Ledger\n" +
        "Total DR: " + money(ledger.totalDr) +
        "\nTotal CR: " + money(ledger.totalCr) +
        "\nBalance: " + money(ledger.balance)
    );

    window.location.href =
      "mailto:" + (ledger.party.email || "") +
      "?subject=" + subject + "&body=" + body;
  }

  function whatsapp() {
    if (!ledger) return;

    const text = encodeURIComponent(
      "Party Ledger - " + ledger.party.customerName +
      "\nDR: " + money(ledger.totalDr) +
      "\nCR: " + money(ledger.totalCr) +
      "\nBalance: " + money(ledger.balance)
    );

    window.open(
      "https://wa.me/?text=" + text,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main className="content party-ledger-page">
      <div className="module-page-header ledger-head">
        <div>
          <div className="eyebrow">REPORTS / PARTY LEDGER</div>
          <h1>Party Ledger <span>✦</span></h1>
          <p>Complete party-wise DR / CR / Balance statement.</p>
        </div>

        {ledger && (
          <div className="ledger-actions">
            <button onClick={email}><Mail size={14} /> Send Email</button>
            <button onClick={whatsapp}><MessageCircle size={14} /> Send WhatsApp</button>
            <button onClick={download}><Download size={14} /> Download</button>
          </div>
        )}
      </div>

      <section className="ledger-filter">
        <div className="party-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search party name, WhatsApp, email or city..."
          />
        </div>

        <select
          value={partyId}
          onChange={(event) => {
            const id = event.target.value;
            setPartyId(id);
            load(id);
          }}
        >
          <option value="">Choose Party</option>
          {filtered.map((party) => (
            <option key={party.id} value={party.id}>
              {party.customerName}
            </option>
          ))}
        </select>

        <button
          className="ledger-refresh"
          onClick={() => load()}
          disabled={!partyId || loading}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </section>

      {error && <div className="ledger-error">{error}</div>}

      {!ledger && !loading && (
        <div className="ledger-empty">
          <BookOpen size={34} />
          <b>Choose a Party</b>
          <span>Select a party to view the complete ledger.</span>
        </div>
      )}

      {ledger && (
        <>
          <section className="party-summary">
            <div>
              <small>PARTY</small>
              <b>{ledger.party.customerName}</b>
              <span>
                {ledger.party.whatsapp ||
                  ledger.party.email ||
                  ledger.party.city ||
                  "Customer"}
              </span>
            </div>

            <div>
              <small>TOTAL DR</small>
              <b>{money(ledger.totalDr)}</b>
              <span>Ticket Bookings</span>
            </div>

            <div>
              <small>TOTAL CR</small>
              <b>{money(ledger.totalCr)}</b>
              <span>Payments Received</span>
            </div>

            <div>
              <small>BALANCE</small>
              <b>{money(ledger.balance)}</b>
              <span>
                {ledger.balance > 0
                  ? "Amount Due"
                  : ledger.balance < 0
                  ? "Advance"
                  : "Settled"}
              </span>
            </div>
          </section>

          <section className="ledger-card">
            <div className="ledger-title">
              <span>Transaction Ledger</span>
              <small>{ledger.ledger.length} entries</small>
            </div>

            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference / PNR</th>
                    <th className="amt">DR</th>
                    <th className="amt">CR</th>
                    <th className="amt">Balance</th>
                  </tr>
                </thead>

                <tbody>
                  {ledger.ledger.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="ledger-empty-row">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    ledger.ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.sr}</td>
                        <td>{entry.date}</td>
                        <td><b>{entry.description}</b></td>
                        <td>{entry.reference}</td>
                        <td className="amt dr">
                          {entry.dr ? money(entry.dr) : "—"}
                        </td>
                        <td className="amt cr">
                          {entry.cr ? money(entry.cr) : "—"}
                        </td>
                        <td className="amt balance">
                          {money(entry.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan="4">TOTAL</td>
                    <td className="amt dr">{money(ledger.totalDr)}</td>
                    <td className="amt cr">{money(ledger.totalCr)}</td>
                    <td className="amt balance">{money(ledger.balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
