import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Coins, Globe, User, LogOut, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const NAV = [
  { to: '/', label: 'nav.home' },
  { to: '/clans', label: 'nav.clans' },
  { to: '/challenges', label: 'nav.challenges' },
  { to: '/leaderboard', label: 'nav.leaderboard' },
] as const;

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const { user, isAuthenticated, logout, showLogoutConfirm, setShowLogoutConfirm } = useAuthStore();
  const [open, setOpen] = useState(false);

  const active = (p: string) => (p === '/' ? loc.pathname === '/' : loc.pathname.startsWith(p));

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(11,17,32,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,214,10,0.15)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

            <Link to="/" style={{ fontFamily: "'Bangers', cursive", fontSize: 28, color: '#FFD60A', textDecoration: 'none', letterSpacing: 2 }}>
              PlotTwist
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden md:flex">
              {NAV.map(n => (
                <Link key={n.to} to={n.to} style={{
                  fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s',
                  color: active(n.to) ? '#FFD60A' : '#94A3B8',
                }}>
                  {t(n.label)}
                </Link>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ru' : 'en')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <Globe size={15} />
                {i18n.language === 'en' ? 'EN' : 'RU'}
              </button>

              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden md:flex">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.25)' }}>
                    <Coins size={14} color="#FFD60A" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#FFD60A' }}>{user.coins}</span>
                  </div>
                  <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, textDecoration: 'none', color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C2538', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={14} color="#64748B" />
                    </div>
                    <span>{user.username}</span>
                  </Link>
                  <button onClick={() => setShowLogoutConfirm(true)} style={{ border: 'none', background: 'transparent', padding: '6px', cursor: 'pointer' }}
                    title={t('nav.logout')}>
                    <LogOut size={16} color="#64748B" />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden md:flex">
                  <Link to="/login" style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', textDecoration: 'none', padding: '6px 14px' }}>
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" style={{
                    fontSize: 13, fontWeight: 600, color: '#0B1120', textDecoration: 'none',
                    padding: '8px 18px', borderRadius: 8, background: '#FFD60A',
                  }}>
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              <button onClick={() => setOpen(!open)} className="md:hidden"
                style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: 6 }}>
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {open && (
            <div className="md:hidden" style={{ paddingBottom: 16, borderTop: '1px solid rgba(255,214,10,0.1)' }}>
              {NAV.map(n => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} style={{
                  display: 'block', padding: '12px 16px', fontSize: 14, fontWeight: 500, textDecoration: 'none', borderRadius: 8,
                  color: active(n.to) ? '#FFD60A' : '#94A3B8',
                }}>
                  {t(n.label)}
                </Link>
              ))}
              {isAuthenticated && user ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,214,10,0.1)' }}>
                  <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#FFD60A', fontSize: 13 }}>
                    <Coins size={14} /> {user.coins} {t('common.coins_short')} · @{user.username}
                  </div>
                  <button onClick={() => { setOpen(false); setShowLogoutConfirm(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 14, color: '#FF4757', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    <LogOut size={16} /> {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,214,10,0.1)' }}>
                  <Link to="/login" onClick={() => setOpen(false)} style={{ padding: '10px 16px', fontSize: 14, color: '#94A3B8', textDecoration: 'none' }}>{t('nav.login')}</Link>
                  <Link to="/register" onClick={() => setOpen(false)} style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#0B1120', background: '#FFD60A', borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}>{t('nav.register')}</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ===== LOGOUT CONFIRMATION MODAL ===== */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
        onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#141C2B', border: '1px solid #243044', borderRadius: 16,
              padding: 32, maxWidth: 380, width: '100%', textAlign: 'center',
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,214,10,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} color="#FFD60A" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 8 }}>
              {t('auth.logout_title')}
            </h3>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
              {t('auth.logout_message')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                  background: '#1C2538', border: '1px solid #243044', color: '#94A3B8',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {t('auth.logout_cancel')}
              </button>
              <button
                onClick={() => logout()}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                  background: '#FF4757', border: 'none', color: '#fff',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {t('auth.logout_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
