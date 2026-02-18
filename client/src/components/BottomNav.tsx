import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Trophy, Plus, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function BottomNav() {
  const { t } = useTranslation();
  const loc = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const active = (path: string) =>
    path === '/' ? loc.pathname === '/' || loc.pathname === '/dashboard' : loc.pathname.startsWith(path);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      padding: '0 16px',
      paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
      pointerEvents: 'none',
    }}>
      <nav style={{
        maxWidth: 420,
        margin: '0 auto',
        background: 'rgba(13, 20, 36, 0.94)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderRadius: 22,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 0.5px 0 rgba(255,255,255,0.06)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        alignItems: 'center',
        height: 64,
        padding: '0 8px',
        pointerEvents: 'auto',
      }}>
        {/* Home */}
        <Tab
          to="/"
          icon={Home}
          label={t('nav.home')}
          isActive={active('/')}
        />

        {/* Leaderboard */}
        <Tab
          to="/leaderboard"
          icon={Trophy}
          label={t('nav.leaderboard')}
          isActive={active('/leaderboard')}
        />

        {/* Create — special pill design */}
        <Link
          to={isAuthenticated ? '/create' : '/login'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            height: 40,
            borderRadius: 14,
            margin: '0 4px',
            background: 'linear-gradient(135deg, #FFD60A 0%, #F0AA00 100%)',
            boxShadow: '0 2px 16px rgba(255,214,10,0.25)',
            textDecoration: 'none',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          }}
          onPointerDown={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 8px rgba(255,214,10,0.15)';
          }}
          onPointerUp={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(255,214,10,0.25)';
          }}
          onPointerLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(255,214,10,0.25)';
          }}
        >
          <Plus size={18} color="#0B1120" strokeWidth={3} />
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#0B1120',
            letterSpacing: 0.3,
          }}>
            {t('predictions.create').split(' ')[0]}
          </span>
        </Link>

        {/* Profile */}
        <Tab
          to={isAuthenticated ? '/profile' : '/login'}
          icon={User}
          label={t('nav.profile')}
          isActive={active('/profile')}
        />
      </nav>
    </div>
  );
}

function Tab({ to, icon: Icon, label, isActive }: {
  to: string;
  icon: typeof Home;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: '100%',
        textDecoration: 'none',
        position: 'relative',
      }}
    >
      <Icon
        size={20}
        color={isActive ? '#FFD60A' : '#4B5563'}
        strokeWidth={isActive ? 2.4 : 1.6}
      />
      <span style={{
        fontSize: 9.5,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? '#FFD60A' : '#4B5563',
        letterSpacing: 0.2,
      }}>
        {label}
      </span>
    </Link>
  );
}
