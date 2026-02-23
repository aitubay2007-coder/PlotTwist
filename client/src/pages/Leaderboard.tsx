import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Trophy, Coins } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

interface LeaderEntry {
  id: string;
  username: string;
  coins_balance: number;
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    withTimeout(
      supabase.from('profiles').select('id, username, coins_balance')
        .order('coins_balance', { ascending: false }).limit(50),
      8000
    ).then(({ data }) => {
      setEntries((data || []) as LeaderEntry[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <h1 style={{
        fontFamily: "'Bangers', cursive", fontSize: isMobile ? 28 : 36,
        color: '#FFD60A', margin: '0 0 24px', letterSpacing: 1.5,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Trophy size={28} /> {t('nav.leaderboard')}
      </h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 56, background: '#141C2B', borderRadius: 12, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Trophy size={48} color="#334155" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B' }}>{t('leaderboard.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((e, i) => {
            const isMe = e.id === user?.id;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12,
                  background: isMe ? 'rgba(255,214,10,0.06)' : '#141C2B',
                  border: isMe ? '1px solid rgba(255,214,10,0.2)' : '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <div style={{
                  width: 32, minWidth: 32, textAlign: 'center',
                  fontSize: i < 3 ? 20 : 14, fontWeight: 700,
                  color: i < 3 ? '#FFD60A' : '#64748B',
                }}>
                  {i < 3 ? medals[i] : i + 1}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isMe ? '#FFD60A' : '#1C2538',
                  color: isMe ? '#0B1120' : '#64748B',
                  fontWeight: 700, fontSize: 14,
                }}>
                  {e.username[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: isMe ? '#FFD60A' : '#E2E8F0', fontWeight: 600, fontSize: 14 }}>
                    @{e.username}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Coins size={14} color="#FFD60A" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#FFD60A' }}>
                    {e.coins_balance.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
