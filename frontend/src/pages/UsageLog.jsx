import { useState, useEffect } from 'react';
import { printJobs, printers as printersApi } from '../api/client.js';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDuration(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_STYLE = {
  completed: { c: '#34d399', bg: 'rgba(16,185,129,.14)' },
  running:   { c: '#93c5fd', bg: 'rgba(59,130,246,.14)' },
  failed:    { c: '#f87171', bg: 'rgba(239,68,68,.14)' },
  cancelled: { c: '#fbbf24', bg: 'rgba(245,158,11,.14)' },
};

export default function UsageLog() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [printerList, setPrinterList] = useState([]);
  const [filterPrinter, setFilterPrinter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      printJobs.list({ limit: 200 }),
      printJobs.stats(),
      printersApi.list(),
    ]).then(([j, s, p]) => {
      setJobs(j);
      setStats(s);
      setPrinterList(p);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = filterPrinter
    ? jobs.filter(j => String(j.printer_id) === filterPrinter)
    : jobs;

  async function handleDelete(id) {
    if (!confirm('Delete this job log?')) return;
    await printJobs.delete(id);
    setJobs(jobs.filter(j => j.id !== id));
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Usage Log</h1>
          <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>
            Print history &amp; filament consumption
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {printerList.length > 1 && (
          <select value={filterPrinter} onChange={e => setFilterPrinter(e.target.value)} className="field-select" style={{ width: 180 }}>
            <option value="">All printers</option>
            {printerList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total jobs', value: stats.total_jobs ?? 0 },
            { label: 'Filament used', value: stats.total_filament_g ? `${Math.round(stats.total_filament_g)}g` : '—' },
            { label: 'Print hours', value: stats.total_hours ? `${stats.total_hours}h` : '—' },
            { label: 'Printers used', value: stats.printers_used ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{
              border: '1px solid rgba(255,255,255,.09)', borderRadius: 14,
              background: 'rgba(255,255,255,.03)', padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(230,237,247,.55)', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#93c5fd', marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Jobs table */}
      <div style={{
        border: '1px solid rgba(255,255,255,.09)', borderRadius: 18,
        background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr .8fr',
          gap: 12, padding: '13px 18px',
          fontSize: 11, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
          color: 'rgba(230,237,247,.5)',
          borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)',
        }}>
          <span>File</span><span>Printer</span><span>Started</span><span>Duration</span><span>Filament</span><span>Status</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(230,237,247,.4)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(230,237,247,.4)' }}>
            No print jobs yet. Jobs are logged automatically when a connected printer starts printing.
          </div>
        ) : filtered.map((job, i) => {
          const ss = STATUS_STYLE[job.status] || STATUS_STYLE.completed;
          return (
            <div
              key={job.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr .8fr',
                gap: 12, padding: '13px 18px', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {job.file_name || 'Unknown file'}
                </div>
                {job.total_layers && (
                  <div style={{ fontSize: 11, color: 'rgba(230,237,247,.5)', fontWeight: 700 }}>
                    {job.layer_count ?? '?'} / {job.total_layers} layers
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {job.printer_display_name || job.printer_name || '—'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {fmtDate(job.started_at)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {fmtDuration(job.duration_minutes)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.7)' }}>
                {job.filament_used_g ? `${Math.round(job.filament_used_g)}g` : '—'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 999, color: ss.c, background: ss.bg,
                }}>{job.status}</span>
                <button onClick={() => handleDelete(job.id)} style={{
                  border: '1px solid rgba(239,68,68,.2)', background: 'transparent',
                  color: 'rgba(239,68,68,.6)', width: 22, height: 22, borderRadius: 6,
                  cursor: 'pointer', fontWeight: 900, fontSize: 10, padding: 0, flexShrink: 0,
                }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
