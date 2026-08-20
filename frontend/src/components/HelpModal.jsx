import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SECTIONS = [
  {
    key: 'inventory',
    label: 'Inventory',
    icon: '📦',
    content: [
      {
        title: 'Overview',
        body: 'The Inventory page shows all your filament definitions. Each card displays the total remaining weight across all active spools, color, material, and a low-stock warning when you\'re running low.',
      },
      {
        title: 'Logging Usage',
        body: 'Click a filament card then press "Register usage" to deduct grams from the oldest active spool (FIFO — first in, first out). Enter the amount used in grams. The system always deducts from the oldest spool first so you naturally cycle through stock in order.',
      },
      {
        title: 'Adding Spools',
        body: 'Inside a filament\'s modal, click "Add spool" to register a new physical spool. Set its starting weight and type (non-reusable or refill). Spools are shown oldest-first.',
      },
      {
        title: 'Refills vs Active Spools',
        body: 'Refills are bare rolls without a cardboard/plastic spool — they must be loaded onto a reusable spool holder before they count as active. Unloaded refills appear in the "Refills in stock" section. Once loaded, they show as active spools.',
      },
      {
        title: 'CSV Backup & Restore',
        body: 'Use the Template button to download a blank CSV you can fill in manually. Export saves your current inventory (one row per active spool). Import reads the CSV and adds any new filaments/spools — existing ones are matched by name + brand + material and only have their spools updated.',
      },
    ],
  },
  {
    key: 'spools',
    label: 'Spools',
    icon: '🧵',
    content: [
      {
        title: 'Spool types',
        body: 'non-reusable: a complete spool unit (filament wound on a cardboard or plastic core). Reusable: a refill that has been mounted on a reusable spool holder. Refill: a bare roll not yet mounted — it is inactive until loaded.',
      },
      {
        title: 'Reusable spool holders',
        body: 'Add your physical reusable holders in the Spools page. Each holder has a name and tare weight. When you load a refill, select which holder it\'s going on. The remaining weight shown already accounts for the holder tare.',
      },
      {
        title: 'FIFO ordering',
        body: 'Spools are listed and consumed oldest-first. When you log usage on a filament, the app picks the oldest active non-refill spool automatically.',
      },
    ],
  },
  {
    key: 'calculator',
    label: 'Calculator',
    icon: '🧮',
    content: [
      {
        title: 'What it calculates',
        body: 'The Calculator estimates the real cost per gram and per print job for a given printer model. It factors in depreciation, maintenance, electricity, and a material waste buffer.',
      },
      {
        title: 'Printer profiles',
        body: 'Select a Bambu Lab model (X1C, X1E, X2D, H2C, H2S, H2D, P1P, P1S, P2S, A1, A1 mini, A2L) or Custom. Each profile has pre-filled assumptions for printer price, expected lifetime, uptime, maintenance costs, and power draw based on the model tier.',
      },
      {
        title: 'Custom profile',
        body: 'Selecting "Custom" lets you override every parameter. Useful for non-Bambu printers or if you know your actual electricity tariff and maintenance costs.',
      },
      {
        title: 'Cost breakdown',
        body: 'The result shows: material cost (filament × weight × buffer), electricity (watts × print hours), maintenance (prorated from yearly cost), and depreciation (printer cost spread over lifetime and uptime). All amounts are in DKK.',
      },
    ],
  },
  {
    key: 'printers',
    label: 'Printers',
    icon: '🖨️',
    content: [
      {
        title: 'Adding a printer',
        body: 'Go to Printer → Add Printer. Enter a display name, select the model, and provide the IP address, serial number, and access code from the printer\'s touch screen (Settings → Network).',
      },
      {
        title: 'Connection',
        body: 'The backend connects to each Bambu Lab printer via MQTT on port 8883 (TLS) over your local network. The printer must be on the same LAN as the server. Status updates stream in real time via WebSocket to the UI.',
      },
      {
        title: 'Status indicators',
        body: 'The sidebar shows how many printers are currently online. Printer cards show live print progress, current stage, temperatures, and the active filament slots.',
      },
    ],
  },
  {
    key: 'ams',
    label: 'AMS',
    icon: '🗂️',
    content: [
      {
        title: 'AMS slot linking',
        body: 'The AMS page lets you manually link your inventory spools to the physical slots on your printer\'s AMS unit. This is informational — it helps you track which spool is loaded where.',
      },
      {
        title: 'How to link',
        body: 'Click a slot, choose the filament and spool from your inventory, and confirm. The slot will show the color and remaining weight. Unlink a slot when you remove the spool.',
      },
    ],
  },
  {
    key: 'log',
    label: 'Usage Log',
    icon: '📋',
    content: [
      {
        title: 'What\'s logged',
        body: 'Every time you click "Register usage" the event is recorded with the filament name, spool ID, grams used, and timestamp. Print jobs detected via MQTT also create log entries automatically.',
      },
      {
        title: 'Filtering',
        body: 'Filter the log by filament, date range, or printer. Useful for reviewing how much of a specific filament you used over a period.',
      },
    ],
  },
  {
    key: 'csv',
    label: 'CSV Format',
    icon: '📄',
    content: [
      {
        title: 'Columns',
        body: 'name, brand, material, color_hex, color_name, finish, density_g_cm3, price_per_kg_dkk, spool_weight_g, low_stock_threshold_g, nozzle_temp_c, bed_temp_c, location, notes, initial_spools, initial_weight_g, spool_type',
      },
      {
        title: 'One row = one spool',
        body: 'Each CSV row represents one physical spool. For the same filament (same name + brand + material) with multiple spools, add multiple rows. On import, duplicate filament definitions are detected and only a new spool is added.',
      },
      {
        title: 'spool_type values',
        body: '"non-reusable" for complete spools, "refill" for bare rolls, "reusable" for a refill already mounted on a holder. Defaults to non-reusable if blank.',
      },
      {
        title: 'Tips',
        body: 'Download the Template for a ready-to-fill blank file with example rows. Color hex must include the #. Finish and location are optional. Leave price blank if unknown — it defaults to 149 DKK/kg.',
      },
    ],
  },
];

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: 'linear-gradient(180deg,rgba(30,41,59,.98),rgba(15,23,42,.99))',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 20,
    boxShadow: '0 32px 80px rgba(0,0,0,.6)',
    width: '100%', maxWidth: 780,
    maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    fontSize: 20, fontWeight: 800, color: '#e6edf7',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(255,255,255,.06)', color: 'rgba(230,237,247,.6)',
    cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  tabs: {
    display: 'flex', gap: 4, padding: '16px 24px 0', flexShrink: 0, flexWrap: 'wrap',
  },
  tabBtn: (active) => ({
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? '#c084fc' : 'rgba(255,255,255,.1)'}`,
    background: active ? 'rgba(192,132,252,.18)' : 'transparent',
    color: active ? '#e9d5ff' : 'rgba(230,237,247,.55)',
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
  }),
  body: {
    padding: '20px 24px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  section: {
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  card: {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12,
    padding: '14px 16px',
  },
  cardTitle: {
    fontSize: 13, fontWeight: 800, color: '#c084fc', marginBottom: 6,
  },
  cardBody: {
    fontSize: 13, color: 'rgba(230,237,247,.78)', lineHeight: 1.65,
  },
  footer: {
    padding: '12px 24px',
    borderTop: '1px solid rgba(255,255,255,.07)',
    fontSize: 11, color: 'rgba(230,237,247,.3)',
    flexShrink: 0,
    textAlign: 'center',
  },
};

export default function HelpModal({ onClose }) {
  const [tab, setTab] = useState('inventory');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  const section = SECTIONS.find(s => s.key === tab);

  return createPortal(
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>
            <span style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>?</span>
            Help &amp; Guide
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.tabs}>
          {SECTIONS.map(s => (
            <button key={s.key} style={styles.tabBtn(tab === s.key)} onClick={() => setTab(s.key)}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            {section?.content.map((item, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardTitle}>{item.title}</div>
                <div style={styles.cardBody}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.footer}>
          Press Esc or click outside to close
        </div>
      </div>
    </div>,
    document.body
  );
}
