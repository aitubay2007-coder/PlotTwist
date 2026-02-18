import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Trophy, Coins } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import type { Profile } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Leaderboard() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase.from('profiles').select('*').order('coins', { ascending: false }).limit(50),
          8000
        );
        if (error) {
          setPlayers(getDemoLeaderboard());
        } else if (!data || data.length === 0) {
          setPlayers(getDemoLeaderboard());
        } else {
          setPlayers(data as Profile[]);
        }
      } catch {
        setPlayers(getDemoLeaderboard());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{
        fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: '0 0 32px',
        display: 'flex', alignItems: 'center', gap: 12, textShadow: '2px 2px 0 #000',
      }}>
        <Trophy size={40} />
        {t('leaderboard.title')}
      </h1>

      <div style={{ background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 80px' : '60px 1fr 120px',
          padding: isMobile ? '12px 12px' : '16px 24px', borderBottom: '1px solid rgba(255,214,10,0.1)',
          color: '#64748B', fontSize: 13, fontWeight: 600,
        }}>
          <div>{t('leaderboard.rank')}</div>
          <div>{t('leaderboard.player')}</div>
          <div style={{ textAlign: 'right' }}>{t('leaderboard.coins')}</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 56, background: '#0B1120', borderRadius: 10, animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: '#64748B', fontSize: 14 }}>{t('leaderboard.no_results')}</p>
          </div>
        ) : (
          <div>
            {players.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 80px' : '60px 1fr 120px',
                  padding: isMobile ? '12px 12px' : '16px 24px', alignItems: 'center',
                  borderBottom: i < players.length - 1 ? '1px solid rgba(255,214,10,0.05)' : 'none',
                  background: i === 0 ? 'rgba(255,214,10,0.03)' : 'transparent',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(11,17,32,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'rgba(255,214,10,0.03)' : 'transparent')}
              >
                <div>
                  <span style={{
                    fontFamily: "'Bangers', cursive", fontSize: 20,
                    color: i === 0 ? '#FFD60A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#64748B',
                  }}>
                    {i + 1}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: isMobile ? 28 : 40, height: isMobile ? 28 : 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                    background: i === 0 ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                    color: i === 0 ? '#0B1120' : '#FFD60A',
                  }}>
                    {player.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span style={{ color: '#E2E8F0', fontWeight: 500 }}>@{player.username}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <Coins size={16} color="#FFD60A" />
                  <span style={{ color: '#FFD60A', fontWeight: 700 }}>{(player.coins ?? 0).toLocaleString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getDemoLeaderboard(): Profile[] {
  return [
    { id: '1', username: 'NakamaCrew', display_name: null, avatar_url: null, coins: 125000, reputation: 9850, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '2', username: 'KDramaKing', display_name: null, avatar_url: null, coins: 98000, reputation: 8720, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '3', username: 'MMAExpert', display_name: null, avatar_url: null, coins: 87000, reputation: 7650, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '4', username: 'WinterIsComing', display_name: null, avatar_url: null, coins: 76000, reputation: 6890, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '5', username: 'GrandLineGuru', display_name: null, avatar_url: null, coins: 65000, reputation: 6340, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '6', username: 'YeezyFan', display_name: null, avatar_url: null, coins: 54000, reputation: 5120, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '7', username: 'AnimeOracle', display_name: null, avatar_url: null, coins: 48000, reputation: 4870, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '8', username: 'PlotMaster', display_name: null, avatar_url: null, coins: 42000, reputation: 4350, country: null, created_at: '', last_daily_bonus: null, is_admin: false },
  ];
}
