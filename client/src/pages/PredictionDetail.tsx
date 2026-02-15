import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords, TrendingUp } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import BetModal from '../components/BetModal';
import ChallengeModal from '../components/ChallengeModal';
import type { Prediction } from '../types';
import toast from 'react-hot-toast';

export default function PredictionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [betOpen, setBetOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
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
    try {
      // Insert bet
      const { error: betError } = await supabase.from('bets').insert({
        user_id: user.id,
        prediction_id: prediction.id,
        position,
        amount,
      });
      if (betError) throw betError;

      // Update prediction totals
      await supabase.rpc('increment_prediction_total', {
        pred_id: prediction.id,
        field_name: position === 'yes' ? 'total_yes' : 'total_no',
        increment_amount: amount,
      });

      // Deduct coins
      await supabase.rpc('increment_coins', {
        user_id_param: user.id,
        amount_param: -amount,
      });

      toast.success(t('predictions.bet_placed', { position: position.toUpperCase(), amount }));
      fetchPrediction();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to place bet');
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
        onChallengeSent={() => setChallengeOpen(false)}
      />
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
