import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, TrendingUp, Clock, Sparkles, Flame, Zap, Coins, Target, Trophy, BarChart3, X } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import type { Prediction } from '../types';
import { useIsMobile, useIsTablet } from '../hooks/useMediaQuery';

type Sort = 'trending' | 'newest' | 'ending_soon';

export default function Dashboard() {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('trending');
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('predictions')
          .select('*, profiles(username, avatar_url)')
          .eq('status', 'active')
          .eq('visibility', 'public')
          .limit(30);

        if (sort === 'trending') query = query.order('total_pool', { ascending: false });
        else if (sort === 'newest') query = query.order('created_at', { ascending: false });
        else if (sort === 'ending_soon') query = query.order('deadline', { ascending: true });

        const { data, error } = await withTimeout(query, 8000);
        if (error || !data) {
          setPredictions(DEMO);
        } else if (data.length === 0) {
          setPredictions(DEMO);
        } else {
          setPredictions(data as unknown as Prediction[]);
        }
      } catch {
        setPredictions(DEMO);
      } finally {
        setLoading(false);
      }
    })();
  }, [sort]);

  const filtered = predictions.filter(p =>
    (p.title ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const featured = filtered.slice(0, 2);
  const rest = filtered.slice(2);

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120' }}>

      {/* =========== HERO BANNER =========== */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a0f00 0%, #3d2200 30%, #5a3300 60%, #2a1500 100%)',
        minHeight: isMobile ? 140 : 220,
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          backgroundImage: 'radial-gradient(circle, #FFD60A 1px, transparent 1px)',
          backgroundSize: isMobile ? '6px 6px' : '8px 8px',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to top, #0B1120, transparent)',
        }} />
        {!isMobile && (
          <img
            src="/images/banner-hero.png"
            alt=""
            style={{
              position: 'absolute', right: 0, top: 0, height: '100%',
              objectFit: 'cover', objectPosition: 'top center',
              opacity: 0.7,
              maskImage: 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)',
              maxWidth: '55%',
            }}
          />
        )}
        <div style={{
          position: 'relative', zIndex: 2, textAlign: 'center',
          padding: isMobile ? '28px 16px 20px' : '50px 24px 40px',
        }}>
          <h1 style={{
            fontFamily: "'Bangers', cursive",
            fontSize: isMobile ? 40 : 'clamp(56px, 10vw, 96px)',
            color: '#FFD60A',
            textShadow: '3px 3px 0px #000, 1px 1px 0px #000',
            letterSpacing: 3, margin: 0, lineHeight: 1,
          }}>
            PlotTwist
          </h1>
          <p style={{
            color: '#D4AF00',
            fontSize: isMobile ? 13 : 16,
            marginTop: isMobile ? 6 : 10,
            fontWeight: 500,
          }}>
            {t('hero.subtitle')}
          </p>
        </div>
      </div>

      <HowItWorksCard />

      {/* =========== MAIN CONTENT =========== */}
      <div style={{
        maxWidth: 1120, margin: '0 auto',
        padding: isMobile ? '16px 16px 24px' : '32px 24px 60px',
      }}>

        {/* Quick Actions (mobile) */}
        {isMobile && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 20,
            overflowX: 'auto', paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            <QuickAction to="/create" icon={<Zap size={14} />} label={t('predictions.create')} primary />
            <QuickAction to="/leaderboard" icon={<Flame size={14} />} label={t('nav.leaderboard')} />
          </div>
        )}

        {/* Featured + Sidebar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 220px',
          gap: isMobile ? 12 : 20,
          marginBottom: isMobile ? 28 : 48,
        }}>
          {loading ? (
            <>
              <Skeleton h={isMobile ? 200 : 280} />
              <Skeleton h={isMobile ? 200 : 280} />
            </>
          ) : featured.length > 0 ? (
            featured.map(p => <FeaturedCard key={p.id} prediction={p} isMobile={isMobile} />)
          ) : (
            <div style={{
              gridColumn: isMobile ? 'span 1' : 'span 2',
              padding: isMobile ? 40 : 60,
              textAlign: 'center', color: '#64748B',
            }}>
              {t('predictions.no_predictions')}
            </div>
          )}

          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SideBtn to="/create" icon={<Zap size={16} />} label={t('predictions.create')} primary />
              <SideBtn to="/leaderboard" icon={<Flame size={16} />} label={t('nav.leaderboard')} />
            </div>
          )}
        </div>

        {/* PREDICTION CARDS Section */}
        <div style={{ marginBottom: isMobile ? 16 : 48 }}>
          <h2 style={{
            fontFamily: "'Bangers', cursive",
            fontSize: isMobile ? 22 : 32,
            color: '#FFD60A',
            textShadow: '2px 2px 0px #000',
            margin: isMobile ? '0 0 14px' : '0 0 20px',
            letterSpacing: 2,
          }}>
            {t('predictions.prediction_cards')}
          </h2>

          {/* Sort filters */}
          <div style={{
            display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap',
            alignItems: 'center', gap: isMobile ? 6 : 10,
            marginBottom: isMobile ? 14 : 20,
            overflowX: isMobile ? 'auto' : undefined,
            paddingBottom: isMobile ? 4 : 0,
            scrollbarWidth: 'none',
          }}>
            {(['trending', 'newest', 'ending_soon'] as Sort[]).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{
                padding: isMobile ? '7px 12px' : '8px 16px',
                borderRadius: 20,
                border: sort === s ? 'none' : '1px solid #243044',
                cursor: 'pointer',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                transition: 'all 0.2s',
                background: sort === s ? '#FFD60A' : '#141C2B',
                color: sort === s ? '#0B1120' : '#94A3B8',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {s === 'trending' && <TrendingUp size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'newest' && <Sparkles size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'ending_soon' && <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'trending' ? t('predictions.trending') : s === 'newest' ? t('predictions.newest') : t('predictions.ending_soon')}
              </button>
            ))}

            {!isMobile && (
              <div style={{ position: 'relative', flex: 1, minWidth: 200, marginLeft: 8 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('predictions.search_placeholder')}
                  style={{
                    width: '100%', padding: '9px 14px 9px 36px', borderRadius: 8, fontSize: 13,
                    background: '#141C2B', border: '1px solid #243044', color: '#E2E8F0',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Mobile search */}
          {isMobile && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('predictions.search_placeholder')}
                style={{
                  width: '100%', padding: '10px 14px 10px 36px', borderRadius: 12, fontSize: 14,
                  background: '#141C2B', border: '1px solid #1C2538', color: '#E2E8F0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Cards grid */}
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: isMobile ? 10 : 16,
            }}>
              {[1,2,3].map(i => <Skeleton key={i} h={isMobile ? 140 : 200} />)}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: isMobile ? 10 : 16,
              }}
            >
              {rest.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <PredCard prediction={p} isMobile={isMobile} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================  COMPONENTS  ==================== */

function QuickAction({ to, icon, label, primary }: { to: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 20, textDecoration: 'none',
      fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
      background: primary ? '#FFD60A' : '#141C2B',
      color: primary ? '#0B1120' : '#E2E8F0',
      border: primary ? '2px solid #D4AF00' : '1px solid #243044',
    }}>
      {icon} {label}
    </Link>
  );
}

function SideBtn({ to, icon, label, primary }: { to: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '12px 16px', borderRadius: 10, textDecoration: 'none',
      fontWeight: 700, fontSize: 13, transition: 'all 0.2s', cursor: 'pointer',
      background: primary ? '#FFD60A' : '#1C2538',
      color: primary ? '#0B1120' : '#E2E8F0',
      border: primary ? 'none' : '1px solid #243044',
    }}>
      {icon} {label}
    </Link>
  );
}

