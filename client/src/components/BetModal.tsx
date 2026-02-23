import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: { id: string; title: string; total_yes: number; total_no: number };
  onBetPlaced: (outcome: 'yes' | 'no', amount: number) => void | Promise<void>;
}

const MIN_BET = 10;

export default function BetModal({ isOpen, onClose, prediction, onBetPlaced }: BetModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const maxCoins = user?.coins_balance ?? 0;
  const canBet = maxCoins >= MIN_BET;

  const [outcome, setOutcome] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState(MIN_BET);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && amount > maxCoins) {
      setAmount(maxCoins >= MIN_BET ? maxCoins : MIN_BET);
    }
  }, [isOpen, maxCoins, amount]);

  const handleClose = () => { setOutcome(null); setAmount(MIN_BET); onClose(); };

  const handleConfirm = async () => {
    if (!canBet || !outcome || amount < MIN_BET || amount > maxCoins) return;
    setIsSubmitting(true);
    try {
      await onBetPlaced(outcome, amount);
      handleClose();
    } catch {
      // error shown by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPool = prediction.total_yes + prediction.total_no;
  const potentialReturn = outcome
    ? amount * ((totalPool + amount) / Math.max((outcome === 'yes' ? prediction.total_yes : prediction.total_no) + amount, 1))
    : 0;
  const potentialProfit = potentialReturn > 0 ? potentialReturn - amount : 0;
  const sliderMax = Math.max(MIN_BET, maxCoins);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
              borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0, paddingRight: 16, lineHeight: 1.4 }}>
                {prediction.title}
              </h2>
              <button onClick={handleClose} style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            {/* YES / NO */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {(['yes', 'no'] as const).map(o => (
                <button key={o} onClick={() => setOutcome(o)} style={{
                  flex: 1, padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 16, transition: 'all 0.2s',
                  background: outcome === o ? (o === 'yes' ? '#2ED573' : '#FF4757') : (o === 'yes' ? 'rgba(46,213,115,0.15)' : 'rgba(255,71,87,0.15)'),
                  color: outcome === o ? '#fff' : (o === 'yes' ? '#2ED573' : '#FF4757'),
                }}>
                  {o.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>{t('predictions.your_balance')}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: canBet ? '#FFD60A' : '#FF4757' }}>
                {maxCoins.toLocaleString()} {t('common.coins')}
              </span>
            </div>

            {!canBet ? (
              <div style={{ textAlign: 'center', padding: 16, marginBottom: 16, background: 'rgba(255,71,87,0.1)', borderRadius: 10 }}>
                <p style={{ color: '#FF4757', fontSize: 14, fontWeight: 600, margin: 0 }}>{t('predictions.insufficient_coins')}</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    {t('predictions.amount')}
                  </label>
                  <input type="range" min={MIN_BET} max={sliderMax} value={Math.min(amount, sliderMax)}
                    onChange={e => setAmount(Number(e.target.value))}
                    style={{ width: '100%', height: 8, cursor: 'pointer', accentColor: '#FFD60A' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
                    <span style={{ color: '#64748B' }}>{MIN_BET}</span>
                    <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 18 }}>{amount}</span>
                    <span style={{ color: '#64748B' }}>{maxCoins}</span>
                  </div>
                </div>

                {outcome && amount >= MIN_BET && (
                  <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>
                    {t('predictions.potential_winnings')}:{' '}
                    <span style={{ color: '#2ED573', fontWeight: 600 }}>+{potentialProfit.toFixed(0)} {t('common.coins')}</span>
                  </p>
                )}
              </>
            )}

            <button onClick={handleConfirm}
              disabled={!canBet || !outcome || amount < MIN_BET || isSubmitting}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 16, transition: 'all 0.2s',
                background: (canBet && outcome && !isSubmitting) ? '#FFD60A' : '#1C2538',
                color: (canBet && outcome && !isSubmitting) ? '#0B1120' : '#64748B',
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
