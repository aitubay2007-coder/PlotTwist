import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Globe, MapPin, Coins, Shield, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, ClanLeaderboardEntry } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { ClanBadge } from '../components/ClanBadge';

export default function Leaderboard() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [clans, setClans] = useState<ClanLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'global' | 'country' | 'clans'>('global');
  const [country, setCountry] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (tab === 'clans') {
      fetchClanLeaderboard();
    } else {
      fetchLeaderboard();
    }
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

      if (error) {
        console.error('Leaderboard fetch error:', error);
        setPlayers(getDemoLeaderboard());
      } else if (!data || data.length === 0) {
        // No real users yet — show demo as placeholder
        setPlayers(getDemoLeaderboard());
      } else {
        setPlayers(data as Profile[]);
      }
    } catch (err) {
      console.error('Leaderboard fetch failed:', err);
      setPlayers(getDemoLeaderboard());
    } finally {
      setLoading(false);
    }
  };

  const fetchClanLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_clan_leaderboard');
      if (error) {
        console.error('Clan leaderboard fetch error:', error);
        setClans(getDemoClanLeaderboard());
      } else if (!data || data.length === 0) {
        setClans(getDemoClanLeaderboard());
      } else {
        setClans(data as ClanLeaderboardEntry[]);
      }
    } catch (err) {
      console.error('Clan leaderboard fetch failed:', err);
      setClans(getDemoClanLeaderboard());
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        <TabButton
          active={tab === 'global'}
          onClick={() => setTab('global')}
          icon={<Globe size={16} />}
          label={t('leaderboard.global')}
          isMobile={isMobile}
        />
        <TabButton
          active={tab === 'country'}
          onClick={() => setTab('country')}
          icon={<MapPin size={16} />}
          label={t('leaderboard.country')}
          isMobile={isMobile}
        />
        <TabButton
          active={tab === 'clans'}
          onClick={() => setTab('clans')}
          icon={<Shield size={16} />}
          label={t('leaderboard.clans_tab')}
          isMobile={isMobile}
        />
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
        {tab === 'clans' ? (
          <ClanLeaderboardTable clans={clans} loading={loading} isMobile={isMobile} t={t} />
        ) : (
          <PlayerLeaderboardTable players={players} loading={loading} isMobile={isMobile} t={t} />
        )}
      </div>
    </div>
  );
}