function FeaturedCard({ prediction, isMobile }: { prediction: Prediction; isMobile: boolean }) {
  const { t } = useTranslation();
  const pool = prediction.total_pool ?? 0;
  const pct = pool > 0 ? Math.round(((prediction.total_yes ?? 0) / pool) * 100) : 50;

  return (
    <Link to={`/prediction/${prediction.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        height: '100%',
        borderRadius: isMobile ? 16 : 14,
        padding: isMobile ? 16 : 22,
        background: '#EDE5CC',
        border: '2px solid #D4A017',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block',
              fontSize: isMobile ? 9 : 10, fontWeight: 700,
              padding: '3px 10px', borderRadius: 4,
              background: (prediction.mode ?? 'official') === 'unofficial' ? 'rgba(224,64,251,0.2)' : 'rgba(0,212,255,0.15)',
              color: (prediction.mode ?? 'official') === 'unofficial' ? '#E040FB' : '#0891b2',
            }}>
              {(prediction.mode ?? 'official') === 'unofficial' ? t('predictions.unofficial_badge') : t('predictions.official_badge')}
            </span>
          </div>
          <h3 style={{
            fontSize: isMobile ? 15 : 16, fontWeight: 700,
            color: '#1a1a1a', lineHeight: 1.35,
            margin: '0 0 6px',
          }}>
            {prediction.title}
          </h3>
          <p style={{ fontSize: isMobile ? 11 : 12, color: '#888', margin: '0 0 12px' }}>
            {prediction.profiles?.username && `@${prediction.profiles.username}`}
          </p>
        </div>

        <div>
          <div style={{
            height: 6, borderRadius: 3, overflow: 'hidden',
            display: 'flex', background: '#d5ccb3', marginBottom: 10,
          }}>
            <div style={{ width: `${pct}%`, background: '#22c55e', borderRadius: '3px 0 0 3px' }} />
            <div style={{ width: `${100-pct}%`, background: '#ef4444', borderRadius: '0 3px 3px 0' }} />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: isMobile ? 10 : 11, marginBottom: 12,
          }}>
            <span style={{ color: '#b8860b', fontWeight: 800 }}>
              {(prediction.total_pool ?? 0).toLocaleString()} {t('common.coins_short')}
            </span>
            <span style={{ color: '#999' }}>{timeLeft(prediction.deadline)}</span>
          </div>

          <span style={{
            display: 'block', width: '100%',
            padding: isMobile ? '10px 0' : '12px 0',
            borderRadius: 10,
            border: '2px solid #b8860b',
            background: '#FFD60A', color: '#000',
            fontWeight: 800,
            fontSize: isMobile ? 14 : 15,
            cursor: 'pointer', letterSpacing: 1,
            fontFamily: "'Bangers', cursive",
            textAlign: 'center',
          }}>
            {t('predictions.place_bet')}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PredCard({ prediction, isMobile }: { prediction: Prediction; isMobile: boolean }) {
  const { t } = useTranslation();
  const pool = prediction.total_pool ?? 0;
  const pct = pool > 0 ? Math.round(((prediction.total_yes ?? 0) / pool) * 100) : 50;

  return (
    <Link to={`/prediction/${prediction.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        height: '100%',
        borderRadius: isMobile ? 14 : 12,
        padding: isMobile ? 14 : 18,
        background: '#141C2B',
        border: '1px solid #1E293B',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.2s, border-color 0.2s',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{
                display: 'inline-block',
                fontSize: 9, fontWeight: 700,
                padding: '2px 8px', borderRadius: 4,
                marginBottom: 8,
                background: (prediction.mode ?? 'official') === 'unofficial' ? 'rgba(224,64,251,0.12)' : 'rgba(0,212,255,0.1)',
                color: (prediction.mode ?? 'official') === 'unofficial' ? '#E040FB' : '#00D4FF',
              }}>
                {(prediction.mode ?? 'official') === 'unofficial' ? t('predictions.unofficial_badge') : t('predictions.official_badge')}
              </span>
              <h4 style={{
                fontSize: isMobile ? 14 : 14, fontWeight: 600,
                color: '#E2E8F0', lineHeight: 1.4, margin: '0 0 4px',
              }}>
                {prediction.title}
              </h4>
            </div>
            <div style={{
              flexShrink: 0,
              width: 40, height: 40,
              borderRadius: 10,
              background: pct >= 50 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
              color: pct >= 50 ? '#22c55e' : '#ef4444',
            }}>
              {pct}%
            </div>
          </div>
        </div>

        <div style={{
          height: 4, borderRadius: 2, overflow: 'hidden',
          display: 'flex', background: '#1C2538', marginBottom: 10,
        }}>
          <div style={{ width: `${pct}%`, background: '#22c55e' }} />
          <div style={{ width: `${100-pct}%`, background: '#ef4444' }} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, marginTop: 'auto',
        }}>
          <span style={{ color: '#FFD60A', fontWeight: 700 }}>
            {(prediction.total_pool ?? 0).toLocaleString()} {t('common.coins_short')}
          </span>
          <span style={{ color: '#64748B' }}>{timeLeft(prediction.deadline)}</span>
        </div>
      </div>
    </Link>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div style={{
      height: h, borderRadius: 14,
      background: 'linear-gradient(110deg, #141C2B 30%, #1C2538 50%, #141C2B 70%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite ease-in-out',
    }} />
  );
}

