import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { supabase, withTimeout, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Prediction, Bet } from '../types';
import BetModal from '../components/BetModal';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function PredictionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated, adjustCoins, fetchProfile } = useAuthStore();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const isMobile = useIsMobile();

  const fetchData = useCallback(async () => {
    setLoadError(null);
    if (!id) {
      setPrediction(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setPrediction(null);
      setLoadError('Supabase is not configured in Vercel env');
      setLoading(false);
      return;
    }
    try {
      const { data: pred, error: predError } = await withTimeout(
        supabase
          .from('predictions')
          .select('id, creator_id, type, title, description, status, deadline_at, resolved_outcome, visibility_token, created_at')
          .eq('id', id)
          .single(),
        8000
      );
      if (predError) throw predError;
      if (!pred) throw new Error('Prediction not found');

      const { data: creatorData } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, username')
          .eq('id', (pred as Prediction).creator_id)
          .single(),
        8000
      );

      const { data: betData, error: betError } = await withTimeout(
        supabase
          .from('bets')
          .select('id, prediction_id, user_id, outcome, amount, created_at')
          .eq('prediction_id', id)
          .order('created_at'),
        8000
      );
      if (betError) throw betError;

      const userIds = [...new Set(((betData || []) as Bet[]).map((b) => b.user_id))];
      const { data: betUsers } = userIds.length > 0
        ? await withTimeout(
            supabase
              .from('profiles')
              .select('id, username')
              .in('id', userIds),
            8000
          )
        : { data: [] };

      const usernameById = new Map<string, string>(
        ((betUsers || []) as { id: string; username: string }[]).map((u) => [u.id, u.username])
      );

      setPrediction({
        ...(pred as Prediction),
        profiles: { username: (creatorData as { username?: string } | null)?.username || 'unknown' },
      });

      const mappedBets: Bet[] = ((betData || []) as Bet[]).map((b) => ({
        ...b,
        profiles: { username: usernameById.get(b.user_id) || '?' },
      }));
      setBets(mappedBets);
    } catch (err: unknown) {
      setPrediction(null);
      const msg = (err as { message?: string })?.message || 'Failed to load prediction';
      setLoadError(msg);
      console.error('[PredictionDetail] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPool = bets.reduce((s, b) => s + b.amount, 0);
  const yesPool = bets.filter(b => b.outcome === 'yes').reduce((s, b) => s + b.amount, 0);
  const noPool = bets.filter(b => b.outcome === 'no').reduce((s, b) => s + b.amount, 0);
  const yesPct = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const userBet = bets.find(b => b.user_id === user?.id);
  const isExpired = prediction ? new Date(prediction.deadline_at).getTime() < Date.now() : false;
  const canBet = prediction?.status === 'open' && !isExpired && !userBet && isAuthenticated;
  const canResolve = prediction?.status === 'open' && isAuthenticated && (
    (prediction.type === 'official' && user?.is_admin) ||
    (prediction.type === 'private' && prediction.creator_id === user?.id)
  );

  const handleBet = async (outcome: 'yes' | 'no', amount: number) => {
    if (!prediction) return;
    try {
      const { data, error } = await withTimeout(supabase.rpc('place_bet', {
        p_prediction_id: prediction.id,
        p_outcome: outcome,
        p_amount: amount,
      }), 8000);
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result.error) { toast.error(result.error); throw new Error(result.error); }

      adjustCoins(-amount);
      toast.success(t('predictions.bet_placed'));
      fetchData();
      fetchProfile();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      if (msg && msg !== 'insufficient_coins') {
        toast.error(msg || t('common.error'));
      }
      throw err;
    }
  };

  const handleResolve = async (outcome: 'yes' | 'no') => {
    if (!prediction) return;
    setResolving(true);
    try {
      const rpc = prediction.type === 'official' ? 'resolve_official' : 'resolve_private';
      const { data, error } = await withTimeout(supabase.rpc(rpc, {
        p_prediction_id: prediction.id,
        p_outcome: outcome,
      }), 8000);
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result.error) { toast.error(result.error); return; }

      toast.success(t('predictions.resolved'));
      fetchData();
      fetchProfile();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('common.error'));
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
        <div style={{ height: 200, background: '#141C2B', borderRadius: 14, animation: 'shimmer 1.5s infinite' }} />
      </div>
    );
  }

  if (!prediction) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('predictions.not_found')}</p>
        {loadError && (
          <p style={{ color: '#FCA5A5', fontSize: 13, marginTop: 8 }}>
            {loadError}
          </p>
        )}
        <Link to="/" style={{ color: '#FFD60A', textDecoration: 'none', marginTop: 12, display: 'inline-block' }}>
          {t('common.back_home')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748B', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={18} /> {t('common.back')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: 16, padding: isMobile ? 18 : 28,
        }}>
          {/* Status badge */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: prediction.status === 'open' ? 'rgba(46,213,115,0.15)' : 'rgba(100,116,139,0.15)',
              color: prediction.status === 'open' ? '#2ED573' : '#94A3B8',
              textTransform: 'uppercase',
            }}>
              {prediction.status === 'open' ? t('predictions.open') : t('predictions.resolved')}
            </span>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(255,214,10,0.1)', color: '#FFD60A', textTransform: 'uppercase',
            }}>
              {prediction.type}
            </span>
          </div>

          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px', lineHeight: 1.3 }}>
            {prediction.title}
          </h1>
          {prediction.description && (
            <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{prediction.description}</p>
          )}
          <p style={{ color: '#475569', fontSize: 12 }}>
            @{prediction.profiles?.username || 'unknown'} · <Clock size={11} style={{ verticalAlign: -1 }} /> {new Date(prediction.deadline_at).toLocaleString()}
          </p>

          {/* Pool stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
            marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {[
              { label: t('predictions.pool'), value: totalPool.toLocaleString(), icon: TrendingUp },
              { label: t('predictions.yes_pool'), value: `${yesPct}%`, icon: CheckCircle, color: '#2ED573' },
              { label: t('predictions.bets'), value: bets.length.toString(), icon: Users },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 12, background: '#0B1120', borderRadius: 10 }}>
                <s.icon size={16} color={s.color || '#64748B'} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: '#E2E8F0' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pool bar */}
          <div style={{ marginTop: 16, borderRadius: 8, overflow: 'hidden', height: 8, background: '#1C2538' }}>
            <div style={{
              width: `${yesPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #2ED573, #00D4FF)',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#64748B' }}>
            <span>{t('predictions.yes')} {yesPool.toLocaleString()}</span>
            <span>{t('predictions.no')} {noPool.toLocaleString()}</span>
          </div>

          {/* Resolved outcome */}
          {prediction.status === 'resolved' && prediction.resolved_outcome && (
            <div style={{
              marginTop: 20, padding: 16, borderRadius: 12,
              background: prediction.resolved_outcome === 'yes' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${prediction.resolved_outcome === 'yes' ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: 18, fontWeight: 700,
                color: prediction.resolved_outcome === 'yes' ? '#2ED573' : '#FF4757',
              }}>
                {t('predictions.result')}: {prediction.resolved_outcome.toUpperCase()}
              </span>
            </div>
          )}

          {/* User's bet */}
          {userBet && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>{t('predictions.your_bet')}</span>
              <span style={{
                fontWeight: 700, fontSize: 14,
                color: userBet.outcome === 'yes' ? '#2ED573' : '#FF4757',
              }}>
                {userBet.outcome.toUpperCase()} — {userBet.amount} {t('common.coins')}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {canBet && (
            <button
              onClick={() => setBetModalOpen(true)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 16, marginTop: 20,
                background: '#FFD60A', color: '#0B1120',
              }}
            >
              {t('predictions.place_bet')}
            </button>
          )}

          {canResolve && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => handleResolve('yes')} disabled={resolving}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 15, background: '#2ED573', color: '#fff',
                  opacity: resolving ? 0.5 : 1,
                }}
              >
                {t('predictions.resolve_yes')}
              </button>
              <button
                onClick={() => handleResolve('no')} disabled={resolving}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 15, background: '#FF4757', color: '#fff',
                  opacity: resolving ? 0.5 : 1,
                }}
              >
                {t('predictions.resolve_no')}
              </button>
            </div>
          )}
        </div>

        {/* Bets list */}
        {bets.length > 0 && (
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
            borderRadius: 16, padding: isMobile ? 18 : 28, marginTop: 16,
          }}>
            <h3 style={{ fontFamily: "'Bangers', cursive", fontSize: 20, color: '#FFD60A', margin: '0 0 16px' }}>
              {t('predictions.all_bets')} ({bets.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bets.map(b => (
                <div key={b.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#0B1120', borderRadius: 10,
                }}>
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>@{b.profiles?.username || '?'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{b.amount}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: b.outcome === 'yes' ? 'rgba(46,213,115,0.15)' : 'rgba(255,71,87,0.15)',
                      color: b.outcome === 'yes' ? '#2ED573' : '#FF4757',
                    }}>
                      {b.outcome.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {prediction && (
        <BetModal
          isOpen={betModalOpen}
          onClose={() => setBetModalOpen(false)}
          prediction={{ id: prediction.id, title: prediction.title, total_yes: yesPool, total_no: noPool }}
          onBetPlaced={handleBet}
        />
      )}
    </div>
  );
}
