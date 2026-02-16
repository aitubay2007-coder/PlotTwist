import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface PredictionOption {
  id: string;
  title: string;
}

interface UserSuggestion {
  id: string;
  username: string;
  avatar_url: string | null;
  reputation: number;
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

  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const maxAmount = user?.coins ?? 0;
  const query = opponentUsername.replace(/^@/, '').trim();

  // Dropdown is visible: has text, not dismissed after selection
  const dropdownVisible = query.length >= 1 && !dismissed;

  // Reset dismissed flag whenever user types
  useEffect(() => {
    setDismissed(false);
  }, [opponentUsername]);

  // Search users when typing
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, reputation')
          .ilike('username', `%${query}%`)
          .neq('id', user?.id ?? '')
          .order('reputation', { ascending: false })
          .limit(6);
        if (error) throw error;
        setSuggestions((data as UserSuggestion[]) || []);
      } catch (err) {
        console.error('Search error:', err);
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, user?.id]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleClose = () => {
    setOpponentUsername('');
    setSelectedPredictionId(predictionId ?? '');
    setPosition('yes');
    setAmount(MIN_AMOUNT);
    setSuggestions([]);
    setDismissed(false);
    onClose();
  };

  const handleSelectUser = (username: string) => {
    setDismissed(true);
    setOpponentUsername(username);
    setSuggestions([]);
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
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 16,
    background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
    boxSizing: 'border-box',
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
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            padding: 16, paddingTop: 40,
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
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
              overflow: 'visible', position: 'relative',
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

            {/* Opponent with autocomplete */}
            <div style={{ marginBottom: 16, position: 'relative', zIndex: 20 }}>
              <label style={labelStyle}>{t('challenges.select_user')}</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  placeholder="@username"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>

              {/* Suggestions dropdown — always rendered inline when visible */}
              {dropdownVisible && (
                <div style={{
                  background: '#1E293B', border: '2px solid #FFD60A', borderRadius: 10,
                  marginTop: 6, maxHeight: 200, overflowY: 'auto',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                }}>
                  {searchLoading && (
                    <div style={{ padding: '14px', color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                      ⏳ {t('common.loading')}
                    </div>
                  )}
                  {!searchLoading && suggestions.length === 0 && (
                    <div style={{ padding: '14px', color: '#64748B', fontSize: 13, textAlign: 'center' }}>
                      {t('challenges.user_not_found')}
                    </div>
                  )}
                  {!searchLoading && suggestions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectUser(s.username)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        background: 'transparent',
                        borderBottom: '1px solid #334155',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'rgba(255,214,10,0.2)',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(255,214,10,0.15)', color: '#FFD60A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(s.username ?? '?')[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>
                          @{s.username}
                        </div>
                        <div style={{ color: '#64748B', fontSize: 11 }}>
                          ⭐ {(s.reputation ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
