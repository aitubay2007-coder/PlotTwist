import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Zap, Users, ArrowUpRight, ArrowDownRight, Lock } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import type { Prediction } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuthStore } from '../store/authStore';

interface MyParticipationItem {
  id: string;
  outcome: 'yes' | 'no';
  amount: number;
  created_at: string;
  prediction_id: string;
  prediction_title: string;
  prediction_status: 'open' | 'resolved';
  prediction_type: 'official' | 'private';
  deadline_at: string;
  visibility_token: string | null;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [predictions, setPredictions] = useState<(Prediction & { bet_count: number; total_pool: number; yes_pct: number })[]>([]);
  const [myParticipation, setMyParticipation] = useState<MyParticipationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [myParticipationLoading, setMyParticipationLoading] = useState(false);
  const [tickerDuration, setTickerDuration] = useState(36);
  const tickerResetTimer = useRef<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('predictions')
          .select('*, profiles(username), bets(amount, outcome)')
          .eq('type', 'official')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
        8000
      );
      if (error) throw error;

      const now = Date.now();
      const withStats = ((data || []) as (Prediction & { bets: { amount: number; outcome: 'yes' | 'no' }[] })[])
        .filter(p => new Date(p.deadline_at).getTime() > now)
        .map(p => {
          const betArr = p.bets || [];
          const totalPool = betArr.reduce((s, b) => s + (b.amount || 0), 0);
          const yesPool = betArr.filter(b => b.outcome === 'yes').reduce((s, b) => s + (b.amount || 0), 0);
          return {
            ...p,
            bet_count: betArr.length,
            total_pool: totalPool,
            yes_pct: totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50,
          };
        });

      setPredictions(withStats);
    } catch (err) {
      console.error('Failed to load predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadMyParticipation = async () => {
      if (!isAuthenticated || !user?.id) {
        setMyParticipation([]);
        return;
      }

      setMyParticipationLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('bets')
            .select('id, outcome, amount, created_at, prediction_id, predictions(id, title, status, type, deadline_at, visibility_token)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          8000
        );

        if (error) throw error;

        const mapped = ((data || []) as Record<string, unknown>[]).map((b) => {
          const pred = b.predictions as {
            id: string;
            title: string;
            status: 'open' | 'resolved';
            type: 'official' | 'private';
            deadline_at: string;
            visibility_token: string | null;
          } | null;

          return {
            id: b.id as string,
            outcome: b.outcome as 'yes' | 'no',
            amount: b.amount as number,
            created_at: b.created_at as string,
            prediction_id: b.prediction_id as string,
            prediction_title: pred?.title || t('dashboard.unknown_market'),
            prediction_status: pred?.status || 'open',
            prediction_type: pred?.type || 'official',
            deadline_at: pred?.deadline_at || new Date().toISOString(),
            visibility_token: pred?.visibility_token || null,
          };
        });

        setMyParticipation(mapped);
      } catch {
        setMyParticipation([]);
      } finally {
        setMyParticipationLoading(false);
      }
    };

    loadMyParticipation();
  }, [isAuthenticated, user?.id, t]);

  const timeLeft = (deadline: string) => {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return t('predictions.expired');
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const tickerItems = useMemo(() => {
    return [...predictions]
      .sort((a, b) => b.total_pool - a.total_pool)
      .slice(0, 8);
  }, [predictions]);
  const tickerLoop = useMemo(() => [...tickerItems, ...tickerItems], [tickerItems]);

  useEffect(() => {
    return () => {
      if (tickerResetTimer.current) {
        window.clearTimeout(tickerResetTimer.current);
      }
    };
  }, []);

  const boostTickerSpeed = () => {
    setTickerDuration(20);
    if (tickerResetTimer.current) {
      window.clearTimeout(tickerResetTimer.current);
    }
    tickerResetTimer.current = window.setTimeout(() => {
      setTickerDuration(36);
    }, 1200);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{
            fontFamily: "'Bangers', cursive", fontSize: isMobile ? 28 : 36,
            color: '#FFD60A', margin: 0, letterSpacing: 1.5,
          }}>
            {t('nav.home')}
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{t('dashboard.subtitle')}</p>
        </div>
        <Link to="/create" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 12,
          background: '#FFD60A', color: '#0B1120',
          fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          <Zap size={16} /> {t('predictions.create')}
        </Link>
      </div>

      {/* Floating ticker */}
      {!loading && tickerItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{
          position: 'sticky',
          top: isMobile ? 52 : 60,
          zIndex: 5,
          marginBottom: 16,
          padding: '6px 0 10px',
          background: 'linear-gradient(180deg, rgba(11,17,32,0.95), rgba(11,17,32,0.55) 70%, rgba(11,17,32,0))',
        }}>
          <div
            className="ticker-marquee"
            style={{ paddingBottom: 2 }}
            onWheel={boostTickerSpeed}
            onTouchMove={boostTickerSpeed}
            onPointerDown={boostTickerSpeed}
          >
            <div className="ticker-track" style={{ animationDuration: `${tickerDuration}s` }}>
            {tickerLoop.map((item, idx) => {
              const isBullish = item.yes_pct >= 50;
              const trendColor = isBullish ? '#2ED573' : '#FF6B6B';
              const TrendIcon = isBullish ? ArrowUpRight : ArrowDownRight;
              return (
              <Link
                key={`${item.id}-${idx}`}
                to={`/prediction/${item.id}`}
                style={{ textDecoration: 'none', minWidth: isMobile ? 180 : 220 }}
              >
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(20,28,43,0.9)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
                  }}
                >
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #FFD60A, #F59E0B)',
                    color: '#0B1120',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 13,
                  }}>
                    {(item.title || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      color: '#E2E8F0',
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </p>
                    <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: 10 }}>
                      {item.bet_count} {t('predictions.bets')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      color: trendColor,
                      fontSize: 11,
                      fontWeight: 700,
                      background: `${trendColor}14`,
                      borderRadius: 6,
                      padding: '2px 6px',
                    }}>
                      <TrendIcon size={12} />
                      {item.yes_pct}%
                    </div>
                    <div style={{ color: '#475569', fontSize: 10 }}>YES</div>
                  </div>
                </motion.div>
              </Link>
            );})}
            </div>
          </div>
        </motion.div>
      )}

      {/* My participation */}
      {isAuthenticated && (
        <div style={{
          marginBottom: 16,
          background: '#141C2B',
          border: '1px solid rgba(255,214,10,0.1)',
          borderRadius: 14,
          padding: isMobile ? 14 : 16,
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#FFD60A', letterSpacing: 0.2 }}>
            {t('dashboard.my_participation_title')}
          </h3>

          {myParticipationLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 52, borderRadius: 10, background: '#0B1120', animation: 'shimmer 1.5s infinite' }} />
              ))}
            </div>
          ) : myParticipation.length === 0 ? (
            <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>{t('dashboard.my_participation_empty')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myParticipation.map((item, idx) => {
                const path = item.prediction_type === 'private' && item.visibility_token
                  ? `/p/${item.visibility_token}`
                  : `/prediction/${item.prediction_id}`;
                const outcomeColor = item.outcome === 'yes' ? '#2ED573' : '#FF4757';
                const marketStatus = item.prediction_status === 'open'
                  ? t('predictions.open')
                  : t('predictions.resolved');

                return (
                  <Link key={item.id} to={path} style={{ textDecoration: 'none' }}>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      whileHover={{ y: -1 }}
                      style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      background: '#0B1120',
                      borderRadius: 10,
                      padding: '11px 12px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      boxShadow: '0 3px 14px rgba(0,0,0,0.16)',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                          margin: 0,
                          color: '#E2E8F0',
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.prediction_title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: outcomeColor,
                            background: `${outcomeColor}18`,
                            borderRadius: 4,
                            padding: '2px 6px',
                            textTransform: 'uppercase',
                          }}>
                            {item.outcome}
                          </span>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>
                            {item.amount} {t('common.coins')}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: item.prediction_status === 'open' ? '#2ED573' : '#94A3B8',
                            background: item.prediction_status === 'open' ? 'rgba(46,213,115,0.12)' : 'rgba(148,163,184,0.12)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontWeight: 700,
                          }}>
                            {marketStatus}
                          </span>
                          {item.prediction_type === 'private' && <Lock size={11} color="#64748B" />}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>
                        {timeLeft(item.deadline_at)}
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 100, background: '#141C2B', borderRadius: 14, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : predictions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <TrendingUp size={48} color="#334155" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontSize: 16 }}>{t('dashboard.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {predictions.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/prediction/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
                  borderRadius: 14, padding: isMobile ? 16 : 20,
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: isMobile ? 15 : 17, fontWeight: 600,
                        color: '#E2E8F0', margin: 0, lineHeight: 1.4,
                      }}>
                        {p.title}
                      </h3>
                      <p style={{ color: '#64748B', fontSize: 12, marginTop: 6 }}>
                        @{p.profiles?.username || 'unknown'}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      padding: '4px 10px', borderRadius: 8,
                      background: 'rgba(255,214,10,0.08)',
                    }}>
                      <Clock size={12} color="#FFD60A" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#FFD60A' }}>
                        {timeLeft(p.deadline_at)}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: 16, marginTop: 12,
                    paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} color="#64748B" />
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>{p.bet_count} {t('predictions.bets')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={13} color="#64748B" />
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>{p.total_pool.toLocaleString()} {t('common.coins')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
