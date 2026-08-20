import { useState, useEffect, useMemo } from 'react';
import { filaments as filamentsApi } from '../api/client.js';

const PROFILES = {
  // ── X series ──────────────────────────────────────────────────────────────
  'Bambu X1C':    { printerPrice: 8999,  lifetimeYears: 4, uptimePercent: 85, maintenanceYearly: 600,  powerWatt: 150, electricityPrice: 2.5, materialFactor: 1.12, bufferFactor: 1.25 },
  'Bambu X1E':    { printerPrice: 14999, lifetimeYears: 5, uptimePercent: 90, maintenanceYearly: 800,  powerWatt: 160, electricityPrice: 2.5, materialFactor: 1.12, bufferFactor: 1.28 },
  'Bambu X2D':    { printerPrice: 11999, lifetimeYears: 5, uptimePercent: 87, maintenanceYearly: 700,  powerWatt: 160, electricityPrice: 2.5, materialFactor: 1.13, bufferFactor: 1.27 },
  // ── H series ──────────────────────────────────────────────────────────────
  'Bambu H2C':    { printerPrice: 11499, lifetimeYears: 5, uptimePercent: 87, maintenanceYearly: 750,  powerWatt: 180, electricityPrice: 2.5, materialFactor: 1.13, bufferFactor: 1.28 },
  'Bambu H2S':    { printerPrice: 13999, lifetimeYears: 5, uptimePercent: 90, maintenanceYearly: 900,  powerWatt: 200, electricityPrice: 2.5, materialFactor: 1.14, bufferFactor: 1.30 },
  'Bambu H2D':    { printerPrice: 16999, lifetimeYears: 5, uptimePercent: 92, maintenanceYearly: 1000, powerWatt: 230, electricityPrice: 2.5, materialFactor: 1.15, bufferFactor: 1.32 },
  // ── P series ──────────────────────────────────────────────────────────────
  'Bambu P1P':    { printerPrice: 4499,  lifetimeYears: 3, uptimePercent: 75, maintenanceYearly: 400,  powerWatt: 120, electricityPrice: 2.5, materialFactor: 1.08, bufferFactor: 1.18 },
  'Bambu P1S':    { printerPrice: 6499,  lifetimeYears: 4, uptimePercent: 80, maintenanceYearly: 500,  powerWatt: 140, electricityPrice: 2.5, materialFactor: 1.10, bufferFactor: 1.22 },
  'Bambu P2S':    { printerPrice: 7999,  lifetimeYears: 4, uptimePercent: 82, maintenanceYearly: 550,  powerWatt: 145, electricityPrice: 2.5, materialFactor: 1.10, bufferFactor: 1.23 },
  // ── A series ──────────────────────────────────────────────────────────────
  'Bambu A1 mini':{ printerPrice: 2999,  lifetimeYears: 3, uptimePercent: 70, maintenanceYearly: 350,  powerWatt: 110, electricityPrice: 2.5, materialFactor: 1.05, bufferFactor: 1.18 },
  'Bambu A1':     { printerPrice: 3999,  lifetimeYears: 3, uptimePercent: 75, maintenanceYearly: 400,  powerWatt: 130, electricityPrice: 2.5, materialFactor: 1.08, bufferFactor: 1.20 },
  'Bambu A2L':    { printerPrice: 5999,  lifetimeYears: 4, uptimePercent: 78, maintenanceYearly: 450,  powerWatt: 150, electricityPrice: 2.5, materialFactor: 1.09, bufferFactor: 1.21 },
  // ── ──────────────────────────────────────────────────────────────────────
  'Custom':       { printerPrice: 5000,  lifetimeYears: 4, uptimePercent: 80, maintenanceYearly: 500,  powerWatt: 150, electricityPrice: 2.5, materialFactor: 1.10, bufferFactor: 1.20 },
};

const PRESETS = [
  { id: 'competitive', label: 'Competitive', margin: 15 },
  { id: 'standard',    label: 'Standard',    margin: 30 },
  { id: 'premium',     label: 'Premium',     margin: 50 },
  { id: 'luxury',      label: 'Luxury',      margin: 80 },
];

function kr(v) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 2 }).format(v || 0);
}

function gnum(v) { return (v === '' || v == null || isNaN(v)) ? 0 : Number(v); }