function HowItWorksCard() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pt_hiw_dismissed') === '1');

  if (dismissed) return null;

  const steps = [
    { title: t('how_it_works.step1_title'), desc: t('how_it_works.step1_desc'), icon: Coins, accent: '#FFD60A' },
    { title: t('how_it_works.step2_title'), desc: t('how_it_works.step2_desc'), icon: Target, accent: '#00D4FF' },
    { title: t('how_it_works.step3_title'), desc: t('how_it_works.step3_desc'), icon: Trophy, accent: '#2ED573' },
    { title: t('how_it_works.step4_title'), desc: t('how_it_works.step4_desc'), icon: BarChart3, accent: '#E040FB' },
  ];

  const dismiss = () => { setDismissed(true); localStorage.setItem('pt_hiw_dismissed', '1'); };

  return (
    <div style={{
      maxWidth: 1120, margin: '0 auto',
      padding: isMobile ? '16px 16px 0' : '24px 24px 0',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, rgba(28,37,56,0.95) 0%, rgba(11,17,32,0.98) 100%)',
          border: '1px solid rgba(255,214,10,0.12)',
          borderRadius: isMobile ? 18 : 22,
          padding: isMobile ? '22px 16px 20px' : '32px 36px 28px',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,214,10,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,64,251,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Close button */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: isMobile ? 12 : 16, right: isMobile ? 12 : 16,
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 2,
          }}
        >
          <X size={14} color="#475569" />
        </button>

        {/* Header */}
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: isMobile ? 20 : 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 20,
            background: 'rgba(255,214,10,0.08)',
            border: '1px solid rgba(255,214,10,0.15)',
            marginBottom: 10,
          }}>
            <Sparkles size={12} color="#FFD60A" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD60A', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Quick Guide
            </span>
          </div>
          <h3 style={{
            fontFamily: "'Bangers', cursive",
            fontSize: isMobile ? 24 : 32,
            color: '#E2E8F0',
            margin: 0, letterSpacing: 1.5,
            textShadow: '0 2px 12px rgba(255,214,10,0.15)',
          }}>
            {t('how_it_works.title')}
          </h3>
        </div>

        {/* Steps */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? 0 : 0,
          position: 'relative',
        }}>
          {/* Connector line (desktop only) */}
          {!isMobile && (
            <div style={{
              position: 'absolute',
              top: 28,
              left: 'calc(12.5% + 20px)',
              right: 'calc(12.5% + 20px)',
              height: 2,
              background: 'linear-gradient(90deg, rgba(255,214,10,0.3), rgba(0,212,255,0.3), rgba(46,213,115,0.3), rgba(224,64,251,0.3))',
              borderRadius: 1,
              zIndex: 0,
            }} />
          )}

          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? 14 : 0,
                  padding: isMobile ? '14px 0' : '0 10px',
                  position: 'relative',
                  zIndex: 1,
                  borderBottom: isMobile && i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                {/* Icon circle */}
                <div style={{
                  width: isMobile ? 48 : 56,
                  height: isMobile ? 48 : 56,
                  borderRadius: isMobile ? 14 : 18,
                  background: `linear-gradient(135deg, ${s.accent}12, ${s.accent}06)`,
                  border: `1.5px solid ${s.accent}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  marginBottom: isMobile ? 0 : 14,
                  position: 'relative',
                }}>
                  <Icon size={isMobile ? 22 : 24} color={s.accent} strokeWidth={2} />
                  {/* Step number badge */}
                  <div style={{
                    position: 'absolute',
                    top: -6, right: -6,
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: s.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#0B1120',
                    boxShadow: `0 2px 8px ${s.accent}40`,
                  }}>
                    {i + 1}
                  </div>
                </div>

                {/* Text */}
                <div style={{ textAlign: isMobile ? 'left' : 'center', flex: 1 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: isMobile ? 14 : 13,
                    color: '#E2E8F0',
                    marginBottom: 4,
                    lineHeight: 1.3,
                  }}>
                    {s.title.replace(/^\d+\.\s*/, '')}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 12 : 11.5,
                    color: '#64748B',
                    lineHeight: 1.5,
                  }}>
                    {s.desc}
                  </div>
                </div>

                {/* Mobile connector dot */}
                {isMobile && i < 3 && (
                  <div style={{
                    position: 'absolute', bottom: -3, left: 23,
                    width: 6, height: 6, borderRadius: '50%',
                    background: steps[i + 1]?.accent ?? '#475569',
                    opacity: 0.4,
                  }} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginTop: isMobile ? 20 : 28,
        }}>
          <Link to="/create" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: isMobile ? '11px 24px' : '12px 28px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #FFD60A 0%, #F0AA00 100%)',
            boxShadow: '0 4px 20px rgba(255,214,10,0.2)',
            color: '#0B1120', fontWeight: 800, fontSize: isMobile ? 13 : 14,
            textDecoration: 'none', letterSpacing: 0.3,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}>
            <Zap size={15} strokeWidth={2.5} />
            {t('predictions.create')}
          </Link>
          <button
            onClick={dismiss}
            style={{
              padding: isMobile ? '11px 20px' : '12px 24px',
              borderRadius: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748B', fontWeight: 600, fontSize: isMobile ? 13 : 14,
              transition: 'background 0.15s',
            }}
          >
            {t('how_it_works.got_it')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function timeLeft(d: string) {
  const t = new Date(d).getTime();
  if (isNaN(t)) return '—';
  const ms = t - Date.now();
  if (ms <= 0) return '⏰';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d`;
  return `${Math.floor(ms / 3600000)}h`;
}

/* ============ DEMO DATA ============ */
const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const now = new Date().toISOString();

const DEMO: Prediction[] = [
  { id:'1', title:'Luffy will find the One Piece by end of 2026', description:null, creator_id:'1', mode:'official', visibility:'public', status:'active', deadline:d(30), resolved_at:null, disputed:false, total_yes:15000, total_no:8000, total_pool:23000, created_at:now, profiles:{username:'NakamaCrew',avatar_url:null} },
  { id:'2', title:'Squid Game S3 protagonist dies in the finale', description:null, creator_id:'2', mode:'official', visibility:'public', status:'active', deadline:d(14), resolved_at:null, disputed:false, total_yes:12000, total_no:18000, total_pool:30000, created_at:now, profiles:{username:'KDramaKing',avatar_url:null} },
  { id:'3', title:'Vegapunk will survive the Egghead arc', description:null, creator_id:'3', mode:'unofficial', visibility:'public', status:'active', deadline:d(7), resolved_at:null, disputed:false, total_yes:5000, total_no:20000, total_pool:25000, created_at:now, profiles:{username:'GrandLineGuru',avatar_url:null} },
  { id:'4', title:'Kanye West will release Bully this year', description:null, creator_id:'4', mode:'official', visibility:'public', status:'active', deadline:d(60), resolved_at:null, disputed:false, total_yes:3000, total_no:22000, total_pool:25000, created_at:now, profiles:{username:'YeezyFan',avatar_url:null} },
  { id:'5', title:'Jon Snow spin-off announced at Comic-Con', description:null, creator_id:'5', mode:'unofficial', visibility:'public', status:'active', deadline:d(120), resolved_at:null, disputed:false, total_yes:9000, total_no:6000, total_pool:15000, created_at:now, profiles:{username:'WinterIsComing',avatar_url:null} },
  { id:'6', title:'Islam Makhachev defends title at UFC 310', description:null, creator_id:'6', mode:'official', visibility:'public', status:'active', deadline:d(45), resolved_at:null, disputed:false, total_yes:25000, total_no:10000, total_pool:35000, created_at:now, profiles:{username:'MMAExpert',avatar_url:null} },
];
