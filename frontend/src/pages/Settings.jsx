import { useState, useEffect } from 'react';
import { settings as settingsApi, brands as brandsApi, auth, filaments as filamentsApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrinter } from '../context/PrinterContext.jsx';
import Modal from '../components/Modal.jsx';

export default function Settings() {
  const { user } = useAuth();
  const { mqttLog, clearMqttLog } = usePrinter();
  const [appSettings, setAppSettings] = useState({});
  const [brandList, setBrandList] = useState([]);
  const [newBrand, setNewBrand] = useState('');
  const [users, setUsers] = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filterSerial, setFilterSerial] = useState('all');
  const [paused, setPaused] = useState(false);
  const [frozenLog, setFrozenLog] = useState([]);

  useEffect(() => {
    settingsApi.get().then(setAppSettings);
    brandsApi.list().then(setBrandList);
    if (user?.is_admin) auth.users().then(setUsers).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!paused) setFrozenLog(mqttLog);
  }, [mqttLog, paused]);

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(appSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  async function handleAddBrand() {
    if (!newBrand.trim()) return;
    await brandsApi.create(newBrand.trim());
    setBrandList(await brandsApi.list());
    setNewBrand('');
  }

  async function handleRemoveBrand(id) {
    await brandsApi.delete(id);
    setBrandList(await brandsApi.list());
  }

  async function handleAddUser(e) {
    e.preventDefault();
    await auth.createUser(newUser);
    setUsers(await auth.users());
    setShowNewUser(false);
    setNewUser({ username: '', password: '', is_admin: 0 });
  }

  async function handleDeleteUser(id) {
    if (!confirm('Delete this user?')) return;
    await auth.deleteUser(id);
    setUsers(await auth.users());
  }

  const set = (k) => (e) => setAppSettings(s => ({ ...s, [k]: e.target.value }));

  async function handleDeleteAll() {
    setShowDeleteAll(false);
    setDeleteConfirm('');
    setDeleting(true);
    try {
      await filamentsApi.deleteAll();
    } finally { setDeleting(false); }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Settings</h1>
      <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginBottom: 18, fontWeight: 600 }}>
        Application settings and administration.
      </div>

      {/* App settings */}
      <form onSubmit={handleSaveSettings}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>General</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Label text="Currency">
              <input value={appSettings.currency || 'DKK'} onChange={set('currency')} className="field" />
            </Label>
            <Label text="Low stock threshold (g)">
              <input value={appSettings.low_stock_threshold || 150} onChange={set('low_stock_threshold')} type="number" className="field" />
            </Label>
            <Label text="Default hourly rate">
              <input value={appSettings.hourly_rate || 250} onChange={set('hourly_rate')} type="number" className="field" />
            </Label>
            <Label text="Default VAT rate (%)">
              <input value={appSettings.vat_rate || 25} onChange={set('vat_rate')} type="number" className="field" />
            </Label>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '16px 0' }} />
          <div className="section-label" style={{ marginBottom: 12 }}>MQTT Relay Broker</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Label text="Enable relay broker">
              <select value={appSettings.relay_enabled || 'false'} onChange={set('relay_enabled')} className="field-select">
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </Label>
            <Label text="Relay port (TCP)">
              <input value={appSettings.relay_port || 1883} onChange={set('relay_port')} type="number" className="field" />
            </Label>
          </div>
          <div style={{ marginTop: 6, padding: '10px 13px', borderRadius: 10, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', fontSize: 12, color: 'rgba(191,219,254,.9)' }}>
            The relay broker re-publishes all Bambu MQTT data on TCP port {appSettings.relay_port || 1883} so ESP32s or other clients can subscribe without using the printer's single MQTT slot.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Brands */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <span className="section-label">Filament brands</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(230,237,247,.4)' }}>used by the Add Filament dropdown</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={newBrand}
            onChange={e => setNewBrand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBrand()}
            placeholder="Add a brand…"
            className="field"
            style={{ flex: 1 }}
          />
          <button onClick={handleAddBrand} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {brandList.map(b => (
            <span key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 9px 7px 13px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)',
              fontSize: 12.5, fontWeight: 800,
            }}>
              {b.name}
              <button onClick={() => handleRemoveBrand(b.id)} style={{
                border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(230,237,247,.6)',
                width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                fontSize: 10, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* User management (admin only) */}
      {user?.is_admin === 1 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="section-label">Users</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowNewUser(true)} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}>
              + Add user
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 14, color: '#fff',
                }}>{u.username[0].toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{u.username}</div>
                  <div style={{ fontSize: 11, color: 'rgba(230,237,247,.5)', fontWeight: 700 }}>
                    {u.is_admin ? 'Admin' : 'User'} · since {new Date(u.created_at).toLocaleDateString('da-DK')}
                  </div>
                </div>
                {u.id !== user.id && (
                  <button onClick={() => handleDeleteUser(u.id)} className="btn-danger" style={{ padding: '5px 10px', fontSize: 11 }}>
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{
        marginBottom: 16, borderRadius: 16,
        border: '1px solid rgba(239,68,68,.25)',
        background: 'rgba(239,68,68,.04)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <span style={{ fontWeight: 900, fontSize: 14, color: '#fca5a5', letterSpacing: '.02em' }}>Danger Zone</span>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 3 }}>Delete all filaments</div>
            <div style={{ fontSize: 12, color: 'rgba(230,237,247,.5)', fontWeight: 600 }}>
              Permanently removes every filament, all spools, and all AMS links. This cannot be undone.
            </div>
          </div>
          <button
            onClick={() => { setShowDeleteAll(true); setDeleteConfirm(''); }}
            style={{
              flexShrink: 0, padding: '9px 18px', borderRadius: 10,
              border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.12)',
              color: '#f87171', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Delete all filaments
          </button>
        </div>
      </div>

      {/* Delete all confirmation modal */}
      {showDeleteAll && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'linear-gradient(180deg,rgba(30,41,59,.99),rgba(15,23,42,1))',
            border: '1px solid rgba(239,68,68,.35)', borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,.7)',
            width: '100%', maxWidth: 440, padding: '26px 28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>⚠</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, color: '#fca5a5' }}>Delete all filaments?</div>
                <div style={{ fontSize: 12, color: 'rgba(230,237,247,.5)', marginTop: 2 }}>This action is permanent and cannot be undone.</div>
              </div>
            </div>

            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 18,
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
              fontSize: 12.5, color: 'rgba(230,237,247,.7)', lineHeight: 1.6,
            }}>
              This will permanently delete:
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>All filaments and their settings</li>
                <li>All spools and remaining weight data</li>
                <li>All AMS slot links</li>
              </ul>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(230,237,247,.7)', marginBottom: 8 }}>
                Type <span style={{ color: '#f87171', fontWeight: 900, fontFamily: 'monospace' }}>DELETE ALL</span> to confirm:
              </div>
              <input
                autoFocus
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE ALL"
                className="field"
                style={{ width: '100%', borderColor: deleteConfirm === 'DELETE ALL' ? 'rgba(239,68,68,.6)' : undefined }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDeleteAll}
                disabled={deleteConfirm !== 'DELETE ALL' || deleting}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                  background: deleteConfirm === 'DELETE ALL' ? 'linear-gradient(135deg,#dc2626,#991b1b)' : 'rgba(255,255,255,.06)',
                  color: deleteConfirm === 'DELETE ALL' ? '#fff' : 'rgba(230,237,247,.3)',
                  fontWeight: 900, fontSize: 14, cursor: deleteConfirm === 'DELETE ALL' ? 'pointer' : 'default',
                  boxShadow: deleteConfirm === 'DELETE ALL' ? '0 4px 16px rgba(220,38,38,.4)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
              <button
                onClick={() => { setShowDeleteAll(false); setDeleteConfirm(''); }}
                className="btn-ghost"
                style={{ padding: '11px 20px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MQTT Debug */}
      <MqttDebugPanel
        open={debugOpen}
        onToggle={() => setDebugOpen(v => !v)}
        log={frozenLog}
        filterSerial={filterSerial}
        setFilterSerial={setFilterSerial}
        paused={paused}
        onPause={() => { setPaused(true); setFrozenLog(mqttLog); }}
        onResume={() => setPaused(false)}
        onClear={() => { clearMqttLog(); setFrozenLog([]); }}
        expandedIdx={expandedIdx}
        setExpandedIdx={setExpandedIdx}
      />

      {showNewUser && (
        <Modal onClose={() => setShowNewUser(false)} width={380}>
          <div style={{ padding: '22px 24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Add User</h2>
            <form onSubmit={handleAddUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label text="Username">
                  <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} className="field" required />
                </Label>
                <Label text="Password">
                  <input value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} type="password" className="field" required />
                </Label>
                <Label text="Role">
                  <select value={newUser.is_admin} onChange={e => setNewUser(u => ({ ...u, is_admin: Number(e.target.value) }))} className="field-select">
                    <option value={0}>User</option>
                    <option value={1}>Admin</option>
                  </select>
                </Label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn-primary">Create user</button>
                <button type="button" onClick={() => setShowNewUser(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </Modal>
      )}
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

function msgType(msg) {
  const p = msg.payload?.print;
  if (!p) return 'unknown';
  if (p.ams?.ams?.length) return 'ams';
  if (p.gcode_state) return 'state';
  if (p.nozzle_temper != null || p.bed_temper != null) return 'temp';
  if (p.wifi_signal) return 'wifi';
  return 'status';
}

const TYPE_COLOR = {
  ams:    { bg: 'rgba(249,115,22,.18)', color: '#fb923c', label: 'AMS' },
  state:  { bg: 'rgba(99,102,241,.18)', color: '#818cf8', label: 'STATE' },
  temp:   { bg: 'rgba(239,68,68,.15)',  color: '#f87171', label: 'TEMP' },
  wifi:   { bg: 'rgba(20,184,166,.15)', color: '#2dd4bf', label: 'WIFI' },
  status: { bg: 'rgba(100,116,139,.15)',color: '#94a3b8', label: 'STATUS' },
  unknown:{ bg: 'rgba(100,116,139,.1)', color: '#64748b', label: '?' },
};

function summarise(msg) {
  const p = msg.payload?.print;
  if (!p) return JSON.stringify(msg.payload).slice(0, 80);
  const parts = [];
  if (p.gcode_state) parts.push(p.gcode_state);
  if (p.mc_percent != null) parts.push(`${p.mc_percent}%`);
  if (p.nozzle_temper != null) parts.push(`nozzle ${p.nozzle_temper}°C`);
  if (p.bed_temper != null) parts.push(`bed ${p.bed_temper}°C`);
  if (p.layer_num != null) parts.push(`layer ${p.layer_num}/${p.total_layer_num ?? '?'}`);
  if (p.wifi_signal) parts.push(p.wifi_signal);
  if (p.ams?.ams) {
    for (const unit of p.ams.ams) {
      const loaded = (unit.tray || []).filter(t => t.tray_type);
      for (const t of loaded) {
        const hex = t.tray_color ? '#' + t.tray_color.slice(0, 6) : null;
        parts.push(`T${t.id}:${t.tray_sub_brands || t.tray_type}${t.remain != null ? ' ' + t.remain + '%' : ''}`);
        void hex;
      }
    }
  }
  return parts.length ? parts.join(' · ') : JSON.stringify(p).slice(0, 60);
}

function AmsView({ amsData }) {
  const units = (amsData?.ams || []).filter(u => u.tray);
  if (!units.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {units.map(unit => (
        <div key={unit.id} style={{
          background: 'rgba(255,255,255,.03)', borderRadius: 10,
          border: '1px solid rgba(255,255,255,.08)', padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fb923c', marginBottom: 8, letterSpacing: '.06em' }}>
            AMS {unit.id === '0' || unit.id === 0 ? '1' : unit.id}
            <span style={{ color: 'rgba(230,237,247,.35)', marginLeft: 8, fontWeight: 600 }}>
              {unit.temp}°C · {(() => {
                  const lvl = parseInt(unit.humidity);
                  const labels = { 1: 'Very Dry', 2: 'Dry', 3: 'Normal', 4: 'Damp', 5: 'Wet' };
                  return `Humidity: ${labels[lvl] || 'Lvl ' + unit.humidity} (${unit.humidity}/5)`;
                })()}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[0, 1, 2, 3].map(slotIdx => {
              const tray = unit.tray?.find(t => String(t.id) === String(slotIdx));
              const hasFilament = tray?.tray_type;
              const hex = hasFilament && tray.tray_color ? '#' + tray.tray_color.slice(0, 6) : null;
              return (
                <div key={slotIdx} style={{
                  borderRadius: 8, padding: '8px 10px',
                  background: hasFilament ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)',
                  border: `1px solid ${hex ? hex + '44' : 'rgba(255,255,255,.07)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    {hex && <div style={{ width: 10, height: 10, borderRadius: 3, background: hex, flexShrink: 0, border: '1px solid rgba(255,255,255,.2)' }} />}
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '.06em' }}>SLOT {slotIdx}</span>
                  </div>
                  {hasFilament ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>
                        {tray.tray_sub_brands || tray.tray_type}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(230,237,247,.45)', marginTop: 3 }}>
                        {tray.tray_id_name} · {tray.remain}%
                      </div>
                      {tray.tag_uid && (
                        <div style={{ fontSize: 9, color: 'rgba(230,237,247,.2)', marginTop: 2, letterSpacing: '.04em' }}>
                          {tray.tag_uid}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 10, color: 'rgba(230,237,247,.2)', fontStyle: 'italic' }}>Empty</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MqttDebugPanel({ open, onToggle, log, filterSerial, setFilterSerial, paused, onPause, onResume, onClear, expandedIdx, setExpandedIdx }) {
  const serials = [...new Set(log.map(m => m.serial))];
  const filtered = filterSerial === 'all' ? log : log.filter(m => m.serial === filterSerial);
  const display = [...filtered].reverse();

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="section-label" style={{ flex: 1 }}>MQTT Debug</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: open ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
          color: open ? '#4ade80' : 'rgba(230,237,247,.4)',
          border: `1px solid ${open ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.1)'}`,
        }}>
          {open ? `● LIVE${paused ? ' (paused)' : ''}` : '○ OFF'}
        </span>
        <button onClick={onToggle} className={open ? 'btn-danger' : 'btn-primary'} style={{ padding: '6px 14px', fontSize: 12 }}>
          {open ? 'Disable' : 'Enable'}
        </button>
      </div>

      {open && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filterSerial}
              onChange={e => setFilterSerial(e.target.value)}
              className="field-select"
              style={{ fontSize: 12, padding: '5px 10px', flex: '0 0 auto' }}
            >
              <option value="all">All printers</option>
              {serials.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={paused ? onResume : onPause}
              style={{
                padding: '5px 12px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
                background: paused ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.06)',
                color: paused ? '#fbbf24' : 'rgba(230,237,247,.7)', cursor: 'pointer', fontWeight: 700,
              }}
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              onClick={onClear}
              style={{
                padding: '5px 12px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.06)', color: 'rgba(230,237,247,.7)', cursor: 'pointer', fontWeight: 700,
              }}
            >
              Clear
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(230,237,247,.35)', fontWeight: 700 }}>
              {filtered.length} / 200 · newest first
            </span>
          </div>

          <div style={{
            marginTop: 10,
            background: '#070d1a',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 12,
            height: 480,
            overflowY: 'auto',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 11.5,
          }}>
            {display.length === 0 ? (
              <div style={{ padding: 24, color: 'rgba(230,237,247,.25)', textAlign: 'center' }}>
                Waiting for MQTT messages…
              </div>
            ) : display.map((msg, i) => {
              const isOpen = expandedIdx === i;
              const type = msgType(msg);
              const tc = TYPE_COLOR[type] || TYPE_COLOR.unknown;
              const hasAms = msg.payload?.print?.ams?.ams?.length > 0;
              return (
                <div
                  key={i}
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    padding: '7px 12px',
                    cursor: 'pointer',
                    background: isOpen ? 'rgba(124,58,237,.1)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#475569', flexShrink: 0, fontSize: 10.5 }}>{fmtTime(msg.ts)}</span>
                    <span style={{
                      background: 'rgba(99,102,241,.2)', color: '#a5b4fc',
                      padding: '1px 6px', borderRadius: 4, fontSize: 9.5, fontWeight: 800, flexShrink: 0,
                    }}>{msg.printer_name}</span>
                    <span style={{
                      background: tc.bg, color: tc.color,
                      padding: '1px 6px', borderRadius: 4, fontSize: 9.5, fontWeight: 800, flexShrink: 0,
                    }}>{tc.label}</span>
                    {hasAms && !isOpen && (
                      <span style={{ color: '#fb923c', fontSize: 9.5, flexShrink: 0 }}>▪ AMS data</span>
                    )}
                    <span style={{
                      color: 'rgba(230,237,247,.45)', minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {!isOpen && summarise(msg)}
                    </span>
                    <span style={{ color: 'rgba(230,237,247,.18)', flexShrink: 0, fontSize: 10 }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 6 }}>
                      {hasAms && (
                        <AmsView amsData={msg.payload.print.ams} />
                      )}
                      <details style={{ marginTop: hasAms ? 8 : 0 }}>
                        <summary style={{
                          fontSize: 10, color: 'rgba(230,237,247,.35)', cursor: 'pointer',
                          userSelect: 'none', padding: '4px 0', fontWeight: 700,
                        }}>
                          Raw JSON
                        </summary>
                        <pre style={{
                          margin: '6px 0 2px', padding: '10px 12px',
                          background: 'rgba(0,0,0,.45)', borderRadius: 8,
                          color: '#86efac', fontSize: 10.5, overflowX: 'auto',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                          maxHeight: 280, overflowY: 'auto',
                        }}>
                          {JSON.stringify(msg.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
