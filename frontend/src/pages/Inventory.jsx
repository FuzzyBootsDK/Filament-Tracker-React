import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { filaments as filamentsApi, spools as spoolsApi, settings as settingsApi } from '../api/client.js';
import FilamentCard from '../components/FilamentCard.jsx';
import LiveTracker from '../components/LiveTracker.jsx';
import Modal from '../components/Modal.jsx';

const CSV_TEMPLATE = `name,brand,material,color_hex,color_name,finish,density_g_cm3,price_per_kg_dkk,spool_weight_g,low_stock_threshold_g,nozzle_temp_c,bed_temp_c,location,notes,initial_spools,initial_weight_g,spool_type
PLA Basic White,Bambu Lab,PLA,#ffffff,White,Basic,1.24,149,1000,150,220,65,Shelf A,,1,1000,non-reusable
PETG Basic Black,Bambu Lab,PETG,#1a1a1a,Black,Basic,1.27,199,1000,150,240,70,Shelf B,,1,1000,non-reusable
PLA Matte Charcoal,Bambu Lab,PLA,#2c2c2c,Charcoal,Matte,1.24,91,1000,150,220,65,,,1,1000,refill
`;

function downloadBlob(content, filename, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TYPE_COLORS = {
  PLA: ['rgba(16,185,129,.40)', 'rgba(16,185,129,.14)', '#10b981'],
  PETG: ['rgba(59,130,246,.40)', 'rgba(59,130,246,.14)', '#3b82f6'],
  ABS: ['rgba(239,68,68,.40)', 'rgba(239,68,68,.14)', '#ef4444'],
  ASA: ['rgba(245,158,11,.40)', 'rgba(245,158,11,.14)', '#f59e0b'],
  TPU: ['rgba(168,85,247,.40)', 'rgba(168,85,247,.14)', '#a855f7'],
  'PLA Pure': ['rgba(6,182,212,.40)', 'rgba(6,182,212,.14)', '#06b6d4'],
};

const SEARCH_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const PLUS_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const SAVE_IC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>';

const SPOOL_TYPES = [
  { id: 'non-reusable', label: 'Non-reusable' },
  { id: 'reusable', label: 'Reusable spool' },
  { id: 'refill', label: 'Cardboard refill' },
];

const FILTERS = ['All', 'PLA', 'PLA Pure', 'PETG', 'ABS', 'ASA', 'TPU'];

export default function Inventory() {
  const navigate = useNavigate();
  const [filamentList, setFilamentList] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedFilament, setSelectedFilament] = useState(null);
  const [spoolList, setSpoolList] = useState([]);
  const [reusableHolders, setReusableHolders] = useState([]);
  const [useGrams, setUseGrams] = useState('');
  const [newSpoolPrice, setNewSpoolPrice] = useState('');
  const [newSpoolType, setNewSpoolType] = useState('non-reusable');
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState(null);
  const [glow, setGlow] = useState(null);
  const importRef = useRef();

  useEffect(() => {
    loadFilaments();
    settingsApi.get().then(s => setGlow({
      enabled: String(s.glow_enabled ?? 'true') === 'true',
      warn: Number(s.glow_warn_threshold ?? 300),
      crit: Number(s.glow_crit_threshold ?? 100),
    })).catch(() => {});
  }, []);

  async function loadFilaments() {
    setLoading(true);
    try { setFilamentList(await filamentsApi.list()); } finally { setLoading(false); }
  }

  async function openModal(filament) {
    setSelectedFilament(filament);
    const [spools, holders] = await Promise.all([
      spoolsApi.list(filament.id),
      spoolsApi.reusable.list(),
    ]);
    setSpoolList(spools);
    setReusableHolders(holders);
  }

  async function handleLogUse() {
    const g = parseFloat(useGrams);
    if (!g || g <= 0 || !spoolList.length) return;
    // FIFO: oldest active non-refill spool
    const spool = spoolList.find(sp => sp.is_active !== 0 && sp.spool_type !== 'refill')
                ?? spoolList.find(sp => sp.spool_type !== 'refill')
                ?? spoolList[0];
    await spoolsApi.use(spool.id, g);
    setUseGrams('');
    const updated = await spoolsApi.list(selectedFilament.id);
    setSpoolList(updated);
    loadFilaments();
  }

  async function handleLoad(spoolId, reusableSpoolId) {
    await spoolsApi.load(spoolId, reusableSpoolId);
    const updated = await spoolsApi.list(selectedFilament.id);
    setSpoolList(updated);
    loadFilaments();
  }

  async function handleUnload(spoolId) {
    await spoolsApi.unload(spoolId);
    const updated = await spoolsApi.list(selectedFilament.id);
    setSpoolList(updated);
    loadFilaments();
  }

  async function handleExport() {
    const csv = await filamentsApi.exportCSV();
    downloadBlob(csv, 'filaments.csv');
  }

  function handleTemplate() {
    downloadBlob(CSV_TEMPLATE, 'filaments-template.csv');
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const csv = await file.text();
      const result = await filamentsApi.importCSV(csv);
      setImportResult(result);
      if (result.spools > 0 || result.filaments > 0) loadFilaments();
    } catch (err) {
      setImportResult({ spools: 0, filaments: 0, skipped: 1, errors: [err.message || 'Import failed'] });
    }
  }

  async function handleAddSpool() {
    await spoolsApi.create({
      filament_id: selectedFilament.id,
      spool_type: newSpoolType,
      purchase_price: parseFloat(newSpoolPrice) || null,
    });
    setNewSpoolPrice('');
    const updated = await spoolsApi.list(selectedFilament.id);
    setSpoolList(updated);
    loadFilaments();
  }

  async function handleDeleteSpool(spoolId) {
    await spoolsApi.delete(spoolId);
    const updated = await spoolsApi.list(selectedFilament.id);
    setSpoolList(updated);
    loadFilaments();
  }

  async function handleDeleteFilament() {
    await filamentsApi.delete(selectedFilament.id);
    setSelectedFilament(null);
    setSpoolList([]);
    loadFilaments();
  }

  const filtered = filamentList.filter(f => {
    const matchFilter = filter === 'All' || f.material === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || f.name?.toLowerCase().includes(q) || f.brand_name?.toLowerCase().includes(q) || f.material?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const totalValue = filamentList.reduce((s, f) => {
    const ppg = (f.price_per_kg || 0) / 1000;
    return s + ppg * (f.total_remaining || 0);
  }, 0);

  const restockCount = filamentList.filter(f => {
    const pct = f.spool_weight > 0 ? (f.total_remaining / (f.spool_count * f.spool_weight)) * 100 : 0;
    return pct < 20;
  }).length;

  return (
    <div className="fade-in">
      <LiveTracker />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Inventory</h1>
          <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>
            {filamentList.length} filaments · {filamentList.reduce((s, f) => s + (f.spool_count || 0), 0)} spools
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
          <div style={{
            border: '1px solid rgba(255,255,255,.09)', borderRadius: 14,
            background: 'rgba(255,255,255,.03)', padding: '9px 15px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(230,237,247,.55)', fontWeight: 700 }}>Value</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#93c5fd', marginTop: 2 }}>
              {Math.round(totalValue).toLocaleString('da-DK')} kr
            </div>
          </div>
          {restockCount > 0 && (
            <div style={{
              border: '1px solid rgba(245,158,11,.28)', borderRadius: 14,
              background: 'rgba(245,158,11,.1)', padding: '9px 15px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,225,170,.8)', fontWeight: 700 }}>Restock</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>{restockCount}</div>
            </div>
          )}
          <button className="btn-ghost" onClick={handleTemplate} title="Download blank CSV template">
            Template
          </button>
          <button className="btn-ghost" onClick={handleExport} title="Export all filaments as CSV">
            Export
          </button>
          <button className="btn-ghost" onClick={() => importRef.current?.click()} title="Import filaments from CSV">
            Import
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
          <button className="btn-primary" onClick={() => navigate('/add')}>
            <span dangerouslySetInnerHTML={{ __html: PLUS_IC }} /> Add
          </button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          padding: '10px 14px', borderRadius: 12,
          background: importResult.spools > 0 ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${importResult.spools > 0 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
        }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: importResult.spools > 0 ? '#34d399' : '#f87171' }}>
            {importResult.spools > 0
              ? `Imported ${importResult.spools} spool${importResult.spools !== 1 ? 's' : ''} across ${importResult.filaments} filament${importResult.filaments !== 1 ? 's' : ''}${importResult.skipped ? ` · ${importResult.skipped} skipped` : ''}`
              : `Import failed — ${importResult.skipped} row${importResult.skipped !== 1 ? 's' : ''} skipped`}
          </span>
          {importResult.errors?.length > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(230,237,247,.5)', flex: 1 }}>
              {importResult.errors[0]}{importResult.errors.length > 1 ? ` (+${importResult.errors.length - 1} more)` : ''}
            </span>
          )}
          <button onClick={() => setImportResult(null)} style={{
            border: 'none', background: 'none', color: 'rgba(230,237,247,.5)',
            cursor: 'pointer', fontWeight: 900, fontSize: 14, padding: '0 4px',
          }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(230,237,247,.4)',
          }} dangerouslySetInnerHTML={{ __html: SEARCH_IC }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brand, colour, type…"
            className="field"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{
          display: 'flex', gap: 4, padding: 4, borderRadius: 12,
          border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.02)',
        }}>
          {FILTERS.map(f => (
            <span
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                background: filter === f ? 'rgba(124,58,237,.3)' : 'transparent',
                color: filter === f ? '#c4b5fd' : 'rgba(230,237,247,.6)',
                transition: 'all .15s',
              }}
            >{f}</span>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(230,237,247,.4)', padding: '60px 0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(230,237,247,.4)', padding: '60px 0' }}>
          {search || filter !== 'All' ? 'No results' : 'No filaments yet — add one!'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(224px,1fr))', gap: 14 }}>
          {filtered.map(f => (
            <FilamentCard key={f.id} filament={f} glow={glow} onClick={() => openModal(f)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedFilament && (
        <Modal onClose={() => setSelectedFilament(null)}>
          <FilamentModal
            filament={selectedFilament}
            spools={spoolList}
            reusableHolders={reusableHolders}
            useGrams={useGrams}
            setUseGrams={setUseGrams}
            newSpoolPrice={newSpoolPrice}
            setNewSpoolPrice={setNewSpoolPrice}
            newSpoolType={newSpoolType}
            setNewSpoolType={setNewSpoolType}
            onLogUse={handleLogUse}
            onAddSpool={handleAddSpool}
            onDeleteSpool={handleDeleteSpool}
            onDeleteFilament={handleDeleteFilament}
            onLoad={handleLoad}
            onUnload={handleUnload}
            onClose={() => setSelectedFilament(null)}
            onEdit={() => navigate(`/add/${selectedFilament.id}`)}
          />
        </Modal>
      )}
    </div>
  );
}

function FilamentModal({ filament, spools, reusableHolders, useGrams, setUseGrams, newSpoolPrice, setNewSpoolPrice, newSpoolType, setNewSpoolType, onLogUse, onAddSpool, onDeleteSpool, onDeleteFilament, onLoad, onUnload, onClose, onEdit }) {
  const { name, brand_name, material = 'PLA', finish, color_hex = '#6366f1', spool_weight = 1000, avg_price, price_per_kg } = filament;
  const [typeBorder, typeBg, typeColor] = TYPE_COLORS[material] || TYPE_COLORS.PLA;
  const [loadingRefillId, setLoadingRefillId] = useState(null);
  const [selectedHolder, setSelectedHolder] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeSpools = spools.filter(sp => sp.spool_type !== 'refill');
  const refills = spools.filter(sp => sp.spool_type === 'refill');

  const totalRemain = spools.reduce((s, sp) => s + (sp.remaining_weight || 0), 0);
  const estValue = price_per_kg ? Math.round((price_per_kg / 1000) * totalRemain) : 0;

  const SPOOL_TYPE_STYLE = {
    reusable: { c: '#34d399', bg: 'rgba(16,185,129,.14)', label: 'On reusable spool' },
    'non-reusable': { c: '#cbd5e1', bg: 'rgba(148,163,184,.16)', label: 'Non-reusable' },
  };

  function SpoolRow({ sp, showUnload }) {
    const pct = Math.round((sp.remaining_weight / spool_weight) * 100);
    const ts = SPOOL_TYPE_STYLE[sp.spool_type] || SPOOL_TYPE_STYLE['non-reusable'];
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: color_hex, border: '1px solid rgba(255,255,255,.18)',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>
            Spool #{sp.id}
            {sp.reusable_spool_name && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(230,237,247,.45)', marginLeft: 6 }}>
                · {sp.reusable_spool_name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 99, background: pct > 30 ? '#34d399' : pct > 10 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(230,237,247,.5)', whiteSpace: 'nowrap' }}>
              {Math.round(sp.remaining_weight)}g
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
          color: ts.c, background: ts.bg, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>{ts.label}</span>
        {showUnload && (
          <button onClick={() => onUnload(sp.id)} title="Unload — revert to refill" style={{
            border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.1)',
            color: '#fcd34d', padding: '4px 8px', borderRadius: 7,
            cursor: 'pointer', fontWeight: 800, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
          }}>Unload</button>
        )}
        <button onClick={() => onDeleteSpool(sp.id)} style={{
          border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.1)',
          color: '#f87171', width: 26, height: 26, borderRadius: 8,
          cursor: 'pointer', fontWeight: 900, fontSize: 11, flexShrink: 0, padding: 0,
        }}>✕</button>
      </div>
    );
  }

  function RefillRow({ sp }) {
    const isExpanded = loadingRefillId === sp.id;
    return (
      <div style={{ borderRadius: 12, border: '1px solid rgba(59,130,246,.2)', background: 'rgba(59,130,246,.05)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: color_hex, border: '1px solid rgba(255,255,255,.18)',
            opacity: 0.6,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'rgba(230,237,247,.7)' }}>Refill #{sp.id}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(230,237,247,.4)' }}>
              {Math.round(sp.remaining_weight)}g · not mounted
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase',
            color: '#93c5fd', background: 'rgba(59,130,246,.14)', padding: '3px 8px', borderRadius: 999,
          }}>Refill</span>
          <button
            onClick={() => { setLoadingRefillId(isExpanded ? null : sp.id); setSelectedHolder(''); }}
            style={{
              border: '1px solid rgba(99,102,241,.4)', background: isExpanded ? 'rgba(99,102,241,.25)' : 'rgba(99,102,241,.12)',
              color: '#a5b4fc', padding: '5px 10px', borderRadius: 7,
              cursor: 'pointer', fontWeight: 800, fontSize: 11, flexShrink: 0,
            }}>
            {isExpanded ? 'Cancel' : 'Load onto spool'}
          </button>
          <button onClick={() => onDeleteSpool(sp.id)} style={{
            border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.1)',
            color: '#f87171', width: 26, height: 26, borderRadius: 8,
            cursor: 'pointer', fontWeight: 900, fontSize: 11, flexShrink: 0, padding: 0,
          }}>✕</button>
        </div>

        {isExpanded && (
          <div style={{
            padding: '10px 12px 12px', borderTop: '1px solid rgba(59,130,246,.15)',
            background: 'rgba(59,130,246,.06)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <select
              value={selectedHolder}
              onChange={e => setSelectedHolder(e.target.value)}
              className="field-select"
              style={{ flex: 1, fontSize: 12.5 }}
            >
              <option value="">— select reusable spool holder —</option>
              {reusableHolders.map(h => (
                <option key={h.id} value={h.id}>{h.name || `Holder #${h.id}`} ({h.weight}g)</option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!selectedHolder) return;
                await onLoad(sp.id, Number(selectedHolder));
                setLoadingRefillId(null);
                setSelectedHolder('');
              }}
              disabled={!selectedHolder}
              className="btn-primary"
              style={{ whiteSpace: 'nowrap', padding: '9px 14px', opacity: selectedHolder ? 1 : 0.45 }}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Header swatch */}
      <div style={{ height: 96, position: 'relative', background: color_hex }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.55),transparent 60%)' }} />
        <span style={{
          position: 'absolute', top: 12, left: 14,
          fontSize: 10, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase',
          padding: '4px 9px', borderRadius: 999,
          background: 'rgba(0,0,0,.4)', color: '#fff', backdropFilter: 'blur(4px)',
        }}>{brand_name || '—'}</span>
        <button onClick={onClose} style={{
          position: 'absolute', top: 10, right: 10,
          width: 30, height: 30, borderRadius: 9,
          border: 'none', background: 'rgba(0,0,0,.4)', color: '#fff',
          fontWeight: 900, cursor: 'pointer', backdropFilter: 'blur(4px)',
          fontSize: 14,
        }}>✕</button>
        <div style={{
          position: 'absolute', bottom: 10, left: 16, right: 16,
          fontWeight: 900, fontSize: 20, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)',
        }}>{name}</div>
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 999,
            border: `1px solid ${typeBorder}`, background: typeBg, color: typeColor,
          }}>{material}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 900, padding: '3px 9px', borderRadius: 999,
            border: '1px solid rgba(148,163,184,.32)', background: 'rgba(148,163,184,.1)', color: '#9aa8bd',
          }}>{finish}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onEdit} style={{
            border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
            color: '#e6edf7', padding: '5px 12px', borderRadius: 8,
            fontWeight: 800, fontSize: 12, cursor: 'pointer',
          }}>Edit</button>
          <button onClick={() => setConfirmDelete(true)} title="Delete this filament and all its spools" style={{
            border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.1)',
            color: '#f87171', padding: '5px 12px', borderRadius: 8,
            fontWeight: 800, fontSize: 12, cursor: 'pointer',
          }}>Delete</button>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{
            marginBottom: 16, padding: 13, borderRadius: 14,
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.28)',
          }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#f87171', marginBottom: 4 }}>
              Delete “{name}” permanently?
            </div>
            <div style={{ fontSize: 12, color: 'rgba(230,237,247,.6)', fontWeight: 600, marginBottom: 11 }}>
              {spools.length > 0
                ? `${spools.length} spool${spools.length !== 1 ? 's' : ''} (${Math.round(totalRemain)}g remaining) will be removed too. `
                : ''}
              Past print jobs are kept, but lose their link to this filament. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => { setDeleting(true); try { await onDeleteFilament(); } finally { setDeleting(false); } }}
                disabled={deleting}
                style={{
                  border: '1px solid rgba(239,68,68,.45)', background: 'rgba(239,68,68,.22)',
                  color: '#fca5a5', padding: '8px 14px', borderRadius: 9,
                  fontWeight: 800, fontSize: 12.5, cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}>{deleting ? 'Deleting…' : 'Yes, delete filament'}</button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{
                border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)',
                color: '#e6edf7', padding: '8px 14px', borderRadius: 9,
                fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <StatBox label="Spools" value={activeSpools.length} />
          <StatBox label="Avg / spool" value={avg_price ? `${Math.round(avg_price)} kr` : '—'} accent />
          <StatBox label="Est. value" value={estValue ? `${estValue} kr` : '—'} blue />
        </div>

        {/* Active spool list */}
        {activeSpools.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase', color: 'rgba(230,237,247,.5)', marginBottom: 8 }}>
              Spools
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {activeSpools.map(sp => (
                <SpoolRow key={sp.id} sp={sp} showUnload={sp.spool_type === 'reusable'} />
              ))}
            </div>
          </>
        )}

        {/* Refills section */}
        {refills.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase', color: 'rgba(93,130,246,.7)', marginBottom: 8 }}>
              Refills in stock — not mounted
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {refills.map(sp => <RefillRow key={sp.id} sp={sp} />)}
            </div>
          </>
        )}

        {activeSpools.length === 0 && refills.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(230,237,247,.35)', fontSize: 13, padding: '16px 0', marginBottom: 12 }}>
            No spools yet
          </div>
        )}

        {/* Register usage */}
        <div style={{
          marginTop: 4, padding: 13, borderRadius: 14,
          background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase', color: 'rgba(230,237,247,.45)', marginBottom: 9 }}>
            Register usage
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.03)',
              borderRadius: 10, padding: '0 10px', width: 100,
            }}>
              <input
                value={useGrams}
                onChange={e => setUseGrams(e.target.value)}
                type="number" placeholder="0"
                style={{ border: 'none', background: 'none', color: '#e6edf7', padding: '10px 0', width: '100%', fontSize: 13, fontWeight: 800 }}
              />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.45)' }}>g</span>
            </div>
            <button onClick={onLogUse} disabled={activeSpools.length === 0} style={{
              flex: 1, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)',
              color: '#e6edf7', padding: 10, borderRadius: 10, fontWeight: 800, cursor: activeSpools.length ? 'pointer' : 'default',
              opacity: activeSpools.length ? 1 : 0.4,
            }}>Log used filament</button>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '13px 0' }} />

          <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase', color: 'rgba(230,237,247,.45)', marginBottom: 9 }}>
            Add a spool
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.03)',
              borderRadius: 10, padding: '0 10px', width: 90,
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.45)' }}>kr</span>
              <input
                value={newSpoolPrice}
                onChange={e => setNewSpoolPrice(e.target.value)}
                type="number"
                style={{ border: 'none', background: 'none', color: '#e6edf7', padding: '10px 0 10px 5px', width: '100%', fontSize: 13, fontWeight: 800 }}
              />
            </div>
            <select
              value={newSpoolType}
              onChange={e => setNewSpoolType(e.target.value)}
              className="field-select"
              style={{ flex: 1, minWidth: 0, padding: '10px' }}
            >
              {SPOOL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button onClick={onAddSpool} className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '10px 16px' }}>
              + Add
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value, accent, blue }) {
  const bg = accent ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.03)';
  const border = accent ? '1px solid rgba(124,58,237,.28)' : '1px solid rgba(255,255,255,.08)';
  const color = accent ? '#c4b5fd' : blue ? '#93c5fd' : '#e6edf7';
  return (
    <div style={{ padding: '12px 8px', borderRadius: 13, background: bg, border, textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(230,237,247,.5)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 3, color }}>{value}</div>
    </div>
  );
}
