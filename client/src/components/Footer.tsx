import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer style={{
      background: '#0B1120',
      borderTop: '1px solid rgba(255,214,10,0.1)',
      marginTop: 'auto',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ textAlign: 'center' }}>
            <Link to="/" style={{
              fontFamily: "'Bangers', cursive",
              fontSize: 24, color: '#FFD60A', letterSpacing: 2,
              textDecoration: 'none', transition: 'opacity 0.2s',
            }}>
              PlotTwist
            </Link>
            <p style={{ marginTop: 4, fontSize: 13, color: '#64748B' }}>
              {t('footer.tagline')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a
              href="#"
              aria-label={t('footer.twitter')}
              style={{ color: '#64748B', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFD60A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
            >
              {t('footer.twitter')}
            </a>
            <a
              href="#"
              aria-label={t('footer.discord')}
              style={{ color: '#64748B', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFD60A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
            >
              {t('footer.discord')}
            </a>
          </div>
        </div>
        <div style={{
          marginTop: 24, paddingTop: 24,
          borderTop: '1px solid rgba(255,214,10,0.1)',
          textAlign: 'center', fontSize: 13, color: '#64748B',
        }}>
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
