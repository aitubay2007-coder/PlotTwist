import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

interface BetModalPrediction {
  id: string;
  title: string;
  total_yes: number;
  total_no: number;
}

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: BetModalPrediction;
  onBetPlaced: (position: 'yes' | 'no', amount: number) => void | Promise<void>;
}

const MIN_BET = 10;

export default function BetModal({
  isOpen,
  onClose,
  prediction,
  onBetPlaced,
}: BetModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const maxCoins = user?.coins ?? 0;
  const canBet = maxCoins >= MIN_BET;
  const maxBet = maxCoins;

  const [position, setPosition] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState(MIN_BET);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset amount when modal opens or balance changes
  useEffect(() => {
    if (isOpen && amount > maxBet) {
      setAmount(maxBet >= MIN_BET ? maxBet : MIN_BET);
    }
  }, [isOpen, maxBet, amount]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleClose = () => {
    setPosition(null);
    setAmount(MIN_BET);
    onClose();
  };

  const handleConfirm = async () => {
    if (!canBet || !position || amount < MIN_BET || amount > maxBet) return;
    setIsSubmitting(true);
    try {
      await onBetPlaced(position, amount);
      handleClose();
    } catch {
      // Error handled by parent via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPool = prediction.total_yes + prediction.total_no;
  const potentialReturn =
    position === 'yes'
      ? amount * ((totalPool + amount) / (prediction.total_yes + amount || 1))
      : position === 'no'
        ? amount * ((totalPool + amount) / (prediction.total_no + amount || 1))
        : 0;
  const potentialProfit = potentialReturn > 0 ? potentialReturn - amount : 0;

  const sliderMax = Math.max(MIN_BET, maxBet);

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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0, paddingRight: 16, lineHeight: 1.4 }}>
                {prediction.title}
              </h2>
              <button
                onClick={handleClose}
                aria-label={t('common.close')}
                style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* YES / NO buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setPosition('yes')}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 16, transition: 'all 0.2s',
                  background: position === 'yes' ? '#2ED573' : 'rgba(46,213,115,0.15)',
                  color: position === 'yes' ? '#fff' : '#2ED573',
                  boxShadow: position === 'yes' ? '0 0 0 3px rgba(46,213,115,0.3)' : 'none',
                }}
              >
                {t('predictions.vote_yes')}
              </button>
              <button
                onClick={() => setPosition('no')}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 16, transition: 'all 0.2s',
                  background: position === 'no' ? '#FF4757' : 'rgba(255,71,87,0.15)',
                  color: position === 'no' ? '#fff' : '#FF4757',
                  boxShadow: position === 'no' ? '0 0 0 3px rgba(255,71,87,0.3)' : 'none',
                }}
              >
                {t('predictions.vote_no')}
              </button>
            </div>

            {/* Balance display */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>{t('predictions.your_balance')}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: canBet ? '#FFD60A' : '#FF4757' }}>
                {maxCoins.toLocaleString()} {t('common.coins_short')}
              </span>
            </div>

            {!canBet ? (
              <div style={{
                textAlign: 'center', padding: 16, marginBottom: 16,
                background: 'rgba(255,71,87,0.1)', borderRadius: 10,
              }}>
                <p style={{ color: '#FF4757', fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {t('predictions.insufficient_coins')}
                </p>
              </div>
            ) : (
              <>
                {/* Amount slider */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    {t('predictions.amount')} ({t('predictions.amount_range', { min: MIN_BET, max: maxBet })})
                  </label>
                  <input
                    type="range"
                    min={MIN_BET}
                    max={sliderMax}
                    value={Math.min(amount, sliderMax)}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={{ width: '100%', height: 8, cursor: 'pointer', accentColor: '#FFD60A' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: '#64748B' }}>{MIN_BET}</span>
                    <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 18 }}>{amount}</span>
                    <span style={{ color: '#64748B' }}>{maxBet}</span>
                  </div>
                </div>

                {/* Potential winnings */}
                {position && amount >= MIN_BET && (
                  <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>
                    {t('predictions.potential_winnings')}:{' '}
                    <span style={{ color: '#2ED573', fontWeight: 600 }}>
                      +{potentialProfit.toFixed(0)} {t('common.coins')}
                    </span>
                  </p>
                )}
              </>
            )}

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              disabled={!canBet || !position || amount < MIN_BET || amount > maxBet || isSubmitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 16, transition: 'all 0.2s',
                background: (canBet && position && !isSubmitting) ? '#FFD60A' : '#1C2538',
                color: (canBet && position && !isSubmitting) ? '#0B1120' : '#64748B',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? t('common.loading') : t('predictions.confirm_bet')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
