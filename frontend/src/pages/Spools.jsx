import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spools as spoolsApi } from '../api/client.js';

const PLUS_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

const SPOOL_TYPE_STYLE = {
  reusable: { c: '#34d399', bg: 'rgba(16,185,129,.14)', label: 'Reusable' },
  refill: { c: '#93c5fd', bg: 'rgba(59,130,246,.14)', label: 'Refill' },
  'non-reusable': { c: '#cbd5e1', bg: 'rgba(148,163,184,.16)', label: 'Non-reuse' },
};

const BAR_OK = 'linear-gradient(90deg,rgba(16,185,129,.95),rgba(59,130,246,.95))';
const BAR_LOW = 'linear-gradient(90deg,rgba(245,158,11,.98),rgba(239,68,68,.95))';

export default function Spools() {
  const navigate = useNavigate();
  const [spoolList, setSpoolList] = useState([]);
  const [reusable, setReusable] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([spoolsApi.list(), spoolsApi.reusable.list()])
      .then(([s, r]) => { setSpoolList(s); setReusable(r); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Spools</h1>
          <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>
            {spoolList.filter(s => s.spool_type !== 'refill').length} spools ready to use
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => navigate('/add')}>
          <span dangerouslySetInnerHTML={{ __html: PLUS_IC }} /> Add filament
        </button>
      </div>

      {/* Empty reusable spool counter */}
      <div style={{
        border: '1px solid rgba(255,255,255,.09)', borderRadius: 16,
        background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#34d399', lineHeight: 1, minWidth: 40, textAlign: 'center' }}>
            {reusable.length}
          </div>
          <div>
            <div className="section-label">Empty reusable spools</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(230,237,247,.45)', marginTop: 3 }}>
              available for a new refill
            </div>
          </div>
        </div>
      </div>

      {/* Spools table */}
      <div style={{
        border: '1px solid rgba(255,255,255,.09)', borderRadius: 18,
        background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
        overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.28)',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2.2fr 1.1fr 1.6fr .8fr .9fr',
          gap: 12, padding: '13px 18px',
          fontSize: 11, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
          color: 'rgba(230,237,247,.5)',
          borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)',
        }}>
          <span>Colour</span><span>Spool type</span><span>Remaining</span>
          <span style={{ textAlign: 'right' }}>Price</span>
          <span style={{ textAlign: 'right' }}>Location</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(230,237,247,.4)' }}>Loading…</div>
        ) : spoolList.filter(s => s.spool_type !== 'refill').length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(230,237,247,.4)' }}>
            No spools yet — add a filament to get started!
          </div>
        ) : spoolList.filter(s => s.spool_type !== 'refill').map((s, i, arr) => {
          const pct = s.spool_weight > 0 ? Math.round((s.remaining_weight / s.spool_weight) * 100) : 0;
          const isLow = pct < 20;
          const ts = SPOOL_TYPE_STYLE[s.spool_type] || SPOOL_TYPE_STYLE['non-reusable'];
          return (
            <div
              key={s.id}
              style={{
                display: 'grid', gridTemplateColumns: '2.2fr 1.1fr 1.6fr .8fr .9fr',
                gap: 12, padding: '13px 18px', alignItems: 'center',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {/* Colour + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: s.color_hex || '#6366f1',
                  border: '1px solid rgba(255,255,255,.18)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,.3)',
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.filament_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(230,237,247,.5)', fontWeight: 700 }}>
                    {s.brand_name} · {s.material}
                  </div>
                </div>
              </div>

              {/* Spool type */}
              <span>
                <span style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
                  padding: '3px 9px', borderRadius: 999,
                  color: ts.c, background: ts.bg,
                }}>{ts.label}</span>
              </span>

              {/* Remaining */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 800, marginBottom: 4 }}>
                  <span>{Math.round(s.remaining_weight)}g</span>
                  <span style={{ color: 'rgba(230,237,247,.45)' }}>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-bar${isLow ? ' low' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {s.purchase_price ? `${s.purchase_price} kr` : '—'}
              </span>
              <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {s.location || '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
