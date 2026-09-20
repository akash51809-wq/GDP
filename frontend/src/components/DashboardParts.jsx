import { ArrowUpRight } from "lucide-react";

export function Metric({ icon, label, value, trend }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{trend}</small></div>
    </div>
  );
}

export function Action({ icon, title, text, onClick }) {
  return (
    <button className="action-card" onClick={onClick}>
      <div className="action-icon">{icon}</div>
      <div><b>{title}</b><span>{text}</span></div>
      <ArrowUpRight size={17} />
    </button>
  );
}
