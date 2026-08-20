import { useEffect } from 'react';

export default function Modal({ onClose, children, width = 440 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(4,8,18,.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width, maxWidth: '100%',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: 22,
          overflow: 'hidden', background: '#0e1626',
          boxShadow: '0 40px 120px rgba(0,0,0,.6)',
          animation: 'fadeIn .2s ease',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
