import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Trophy, PlusCircle, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

const TABS = [
  { to: '/', icon: Home, label: 'nav.home' },
  { to: '/leaderboard', icon: Trophy, label: 'nav.leaderboard' },
  { to: '/create', icon: PlusCircle, label: 'predictions.create', center: true },
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
      background: 'rgba(11,17,32,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,214,10,0.12)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 56,
        maxWidth: 480,
        margin: '0 auto',
      }}>
        {TABS.map((tab) => {
          const active = isActive(tab.to);
          const Icon = tab.icon;
          const isCenter = 'center' in tab && tab.center;

          if (isCenter) {
            return (
              <Link
                key={tab.to}
                to={isAuthenticated ? tab.to : '/login'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  marginTop: -16,
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#FFD60A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(255,214,10,0.35)',
                }}>
                  <Icon size={24} color="#0B1120" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.to}
              to={tab.to === '/profile' && !isAuthenticated ? '/login' : tab.to}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                textDecoration: 'none',
                padding: '4px 12px',
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
        })}
      </div>
    </nav>
  );
}
