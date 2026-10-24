import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePrinter } from '../../context/PrinterContext.jsx';
import HelpModal from '../HelpModal.jsx';

const IC = {
  inventory: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V9a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/><path d="M16 20v-3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 22V2"/><path d="M4 12h16"/><path d="M4 20h16"/><path d="M4 2v20"/><path d="M4 4h16"/></svg>',
  add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M16 17h6"/><path d="M19 14v6"/><path d="M21 10.535V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.675-.955"/><path d="M3.29 7 12 12l8.71-5"/><path d="m7.5 4.27 8.997 5.148"/></svg>',
  spools: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13.44 4.442 17.082A2 2 0 0 0 4.982 21H19a2 2 0 0 0 .558-3.921l-1.115-.32A2 2 0 0 1 17 14.837V7.66"/><path d="m7 10.56 12.558-3.642A2 2 0 0 0 19.018 3H5a2 2 0 0 0-.558 3.921l1.115.32A2 2 0 0 1 7 9.163v7.178"/></svg>',
  calc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>',
  printer: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>',
  ams: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M 7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8"/></svg>',
  log: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M12 9v6"/><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/></svg>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
};

const ICBG = {
  '/': 'linear-gradient(135deg,#06b6d4,#3b82f6)',
  '/add': 'linear-gradient(135deg,#22c55e,#10b981)',
  '/spools': 'linear-gradient(135deg,#f59e0b,#ef4444)',
  '/calculator': 'linear-gradient(135deg,#8b5cf6,#6366f1)',
  '/printer': 'linear-gradient(135deg,#3b82f6,#2563eb)',
  '/ams': 'linear-gradient(135deg,#f97316,#fb7185)',
  '/log': 'linear-gradient(135deg,#0ea5e9,#3b82f6)',
  '/settings': 'linear-gradient(135deg,#64748b,#475569)',
};

const NAV = [
  { path: '/', label: 'Inventory', icon: 'inventory' },
  { path: '/add', label: 'Add Filament', icon: 'add' },
  { path: '/spools', label: 'Spools', icon: 'spools' },
  { path: '/calculator', label: 'Calculator', icon: 'calc' },
  { path: '/printer', label: 'Printer', icon: 'printer' },
  { path: '/ams', label: 'AMS', icon: 'ams' },
];
const NAV_FOOT = [
  { path: '/log', label: 'Usage Log', icon: 'log' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function NavItem({ item, active }) {
  const navigate = useNavigate();
  const icbg = ICBG[item.path] || 'linear-gradient(135deg,#64748b,#475569)';
  return (
    <div
      onClick={() => navigate(item.path)}
      style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '11px 12px', borderRadius: 12,
        fontWeight: 800, fontSize: 13, cursor: 'pointer', userSelect: 'none',
        border: `1px solid ${active ? '#c084fc' : 'rgba(255,255,255,.08)'}`,
        background: active ? 'linear-gradient(180deg,rgba(192,132,252,.22),rgba(236,72,153,.14))' : 'transparent',
        color: active ? '#fff' : 'rgba(230,237,247,.82)',
        boxShadow: active ? '0 0 10px #c084fc55,0 0 18px #ec489922' : 'none',
        transition: 'all .15s',
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 7,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: icbg, color: '#fff', flexShrink: 0,
      }} dangerouslySetInnerHTML={{ __html: IC[item.icon] }} />
      {item.label}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { user, authDisabled, logout } = useAuth();
  const { printerStatus } = usePrinter();
  const [helpOpen, setHelpOpen] = useState(false);

  const connectedCount = Object.values(printerStatus).filter(s => s.connected).length;
  const activePath = location.pathname === '/add' || location.pathname.startsWith('/add/') ? '/add' : location.pathname;

  return (
    <div style={{
      alignSelf: 'start', position: 'sticky', top: 16,
      border: '1px solid rgba(255,255,255,.09)', borderRadius: 18,
      background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))',
      padding: '20px 12px 14px',
      boxShadow: '0 18px 50px rgba(0,0,0,.4)',
    }}>
      {/* Logo */}
      <div style={{
        fontWeight: 900, fontSize: 19, textAlign: 'center',
        letterSpacing: '.08em', textTransform: 'uppercase', lineHeight: 1.05,
        marginBottom: 6,
        background: 'linear-gradient(180deg,#7dd3fc 0%,#60a5fa 45%,#c084fc 70%,#ec4899 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>
        Filament<br />Tracker
      </div>
      <div style={{
        textAlign: 'center', fontSize: 10, fontWeight: 700,
        letterSpacing: '.3px', color: 'rgba(230,237,247,.4)', marginBottom: 16,
      }}>
        v2.0 · {connectedCount} printer{connectedCount !== 1 ? 's' : ''} online
      </div>

      {/* Main nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NAV.map(item => (
          <NavItem key={item.path} item={item} active={activePath === item.path} />
        ))}

        <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '8px 4px' }} />

        {NAV_FOOT.map(item => (
          <NavItem key={item.path} item={item} active={activePath === item.path} />
        ))}

        {/* Help */}
        <div
          onClick={() => setHelpOpen(true)}
          style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '11px 12px', borderRadius: 12,
            fontWeight: 800, fontSize: 13, cursor: 'pointer', userSelect: 'none',
            border: '1px solid rgba(255,255,255,.08)',
            color: 'rgba(230,237,247,.65)',
          }}
        >
          <span style={{
            width: 24, height: 24, borderRadius: 7,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', flexShrink: 0,
            fontSize: 13, fontWeight: 900,
          }}>?</span>
          Help
        </div>

        {/* Logout — pointless when the server runs without login */}
        {!authDisabled && (
        <div
          onClick={logout}
          style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '11px 12px', borderRadius: 12,
            fontWeight: 800, fontSize: 13, cursor: 'pointer', userSelect: 'none',
            border: '1px solid rgba(255,255,255,.08)',
            color: 'rgba(230,237,247,.5)',
            marginTop: 4,
          }}
        >
          <span style={{
            width: 24, height: 24, borderRadius: 7,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.08)', color: '#94a3b8', flexShrink: 0,
            fontSize: 11,
          }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </span>
          {user?.username}
        </div>
        )}
      </div>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
