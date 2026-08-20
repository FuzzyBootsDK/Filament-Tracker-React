import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      color: '#e6edf7',
      display: 'grid',
      gridTemplateColumns: '236px minmax(0,1fr)',
      gap: 16,
      padding: 16,
      background: `
        radial-gradient(1200px 620px at 28% -12%,rgba(59,130,246,.16),transparent 60%),
        radial-gradient(920px 520px at 92% 8%,rgba(16,185,129,.09),transparent 55%),
        radial-gradient(700px 700px at 60% 120%,rgba(124,58,237,.10),transparent 60%),
        #0b1220
      `,
    }}>
      <Sidebar />
      <div style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
