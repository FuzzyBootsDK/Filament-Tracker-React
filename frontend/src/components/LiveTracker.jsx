import ProgressRing from './ProgressRing.jsx';
import { usePrinter } from '../context/PrinterContext.jsx';

function parseDbm(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^-\d]/g, ''));
  return isNaN(n) ? null : n;
}

function WifiIndicator({ raw }) {
  const dbm = parseDbm(raw);
  const level = dbm == null ? 0 : dbm >= -55 ? 4 : dbm >= -65 ? 3 : dbm >= -75 ? 2 : 1;
  const barColor = level >= 3 ? '#34d399' : level >= 2 ? '#fbbf24' : '#f87171';
  const dim = 'rgba(255,255,255,.18)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {/* 4-bar signal icon */}
      <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
        <rect x="1"  y="13" width="4" height="5"  rx="1" fill={level >= 1 ? barColor : dim} />
        <rect x="6"  y="9"  width="4" height="9"  rx="1" fill={level >= 2 ? barColor : dim} />
        <rect x="11" y="5"  width="4" height="13" rx="1" fill={level >= 3 ? barColor : dim} />
        <rect x="16" y="1"  width="4" height="17" rx="1" fill={level >= 4 ? barColor : dim} />
      </svg>
      <div>
        <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1, color: dbm != null ? '#e2e8f0' : 'rgba(230,237,247,.4)' }}>
          {dbm != null ? `${dbm} dBm` : '—'}
        </div>
        {dbm != null && (
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: barColor }}>
            {level === 4 ? 'Excellent' : level === 3 ? 'Good' : level === 2 ? 'Fair' : 'Poor'}
          </div>
        )}
      </div>
    </div>
  );
}

const PRINTER_IC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>';

function fmtTime(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtEta(minutes) {
  if (!minutes) return '—';
  const d = new Date(Date.now() + minutes * 60 * 1000);
  return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export default function LiveTracker() {
  const { getBestPrinter } = usePrinter();
  const s = getBestPrinter();

  const isRunning = s?.gcode_state === 'RUNNING';
  const percent = s?.mc_percent ?? 0;
  const stateLabel = s?.gcode_state
    ? s.gcode_state.charAt(0) + s.gcode_state.slice(1).toLowerCase()
    : 'Idle';

  return (
    <div style={{
      border: '1px solid rgba(99,102,241,.28)', borderRadius: 18,
      background: 'linear-gradient(135deg,rgba(79,70,229,.14),rgba(124,58,237,.06)),rgba(255,255,255,.02)',
      padding: '16px 18px', marginBottom: 14,
      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
      gap: 22, alignItems: 'center',
      boxShadow: '0 12px 34px rgba(30,20,80,.28)',
    }}>
      {/* Progress ring */}
      <ProgressRing percent={percent} size={104} label={stateLabel} />

      {/* Middle info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', flexShrink: 0,
          }} dangerouslySetInnerHTML={{ __html: PRINTER_IC }} />
          <span style={{ fontWeight: 900, fontSize: 16 }}>
            {s?.printer_name || 'No printer'}
          </span>
          {s?.connected ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
              color: 'rgb(52,211,153)', background: 'rgba(52,211,153,.1)',
              border: '1px solid rgba(52,211,153,.28)', padding: '3px 9px', borderRadius: 999,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'rgb(52,211,153)', boxShadow: '0 0 8px rgba(52,211,153,.6)',
                animation: 'pulse 2s infinite',
              }} />
              Connected
            </span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
              color: 'rgba(148,163,184,.7)', background: 'rgba(148,163,184,.1)',
              border: '1px solid rgba(148,163,184,.2)', padding: '3px 9px', borderRadius: 999,
            }}>Offline</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(230,237,247,.62)', fontWeight: 700, marginBottom: 12 }}>
          {s?.gcode_file
            ? `${s.gcode_file} · Layer ${s.layer_num ?? '?'} / ${s.total_layer_num ?? '?'}`
            : 'No active print'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { label: 'Remaining', value: fmtTime(s?.mc_remaining_time) },
            { label: 'ETA', value: fmtEta(s?.mc_remaining_time) },
            { label: 'Layer', value: s ? `${s.layer_num ?? '?'} / ${s.total_layer_num ?? '?'}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '9px 12px', background: 'rgba(255,255,255,.04)',
              borderRadius: 10, border: '1px solid rgba(255,255,255,.08)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(230,237,247,.6)', fontWeight: 700 }}>{label}</div>
              <div style={{ fontWeight: 900, fontSize: 15, marginTop: 3 }}>{value}</div>
            </div>
          ))}
          {/* WiFi signal */}
          <div style={{
            padding: '9px 12px', background: 'rgba(255,255,255,.04)',
            borderRadius: 10, border: '1px solid rgba(255,255,255,.08)',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(230,237,247,.6)', fontWeight: 700, marginBottom: 5 }}>WiFi</div>
            <WifiIndicator raw={s?.wifi_signal} />
          </div>
        </div>
      </div>

      {/* Temps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          minWidth: 118, padding: '10px 13px', borderRadius: 12,
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          boxShadow: '0 6px 16px rgba(79,70,229,.35)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)' }}>Nozzle</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>
            {s?.nozzle_temper != null ? `${Number(s.nozzle_temper).toFixed(1)}°` : '—'}
          </div>
        </div>
        <div style={{
          minWidth: 118, padding: '10px 13px', borderRadius: 12,
          background: 'linear-gradient(135deg,#10b981,#06b6d4)',
          boxShadow: '0 6px 16px rgba(6,182,212,.3)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>Bed</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 2 }}>
            {s?.bed_temper != null ? `${Number(s.bed_temper).toFixed(1)}°` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
