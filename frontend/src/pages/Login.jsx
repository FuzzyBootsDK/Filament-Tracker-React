import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { auth } from '../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (setupMode) {
        await auth.setup(form.username, form.password);
        await login(form.username, form.password);
      } else {
        await login(form.username, form.password);
      }
      navigate('/');
    } catch (err) {
      if (!setupMode && err.message.includes('Invalid')) {
        setError('Invalid username or password');
      } else if (setupMode && err.message.includes('already')) {
        setSetupMode(false);
        setError('Setup already completed. Please log in.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `
        radial-gradient(1200px 620px at 28% -12%,rgba(59,130,246,.16),transparent 60%),
        radial-gradient(920px 520px at 92% 8%,rgba(16,185,129,.09),transparent 55%),
        radial-gradient(700px 700px at 60% 120%,rgba(124,58,237,.10),transparent 60%),
        #0b1220
      `,
      color: '#e6edf7', padding: 24,
    }}>
      <div style={{
        width: 380, border: '1px solid rgba(255,255,255,.12)', borderRadius: 22,
        background: '#0e1626', boxShadow: '0 40px 120px rgba(0,0,0,.6)',
        overflow: 'hidden', animation: 'fadeIn .35s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 24px 22px', textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <div style={{
            fontWeight: 900, fontSize: 22, letterSpacing: '.08em', textTransform: 'uppercase',
            lineHeight: 1.1, marginBottom: 8,
            background: 'linear-gradient(180deg,#7dd3fc 0%,#60a5fa 45%,#c084fc 70%,#ec4899 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            Filament<br />Tracker
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(230,237,247,.5)', fontWeight: 600 }}>
            {setupMode ? 'Create your admin account' : 'Sign in to continue'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '22px 24px 26px' }}>
          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)',
              color: '#fca5a5', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(230,237,247,.72)' }}>Username</span>
              <input
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
                className="field"
                required
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(230,237,247,.72)' }}>Password</span>
              <input
                value={form.password}
                onChange={set('password')}
                type="password"
                autoComplete={setupMode ? 'new-password' : 'current-password'}
                className="field"
                required
              />
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>
            {loading ? 'Signing in…' : setupMode ? 'Create account & sign in' : 'Sign in'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              type="button"
              onClick={() => { setSetupMode(!setupMode); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}
            >
              {setupMode ? 'Already have an account? Sign in' : 'First time? Set up admin account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
