import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Trophy, Globe, MapPin, Coins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Leaderboard() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'global' | 'country'>('global');
  const [country, setCountry] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchLeaderboard();
  }, [tab, country]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('reputation', { ascending: false })
        .limit(50);

      if (tab === 'country' && country) {
        query = query.eq('country', country);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setPlayers(getDemoLeaderboard());
      } else {
        setPlayers(data as Profile[]);
      }
    } catch {
      setPlayers(getDemoLeaderboard());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{
        fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: '0 0 32px',
        display: 'flex', alignItems: 'center', gap: 12, textShadow: '2px 2px 0 #000',
      }}>
        <Trophy size={40} />
        {t('leaderboard.title')}
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <button
          onClick={() => setTab('global')}
          style={{
            padding: isMobile ? '10px 14px' : '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            background: tab === 'global' ? '#FFD60A' : '#141C2B',
            color: tab === 'global' ? '#0B1120' : '#64748B',
            border: tab === 'global' ? 'none' : '1px solid rgba(255,214,10,0.2)',
          }}
        >
          <Globe size={16} />
          {t('leaderboard.global')}
        </button>
        <button
          onClick={() => setTab('country')}
          style={{
            padding: isMobile ? '10px 14px' : '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            background: tab === 'country' ? '#FFD60A' : '#141C2B',
            color: tab === 'country' ? '#0B1120' : '#64748B',
            border: tab === 'country' ? 'none' : '1px solid rgba(255,214,10,0.2)',
          }}
        >
          <MapPin size={16} />
          {t('leaderboard.country')}
        </button>
      </div>

      {tab === 'country' && (
        <div style={{ marginBottom: 24 }}>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              padding: '12px 16px', borderRadius: 10, fontSize: 14,
              background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
              color: '#E2E8F0', outline: 'none',
            }}
          >
            <option value="">{t('leaderboard.all_countries')}</option>
            <option value="KZ">{t('leaderboard.kazakhstan')}</option>
            <option value="US">{t('leaderboard.united_states')}</option>
            <option value="RU">{t('leaderboard.russia')}</option>
            <option value="JP">{t('leaderboard.japan')}</option>
            <option value="KR">{t('leaderboard.south_korea')}</option>
            <option value="TR">{t('leaderboard.turkey')}</option>
            <option value="DE">{t('leaderboard.germany')}</option>
            <option value="BR">{t('leaderboard.brazil')}</option>
          </select>
        </div>
      )}

      {/* Leaderboard Table */}
      <div style={{ background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 80px' : '60px 1fr 120px 120px',
          padding: isMobile ? '12px 12px' : '16px 24px', borderBottom: '1px solid rgba(255,214,10,0.1)',
          color: '#64748B', fontSize: 13, fontWeight: 600,
        }}>
          <div>{t('leaderboard.rank')}</div>
          <div>{t('leaderboard.player')}</div>
          <div style={{ textAlign: 'right' }}>{t('leaderboard.reputation')}</div>
          <div style={{ textAlign: 'right', display: isMobile ? 'none' : undefined }}>{t('leaderboard.coins')}</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 56, background: '#0B1120', borderRadius: 10 }} />
            ))}
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
                  display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 80px' : '60px 1fr 120px 120px',
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
                  <div>
                    <span style={{ color: '#E2E8F0', fontWeight: 500 }}>@{player.username}</span>
                    {player.country && (
                      <span style={{ color: '#64748B', fontSize: 12, marginLeft: 8 }}>{player.country}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 700 }}>{player.reputation.toLocaleString()}</span>
                </div>
                {!isMobile && (
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <Coins size={16} color="#FFD60A" />
                  <span style={{ color: '#FFD60A', fontWeight: 700 }}>{player.coins.toLocaleString()}</span>
                </div>
                )}
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
    { id: '1', username: 'NakamaCrew', display_name: null, avatar_url: null, coins: 125000, reputation: 9850, country: 'JP', created_at: '' },
    { id: '2', username: 'KDramaKing', display_name: null, avatar_url: null, coins: 98000, reputation: 8720, country: 'KR', created_at: '' },
    { id: '3', username: 'MMAExpert', display_name: null, avatar_url: null, coins: 87000, reputation: 7650, country: 'KZ', created_at: '' },
    { id: '4', username: 'WinterIsComing', display_name: null, avatar_url: null, coins: 76000, reputation: 6890, country: 'US', created_at: '' },
    { id: '5', username: 'GrandLineGuru', display_name: null, avatar_url: null, coins: 65000, reputation: 6340, country: 'TR', created_at: '' },
    { id: '6', username: 'YeezyFan', display_name: null, avatar_url: null, coins: 54000, reputation: 5120, country: 'US', created_at: '' },
    { id: '7', username: 'AnimeOracle', display_name: null, avatar_url: null, coins: 48000, reputation: 4870, country: 'JP', created_at: '' },
    { id: '8', username: 'PlotMaster', display_name: null, avatar_url: null, coins: 42000, reputation: 4350, country: 'DE', created_at: '' },
    { id: '9', username: 'SeriesNerd', display_name: null, avatar_url: null, coins: 38000, reputation: 3980, country: 'BR', created_at: '' },
    { id: '10', username: 'FanTheory99', display_name: null, avatar_url: null, coins: 35000, reputation: 3650, country: 'RU', created_at: '' },
  ];
}
