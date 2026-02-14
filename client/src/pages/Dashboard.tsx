import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, TrendingUp, Clock, Sparkles, Flame, Zap, Users, Swords } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Prediction } from '../types';

type Sort = 'trending' | 'newest' | 'ending_soon';

export default function Dashboard() {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('trending');
  const [search, setSearch] = useState('');

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
        if (error || !data || data.length === 0) {
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
        minHeight: 220,
      }}>
        {/* Halftone dots */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.2,
          backgroundImage: 'radial-gradient(circle, #FFD60A 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }} />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(to top, #0B1120, transparent)',
        }} />

        {/* Hero image — right side */}
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

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '50px 24px 40px' }}>
          <h1 style={{
            fontFamily: "'Bangers', cursive", fontSize: 'clamp(56px, 10vw, 96px)',
            color: '#FFD60A', textShadow: '4px 4px 0px #000, 2px 2px 0px #000',
            letterSpacing: 3, margin: 0, lineHeight: 1,
          }}>
            PlotTwist
          </h1>
          <p style={{ color: '#D4AF00', fontSize: 16, marginTop: 10, fontWeight: 500 }}>
            {t('hero.subtitle')}
          </p>
        </div>
      </div>

      {/* =========== MAIN CONTENT =========== */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* ---- 3 Column: 2 Featured + Sidebar ---- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: 20, marginBottom: 48 }}
             className="lg:grid-cols-[1fr_1fr_220px] max-lg:!grid-cols-1">

          {loading ? (
            <>
              <Skeleton h={280} />
              <Skeleton h={280} />
            </>
          ) : featured.length > 0 ? (
            featured.map(p => <FeaturedCard key={p.id} prediction={p} />)
          ) : (
            <div style={{ gridColumn: 'span 2', padding: 60, textAlign: 'center', color: '#64748B' }}>
              {t('predictions.no_predictions')}
            </div>
          )}

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SideBtn to="/create" icon={<Zap size={16} />} label={t('predictions.create')} primary />
            <SideBtn to="/clans?action=create" icon={<Users size={16} />} label={t('clans.create')} />
            <SideBtn to="/challenges" icon={<Swords size={16} />} label={t('challenges.send')} />
            <SideBtn to="/leaderboard" icon={<Flame size={16} />} label={t('nav.leaderboard')} />
          </div>
        </div>

        {/* ---- PREDICTION CARDS Section ---- */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: "'Bangers', cursive", fontSize: 32, color: '#FFD60A',
            textShadow: '2px 2px 0px #000', margin: '0 0 20px', letterSpacing: 2,
          }}>
            {t('predictions.prediction_cards')}
          </h2>

          {/* Filters row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            {(['trending', 'newest', 'ending_soon'] as Sort[]).map(s => (
              <button key={s} onClick={() => setSort(s)} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                background: sort === s ? '#FFD60A' : '#1C2538',
                color: sort === s ? '#0B1120' : '#94A3B8',
              }}>
                {s === 'trending' && <TrendingUp size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'newest' && <Sparkles size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'ending_soon' && <Clock size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {s === 'trending' ? t('predictions.trending') : s === 'newest' ? t('predictions.newest') : t('predictions.ending_soon')}
              </button>
            ))}
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
          </div>

          {/* Cards grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}
                 className="sm:grid-cols-2 lg:grid-cols-3 max-sm:!grid-cols-1">
              {[1,2,3].map(i => <Skeleton key={i} h={200} />)}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}
              className="sm:grid-cols-2 lg:grid-cols-3 max-sm:!grid-cols-1"
            >
              {(rest.length > 0 ? rest : filtered).map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <PredCard prediction={p} />
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

function FeaturedCard({ prediction }: { prediction: Prediction }) {
  const { t } = useTranslation();
  const pct = prediction.total_pool > 0 ? Math.round((prediction.total_yes / prediction.total_pool) * 100) : 50;

  return (
    <Link to={`/prediction/${prediction.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        height: '100%', borderRadius: 14, padding: 22,
        background: '#EDE5CC', border: '2px solid #D4A017',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,214,10,0.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
      >
        {prediction.shows && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            background: '#FFD60A', color: '#1a1a00', padding: '3px 10px', borderRadius: 4, marginBottom: 10,
            letterSpacing: 1,
          }}>
            {prediction.shows.category}
          </span>
        )}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4, margin: '0 0 8px' }}>
          {prediction.title}
        </h3>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 14px' }}>
          {prediction.shows?.title} {prediction.profiles && `· @${prediction.profiles.username}`}
        </p>

        {/* Bar */}
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: '#d5ccb3', marginBottom: 12 }}>
          <div style={{ width: `${pct}%`, background: '#22c55e', borderRadius: '4px 0 0 4px' }} />
          <div style={{ width: `${100-pct}%`, background: '#ef4444', borderRadius: '0 4px 4px 0' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 14 }}>
          <span style={{ color: '#b8860b', fontWeight: 800 }}>
            {t('predictions.pool')}: {prediction.total_pool.toLocaleString()} {t('common.coins_short')}
          </span>
          <span style={{ color: '#999' }}>{timeLeft(prediction.deadline)}</span>
        </div>

        <button
          onClick={e => e.preventDefault()}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: '2px solid #b8860b',
            background: '#FFD60A', color: '#000', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', letterSpacing: 1, fontFamily: "'Bangers', cursive",
            transition: 'background 0.2s',
          }}
        >
          {t('predictions.vote_yes')}!
        </button>
      </div>
    </Link>
  );
}

function PredCard({ prediction }: { prediction: Prediction }) {
  const { t } = useTranslation();
  const pct = prediction.total_pool > 0 ? Math.round((prediction.total_yes / prediction.total_pool) * 100) : 50;

  return (
    <Link to={`/prediction/${prediction.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        height: '100%', borderRadius: 12, padding: 18,
        background: '#141C2B', border: '1px solid #243044',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#FFD60A40'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#243044'; }}
      >
        {prediction.shows && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            background: 'rgba(255,214,10,0.15)', color: '#FFD60A', padding: '3px 8px', borderRadius: 4,
            marginBottom: 10, letterSpacing: 0.5,
          }}>
            {prediction.shows.category}
          </span>
        )}
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.4, margin: '0 0 6px' }}>
          {prediction.title}
        </h4>
        <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 12px' }}>
          {prediction.shows?.title}
        </p>

        <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: '#1C2538', marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, background: '#22c55e' }} />
          <div style={{ width: `${100-pct}%`, background: '#ef4444' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 'auto' }}>
          <span style={{ color: '#FFD60A', fontWeight: 700 }}>{prediction.total_pool.toLocaleString()} {t('common.coins_short')}</span>
          <span style={{ color: '#64748B' }}>{timeLeft(prediction.deadline)}</span>
        </div>
      </div>
    </Link>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div style={{ height: h, borderRadius: 12, background: '#1C2538', animation: 'pulse 2s infinite' }} />;
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
