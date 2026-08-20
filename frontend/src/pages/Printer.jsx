import { useState, useEffect } from 'react';
import { printers as printersApi } from '../api/client.js';
import { usePrinter } from '../context/PrinterContext.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import Modal from '../components/Modal.jsx';

const PRINTER_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>';

function fmtTime(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtEta(min) {
  if (!min) return '—';
  return new Date(Date.now() + min * 60000).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export default function Printer() {
  const [printerList, setPrinterList] = useState([]);
  const [loadError, setLoadError] = useState('');
  const { printerStatus } = usePrinter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', model: '', ip_address: '', access_code: '', serial_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    printersApi.list()
      .then(list => { setPrinterList(list); setLoadError(''); })
      .catch(err => setLoadError(err.message || 'Failed to load printers'));
  }, []);

  const connectedCount = Object.values(printerStatus).filter(s => s.connected).length;

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.ip_address || !form.access_code || !form.serial_number) {
      setError('All fields required'); return;
    }
    setSaving(true); setError('');
    try {
      await printersApi.create(form);
      setPrinterList(await printersApi.list());
      setShowAdd(false);
      setForm({ name: '', model: '', ip_address: '', access_code: '', serial_number: '' });
    } catch (err) {
      const msg = err.message || '';
      setError(msg.toLowerCase().includes('serial') ? 'A printer with this serial number is already registered.' : msg || 'Failed to add printer.');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this printer?')) return;
    await printersApi.delete(id);
    setPrinterList(await printersApi.list());
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Printer Monitor</h1>
          <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>
            Live status over MQTT · {connectedCount} printer{connectedCount !== 1 ? 's' : ''} connected
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontSize: 12, fontWeight: 900,
          color: connectedCount > 0 ? 'rgb(52,211,153)' : 'rgb(148,163,184)',
          background: connectedCount > 0 ? 'rgba(52,211,153,.1)' : 'rgba(148,163,184,.1)',
          border: `1px solid ${connectedCount > 0 ? 'rgba(52,211,153,.28)' : 'rgba(148,163,184,.2)'}`,
          padding: '8px 14px', borderRadius: 999,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connectedCount > 0 ? 'rgb(52,211,153)' : 'rgb(148,163,184)',
            boxShadow: connectedCount > 0 ? '0 0 8px rgba(52,211,153,.6)' : 'none',
            animation: connectedCount > 0 ? 'pulse 2s infinite' : 'none',
          }} />
          MQTT {connectedCount > 0 ? 'broker online' : 'offline'}
        </span>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Printer</button>
      </div>

      {loadError && (
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
          color: '#fca5a5', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontWeight: 800 }}>⚠ Could not load printers:</span> {loadError}
          {loadError.toLowerCase().includes('unauthorized') && (
            <span style={{ marginLeft: 4, color: '#f87171' }}>— please refresh and log in again.</span>
          )}
        </div>
      )}

      {!loadError && printerList.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(230,237,247,.4)', padding: '60px 0' }}>
          No printers configured. Add one with IP address and access code.
        </div>
      )}

      {printerList.map(printer => {
        const live = printerStatus[printer.serial_number];
        const isRunning = live?.gcode_state === 'RUNNING';
        const stateLabel = live?.gcode_state
          ? live.gcode_state.charAt(0) + live.gcode_state.slice(1).toLowerCase()
          : 'Idle';

        if (isRunning) {
          return (
            <div key={printer.id} style={{
              border: '1px solid rgba(99,102,241,.28)', borderRadius: 20,
              background: 'linear-gradient(135deg,rgba(79,70,229,.14),rgba(124,58,237,.06)),rgba(255,255,255,.02)',
              padding: 22, marginBottom: 14, boxShadow: '0 12px 34px rgba(30,20,80,.28)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff',
                }} dangerouslySetInnerHTML={{ __html: PRINTER_IC }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{printer.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(230,237,247,.55)', fontWeight: 700 }}>
                    {printer.ip_address} · {live?.gcode_file || 'no file'}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => handleDelete(printer.id)} className="btn-danger">Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 26, alignItems: 'center' }}>
                <ProgressRing percent={live?.mc_percent ?? 0} size={130} label={stateLabel} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { label: 'Remaining', value: fmtTime(live?.mc_remaining_time) },
                    { label: 'ETA', value: fmtEta(live?.mc_remaining_time) },
                    { label: 'Layer', value: `${live?.layer_num ?? '?'} / ${live?.total_layer_num ?? '?'}` },
                    { label: 'Speed', value: live?.speed_level ? `${live.speed_level}%` : '—' },
                  ].map(({ label, value }) => (
                    <StatCard key={label} label={label} value={value} />
                  ))}
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 16px rgba(79,70,229,.35)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,.8)' }}>Nozzle</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 3 }}>
                      {live?.nozzle_temper != null ? `${Number(live.nozzle_temper).toFixed(1)}°` : '—'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#06b6d4)', boxShadow: '0 6px 16px rgba(6,182,212,.3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>Bed</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 3 }}>
                      {live?.bed_temper != null ? `${Number(live.bed_temper).toFixed(1)}°` : '—'}
                    </div>
                  </div>
                  <StatCard label="Chamber" value={live?.chamber_temper != null ? `${Math.round(live.chamber_temper)}°` : '—'} />
                  <StatCard label="Wifi" value={live?.wifi_signal || '—'} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={printer.id} style={{
            border: '1px solid rgba(255,255,255,.09)', borderRadius: 20,
            background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
            padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16,
            marginBottom: 14, boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: live?.connected ? 'rgba(59,130,246,.25)' : 'rgba(148,163,184,.18)',
              color: live?.connected ? '#93c5fd' : '#cbd5e1',
            }} dangerouslySetInnerHTML={{ __html: PRINTER_IC }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: 'rgba(230,237,247,.8)' }}>{printer.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(230,237,247,.5)', fontWeight: 700 }}>
                {printer.ip_address} · {stateLabel.toLowerCase()}
                {live?.nozzle_temper != null && ` · nozzle ${Number(live.nozzle_temper).toFixed(1)}°`}
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800,
              color: live?.connected ? 'rgba(52,211,153,.9)' : 'rgba(148,163,184,.9)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: live?.connected ? '#34d399' : '#94a3b8' }} />
              {live?.connected ? 'Connected' : 'Offline'}
            </span>
            <button onClick={() => handleDelete(printer.id)} className="btn-danger">Remove</button>
          </div>
        );
      })}

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} width={460}>
          <div style={{ padding: '22px 24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Add Printer</h2>
            <form onSubmit={handleAdd}>
              {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label text="Printer name"><input value={form.name} onChange={set('name')} className="field" placeholder="e.g. X1 Carbon" /></Label>
                <Label text="Model (optional)"><input value={form.model} onChange={set('model')} className="field" placeholder="e.g. Bambu X1C" /></Label>
                <Label text="IP address"><input value={form.ip_address} onChange={set('ip_address')} className="field" placeholder="192.168.1.100" /></Label>
                <Label text="Access code"><input value={form.access_code} onChange={set('access_code')} className="field" placeholder="8-digit code from printer LCD" /></Label>
                <Label text="Serial number"><input value={form.serial_number} onChange={set('serial_number')} className="field" placeholder="e.g. 01S00C123456789" /></Label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add printer'}</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)' }}>
      <div style={{ fontSize: 11, color: 'rgba(230,237,247,.6)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 17, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Label({ text, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(230,237,247,.72)' }}>{text}</span>
      {children}
    </label>
  );
}
