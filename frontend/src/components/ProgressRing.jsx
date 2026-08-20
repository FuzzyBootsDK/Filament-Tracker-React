export default function ProgressRing({ percent = 0, size = 104, label = 'Printing' }) {
  const inner = size * 0.77;
  // conic-gradient: #7c3aed → #3b82f6 for the filled portion, then dim remainder
  const filled = Math.max(0, Math.min(100, percent));

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `conic-gradient(#7c3aed 0%, #3b82f6 ${filled}%, rgba(255,255,255,.07) ${filled}%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 26px rgba(99,102,241,.35)',
      flexShrink: 0,
    }}>
      <div style={{
        width: inner, height: inner, borderRadius: '50%',
        background: '#0b1220',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.25, fontWeight: 900, lineHeight: 1 }}>{filled}%</span>
        <span style={{
          fontSize: size * 0.091, fontWeight: 800, letterSpacing: '.5px',
          textTransform: 'uppercase', color: 'rgba(230,237,247,.5)', marginTop: 2,
        }}>{label}</span>
      </div>
    </div>
  );
}
