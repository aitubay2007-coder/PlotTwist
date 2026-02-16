import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

interface PredictionOption {
  id: string;
  title: string;
}

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictionId?: string;
  predictions?: PredictionOption[];
  onChallengeSent: (params: {
    opponentUsername: string;
    predictionId: string;
    position: 'yes' | 'no';
    amount: number;
  }) => void | Promise<void>;
}

const MIN_AMOUNT = 10;

export default function ChallengeModal({
  isOpen,
  onClose,
  predictionId,
  predictions = [],
  onChallengeSent,
}: ChallengeModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [opponentUsername, setOpponentUsername] = useState('');
  const [selectedPredictionId, setSelectedPredictionId] = useState(predictionId ?? '');
  const [position, setPosition] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState(MIN_AMOUNT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxAmount = user?.coins ?? 0;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleClose = () => {
    setOpponentUsername('');
    setSelectedPredictionId(predictionId ?? '');
    setPosition('yes');
    setAmount(MIN_AMOUNT);
    onClose();
  };

  const handleSend = async () => {
    const pid = predictionId ?? selectedPredictionId;
    if (!opponentUsername.trim() || !pid || amount < MIN_AMOUNT) return;
    setIsSubmitting(true);
    try {
      await onChallengeSent({
        opponentUsername: opponentUsername.trim().replace(/^@/, ''),
        predictionId: pid,
        position,
        amount,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSend =
    opponentUsername.trim().length > 0 &&
    (predictionId || selectedPredictionId) &&
    amount >= MIN_AMOUNT &&
    amount <= maxAmount;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
              borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 24, color: '#FFD60A', margin: 0 }}>
                {t('challenges.send')}
              </h2>
              <button
                onClick={handleClose}
                style={{
                  padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#64748B',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Opponent */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('challenges.select_user')}</label>
              <input
                type="text"
                value={opponentUsername}
                onChange={(e) => setOpponentUsername(e.target.value)}
                placeholder="@username"
                style={inputStyle}
              />
            </div>

            {/* Prediction selector (when predictionId not provided) */}
            {!predictionId && predictions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('challenges.select_prediction')}</label>
                <select
                  value={selectedPredictionId}
                  onChange={(e) => setSelectedPredictionId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">{t('challenges.select_prediction')}</option>
                  {predictions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Position selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('challenges.your_position')}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setPosition('yes')}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                    background: position === 'yes' ? '#2ED573' : 'rgba(46,213,115,0.15)',
                    color: position === 'yes' ? '#fff' : '#2ED573',
                  }}
                >
                  {t('predictions.vote_yes')}
                </button>
                <button
                  onClick={() => setPosition('no')}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                    background: position === 'no' ? '#FF4757' : 'rgba(255,71,87,0.15)',
                    color: position === 'no' ? '#fff' : '#FF4757',
                  }}
                >
                  {t('predictions.vote_no')}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{t('challenges.amount')}</label>
              <input
                type="number"
                min={MIN_AMOUNT}
                max={maxAmount}
                value={amount}
                onChange={(e) => setAmount(Math.max(MIN_AMOUNT, Math.min(maxAmount, Number(e.target.value) || MIN_AMOUNT)))}
                style={inputStyle}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ color: '#64748B', fontSize: 12 }}>
                  {t('predictions.amount_range', { min: MIN_AMOUNT, max: maxAmount })}
                </span>
                <span style={{ color: '#FFD60A', fontSize: 12, fontWeight: 600 }}>
                  {t('predictions.your_balance')}: {maxAmount.toLocaleString()}
                </span>
              </div>
              {amount > maxAmount && (
                <p style={{ color: '#FF4757', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                  {t('predictions.insufficient_coins')}
                </p>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!canSend || isSubmitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: canSend && !isSubmitting ? '#FFD60A' : '#1C2538',
                color: canSend && !isSubmitting ? '#0B1120' : '#64748B',
                fontWeight: 700, fontSize: 16,
                opacity: isSubmitting ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              {isSubmitting ? t('common.loading') : t('challenges.send_btn')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
