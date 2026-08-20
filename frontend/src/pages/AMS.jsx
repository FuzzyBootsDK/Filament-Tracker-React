import { useState, useEffect, useRef } from 'react';
import { printers as printersApi, ams as amsApi, filaments as filamentsApi, spools as spoolsApi } from '../api/client.js';
import { usePrinter } from '../context/PrinterContext.jsx';

const AMS_IC   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M 7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8"/></svg>';

// Bambu Lab AMS sends humidity as a level index 1–5, not a percentage
const HUM_LABELS = { 1: 'Very Dry', 2: 'Dry', 3: 'Normal', 4: 'Damp', 5: 'Wet' };
const HUM_COLORS = { 1: '#fb923c', 2: '#34d399', 3: '#34d399', 4: '#fbbf24', 5: '#f87171' };
const HUM_BG     = { 1: 'rgba(251,146,60,.1)', 2: 'rgba(56,189,248,.1)', 3: 'rgba(56,189,248,.1)', 4: 'rgba(251,191,36,.1)', 5: 'rgba(248,113,113,.1)' };
const HUM_BORDER = { 1: 'rgba(251,146,60,.2)',  2: 'rgba(56,189,248,.2)',  3: 'rgba(56,189,248,.2)',  4: 'rgba(251,191,36,.2)',  5: 'rgba(248,113,113,.2)' };
const CHIP_IC  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M8 3v4M16 3v4M8 17v4M16 17v4M3 8h4M3 16h4M17 8h4M17 16h4"/></svg>';
const TEMP_IC  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>';
const HUMID_IC = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';

function unitLabel(slotCount) {
  return slotCount === 1 ? 'AMS HT' : 'AMS';
}

