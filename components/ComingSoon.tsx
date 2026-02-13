'use client';

const items = [
  { icon: '\u23F1', label: 'Apple Health' },
  { icon: '\u2328', label: 'Garmin' },
  { icon: '\u26A1', label: 'EEG Data' },
];

export default function ComingSoon() {
  return (
    <section className="metric-section future-section">
      <h2 className="section-title">Coming Soon</h2>
      <div className="coming-soon-grid">
        {items.map(item => (
          <div key={item.label} className="coming-soon-card">
            <span className="coming-soon-icon">{item.icon}</span>
            <p>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
