import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Trophy, Plus, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

const TABS = [
  { to: '/', icon: Home, label: 'nav.home' },
  { to: '/leaderboard', icon: Trophy, label: 'nav.leaderboard' },
  { to: '/profile', icon: User, label: 'nav.profile' },
] as const;

export default function BottomNav() {
  const { t } = useTranslation();
  const loc = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const isActive = (path: string) =>
    path === '/' ? loc.pathname === '/' || loc.pathname === '/dashboard' : loc.pathname.startsWith(path);

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Floating center FAB */}
      <Link
        to={isAuthenticated ? '/create' : '/login'}
        style={{
          position: 'absolute',
          left: '50%',
          top: -22,
          transform: 'translateX(-50%)',
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD60A 0%, #F5B800 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(255,214,10,0.4), 0 0 0 4px rgba(11,17,32,0.97)',
          textDecoration: 'none',
          zIndex: 51,
          transition: 'transform 0.2s',
        }}
      >
        <Plus size={26} color="#0B1120" strokeWidth={3} />
      </Link>

      {/* Bar background */}
      <div style={{
        background: 'rgba(11,17,32,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,214,10,0.12)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 60px 1fr 1fr',
          alignItems: 'center',
          height: 56,
          maxWidth: 480,
          margin: '0 auto',
        }}>
          {TABS.map((tab, i) => {
            const active = isActive(tab.to);
            const Icon = tab.icon;

            const element = (
              <Link
                key={tab.to}
                to={tab.to === '/profile' && !isAuthenticated ? '/login' : tab.to}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  textDecoration: 'none',
                  padding: '4px 0',
                  transition: 'all 0.2s',
                }}
              >
                <Icon
                  size={22}
                  color={active ? '#FFD60A' : '#64748B'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#FFD60A' : '#64748B',
                  letterSpacing: 0.2,
                }}>
                  {t(tab.label)}
                </span>
              </Link>
            );

            if (i === 2) {
              return [
                <div key="spacer" />,
                element,
              ];
            }

            return element;
          })}
        </div>
      </div>
    </nav>
  );
}