/* ===== Tab Button ===== */
function TabButton({ active, onClick, icon, label, isMobile }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; isMobile: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: isMobile ? '10px 14px' : '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        background: active ? '#FFD60A' : '#141C2B',
        color: active ? '#0B1120' : '#64748B',
        border: active ? 'none' : '1px solid rgba(255,214,10,0.2)',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ===== Player Leaderboard (existing) ===== */
function PlayerLeaderboardTable({ players, loading, isMobile, t }: {
  players: Profile[]; loading: boolean; isMobile: boolean; t: (k: string) => string;
}) {
  return (
    <>
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
            <div key={i} style={{ height: 56, background: '#0B1120', borderRadius: 10, animation: 'shimmer 1.5s infinite' }} />
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
                <span style={{ color: '#E2E8F0', fontWeight: 700 }}>{(player.reputation ?? 0).toLocaleString()}</span>
              </div>
              {!isMobile && (
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <Coins size={16} color="#FFD60A" />
                  <span style={{ color: '#FFD60A', fontWeight: 700 }}>{(player.coins ?? 0).toLocaleString()}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

/* ===== Clan Leaderboard (new) ===== */
function ClanLeaderboardTable({ clans, loading, isMobile, t }: {
  clans: ClanLeaderboardEntry[]; loading: boolean; isMobile: boolean; t: (k: string) => string;
}) {
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '30px 1fr 60px' : '50px 1fr 80px 70px 100px',
        padding: isMobile ? '12px 12px' : '16px 24px', borderBottom: '1px solid rgba(255,214,10,0.1)',
        color: '#64748B', fontSize: 13, fontWeight: 600, gap: 8,
      }}>
        <div>{t('leaderboard.rank')}</div>
        <div>{t('leaderboard.clan_name')}</div>
        {!isMobile && <div style={{ textAlign: 'center' }}>{t('clans.members')}</div>}
        {!isMobile && <div style={{ textAlign: 'center' }}>{t('clans.level_label')}</div>}
        <div style={{ textAlign: 'right' }}>{t('leaderboard.rating')}</div>
      </div>

      {loading ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 56, background: '#0B1120', borderRadius: 10, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div>
          {clans.map((clan, i) => (
            <motion.div
              key={clan.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                to={`/clan/${clan.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '30px 1fr 60px' : '50px 1fr 80px 70px 100px',
                  padding: isMobile ? '12px 12px' : '16px 24px', alignItems: 'center',
                  borderBottom: i < clans.length - 1 ? '1px solid rgba(255,214,10,0.05)' : 'none',
                  background: i === 0 ? 'rgba(255,214,10,0.03)' : 'transparent',
                  transition: 'background 0.2s', textDecoration: 'none', gap: 8,
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: isMobile ? 28 : 40, height: isMobile ? 28 : 40, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 0 ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                    color: i === 0 ? '#0B1120' : '#FFD60A',
                    fontWeight: 800, fontSize: isMobile ? 12 : 16,
                    fontFamily: "'Bangers', cursive",
                  }}>
                    {clan.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        color: '#E2E8F0', fontWeight: 600, fontSize: isMobile ? 13 : 15,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {clan.name}
                      </span>
                      <ClanBadge level={clan.level ?? 1} size="sm" />
                    </div>
                    {isMobile && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        <span style={{ color: '#64748B', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Users size={10} /> {clan.member_count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!isMobile && (
                  <div style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Users size={14} /> {clan.member_count}
                  </div>
                )}
                {!isMobile && (
                  <div style={{ textAlign: 'center', color: '#E2E8F0', fontWeight: 700 }}>
                    {t('clans.level_label')} {clan.level ?? 1}
                  </div>
                )}

                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: isMobile ? 13 : 15 }}>
                    {(clan.total_reputation ?? 0).toLocaleString()}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

function getDemoLeaderboard(): Profile[] {
  return [
    { id: '1', username: 'NakamaCrew', display_name: null, avatar_url: null, coins: 125000, reputation: 9850, country: 'JP', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '2', username: 'KDramaKing', display_name: null, avatar_url: null, coins: 98000, reputation: 8720, country: 'KR', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '3', username: 'MMAExpert', display_name: null, avatar_url: null, coins: 87000, reputation: 7650, country: 'KZ', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '4', username: 'WinterIsComing', display_name: null, avatar_url: null, coins: 76000, reputation: 6890, country: 'US', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '5', username: 'GrandLineGuru', display_name: null, avatar_url: null, coins: 65000, reputation: 6340, country: 'TR', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '6', username: 'YeezyFan', display_name: null, avatar_url: null, coins: 54000, reputation: 5120, country: 'US', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '7', username: 'AnimeOracle', display_name: null, avatar_url: null, coins: 48000, reputation: 4870, country: 'JP', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '8', username: 'PlotMaster', display_name: null, avatar_url: null, coins: 42000, reputation: 4350, country: 'DE', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '9', username: 'SeriesNerd', display_name: null, avatar_url: null, coins: 38000, reputation: 3980, country: 'BR', created_at: '', last_daily_bonus: null, is_admin: false },
    { id: '10', username: 'FanTheory99', display_name: null, avatar_url: null, coins: 35000, reputation: 3650, country: 'RU', created_at: '', last_daily_bonus: null, is_admin: false },
  ];
}

function getDemoClanLeaderboard(): ClanLeaderboardEntry[] {
  return [
    { id: '1', name: 'OnePiece Nakama', description: null, xp: 12500, level: 4, created_at: '', member_count: 18, total_reputation: 45200, total_coins: 890000 },
    { id: '2', name: 'K-Drama Club', description: null, xp: 8200, level: 4, created_at: '', member_count: 14, total_reputation: 38500, total_coins: 720000 },
    { id: '3', name: 'Anime Legends', description: null, xp: 5600, level: 4, created_at: '', member_count: 22, total_reputation: 31200, total_coins: 650000 },
    { id: '4', name: 'Night Watch', description: null, xp: 3200, level: 3, created_at: '', member_count: 9, total_reputation: 24800, total_coins: 430000 },
    { id: '5', name: 'UFC Predictors', description: null, xp: 1800, level: 2, created_at: '', member_count: 7, total_reputation: 18600, total_coins: 310000 },
    { id: '6', name: 'Series Addicts', description: null, xp: 900, level: 2, created_at: '', member_count: 5, total_reputation: 12400, total_coins: 220000 },
  ];
}