export default function AMS() {
  const [printerList, setPrinterList]   = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [slotData, setSlotData]         = useState([]);
  const [filaments, setFilaments]       = useState([]);
  const [allSpools, setAllSpools]       = useState([]);
  const [pendingLinks, setPendingLinks] = useState({}); // `${unit}_${slot}` → spool_id str
  const [saving, setSaving]             = useState({});
  const { printerStatus } = usePrinter();
  const intervalRef = useRef(null);

  useEffect(() => {
    printersApi.list().then(ps => {
      setPrinterList(ps);
      if (ps.length) setSelectedPrinter(ps[0]);
    });
    filamentsApi.list().then(setFilaments);
    spoolsApi.list().then(setAllSpools);
  }, []);

  useEffect(() => {
    if (!selectedPrinter) return;
    const load = () => amsApi.slots(selectedPrinter.id).then(setSlotData).catch(() => {});
    load();
    intervalRef.current = setInterval(load, 4000);
    return () => clearInterval(intervalRef.current);
  }, [selectedPrinter]);

  // Build spool options for dropdowns
  const spoolOptions = allSpools
    .filter(s => s.is_active && s.spool_type !== 'refill')
    .map(s => {
      const f = filaments.find(f => f.id === s.filament_id);
      if (!f) return null;
      return {
        id: s.id,
        label: `${f.brand_name ? f.brand_name + ' · ' : ''}${f.name} (${Number(s.remaining_weight).toFixed(0)}g)`,
        color: f.color_hex,
      };
    })
    .filter(Boolean);

  // Group slots by ams_unit
  const unitMap = {};
  slotData.forEach(s => {
    const key = s.ams_unit;
    if (!unitMap[key]) unitMap[key] = [];
    unitMap[key][s.slot_index] = s;
  });

  const units = Object.keys(unitMap).sort((a, b) => Number(a) - Number(b)).map((uid, displayIdx) => {
    const rawSlots  = unitMap[uid];
    const anySlot   = rawSlots.find(Boolean) || {};
    const unitTemp  = anySlot.unit_temp ?? null;
    const unitHum   = anySlot.unit_humidity ?? null;
    const slotCount = anySlot.unit_slot_count ?? rawSlots.filter(Boolean).length;
    const capacity  = slotCount > 1 ? 4 : 1;
    const slots = Array.from({ length: capacity }, (_, i) => rawSlots[i] || {
      ams_unit: Number(uid), slot_index: i,
      spool_id: null, tag_uid: null, remain_percent: null,
      color_hex: null, filament_name: null, brand_name: null,
      sub_brand: null, tray_id_name: null, remaining_weight: null,
    });
    return { uid: Number(uid), displayIdx, slotCount: capacity, unitTemp, unitHum, slots };
  });

  // Count per type for numbered labels
  const typeCounts = {};
  units.forEach(u => { const l = unitLabel(u.slotCount); typeCounts[l] = (typeCounts[l] || 0) + 1; });
  const typeSeq = {};
  const unitsWithLabel = units.map(u => {
    const label = unitLabel(u.slotCount);
    typeSeq[label] = (typeSeq[label] || 0) + 1;
    return { ...u, label, displayNum: typeCounts[label] > 1 ? typeSeq[label] : null };
  });

  function pendingKey(sl) { return `${sl.ams_unit}_${sl.slot_index}`; }

  function getPendingValue(sl) {
    const k = pendingKey(sl);
    return k in pendingLinks ? pendingLinks[k] : (sl.spool_id ? String(sl.spool_id) : '');
  }

  function setPending(sl, value) {
    setPendingLinks(prev => ({ ...prev, [pendingKey(sl)]: value }));
  }

  async function saveLink(sl) {
    if (!selectedPrinter) return;
    const k = pendingKey(sl);
    const value = getPendingValue(sl);
    setSaving(prev => ({ ...prev, [k]: true }));
    try {
      if (value) {
        await amsApi.link(selectedPrinter.id, sl.ams_unit, sl.slot_index, Number(value));
      } else {
        await amsApi.unlink(selectedPrinter.id, sl.ams_unit, sl.slot_index);
      }
      // Clear pending after save
      setPendingLinks(prev => { const n = { ...prev }; delete n[k]; return n; });
      amsApi.slots(selectedPrinter.id).then(setSlotData);
    } finally {
      setSaving(prev => ({ ...prev, [k]: false }));
    }
  }

  const live = selectedPrinter ? printerStatus[selectedPrinter.serial_number] : null;
  const isOnline = live?.connected;

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>AMS</h1>
          <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>
            Automatic Material System · {units.length} unit{units.length !== 1 ? 's' : ''}
            {isOnline !== undefined && (
              <span style={{
                marginLeft: 10, padding: '2px 8px', borderRadius: 6,
                fontSize: 11, fontWeight: 800,
                background: isOnline ? 'rgba(52,211,153,.1)' : 'rgba(148,163,184,.1)',
                color: isOnline ? '#34d399' : '#94a3b8',
              }}>{isOnline ? '● Online' : '○ Offline'}</span>
            )}
          </div>
        </div>
        {printerList.length > 1 && (
          <select
            value={selectedPrinter?.id || ''}
            onChange={e => setSelectedPrinter(printerList.find(p => String(p.id) === e.target.value))}
            className="field-select"
            style={{ width: 200, marginLeft: 'auto' }}
          >
            {printerList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {units.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(230,237,247,.4)', padding: '60px 0' }}>
          No AMS data yet. Connect a printer with AMS — slot data appears automatically.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {unitsWithLabel.map(({ uid, displayNum, slotCount, unitTemp, unitHum, slots, label }) => (
          <div key={uid} style={{
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,.09)',
            background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
            padding: '18px 20px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          }}>
            {/* Unit header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: slotCount === 1
                  ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)'
                  : 'linear-gradient(135deg,#f97316,#fb7185)',
                color: '#fff',
              }} dangerouslySetInnerHTML={{ __html: AMS_IC }} />

              <div style={{ fontWeight: 900, fontSize: 17 }}>
                {label}{displayNum ? ` ${displayNum}` : ''}
              </div>

              <div style={{ fontSize: 11.5, color: 'rgba(230,237,247,.38)', fontWeight: 700 }}>
                · {slotCount} slot{slotCount !== 1 ? 's' : ''}
              </div>

              <div style={{ flex: 1 }} />

              {unitTemp != null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8,
                  background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.2)',
                }}>
                  <span style={{ color: '#fb923c', display: 'flex' }}
                    dangerouslySetInnerHTML={{ __html: TEMP_IC }} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fed7aa' }}>
                    {Number(unitTemp).toFixed(1)}°C
                  </span>
                </div>
              )}
              {unitHum != null && (() => {
                const lvl   = parseInt(unitHum);
                const label = HUM_LABELS[lvl] || `Lvl ${unitHum}`;
                const col   = HUM_COLORS[lvl] || '#38bdf8';
                const bg    = HUM_BG[lvl]     || 'rgba(56,189,248,.1)';
                const bdr   = HUM_BORDER[lvl]  || 'rgba(56,189,248,.2)';
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 11px', borderRadius: 8,
                    background: bg, border: `1px solid ${bdr}`,
                  }}>
                    <span style={{ color: col, display: 'flex' }}
                      dangerouslySetInnerHTML={{ __html: HUMID_IC }} />
                    <div style={{ lineHeight: 1.15 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: col }}>{label}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(230,237,247,.45)' }}>Level {unitHum} / 5</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Slot grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: slotCount === 1 ? 'minmax(0,320px)' : 'repeat(4,1fr)',
              gap: 14,
            }}>
              {slots.map(sl => (
                <SlotCard
                  key={sl.slot_index}
                  sl={sl}
                  spoolOptions={spoolOptions}
                  pendingValue={getPendingValue(sl)}
                  onPendingChange={value => setPending(sl, value)}
                  onSave={() => saveLink(sl)}
                  saving={!!saving[pendingKey(sl)]}
                  isDirty={pendingKey(sl) in pendingLinks}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotCard({ sl, spoolOptions, pendingValue, onPendingChange, onSave, saving, isDirty }) {
  const hasMqtt      = sl.tag_uid || sl.remain_percent != null || sl.color_hex;
  const hasLink      = sl.spool_id != null;
  const hasRfid      = !!sl.tag_uid;
  const displayColor = sl.color_hex || (hasLink && sl.filament_color ? sl.filament_color : null);

  const isSaved = pendingValue === (sl.spool_id ? String(sl.spool_id) : '') && !isDirty;
  const canSave = isDirty || (pendingValue !== '' && !hasLink);

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${hasRfid && hasLink ? 'rgba(124,58,237,.35)' : hasMqtt ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)'}`,
      background: 'rgba(11,18,32,.6)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Color swatch */}
      <div style={{
        height: 72,
        background: displayColor || 'rgba(255,255,255,.04)',
        position: 'relative',
        borderBottom: '1px solid rgba(0,0,0,.25)',
      }}>
        {sl.remain_percent != null && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(180deg, transparent ${sl.remain_percent}%, rgba(0,0,0,.6) ${sl.remain_percent}%)`,
            }} />
            <div style={{
              position: 'absolute', bottom: 6, right: 8,
              fontSize: 12, fontWeight: 900, color: '#fff',
              textShadow: '0 1px 4px rgba(0,0,0,.7)',
            }}>{sl.remain_percent}%</div>
          </>
        )}
        {sl.tray_id_name && (
          <div style={{
            position: 'absolute', top: 6, left: 8,
            fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.65)',
            letterSpacing: '.06em', textShadow: '0 1px 3px rgba(0,0,0,.6)',
          }}>{sl.tray_id_name}</div>
        )}
      </div>

      <div style={{ padding: '14px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Slot heading */}
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 16, letterSpacing: '.01em' }}>
          Slot {sl.slot_index + 1}
        </div>

        {/* Material badge */}
        <div style={{ textAlign: 'center' }}>
          {hasMqtt && (sl.sub_brand || sl.material) ? (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: 11.5, fontWeight: 800,
              background: 'rgba(124,58,237,.2)', color: '#c4b5fd',
              border: '1px solid rgba(124,58,237,.3)',
            }}>
              {sl.sub_brand || sl.material}
            </span>
          ) : (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: 11.5, fontWeight: 700,
              background: 'rgba(255,255,255,.04)', color: 'rgba(230,237,247,.28)',
              border: '1px solid rgba(255,255,255,.07)',
            }}>
              No filament
            </span>
          )}
        </div>

        {/* Stats row */}
        <div style={{ fontSize: 11.5, color: 'rgba(230,237,247,.55)', textAlign: 'center', fontWeight: 600, lineHeight: 1.5 }}>
          {sl.remain_percent != null ? (
            <>
              AMS: {sl.remain_percent}%
              {sl.remaining_weight != null && <span style={{ color: 'rgba(230,237,247,.35)' }}> · </span>}
            </>
          ) : (
            <span style={{ color: 'rgba(230,237,247,.3)' }}>AMS: — </span>
          )}
          {sl.remaining_weight != null && (
            <span>Inventory: {Math.round(sl.remaining_weight)}g</span>
          )}
        </div>

        {/* RFID indicator */}
        <div style={{ textAlign: 'center' }}>
          {hasRfid ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20,
              background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)',
              color: '#34d399', fontSize: 11, fontWeight: 800,
            }}>
              <span dangerouslySetInnerHTML={{ __html: CHIP_IC }} />
              RFID Chip
            </span>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
              color: 'rgba(230,237,247,.3)', fontSize: 11, fontWeight: 700,
            }}>
              <span dangerouslySetInnerHTML={{ __html: CHIP_IC }} />
              No RFID chip
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Currently linked spool pill */}
        {hasLink && !isDirty && (
          <div style={{
            padding: '6px 10px', borderRadius: 10,
            background: 'rgba(124,58,237,.12)', border: '1px solid rgba(124,58,237,.25)',
            fontSize: 11, fontWeight: 700, color: '#e9d5ff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#c084fc', fontWeight: 900 }}>● </span>
            {sl.brand_name ? `${sl.brand_name} · ` : ''}{sl.filament_name}
            {sl.remaining_weight != null ? ` · ${Math.round(sl.remaining_weight)}g` : ''}
          </div>
        )}

        {/* Dropdown */}
        <select
          value={pendingValue}
          onChange={e => onPendingChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 10,
            background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
            color: pendingValue ? '#e2e8f0' : 'rgba(230,237,247,.4)',
            fontSize: 11.5, fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">— Link to inventory spool —</option>
          {spoolOptions.map(opt => (
            <option key={opt.id} value={String(opt.id)}>{opt.label}</option>
          ))}
        </select>

        {/* Save Link button */}
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 10,
            border: 'none', cursor: canSave ? 'pointer' : 'default',
            fontWeight: 800, fontSize: 12.5, letterSpacing: '.02em',
            background: canSave
              ? 'linear-gradient(90deg, #ec4899, #8b5cf6)'
              : 'rgba(255,255,255,.06)',
            color: canSave ? '#fff' : 'rgba(230,237,247,.3)',
            boxShadow: canSave ? '0 4px 16px rgba(139,92,246,.4)' : 'none',
            transition: 'opacity .15s',
          }}
        >
          {saving ? 'Saving…' : '💾 Save Link'}
        </button>
      </div>
    </div>
  );
}