export default function Calculator() {
  const [filamentList, setFilamentList] = useState([]);
  const [profile, setProfile] = useState('Bambu X1C');
  const [partName, setPartName] = useState('My Part');

  const p = PROFILES[profile] || PROFILES['Bambu X1C'];
  const [printerPrice,    setPrinterPrice]    = useState(p.printerPrice);
  const [lifetimeYears,   setLifetimeYears]   = useState(p.lifetimeYears);
  const [uptimePercent,   setUptimePercent]   = useState(p.uptimePercent);
  const [maintenance,     setMaintenance]     = useState(p.maintenanceYearly);
  const [powerWatt,       setPowerWatt]       = useState(p.powerWatt);
  const [electricityKwh,  setElectricityKwh]  = useState(p.electricityPrice);
  const [materialFactor,  setMaterialFactor]  = useState(p.materialFactor);
  const [bufferFactor,    setBufferFactor]    = useState(p.bufferFactor);

  const [printH,    setPrintH]    = useState(6);
  const [printM,    setPrintM]    = useState(30);
  const [laborH,    setLaborH]    = useState(0);
  const [laborM,    setLaborM]    = useState(15);
  const [hourlyRate, setHourlyRate] = useState(250);
  const [hardware,  setHardware]  = useState(0);
  const [packaging, setPackaging] = useState(5);
  const [vatRate,   setVatRate]   = useState(25);
  const [customMargin, setCustomMargin] = useState(50);
  const [selectedPreset, setSelectedPreset] = useState('standard');

  const [materials, setMaterials] = useState([
    { filamentId: '', pricePerKg: 149, weightGrams: 85 },
  ]);

  useEffect(() => {
    filamentsApi.list().then(setFilamentList).catch(() => {});
  }, []);

  function applyProfile(name) {
    const prof = PROFILES[name];
    if (!prof) return;
    setProfile(name);
    setPrinterPrice(prof.printerPrice);
    setLifetimeYears(prof.lifetimeYears);
    setUptimePercent(prof.uptimePercent);
    setMaintenance(prof.maintenanceYearly);
    setPowerWatt(prof.powerWatt);
    setElectricityKwh(prof.electricityPrice);
    setMaterialFactor(prof.materialFactor);
    setBufferFactor(prof.bufferFactor);
  }

  const calc = useMemo(() => {
    const printTime = gnum(printH) + gnum(printM) / 60;
    const laborTime = gnum(laborH) + gnum(laborM) / 60;
    const uptimeFrac = gnum(uptimePercent) / 100;
    const annualActiveHours = 8760 * uptimeFrac;

    const machineCostPerHour = annualActiveHours > 0
      ? (gnum(printerPrice) / (gnum(lifetimeYears) * annualActiveHours)) +
        (gnum(maintenance) / annualActiveHours)
      : 0;

    const materialCost = materials.reduce((sum, m) => {
      return sum + (gnum(m.pricePerKg) / 1000) * gnum(m.weightGrams) * gnum(materialFactor);
    }, 0);

    const machineCost = machineCostPerHour * printTime;
    const electricity = (gnum(powerWatt) / 1000) * gnum(electricityKwh) * printTime;
    const laborCost = (laborTime + printTime * 0) * gnum(hourlyRate); // handling time only
    const actualLabor = laborTime * gnum(hourlyRate);
    const hardwareCost = gnum(hardware);
    const packagingCost = gnum(packaging);

    const baseCost = (materialCost + machineCost + electricity + actualLabor + hardwareCost + packagingCost) * gnum(bufferFactor);

    return { materialCost, machineCost, electricity, labor: actualLabor, hardwareCost, packagingCost, baseCost };
  }, [materials, printH, printM, laborH, laborM, hourlyRate, hardware, packaging,
      printerPrice, lifetimeYears, uptimePercent, maintenance, powerWatt, electricityKwh,
      materialFactor, bufferFactor]);

  function sellPrice(margin) {
    const exVat = calc.baseCost * (1 + margin / 100);
    const incVat = exVat * (1 + gnum(vatRate) / 100);
    return { exVat, incVat };
  }

  const activePresetMargin =
    selectedPreset === 'custom'
      ? gnum(customMargin)
      : PRESETS.find(p => p.id === selectedPreset)?.margin ?? 30;

  function updateMaterial(i, key, val) {
    setMaterials(ms => ms.map((m, idx) => idx === i ? { ...m, [key]: val } : m));
  }
  function removeMaterial(i) {
    setMaterials(ms => ms.filter((_, idx) => idx !== i));
  }
  function addMaterial() {
    setMaterials(ms => [...ms, { filamentId: '', pricePerKg: 149, weightGrams: 0 }]);
  }

  const inp = (setter) => (e) => setter(e.target.value);

  return (
    <div className="fade-in" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Cost Calculator</h1>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(230,237,247,.5)' }}>workshop pricing · DKK</span>
      </div>
      <div style={{ color: 'rgba(230,237,247,.6)', fontSize: 12.5, marginBottom: 18, fontWeight: 600 }}>
        Full cost model — material, machine depreciation, energy, labor, margin &amp; VAT.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 380px', gap: 16, alignItems: 'start' }}>
        {/* Left: inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Part */}
          <Section label="Part">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'rgba(230,237,247,.7)' }}>Part name</span>
              <input value={partName} onChange={e => setPartName(e.target.value)} className="field" />
            </label>
          </Section>

          {/* Printer profile */}
          <Section label="Printer profile" right={
            <select value={profile} onChange={e => applyProfile(e.target.value)} className="field-select" style={{ minWidth: 170 }}>
              {Object.keys(PROFILES).map(k => <option key={k}>{k}</option>)}
            </select>
          }>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumField label="Printer price" value={printerPrice} onChange={inp(setPrinterPrice)} />
              <NumField label="Lifetime (yrs)" value={lifetimeYears} onChange={inp(setLifetimeYears)} />
              <NumField label="Uptime (%)" value={uptimePercent} onChange={inp(setUptimePercent)} />
              <NumField label="Maint. / yr" value={maintenance} onChange={inp(setMaintenance)} />
              <NumField label="Power (W)" value={powerWatt} onChange={inp(setPowerWatt)} />
              <NumField label="El. (kr/kWh)" value={electricityKwh} onChange={inp(setElectricityKwh)} />
              <NumField label="Material factor" value={materialFactor} onChange={inp(setMaterialFactor)} />
              <NumField label="Buffer factor" value={bufferFactor} onChange={inp(setBufferFactor)} />
            </div>
          </Section>

          {/* Materials */}
          <Section label="Materials" right={
            <button onClick={addMaterial} style={{
              border: '1px solid rgba(124,58,237,.4)', background: 'rgba(124,58,237,.16)',
              color: '#c4b5fd', padding: '6px 12px', borderRadius: 9,
              fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}>+ Add material</button>
          }>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr 32px', gap: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '.3px', textTransform: 'uppercase', color: 'rgba(230,237,247,.42)', marginBottom: 8, padding: '0 2px' }}>
              <span>Filament</span><span>Price / kg</span><span>Weight (g)</span><span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {materials.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr .9fr 32px', gap: 8, alignItems: 'center' }}>
                  <select
                    value={m.filamentId}
                    onChange={e => {
                      const fil = filamentList.find(f => String(f.id) === e.target.value);
                      updateMaterial(i, 'filamentId', e.target.value);
                      if (fil) updateMaterial(i, 'pricePerKg', fil.price_per_kg || 149);
                    }}
                    className="field-select"
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="">— select filament —</option>
                    {filamentList.map(f => (
                      <option key={f.id} value={f.id}>{f.brand_name ? `${f.brand_name} ` : ''}{f.name}</option>
                    ))}
                  </select>
                  <input
                    value={m.pricePerKg}
                    onChange={e => updateMaterial(i, 'pricePerKg', e.target.value)}
                    type="number"
                    className="field"
                    style={{ fontSize: 12.5, padding: '9px 10px' }}
                  />
                  <input
                    value={m.weightGrams}
                    onChange={e => updateMaterial(i, 'weightGrams', e.target.value)}
                    type="number"
                    className="field"
                    style={{ fontSize: 12.5, padding: '9px 10px' }}
                  />
                  <button onClick={() => removeMaterial(i)} style={{
                    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)',
                    color: 'rgba(230,237,247,.6)', borderRadius: 9, height: 34,
                    cursor: 'pointer', fontWeight: 900, width: 32,
                  }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '18px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.62)', display: 'block', marginBottom: 6 }}>Print time</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={printH} onChange={inp(setPrintH)} type="number" className="field" style={{ fontSize: 13, padding: '9px 10px' }} title="hours" />
                  <input value={printM} onChange={inp(setPrintM)} type="number" className="field" style={{ fontSize: 13, padding: '9px 10px' }} title="minutes" />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(230,237,247,.38)', marginTop: 4 }}>h · min / part</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.62)', display: 'block', marginBottom: 6 }}>Handling time</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={laborH} onChange={inp(setLaborH)} type="number" className="field" style={{ fontSize: 13, padding: '9px 10px' }} title="hours" />
                  <input value={laborM} onChange={inp(setLaborM)} type="number" className="field" style={{ fontSize: 13, padding: '9px 10px' }} title="minutes" />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(230,237,247,.38)', marginTop: 4 }}>h · min / job</div>
              </div>
              <NumField label="Hourly rate" value={hourlyRate} onChange={inp(setHourlyRate)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <NumField label="Hardware / part" value={hardware} onChange={inp(setHardware)} />
              <NumField label="Packaging / part" value={packaging} onChange={inp(setPackaging)} />
            </div>
          </Section>
        </div>

        {/* Right: result panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Cost breakdown */}
          <div style={{
            border: '1px solid rgba(99,102,241,.3)', borderRadius: 20,
            background: 'linear-gradient(160deg,rgba(79,70,229,.2),rgba(124,58,237,.08)),rgba(255,255,255,.02)',
            padding: 22, boxShadow: '0 12px 34px rgba(30,20,80,.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="section-label" style={{ color: 'rgba(199,190,255,.7)' }}>Cost per unit</span>
            </div>
            <div style={{
              fontSize: 40, fontWeight: 900, margin: '6px 0 16px',
              background: 'linear-gradient(90deg,#c4b5fd,#93c5fd)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              {kr(calc.baseCost)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { label: 'Material', value: calc.materialCost },
                { label: 'Labor', value: calc.labor },
                { label: 'Machine', value: calc.machineCost },
                { label: 'Electricity', value: calc.electricity },
                { label: 'Hardware', value: calc.hardwareCost },
                { label: 'Packaging', value: calc.packagingCost },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, fontWeight: 700 }}>
                  <span style={{ color: 'rgba(230,237,247,.62)' }}>{label}</span>
                  <span style={{ fontWeight: 900 }}>{kr(value)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '5px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 900 }}>
                <span>Base cost</span>
                <span>{kr(calc.baseCost)}</span>
              </div>
            </div>
          </div>

          {/* Sell price presets */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="section-label">Sell price</span>
              <div style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.6)' }}>
                VAT %
                <input
                  value={vatRate}
                  onChange={inp(setVatRate)}
                  type="number"
                  style={{
                    width: 52, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)',
                    color: '#e6edf7', padding: '6px 8px', borderRadius: 8, fontSize: 12,
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {PRESETS.map(preset => {
                const { exVat, incVat } = sellPrice(preset.margin);
                const isActive = selectedPreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 13px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${isActive ? 'rgba(124,58,237,.5)' : 'rgba(255,255,255,.07)'}`,
                      background: isActive ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.02)',
                      transition: 'all .15s',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{preset.label}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(230,237,247,.5)' }}>+{preset.margin}% margin</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{kr(exVat)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(230,237,247,.5)' }}>{kr(incVat)} incl. VAT</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.6)', flex: 1 }}>Custom margin %</span>
              <input
                value={customMargin}
                onChange={inp(setCustomMargin)}
                type="number"
                style={{
                  width: 70, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)',
                  color: '#e6edf7', padding: '7px 9px', borderRadius: 9, fontSize: 12.5,
                }}
              />
              <div style={{ minWidth: 100, textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{kr(sellPrice(gnum(customMargin)).exVat)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(230,237,247,.5)' }}>{kr(sellPrice(gnum(customMargin)).incVat)} incl. VAT</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children, right }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px' }}>
        <span className="section-label">{label}</span>
        <div style={{ flex: 1 }} />
        {right}
      </div>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(230,237,247,.62)' }}>{label}</span>
      <input value={value} onChange={onChange} type="number" className="field" style={{ padding: '9px 11px', fontSize: 13 }} />
    </label>
  );
}
