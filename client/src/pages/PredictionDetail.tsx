import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords, TrendingUp, CheckCircle, XCircle, Trophy, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import BetModal from '../components/BetModal';
import ChallengeModal from '../components/ChallengeModal';
import PredictionComments from '../components/PredictionComments';
import type { Prediction } from '../types';
import { awardClanXP } from '../lib/clanXP';
import toast from 'react-hot-toast';

export default function PredictionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isAuthenticated, user, fetchProfile, adjustCoins } = useAuthStore();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [betOpen, setBetOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState<'yes' | 'no' | null>(null);
  const isMobile = useIsMobile();

  const fetchPrediction = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*, shows(title, poster_url, category), profiles(username, avatar_url)')
        .eq('id', id)
        .single();

      if (error || !data) {
        setPrediction(null);
      } else {
        setPrediction(data as unknown as Prediction);
      }
    } catch {
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrediction(); }, [id]);

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
      const result = data as { success?: boolean; error?: string };
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Instantly update coins in UI
      adjustCoins(-amount);

      // Award clan XP (+5) for placing a bet
      awardClanXP(user.id, 5);

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

  const yesPercent = prediction.total_pool > 0 ? (prediction.total_yes / prediction.total_pool) * 100 : 50;
  const noPercent = 100 - yesPercent;
  const deadline = new Date(prediction.deadline);
  const isExpired = deadline < new Date();
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
            {prediction.shows && (
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(255,214,10,0.15)', color: '#FFD60A', padding: '4px 12px', borderRadius: 20 }}>
                {prediction.shows.category} — {prediction.shows.title}
              </span>
            )}
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
            <StatBox label={t('predictions.pool')} value={prediction.total_pool.toLocaleString()} color="#FFD60A" />
            <StatBox label={t('predictions.vote_yes')} value={prediction.total_yes.toLocaleString()} color="#2ED573" />
            <StatBox label={t('predictions.vote_no')} value={prediction.total_no.toLocaleString()} color="#FF4757" />
            <StatBox label={t('predictions.deadline')} value={deadline.toLocaleDateString()} color="#E2E8F0" />
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

          {/* Resolve Section (creator only) */}
          {isActive && isAuthenticated && user?.id === prediction.creator_id && (
            <div style={{
              padding: 20, borderRadius: 12, marginBottom: 16,
              background: 'rgba(255,214,10,0.05)',
              border: '1px solid rgba(255,214,10,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={18} color="#FFD60A" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#FFD60A' }}>
                  {t('predictions.resolve_title')}
                </span>
              </div>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                {t('predictions.resolve_desc')}
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
                      {resolving ? t('common.loading') : t('predictions.confirm')}
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

          {/* Actions */}
          {isActive && isAuthenticated && (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' as const : 'row' as const, gap: 12 }}>
              <button onClick={() => setBetOpen(true)} style={{
                flex: 1, padding: '16px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <TrendingUp size={18} /> {t('predictions.place_bet')}
              </button>
              <button onClick={() => setChallengeOpen(true)} style={{
                flex: 1, padding: '16px 0', borderRadius: 12, cursor: 'pointer',
                background: 'transparent', border: '2px solid #FFD60A', color: '#FFD60A', fontWeight: 700, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Swords size={18} /> {t('challenges.send')}
              </button>
            </div>
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
      <ChallengeModal
        isOpen={challengeOpen}
        onClose={() => setChallengeOpen(false)}
        predictionId={prediction.id}
        onChallengeSent={async (params) => {
          if (!user) return;
          try {
            // Look up opponent by username
            const { data: opponent, error: lookupErr } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', params.opponentUsername)
              .single();
            if (lookupErr || !opponent) {
              toast.error(t('challenges.user_not_found'));
              return;
            }
            if (opponent.id === user.id) {
              toast.error(t('challenges.cant_challenge_self'));
              return;
            }

            // Check balance client-side
            if (params.amount > user.coins) {
              toast.error(t('predictions.insufficient_coins'));
              return;
            }

            // Deduct coins FIRST (atomic, will fail if insufficient)
            const { error: deductErr } = await supabase.rpc('increment_coins', {
              user_id_param: user.id,
              amount_param: -params.amount,
            });
            if (deductErr) {
              toast.error(t('predictions.insufficient_coins'));
              return;
            }

            // Insert challenge (coins already deducted)
            const { error: insertErr } = await supabase.from('challenges').insert({
              challenger_id: user.id,
              challenged_id: opponent.id,
              prediction_id: params.predictionId,
              challenger_position: params.position,
              challenged_position: params.position === 'yes' ? 'no' : 'yes',
              amount: params.amount,
              status: 'pending',
            });
            if (insertErr) {
              // Refund coins if insert failed
              await supabase.rpc('increment_coins', {
                user_id_param: user.id,
                amount_param: params.amount,
              });
              throw insertErr;
            }

            // Log transaction
            await supabase.from('transactions').insert({
              user_id: user.id,
              type: 'challenge_sent',
              amount: params.amount,
              description: 'Challenge sent',
            });

            adjustCoins(-params.amount);
            toast.success(t('challenges.sent_success'));
            setChallengeOpen(false);
          } catch {
            toast.error(t('challenges.failed'));
          }
        }}
      />

      <PredictionComments predictionId={prediction.id} />
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
