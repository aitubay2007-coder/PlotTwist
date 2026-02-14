import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, AuthError } from '../store/authStore';
import { UserPlus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.length < 3) { setError(t('auth.err_username_short')); return; }
    if (password.length < 6) { setError(t('auth.err_password_short')); return; }
    if (!email.includes('@')) { setError(t('auth.err_invalid_email')); return; }

    setLoading(true);
    try {
      await register(email, password, username);
      toast.success(t('auth.account_created'));
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof AuthError ? t(`auth.${err.code}`) : (err instanceof Error ? err.message : t('auth.err_register_failed'));
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 48, color: '#FFD60A', textShadow: '2px 2px 0 #000' }}>
            {t('auth.register_title')}
          </h1>
          <p style={{ color: '#64748B', marginTop: 8 }}>{t('auth.signup_bonus')}</p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 10, marginBottom: 16, color: '#FF4757', fontSize: 13 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: '#141C2B', border: '1px solid #243044', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>{t('auth.username')}</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="coolpredictor42" required minLength={3} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('auth.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('auth.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} style={inputStyle} />
            <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{t('auth.password_hint')}</p>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1 }}>
            <UserPlus size={18} />
            {loading ? t('auth.creating') : t('auth.register_btn')}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#64748B', marginTop: 24, fontSize: 14 }}>
          {t('auth.has_account')}{' '}
          <Link to="/login" style={{ color: '#FFD60A', textDecoration: 'none', fontWeight: 600 }}>{t('auth.login_link')}</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none' };
