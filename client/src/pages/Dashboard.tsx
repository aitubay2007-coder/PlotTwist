import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Zap, Users } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import type { Prediction } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Dashboard() {
  const { t } = useTranslation();
  const [predictions, setPredictions] = useState<(Prediction & { bet_count: number; total_pool: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('predictions')
          .select('*, profiles(username)')
          .eq('type', 'official')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
        8000
      );
      if (error) throw error;

      const preds = (data || []) as Prediction[];
      const withStats = await Promise.all(preds.map(async (p) => {
        const { data: bets } = await supabase
          .from('bets')
          .select('amount')
          .eq('prediction_id', p.id);
        const betArr = bets || [];
        return {
          ...p,
          bet_count: betArr.length,
          total_pool: betArr.reduce((s, b) => s + (b.amount || 0), 0),
        };
      }));

      setPredictions(withStats);
    } catch (err) {
      console.error('Failed to load predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  const timeLeft = (deadline: string) => {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return t('predictions.expired');
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
