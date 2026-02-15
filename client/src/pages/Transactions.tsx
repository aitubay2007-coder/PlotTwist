import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Gift, Swords, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Coins; color: string; sign: '+' | '-' }> = {
  signup_bonus: { icon: Gift, color: '#2ED573', sign: '+' },
  daily_bonus: { icon: Gift, color: '#2ED573', sign: '+' },
  bet_placed: { icon: TrendingDown, color: '#FF4757', sign: '-' },
  bet_won: { icon: TrendingUp, color: '#2ED573', sign: '+' },
  challenge_sent: { icon: Swords, color: '#FF4757', sign: '-' },
  challenge_accepted: { icon: Swords, color: '#FF4757', sign: '-' },
  challenge_won: { icon: Swords, color: '#2ED573', sign: '+' },
  challenge_refund: { icon: Swords, color: '#FFD60A', sign: '+' },
};

export default function Transactions() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isAuthenticated && user) fetchTransactions();
    else setLoading(false);
  }, [isAuthenticated, user]);

  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setTransactions(data || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <Coins size={64} color="#64748B" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('profile.login_required')}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <Link to="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#64748B', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: '0 0 32px', textShadow: '2px 2px 0 #000' }}>
        {t('transactions.title')}
      </h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 64, background: '#141C2B', borderRadius: 12, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Coins size={64} color="#64748B" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#64748B', fontSize: 18 }}>{t('transactions.empty')}</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transactions.map((tx, i) => {
            const cfg = TYPE_CONFIG[tx.type] || { icon: Target, color: '#64748B', sign: '+' as const };
            const IconComp = cfg.icon;
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
                  borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${cfg.color}15`,
                }}>
                  <IconComp size={20} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500 }}>
                    {t(`transactions.type_${tx.type}`, { defaultValue: tx.description || tx.type })}
                  </div>
                  <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                    {new Date(tx.created_at).toLocaleDateString()} · {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{
                  fontSize: isMobile ? 16 : 18, fontWeight: 700,
                  color: cfg.sign === '+' ? '#2ED573' : '#FF4757',
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.sign}{Math.abs(tx.amount).toLocaleString()} {t('common.coins_short')}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
