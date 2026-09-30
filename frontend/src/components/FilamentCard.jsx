const TYPE_COLORS = {
  PLA: ['rgba(16,185,129,.40)', 'rgba(16,185,129,.14)', '#10b981'],
  PETG: ['rgba(59,130,246,.40)', 'rgba(59,130,246,.14)', '#3b82f6'],
  ABS: ['rgba(239,68,68,.40)', 'rgba(239,68,68,.14)', '#ef4444'],
  ASA: ['rgba(245,158,11,.40)', 'rgba(245,158,11,.14)', '#f59e0b'],
  TPU: ['rgba(168,85,247,.40)', 'rgba(168,85,247,.14)', '#a855f7'],
  'PLA Pure': ['rgba(6,182,212,.40)', 'rgba(6,182,212,.14)', '#06b6d4'],
};

const PIN_IC = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';

function luminance(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function badgeFor(pct, threshold) {
  if (pct <= 10) return { dot: '#ef4444', txt: 'CRIT', color: '#f87171', bg: 'rgba(239,68,68,.15)' };
  if (pct <= (threshold / 10)) return { dot: '#f59e0b', txt: 'LOW', color: '#fbbf24', bg: 'rgba(245,158,11,.15)' };
  return { dot: '#10b981', txt: 'OK', color: '#34d399', bg: 'rgba(16,185,129,.15)' };
}

// Global low-stock glow settings (grams remaining). Falls back to the seeded defaults
// when Settings hasn't loaded yet.
function glowLevelFor(remaining, glow) {
  if (!glow || glow.enabled === false) return null;
  const crit = Number(glow.crit);
  const warn = Number(glow.warn);
  if (Number.isFinite(crit) && crit > 0 && remaining <= crit) return 'crit';
  if (Number.isFinite(warn) && warn > 0 && remaining <= warn) return 'warn';
  return null;
}

export default function FilamentCard({ filament, onClick, glow }) {
  const {
    name, brand_name, material = 'PLA', finish = 'Basic',
    color_hex = '#6366f1', spool_count = 0, total_remaining = 0,
    spool_weight = 1000, avg_price, location = '',
    low_stock_threshold = 150,
  } = filament;

  const totalCapacity = spool_count * spool_weight;
  const pct = totalCapacity > 0 ? Math.round((total_remaining / totalCapacity) * 100) : 0;
  const isLow = pct < 20 || total_remaining < low_stock_threshold;
  const badge = badgeFor(pct, low_stock_threshold);
  const [typeBorder, typeBg, typeColor] = TYPE_COLORS[material] || TYPE_COLORS.PLA;
  const lum = luminance(color_hex);
  const nameShadow = lum > 128 ? '0 1px 3px rgba(0,0,0,.6)' : 'none';

  const glowLevel = glowLevelFor(total_remaining, glow);

  const daysLeft = avg_price && total_remaining
    ? Math.round(total_remaining / 5) // rough estimate: ~5g/day average
    : null;

  return (
    <div
      onClick={onClick}
      className={glowLevel ? `glow-${glowLevel}` : undefined}
      style={{
        border: '1px solid rgba(255,255,255,.09)',
        background: 'linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))',
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,.28)',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; if (!glowLevel) e.currentTarget.style.boxShadow = '0 14px 34px rgba(0,0,0,.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; if (!glowLevel) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.28)'; }}
    >
      {/* Swatch header */}
      <div style={{ height: 88, position: 'relative', background: color_hex }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.5),transparent 62%)' }} />
        <span style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 10, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
          padding: '4px 8px', borderRadius: 999,
          background: 'rgba(0,0,0,.35)', color: 'rgba(255,255,255,.92)', backdropFilter: 'blur(4px)',
        }}>{brand_name || '—'}</span>
        <span style={{
          position: 'absolute', top: 9, right: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
          padding: '4px 9px', borderRadius: 999,
          background: 'rgba(0,0,0,.4)', color: '#fff', backdropFilter: 'blur(4px)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: badge.dot }} />
          {badge.txt}
        </span>
        <div style={{
          position: 'absolute', bottom: 9, left: 12, right: 12,
          fontWeight: 900, fontSize: 17, color: '#fff', textShadow: nameShadow,
        }}>{name}</div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 999,
            border: `1px solid ${typeBorder}`, background: typeBg, color: typeColor,
          }}>{material}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 999,
            border: '1px solid rgba(148,163,184,.32)', background: 'rgba(148,163,184,.1)', color: '#9aa8bd',
          }}>{finish}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontWeight: 900, fontSize: 19 }}>{pct}%</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(230,237,247,.5)' }}>
            {Math.round(total_remaining)}g left
          </span>
        </div>

        <div className="progress-track">
          <div className={`progress-bar${isLow ? ' low' : ''}`} style={{ width: `${pct}%` }} />
        </div>

        <div style={{ marginTop: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 700, color: 'rgba(230,237,247,.55)',
          }}>
            <span dangerouslySetInnerHTML={{ __html: PIN_IC }} />
            {location || 'No location'}
          </span>
          {daysLeft && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'rgba(147,197,253,.85)',
              background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.22)',
              padding: '3px 8px', borderRadius: 999,
            }}>~{daysLeft}d</span>
          )}
        </div>

        {spool_count > 1 && (
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, fontWeight: 800,
          }}>
            <span style={{ color: 'rgba(230,237,247,.5)' }}>{spool_count} spools</span>
            {avg_price && (
              <span style={{ color: '#c4b5fd' }}>
                ⌀ {Math.round(avg_price)} kr/spool
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
