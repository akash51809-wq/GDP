import { useEffect } from "react";
import "./PlaceholderPage.css";

export default function PlaceholderPage({ title, icon, text }) {
  useEffect(() => {}, []);
  return (
    <main className="content placeholder-module-page">
      <section className="glass-panel placeholder-page">
        <div className="placeholder-icon">{icon}</div>
        <div className="eyebrow">MODULE</div>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className="coming">We will add this module step by step with the same premium design and backend.</div>
      </section>
    </main>
  );
}
