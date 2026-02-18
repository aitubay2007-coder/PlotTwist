import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, CheckCircle, XCircle, Trophy, AlertTriangle, Globe, Users, Shield, ThumbsUp, ThumbsDown, Lock, Share2, Copy, X, MessageCircle } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import BetModal from '../components/BetModal';
import PredictionComments from '../components/PredictionComments';
import type { Prediction, PredictionDispute } from '../types';
import toast from 'react-hot-toast';

export default function PredictionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isAuthenticated, user, fetchProfile, adjustCoins } = useAuthStore();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [betOpen, setBetOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState<'yes' | 'no' | null>(null);
  const [disputes, setDisputes] = useState<PredictionDispute[]>([]);
  const [disputing, setDisputing] = useState(false);
  const [userHasBet, setUserHasBet] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isMobile = useIsMobile();

  const fetchPrediction = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('predictions')
        .select('*, profiles(username, avatar_url)')
        .eq('id', id)
        .single(), 8000);

      if (error || !data) {
        setPrediction(null);
      } else {
        setPrediction(data as unknown as Prediction);

        // Fetch disputes for unofficial predictions
        if (data.mode === 'unofficial' && (data.status === 'resolved_yes' || data.status === 'resolved_no')) {
          const { data: disputeData } = await supabase
            .from('prediction_disputes')
            .select('*')
            .eq('prediction_id', id);
          setDisputes((disputeData as PredictionDispute[]) || []);
        }

        // Check if current user has a bet on this prediction
        if (user?.id) {
          const { data: betData } = await supabase
            .from('bets')
            .select('id')
            .eq('prediction_id', id)
            .eq('user_id', user.id)
            .limit(1);
          setUserHasBet(!!betData && betData.length > 0);
        }
      }
    } catch {
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchPrediction(); }, [id, user?.id]);

  const handleBet = async (position: string, amount: number) => {
    if (!user || !prediction) return;

    // Client-side balance check
    if (amount > user.coins) {
      toast.error(t('predictions.insufficient_coins'));
      return;
    }

    try {
      // Atomic bet placement (checks balance server-side, deducts coins, inserts bet, updates pool)
      const { data, error } = await supabase.rpc('place_bet', {
        user_id_param: user.id,
        prediction_id_param: prediction.id,
        position_param: position,
        amount_param: amount,
      });

      if (error) throw error;
      const result = data as { success?: boolean; error?: string; max?: number; current?: number };
      if (result.error === 'creator_bet_limit') {
        toast.error(t('predictions.creator_bet_limit', { max: result.max ?? 200, current: result.current ?? 0 }));
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Instantly update coins in UI
      adjustCoins(-amount);

      toast.success(t('predictions.bet_placed', { position: position.toUpperCase(), amount }));

      // Refresh prediction data + sync real balance in background
      fetchPrediction();
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleResolve = async (outcome: 'yes' | 'no') => {
    if (!user || !prediction || resolving) return;
    setResolving(true);
    try {
      const { data, error } = await supabase.rpc('resolve_prediction', {
        pred_id: prediction.id,
        outcome,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; winners?: number; total_paid?: number };
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t('predictions.resolved_success', {
            outcome: outcome.toUpperCase(),
            winners: result.winners || 0,
            paid: (result.total_paid || 0).toLocaleString(),
          }),
          { duration: 5000 }
        );
        fetchPrediction();
        // Refresh balance — creator or winners may have received coins
        fetchProfile();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('predictions.resolve_failed'));
    } finally {
      setResolving(false);
      setShowResolveConfirm(null);
    }
  };

  const handleDispute = async (vote: 'yes' | 'no') => {
    if (!user || !prediction || disputing) return;
    setDisputing(true);
    try {
      const { data, error } = await supabase.rpc('dispute_prediction', {
        pred_id: prediction.id,
        vote_param: vote,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('predictions.dispute_submitted'));
        fetchPrediction();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('predictions.dispute_failed'));
    } finally {
      setDisputing(false);
    }
  };

  // Compute dispute window remaining hours
  const getDisputeHoursLeft = () => {
    if (!prediction?.resolved_at) return 0;
    const resolvedTime = new Date(prediction.resolved_at).getTime();
    if (isNaN(resolvedTime)) return 0;
    const deadline = resolvedTime + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((deadline - Date.now()) / (60 * 60 * 1000)));
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ height: 32, background: '#1C2538', borderRadius: 8, width: '33%' }} />
          <div style={{ height: 200, background: '#1C2538', borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('predictions.not_found')}</p>
        <Link to="/" style={{ color: '#FFD60A', marginTop: 16, display: 'inline-block' }}>{t('common.back')}</Link>
      </div>
    );
  }

  const yesPercent = (prediction.total_pool ?? 0) > 0 ? ((prediction.total_yes ?? 0) / (prediction.total_pool ?? 1)) * 100 : 50;
  const noPercent = 100 - yesPercent;
  const deadline = new Date(prediction.deadline);
  const deadlineValid = !isNaN(deadline.getTime());
  const isExpired = deadlineValid ? deadline < new Date() : false;
  const isActive = prediction.status === 'active' && !isExpired;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#64748B', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Main Card */}
        <div style={{ background: '#141C2B', border: '1px solid #243044', borderRadius: 16, padding: isMobile ? 18 : 32 }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
              {(prediction.mode ?? 'official') === 'unofficial' ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(224,64,251,0.15)', color: '#E040FB', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> {t('predictions.unofficial')}
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,255,0.12)', color: '#00D4FF', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={12} /> {t('predictions.official')}
                </span>
              )}
              {prediction.visibility === 'private' && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} /> {t('create.visibility_private')}
                </span>
              )}
              <button
                onClick={() => setShareOpen(true)}
                style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8',
                  display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                }}
              >
                <Share2 size={12} /> {t('common.share')}
              </button>
            </div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#E2E8F0', marginTop: 12, lineHeight: 1.3 }}>{prediction.title}</h1>
            {prediction.description && <p style={{ color: '#64748B', marginTop: 8 }}>{prediction.description}</p>}
            {prediction.profiles && (
              <p style={{ color: '#64748B', fontSize: 14, marginTop: 8 }}>
                {t('common.by')} <span style={{ color: '#FFD60A' }}>@{prediction.profiles.username}</span>
              </p>
            )}
          </div>

          {/* Bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#2ED573', fontWeight: 700, fontSize: 14 }}>{t('predictions.vote_yes')} {yesPercent.toFixed(1)}%</span>
              <span style={{ color: '#FF4757', fontWeight: 700, fontSize: 14 }}>{t('predictions.vote_no')} {noPercent.toFixed(1)}%</span>
            </div>
            <div style={{ height: 16, background: '#0B1120', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${yesPercent}%`, background: '#2ED573', borderRadius: '8px 0 0 8px', transition: 'width 0.5s' }} />
              <div style={{ width: `${noPercent}%`, background: '#FF4757', borderRadius: '0 8px 8px 0', transition: 'width 0.5s' }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatBox label={t('predictions.pool')} value={(prediction.total_pool ?? 0).toLocaleString()} color="#FFD60A" />
            <StatBox label={t('predictions.vote_yes')} value={(prediction.total_yes ?? 0).toLocaleString()} color="#2ED573" />
            <StatBox label={t('predictions.vote_no')} value={(prediction.total_no ?? 0).toLocaleString()} color="#FF4757" />
            <StatBox label={t('predictions.deadline')} value={deadlineValid ? deadline.toLocaleDateString() : '—'} color="#E2E8F0" />
          </div>

          {/* Resolved Banner */}
          {(prediction.status === 'resolved_yes' || prediction.status === 'resolved_no') && (
            <div style={{
              padding: 16, borderRadius: 12, marginBottom: 16,
              background: prediction.status === 'resolved_yes' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${prediction.status === 'resolved_yes' ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Trophy size={24} color={prediction.status === 'resolved_yes' ? '#2ED573' : '#FF4757'} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#E2E8F0' }}>
                  {t('predictions.resolved_title')}
                </div>
                <div style={{ fontSize: 14, color: prediction.status === 'resolved_yes' ? '#2ED573' : '#FF4757', fontWeight: 600 }}>
                  {t('predictions.outcome')}: {prediction.status === 'resolved_yes' ? t('predictions.vote_yes') : t('predictions.vote_no')}
                </div>
              </div>
            </div>
          )}

          {/* Resolve Section */}
          {isActive && isAuthenticated && (
            (prediction.mode ?? 'official') === 'official'
              ? user?.is_admin === true
              : user?.id === prediction.creator_id
          ) && (
            <div style={{
              padding: 20, borderRadius: 12, marginBottom: 16,
              background: (prediction.mode ?? 'official') === 'unofficial' ? 'rgba(224,64,251,0.05)' : 'rgba(255,214,10,0.05)',
              border: `1px solid ${(prediction.mode ?? 'official') === 'unofficial' ? 'rgba(224,64,251,0.2)' : 'rgba(255,214,10,0.2)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {(prediction.mode ?? 'official') === 'official' ? <Shield size={18} color="#00D4FF" /> : <AlertTriangle size={18} color="#E040FB" />}
                <span style={{ fontWeight: 700, fontSize: 15, color: (prediction.mode ?? 'official') === 'official' ? '#00D4FF' : '#E040FB' }}>
                  {t('predictions.resolve_title')}
                </span>
              </div>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                {(prediction.mode ?? 'official') === 'official'
                  ? t('predictions.resolve_desc_official')
                  : t('predictions.resolve_desc_unofficial')}
              </p>

              {showResolveConfirm ? (
                <div style={{
                  padding: 16, borderRadius: 10,
                  background: showResolveConfirm === 'yes' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
                  border: `1px solid ${showResolveConfirm === 'yes' ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
                }}>
                  <p style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                    {t('predictions.resolve_confirm', { outcome: showResolveConfirm.toUpperCase() })}
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleResolve(showResolveConfirm)}
                      disabled={resolving}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: 14,
                        background: showResolveConfirm === 'yes' ? '#2ED573' : '#FF4757',
                        color: '#fff',
                        opacity: resolving ? 0.5 : 1,
                      }}
                    >
                      {resolving ? t('common.loading') : t('common.confirm')}
                    </button>
                    <button
                      onClick={() => setShowResolveConfirm(null)}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 700, fontSize: 14,
                        background: 'transparent', border: '1px solid #334155', color: '#94A3B8',
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' as const : 'row' as const }}>
                  <button
                    onClick={() => setShowResolveConfirm('yes')}
                    style={{
                      flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: '#2ED573', color: '#fff', fontWeight: 700, fontSize: 15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <CheckCircle size={18} /> {t('predictions.resolve_yes')}
                  </button>
                  <button
                    onClick={() => setShowResolveConfirm('no')}
                    style={{
                      flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: '#FF4757', color: '#fff', fontWeight: 700, fontSize: 15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <XCircle size={18} /> {t('predictions.resolve_no')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Waiting for admin banner (official predictions) */}
          {isActive && (prediction.mode ?? 'official') === 'official' && !(user?.is_admin) && (
            <div style={{
              padding: 14, borderRadius: 12, marginBottom: 16,
              background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Shield size={16} color="#00D4FF" />
              <span style={{ color: '#94A3B8', fontSize: 13 }}>{t('predictions.waiting_admin')}</span>
            </div>
          )}

          {/* Dispute Section (unofficial, resolved, within 24h) */}
          {(prediction.mode ?? 'official') === 'unofficial'
            && (prediction.status === 'resolved_yes' || prediction.status === 'resolved_no')
            && isAuthenticated
            && userHasBet
            && getDisputeHoursLeft() > 0
            && !disputes.some(d => d.user_id === user?.id)
            && (
            <div style={{
              padding: 20, borderRadius: 12, marginBottom: 16,
              background: 'rgba(224,64,251,0.05)', border: '1px solid rgba(224,64,251,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={18} color="#E040FB" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#E040FB' }}>
                  {t('predictions.dispute_title')}
                </span>
              </div>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                {t('predictions.dispute_desc')}
              </p>
              <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>
                {t('predictions.dispute_window', { hours: getDisputeHoursLeft() })}
              </p>
              {user?.id === prediction.creator_id && (
                <p style={{ color: '#F59E0B', fontSize: 12, marginBottom: 12, background: 'rgba(245,158,11,0.08)', padding: '8px 12px', borderRadius: 8 }}>
                  {t('predictions.creator_vote_notice')}
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' as const : 'row' as const }}>
                <button
                  onClick={() => handleDispute('yes')}
                  disabled={disputing}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#2ED573', color: '#fff', fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: disputing ? 0.5 : 1,
                  }}
                >
                  <ThumbsUp size={16} /> {t('predictions.dispute_vote_yes')}
                </button>
                <button
                  onClick={() => handleDispute('no')}
                  disabled={disputing}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#FF4757', color: '#fff', fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: disputing ? 0.5 : 1,
                  }}
                >
                  <ThumbsDown size={16} /> {t('predictions.dispute_vote_no')}
                </button>
              </div>
            </div>
          )}

          {/* Dispute status banner */}
          {prediction.disputed && disputes.length > 0 && (
            <div style={{
              padding: 14, borderRadius: 12, marginBottom: 16,
              background: 'rgba(224,64,251,0.05)', border: '1px solid rgba(224,64,251,0.15)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <AlertTriangle size={16} color="#E040FB" />
              <div>
                <div style={{ color: '#E040FB', fontWeight: 600, fontSize: 13 }}>
                  {t('predictions.disputed_banner')}
                </div>
                <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                  {t('predictions.dispute_votes', {
                    yes: disputes.filter(d => d.vote === 'yes').length,
                    no: disputes.filter(d => d.vote === 'no').length,
                  })}
                  {getDisputeHoursLeft() > 0
                    ? ` · ${t('predictions.dispute_window', { hours: getDisputeHoursLeft() })}`
                    : ` · ${t('predictions.dispute_window_closed')}`
                  }
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {isActive && isAuthenticated && (
            <button onClick={() => setBetOpen(true)} style={{
              width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <TrendingUp size={18} /> {t('predictions.place_bet')}
            </button>
          )}
          {isActive && !isAuthenticated && (
            <Link to="/login" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '16px 0', borderRadius: 12, textDecoration: 'none',
              background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
            }}>
              <TrendingUp size={18} /> {t('predictions.login_to_bet')}
            </Link>
          )}
        </div>
      </motion.div>

      <BetModal
        isOpen={betOpen}
        onClose={() => setBetOpen(false)}
        prediction={prediction}
        onBetPlaced={handleBet}
      />
      <PredictionComments predictionId={prediction.id} />

      {/* Share Modal */}
      {shareOpen && (
        <ShareModal
          prediction={prediction}
          onClose={() => setShareOpen(false)}
          t={t}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#0B1120', borderRadius: 12, padding: 16, textAlign: 'center' }}>
      <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: 22, color }}>{value}</div>
    </div>
  );
}

function ShareModal({ prediction, onClose, t, isMobile }: {
  prediction: Prediction;
  onClose: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
  isMobile: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const pool = prediction.total_pool ?? 0;
  const pct = pool > 0 ? Math.round(((prediction.total_yes ?? 0) / pool) * 100) : 50;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t('common.link_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `PlotTwist: ${prediction.title}`,
          text: `${prediction.title} — ${t('common.share_text')} ${pool.toLocaleString()} TC`,
          url,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const shareText = encodeURIComponent(`${prediction.title} — PlotTwist`);
  const shareUrl = encodeURIComponent(url);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#141C2B',
          border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          width: '100%',
          maxWidth: 440,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#E2E8F0' }}>
            {t('common.share')}
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={16} color="#94A3B8" />
          </button>
        </div>

        {/* Preview Card */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1C2538 0%, #0F172A 100%)',
            border: '1px solid rgba(255,214,10,0.12)',
            borderRadius: 14, padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #FFD60A, #F0AA00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bangers', cursive", fontSize: 14, color: '#0B1120',
              }}>
                PT
              </div>
              <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600 }}>PlotTwist</span>
              {prediction.visibility === 'private' && <Lock size={11} color="#F59E0B" />}
            </div>
            <h4 style={{ color: '#E2E8F0', fontSize: 15, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.35 }}>
              {prediction.title}
            </h4>
            <div style={{
              height: 4, borderRadius: 2, overflow: 'hidden',
              display: 'flex', background: '#1C2538', marginBottom: 8,
            }}>
              <div style={{ width: `${pct}%`, background: '#22c55e' }} />
              <div style={{ width: `${100 - pct}%`, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#FFD60A', fontWeight: 700 }}>
                {pool.toLocaleString()} TC
              </span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{pct}% YES</span>
            </div>
          </div>

          {/* Link box */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0B1120', borderRadius: 12, padding: '10px 14px',
            border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16,
          }}>
            <span style={{
              flex: 1, fontSize: 13, color: '#64748B',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {url}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#22c55e' : '#FFD60A', border: 'none', borderRadius: 8,
                padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontWeight: 700, fontSize: 12, color: '#0B1120',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <Copy size={13} />
              {copied ? '✓' : t('common.copy')}
            </button>
          </div>

          {/* Share buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <ShareBtn
              label="WhatsApp"
              color="#25D366"
              href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
              icon={<MessageCircle size={20} />}
            />
            <ShareBtn
              label="Telegram"
              color="#26A5E4"
              href={`https://t.me/share/url?url=${shareUrl}&text=${shareText}`}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.98 1.26-5.59 3.7-.53.36-1.01.54-1.43.53-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.65-2.89 7.99-3.44 3.81-1.58 4.6-1.86 5.12-1.87.11 0 .37.03.53.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/></svg>}
            />
            <ShareBtn
              label="X"
              color="#fff"
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
            />
            {typeof navigator.share === 'function' && (
              <button
                onClick={handleNativeShare}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '12px 4px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(148,163,184,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Share2 size={20} color="#94A3B8" />
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{t('common.more')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Pull indicator on mobile */}
        {isMobile && (
          <div style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ShareBtn({ label, color, href, icon }: { label: string; color: string; href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '12px 4px', borderRadius: 12, textDecoration: 'none',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{label}</span>
    </a>
  );
}
