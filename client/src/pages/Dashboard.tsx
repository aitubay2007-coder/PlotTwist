import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, TrendingUp, Clock, Sparkles, Flame, Zap, Users, Swords } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
          .select('*, shows(title, poster_url, category), profiles(username, avatar_url)')
          .eq('status', 'active')
          .limit(20);

        if (sort === 'trending') query = query.order('total_pool', { ascending: false });
        else if (sort === 'newest') query = query.order('created_at', { ascending: false });
        else if (sort === 'ending_soon') query = query.order('deadline', { ascending: true });

        const { data, error } = await query;
        if (error || !data) {
          setPredictions(DEMO);
        } else if (data.length === 0) {
          setPredictions(DEMO); // Show demo as placeholder when no real predictions yet
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
    p.title.toLowerCase().includes(search.toLowerCase())
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
        {/* Halftone dots */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          backgroundImage: 'radial-gradient(circle, #FFD60A 1px, transparent 1px)',
          backgroundSize: isMobile ? '6px 6px' : '8px 8px',
        }} />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to top, #0B1120, transparent)',
        }} />

        {/* Hero image — hidden on mobile */}
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

        {/* Content */}
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

      {/* =========== MAIN CONTENT =========== */}
      <div style={{
        maxWidth: 1120, margin: '0 auto',
        padding: isMobile ? '16px 16px 24px' : '32px 24px 60px',
      }}>

        {/* ---- Quick Actions (horizontal scroll on mobile) ---- */}
        {isMobile && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 20,
            overflowX: 'auto', paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            <QuickAction to="/create" icon={<Zap size={14} />} label={t('predictions.create')} primary />
            <QuickAction to="/clans?action=create" icon={<Users size={14} />} label={t('clans.create')} />
            <QuickAction to="/challenges" icon={<Swords size={14} />} label={t('challenges.send')} />
            <QuickAction to="/leaderboard" icon={<Flame size={14} />} label={t('nav.leaderboard')} />
          </div>
        )}

        {/* ---- Featured + Sidebar (desktop) ---- */}
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

          {/* Desktop Sidebar */}
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SideBtn to="/create" icon={<Zap size={16} />} label={t('predictions.create')} primary />
              <SideBtn to="/clans?action=create" icon={<Users size={16} />} label={t('clans.create')} />
              <SideBtn to="/challenges" icon={<Swords size={16} />} label={t('challenges.send')} />
              <SideBtn to="/leaderboard" icon={<Flame size={16} />} label={t('nav.leaderboard')} />
            </div>
          )}
        </div>

        {/* ---- PREDICTION CARDS Section ---- */}
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

          {/* Filters row */}
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
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
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
                  outline: 'none',
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
  const pct = prediction.total_pool > 0 ? Math.round((prediction.total_yes / prediction.total_pool) * 100) : 50;

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
          {prediction.shows && (
            <span style={{
              display: 'inline-block',
              fontSize: isMobile ? 9 : 10, fontWeight: 800, textTransform: 'uppercase',
              background: '#FFD60A', color: '#1a1a00',
              padding: '3px 10px', borderRadius: 4, marginBottom: 8,
              letterSpacing: 1,
            }}>
              {prediction.shows.category}
            </span>
          )}
          <h3 style={{
            fontSize: isMobile ? 15 : 16, fontWeight: 700,
            color: '#1a1a1a', lineHeight: 1.35,
            margin: '0 0 6px',
          }}>
            {prediction.title}
          </h3>
          <p style={{ fontSize: isMobile ? 11 : 12, color: '#888', margin: '0 0 12px' }}>
            {prediction.shows?.title} {prediction.profiles && `· @${prediction.profiles.username}`}
          </p>
        </div>

        {/* Bar */}
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
              {prediction.total_pool.toLocaleString()} {t('common.coins_short')}
            </span>
            <span style={{ color: '#999' }}>{timeLeft(prediction.deadline)}</span>
          </div>

          <span
            style={{
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
            }}
          >
            {t('predictions.place_bet')}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PredCard({ prediction, isMobile }: { prediction: Prediction; isMobile: boolean }) {
  const { t } = useTranslation();
  const pct = prediction.total_pool > 0 ? Math.round((prediction.total_yes / prediction.total_pool) * 100) : 50;

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            {prediction.shows && (
              <span style={{
                display: 'inline-block',
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                background: 'rgba(255,214,10,0.12)', color: '#FFD60A',
                padding: '2px 8px', borderRadius: 4,
                marginBottom: 8, letterSpacing: 0.5,
              }}>
                {prediction.shows.category}
              </span>
            )}
            <h4 style={{
              fontSize: isMobile ? 14 : 14, fontWeight: 600,
              color: '#E2E8F0', lineHeight: 1.4, margin: '0 0 4px',
            }}>
              {prediction.title}
            </h4>
            <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 10px' }}>
              {prediction.shows?.title}
            </p>
          </div>
          {/* Percentage badge */}
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
            {prediction.total_pool.toLocaleString()} {t('common.coins_short')}
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

function timeLeft(d: string) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return '⏰';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d`;
  return `${Math.floor(ms / 3600000)}h`;
}

/* ============ DEMO DATA ============ */
const d = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const now = new Date().toISOString();

const DEMO: Prediction[] = [
  { id:'1', title:'Luffy will find the One Piece by end of 2026', description:null, show_id:'1', creator_id:'1', status:'active', deadline:d(30), total_yes:15000, total_no:8000, total_pool:23000, created_at:now, shows:{title:'One Piece',poster_url:null,category:'anime'}, profiles:{username:'NakamaCrew',avatar_url:null} },
  { id:'2', title:'Squid Game S3 protagonist dies in the finale', description:null, show_id:'2', creator_id:'2', status:'active', deadline:d(14), total_yes:12000, total_no:18000, total_pool:30000, created_at:now, shows:{title:'Squid Game',poster_url:null,category:'series'}, profiles:{username:'KDramaKing',avatar_url:null} },
  { id:'3', title:'Vegapunk will survive the Egghead arc', description:null, show_id:'1', creator_id:'3', status:'active', deadline:d(7), total_yes:5000, total_no:20000, total_pool:25000, created_at:now, shows:{title:'One Piece',poster_url:null,category:'anime'}, profiles:{username:'GrandLineGuru',avatar_url:null} },
  { id:'4', title:'Kanye West will release Bully this year', description:null, show_id:'4', creator_id:'4', status:'active', deadline:d(60), total_yes:3000, total_no:22000, total_pool:25000, created_at:now, shows:{title:'Music',poster_url:null,category:'music'}, profiles:{username:'YeezyFan',avatar_url:null} },
  { id:'5', title:'Jon Snow spin-off announced at Comic-Con', description:null, show_id:'5', creator_id:'5', status:'active', deadline:d(120), total_yes:9000, total_no:6000, total_pool:15000, created_at:now, shows:{title:'Game of Thrones',poster_url:null,category:'series'}, profiles:{username:'WinterIsComing',avatar_url:null} },
  { id:'6', title:'Islam Makhachev defends title at UFC 310', description:null, show_id:'6', creator_id:'6', status:'active', deadline:d(45), total_yes:25000, total_no:10000, total_pool:35000, created_at:now, shows:{title:'UFC',poster_url:null,category:'sport'}, profiles:{username:'MMAExpert',avatar_url:null} },
];
