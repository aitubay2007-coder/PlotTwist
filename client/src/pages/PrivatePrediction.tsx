import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Clock, TrendingUp, Users, CheckCircle, Share2, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import BetModal from '../components/BetModal';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

interface PrivateData {
  prediction: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    deadline_at: string;
    resolved_outcome: string | null;
    creator_id: string;
    visibility_token: string;
  };
  bets: { id: string; user_id: string; outcome: string; amount: number; created_at: string; username: string }[];
  creator: string;
}

export default function PrivatePrediction() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated, adjustCoins, fetchProfile } = useAuthStore();
  const [data, setData] = useState<PrivateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const isMobile = useIsMobile();

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: result, error } = await supabase.rpc('get_private_prediction', { p_token: token });
      if (error) throw error;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.error) { setData(null); return; }
      setData(parsed);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
        <div style={{ height: 200, background: '#141C2B', borderRadius: 14, animation: 'shimmer 1.5s infinite' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <Lock size={48} color="#334155" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#64748B', fontSize: 16 }}>{t('predictions.private_not_found')}</p>
      </div>
    );
  }

  const pred = data.prediction;
  const bets = data.bets || [];
  const totalPool = bets.reduce((s, b) => s + b.amount, 0);
  const yesPool = bets.filter(b => b.outcome === 'yes').reduce((s, b) => s + b.amount, 0);
  const noPool = bets.filter(b => b.outcome === 'no').reduce((s, b) => s + b.amount, 0);
  const yesPct = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const userBet = bets.find(b => b.user_id === user?.id);
  const isExpired = new Date(pred.deadline_at).getTime() < Date.now();
  const canBet = pred.status === 'open' && !isExpired && !userBet && isAuthenticated;
  const canResolve = pred.status === 'open' && pred.creator_id === user?.id;

  const shareUrl = `${window.location.origin}/p/${token}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: pred.title, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      handleCopyLink();
    }
  };

  const handleBet = async (outcome: 'yes' | 'no', amount: number) => {
    try {
      const { data: result, error } = await supabase.rpc('place_bet', {
        p_prediction_id: pred.id,
        p_outcome: outcome,
        p_amount: amount,
      });
      if (error) throw error;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.error) { toast.error(parsed.error); throw new Error(parsed.error); }

      adjustCoins(-amount);
      toast.success(t('predictions.bet_placed'));
      fetchData();
      fetchProfile();
    } catch (err) {
      throw err;
    }
  };

  const handleResolve = async (outcome: 'yes' | 'no') => {
    setResolving(true);
    try {
      const { data: result, error } = await supabase.rpc('resolve_private', {
        p_prediction_id: pred.id,
        p_outcome: outcome,
      });
      if (error) throw error;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed.error) { toast.error(parsed.error); return; }
      toast.success(t('predictions.resolved'));
      fetchData();
      fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setResolving(false);
    }
  };

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
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(224,64,251,0.1)', color: '#E040FB', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Lock size={10} /> {t('predictions.private')}
            </span>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: pred.status === 'open' ? 'rgba(46,213,115,0.15)' : 'rgba(100,116,139,0.15)',
              color: pred.status === 'open' ? '#2ED573' : '#94A3B8',
              textTransform: 'uppercase',
            }}>
              {pred.status === 'open' ? t('predictions.open') : t('predictions.resolved')}
            </span>
          </div>

          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px', lineHeight: 1.3 }}>
            {pred.title}
          </h1>
          {pred.description && (
            <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>{pred.description}</p>
          )}
          <p style={{ color: '#475569', fontSize: 12 }}>
            @{data.creator} · <Clock size={11} style={{ verticalAlign: -1 }} /> {new Date(pred.deadline_at).toLocaleString()}
          </p>

          {/* Share buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleCopyLink} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: '#94A3B8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Copy size={13} /> {t('common.copy_link')}
            </button>
            <button onClick={handleShare} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)', color: '#94A3B8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Share2 size={13} /> {t('common.share')}
            </button>
          </div>

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
            <div style={{ width: `${yesPct}%`, height: '100%', background: 'linear-gradient(90deg, #2ED573, #00D4FF)', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#64748B' }}>
            <span>{t('predictions.yes')} {yesPool.toLocaleString()}</span>
            <span>{t('predictions.no')} {noPool.toLocaleString()}</span>
          </div>

          {/* Resolved outcome */}
          {pred.status === 'resolved' && pred.resolved_outcome && (
            <div style={{
              marginTop: 20, padding: 16, borderRadius: 12, textAlign: 'center',
              background: pred.resolved_outcome === 'yes' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${pred.resolved_outcome === 'yes' ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: pred.resolved_outcome === 'yes' ? '#2ED573' : '#FF4757' }}>
                {t('predictions.result')}: {pred.resolved_outcome.toUpperCase()}
              </span>
            </div>
          )}

          {/* User bet */}
          {userBet && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>{t('predictions.your_bet')}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: userBet.outcome === 'yes' ? '#2ED573' : '#FF4757' }}>
                {userBet.outcome.toUpperCase()} — {userBet.amount} {t('common.coins')}
              </span>
            </div>
          )}

          {/* Actions */}
          {canBet && (
            <button onClick={() => setBetModalOpen(true)} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 16, marginTop: 20,
              background: '#FFD60A', color: '#0B1120',
            }}>
              {t('predictions.place_bet')}
            </button>
          )}

          {canResolve && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => handleResolve('yes')} disabled={resolving} style={{
                flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 15, background: '#2ED573', color: '#fff', opacity: resolving ? 0.5 : 1,
              }}>
                {t('predictions.resolve_yes')}
              </button>
              <button onClick={() => handleResolve('no')} disabled={resolving} style={{
                flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 15, background: '#FF4757', color: '#fff', opacity: resolving ? 0.5 : 1,
              }}>
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
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>@{b.username || '?'}</span>
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

      <BetModal
        isOpen={betModalOpen}
        onClose={() => setBetModalOpen(false)}
        prediction={{ id: pred.id, title: pred.title, total_yes: yesPool, total_no: noPool }}
        onBetPlaced={handleBet}
      />
    </div>
  );
}
