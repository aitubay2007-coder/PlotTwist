import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
  const [opponentUsername, setOpponentUsername] = useState('');
  const [selectedPredictionId, setSelectedPredictionId] = useState(predictionId ?? '');
  const [position, setPosition] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState(MIN_AMOUNT);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        opponentUsername: opponentUsername.trim(),
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
    amount >= MIN_AMOUNT;

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
              <h2 className="text-xl font-semibold text-pt-yellow">
                {t('challenges.send')}
              </h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-md text-pt-gray hover:text-pt-white hover:bg-pt-dark transition -mt-1"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opponent search */}
            <div className="mb-4">
              <label className="block text-sm text-pt-gray mb-2">
                {t('challenges.select_user')}
              </label>
              <input
                type="text"
                value={opponentUsername}
                onChange={(e) => setOpponentUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-2.5 bg-pt-dark border border-pt-yellow/20 rounded-lg text-pt-white placeholder-pt-gray focus:outline-none focus:ring-2 focus:ring-pt-yellow/50"
              />
            </div>

            {/* Prediction selector (when predictionId not provided) */}
            {!predictionId && predictions.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm text-pt-gray mb-2">
                  {t('challenges.select_prediction')}
                </label>
                <select
                  value={selectedPredictionId}
                  onChange={(e) => setSelectedPredictionId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-pt-dark border border-pt-yellow/20 rounded-lg text-pt-white focus:outline-none focus:ring-2 focus:ring-pt-yellow/50"
                >
                  <option value="">{t('challenges.select_prediction')}</option>
                  {predictions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Position selector */}
            <div className="mb-4">
              <label className="block text-sm text-pt-gray mb-2">
                {t('challenges.your_position')}
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setPosition('yes')}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition ${
                    position === 'yes'
                      ? 'bg-pt-green text-pt-black'
                      : 'bg-pt-green/20 text-pt-green hover:bg-pt-green/30'
                  }`}
                >
                  {t('predictions.vote_yes')}
                </button>
                <button
                  onClick={() => setPosition('no')}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition ${
                    position === 'no'
                      ? 'bg-pt-red text-pt-white'
                      : 'bg-pt-red/20 text-pt-red hover:bg-pt-red/30'
                  }`}
                >
                  {t('predictions.vote_no')}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-6">
              <label className="block text-sm text-pt-gray mb-2">
                {t('challenges.amount')}
              </label>
              <input
                type="number"
                min={MIN_AMOUNT}
                value={amount}
                onChange={(e) => setAmount(Math.max(MIN_AMOUNT, Number(e.target.value) || MIN_AMOUNT))}
                className="w-full px-4 py-2.5 bg-pt-dark border border-pt-yellow/20 rounded-lg text-pt-white focus:outline-none focus:ring-2 focus:ring-pt-yellow/50"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!canSend || isSubmitting}
              className="w-full py-3 bg-pt-yellow text-pt-black font-bold rounded-lg hover:bg-pt-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? t('common.loading') : t('challenges.send_btn')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
