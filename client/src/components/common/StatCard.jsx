export default function StatCard({ label, value, icon: Icon, note, color = 'var(--primary-navy)' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color }}>
        {Icon && <Icon size={26} />}
      </div>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {note && <span style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '2px' }}>{note}</span>}
      </div>
    </div>
  );
}
