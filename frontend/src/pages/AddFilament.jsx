import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { filaments as filamentsApi, brands as brandsApi } from '../api/client.js';

const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PLA+', 'PLA Pure', 'PA', 'PC', 'FLEX'];
const FINISHES = ['Basic', 'Matte', 'Silk', 'Galaxy', 'Glossy', 'HF', 'Clear', 'Wood', 'Metal'];
const SPOOL_TYPES = [
  { id: 'non-reusable', label: 'Non-reusable' },
  { id: 'reusable', label: 'Reusable spool' },
  { id: 'refill', label: 'Cardboard refill' },
];

const SAVE_IC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>';

export default function AddFilament() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [brandList, setBrandList] = useState([]);
  const [form, setForm] = useState({
    name: '', brand_id: '', material: 'PLA', finish: 'Basic',
    color_hex: '#6366f1', color_name: '',
    price_per_kg: 149, spool_weight: 1000, spool_count: 1,
    spool_type: 'non-reusable', location: 'Shelf A',
    low_stock_threshold: 150, nozzle_temp: 220, bed_temp: 65,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    brandsApi.list().then(bs => {
      setBrandList(bs);
      if (bs.length && !form.brand_id) setForm(f => ({ ...f, brand_id: bs[0].id }));
    });
    if (isEdit) {
      filamentsApi.get(id).then(f => {
        setForm({
          name: f.name || '',
          brand_id: f.brand_id || '',
          material: f.material || 'PLA',
          finish: f.finish || 'Basic',
          color_hex: f.color_hex || '#6366f1',
          color_name: f.color_name || '',
          price_per_kg: f.price_per_kg || 149,
          spool_weight: f.spool_weight || 1000,
          spool_count: 1,
          spool_type: 'non-reusable',
          location: f.location || '',
          low_stock_threshold: f.low_stock_threshold || 150,
          nozzle_temp: f.nozzle_temp || 220,
          bed_temp: f.bed_temp || 65,
          notes: f.notes || '',
        });
      });
    }
  }, [id]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await filamentsApi.update(id, form);
      } else {
        const { id: newId } = await filamentsApi.create(form);
        // Create initial spool(s)
        const count = parseInt(form.spool_count) || 1;
        for (let i = 0; i < count; i++) {
          await fetch('/api/spools', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filament_id: newId,
              spool_type: form.spool_type,
              purchase_price: parseFloat(form.price_per_kg) || null,
              location: form.location,
            }),
          });
        }
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hexSafe = /^#[0-9a-fA-F]{6}$/.test(form.color_hex) ? form.color_hex : '#6366f1';

  return (
    <div className="fade-in" style={{ maxWidth: 920 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>{isEdit ? 'Edit Filament' : 'Add Filament'}</h1>
      <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginBottom: 18, fontWeight: 600 }}>
        {isEdit ? 'Update filament details.' : 'Register a new spool into your inventory.'}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          {/* Form */}
          <div className="card">
            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Label text="Brand">
                <select value={form.brand_id} onChange={set('brand_id')} className="field-select">
                  {brandList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Label>
              <Label text="Colour name">
                <input value={form.color_name} onChange={set('color_name')} className="field" placeholder="e.g. Jade White" />
              </Label>
              <Label text="Filament name">
                <input value={form.name} onChange={set('name')} className="field" placeholder="e.g. Jade White PLA" required />
              </Label>
              <Label text="Material">
                <select value={form.material} onChange={set('material')} className="field-select">
                  {MATERIALS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Label>
              <Label text="Finish">
                <select value={form.finish} onChange={set('finish')} className="field-select">
                  {FINISHES.map(f => <option key={f}>{f}</option>)}
                </select>
              </Label>
              <Label text="Location">
                <input value={form.location} onChange={set('location')} className="field" placeholder="e.g. Shelf A" />
              </Label>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '20px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <Label text="Spool weight (g)">
                <input value={form.spool_weight} onChange={set('spool_weight')} type="number" className="field" />
              </Label>
              <Label text="Price (kr/spool)">
                <input value={form.price_per_kg} onChange={set('price_per_kg')} type="number" className="field" />
              </Label>
              {!isEdit && (
                <Label text="# of spools">
                  <input value={form.spool_count} onChange={set('spool_count')} type="number" className="field" min="1" />
                </Label>
              )}
              {!isEdit && (
                <Label text="Spool type">
                  <select value={form.spool_type} onChange={set('spool_type')} className="field-select">
                    {SPOOL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Label>
              )}
              <Label text="Low-stock alert (g)">
                <input value={form.low_stock_threshold} onChange={set('low_stock_threshold')} type="number" className="field" />
              </Label>
              <Label text="Nozzle temp (°C)">
                <input value={form.nozzle_temp} onChange={set('nozzle_temp')} type="number" className="field" />
              </Label>
              <Label text="Bed temp (°C)">
                <input value={form.bed_temp} onChange={set('bed_temp')} type="number" className="field" />
              </Label>
            </div>

            <Label text="Notes" style={{ marginTop: 16 }}>
              <textarea value={form.notes} onChange={set('notes')} className="field" rows={2} placeholder="Optional notes…" style={{ resize: 'vertical' }} />
            </Label>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="submit" disabled={saving} className="btn-primary">
                <span dangerouslySetInnerHTML={{ __html: SAVE_IC }} />
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add filament'}
              </button>
              <button type="button" onClick={() => navigate('/')} className="btn-ghost">Cancel</button>
            </div>
          </div>

          {/* Swatch preview */}
          <div style={{
            border: '1px solid rgba(255,255,255,.09)', borderRadius: 20,
            background: 'linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))',
            overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          }}>
            <div style={{ height: 120, position: 'relative', background: hexSafe }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.5),transparent 62%)' }} />
              {form.brand_id && brandList.find(b => String(b.id) === String(form.brand_id)) && (
                <span style={{
                  position: 'absolute', top: 12, left: 12,
                  fontSize: 10, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
                  padding: '4px 8px', borderRadius: 999,
                  background: 'rgba(0,0,0,.35)', color: '#fff', backdropFilter: 'blur(4px)',
                }}>
                  {brandList.find(b => String(b.id) === String(form.brand_id))?.name}
                </span>
              )}
              <div style={{
                position: 'absolute', bottom: 11, left: 14, right: 14,
                fontWeight: 900, fontSize: 19, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)',
              }}>{form.color_name || form.name || 'Preview'}</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(230,237,247,.6)', marginBottom: 10 }}>Swatch colour</div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <input
                  type="color"
                  value={hexSafe}
                  onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))}
                  style={{ width: 46, height: 46, border: '1px solid rgba(255,255,255,.14)', borderRadius: 11, background: 'none', padding: 3, cursor: 'pointer' }}
                />
                <input
                  value={form.color_hex}
                  onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))}
                  maxLength={7}
                  placeholder="#RRGGBB"
                  className="field"
                  style={{ fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase' }}
                />
              </div>
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 12,
                background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)',
                fontSize: 12, lineHeight: 1.5, color: 'rgba(191,219,254,.9)',
              }}>
                Preview updates live as you type. Colour drives the tile header and status bar.
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function Label({ text, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(230,237,247,.72)' }}>{text}</span>
      {children}
    </label>
  );
}
