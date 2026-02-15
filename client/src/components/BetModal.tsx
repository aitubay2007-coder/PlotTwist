import { useState } from 'react';
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
  const maxBet = maxCoins; // Can only bet what you have

  const [position, setPosition] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState(MIN_BET);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset amount when modal opens or balance changes
  if (isOpen && amount > maxBet && maxBet >= MIN_BET) {
    setAmount(maxBet);
  } else if (isOpen && amount > maxBet) {
    setAmount(MIN_BET);
  }

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
    } finally {
      setIsSubmitting(false);
    }
  };

  // Potential winnings: if YES wins, return = amount * (total_pool + amount) / (total_yes + amount) - amount
  const totalPool = prediction.total_yes + prediction.total_no;
  const potentialReturn =
    position === 'yes'
      ? amount * ((totalPool + amount) / (prediction.total_yes + amount || 1))
      : position === 'no'
        ? amount * ((totalPool + amount) / (prediction.total_no + amount || 1))
        : 0;
  const potentialProfit = potentialReturn > 0 ? potentialReturn - amount : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-pt-card border border-pt-yellow/20 rounded-xl p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-pt-white pr-8 line-clamp-2">
                {prediction.title}
              </h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-md text-pt-gray hover:text-pt-white hover:bg-pt-dark transition -mt-1"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* YES / NO buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setPosition('yes')}
                className={`flex-1 py-4 rounded-lg font-bold text-lg transition ${
                  position === 'yes'
                    ? 'bg-pt-green text-pt-black ring-2 ring-pt-green ring-offset-2 ring-offset-pt-card'
                    : 'bg-pt-green/20 text-pt-green hover:bg-pt-green/30'
                }`}
              >
                {t('predictions.vote_yes')}
              </button>
              <button
                onClick={() => setPosition('no')}
                className={`flex-1 py-4 rounded-lg font-bold text-lg transition ${
                  position === 'no'
                    ? 'bg-pt-red text-pt-white ring-2 ring-pt-red ring-offset-2 ring-offset-pt-card'
                    : 'bg-pt-red/20 text-pt-red hover:bg-pt-red/30'
                }`}
              >
                {t('predictions.vote_no')}
              </button>
            </div>

            {/* Balance display */}
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm text-pt-gray">{t('predictions.your_balance')}</span>
              <span className="text-sm font-bold" style={{ color: canBet ? '#FFD60A' : '#FF4757' }}>
                {maxCoins.toLocaleString()} {t('common.coins_short')}
              </span>
            </div>

            {!canBet ? (
              <div className="text-center py-4 mb-4" style={{ background: 'rgba(255,71,87,0.1)', borderRadius: 10 }}>
                <p className="text-pt-red text-sm font-semibold">{t('predictions.insufficient_coins')}</p>
              </div>
            ) : (
              <>
                {/* Amount slider */}
                <div className="mb-4">
                  <label className="block text-sm text-pt-gray mb-2">
                    {t('predictions.amount')} ({t('predictions.amount_range', { min: MIN_BET, max: maxBet })})
                  </label>
                  <input
                    type="range"
                    min={MIN_BET}
                    max={maxBet}
                    value={Math.min(amount, maxBet)}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full h-2 bg-pt-dark rounded-lg appearance-none cursor-pointer accent-pt-yellow"
                  />
                  <div className="flex justify-between mt-1 text-sm">
                    <span className="text-pt-gray">{MIN_BET}</span>
                    <span className="text-pt-yellow font-medium">{amount}</span>
                    <span className="text-pt-gray">{maxBet}</span>
                  </div>
                </div>

                {/* Potential winnings */}
                {position && amount >= MIN_BET && (
                  <p className="text-sm text-pt-gray-light mb-4">
                    {t('predictions.potential_winnings')}:{' '}
                    <span className="text-pt-green font-medium">
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
              className="w-full py-3 bg-pt-yellow text-pt-black font-bold rounded-lg hover:bg-pt-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? t('common.loading') : t('predictions.confirm_bet')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
