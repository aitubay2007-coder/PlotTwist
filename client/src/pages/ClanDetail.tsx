import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Copy, Crown, Trophy, TrendingUp, Coins, Target, Zap, LogOut, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { ClanBadge, ClanXPBar, ClanLevelShield } from '../components/ClanBadge';
import ClanChat from '../components/ClanChat';
import { getClanLevel } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

interface ClanMemberRow {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
    coins: number;
    reputation: number;
  } | null;
}

interface ClanDetailData {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  creator_id: string;
  xp: number;
  level: number;
  created_at: string;
  clan_members: ClanMemberRow[];
}

export default function ClanDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [clan, setClan] = useState<ClanDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (id) fetchClan();
  }, [id]);

  const fetchClan = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('id, name, description, invite_code, creator_id, xp, level, created_at, clan_members(user_id, role, joined_at, profiles(username, avatar_url, coins, reputation))')
        .eq('id', id)
        .single();

      if (error || !data) {
        setClan(null);
      } else {
        setClan(data as unknown as ClanDetailData);
      }
    } catch {
      setClan(null);
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = () => {
    if (clan?.invite_code) {
      navigator.clipboard.writeText(clan.invite_code);
      toast.success(t('clans.copy_link'));
    }
  };

  const isMember = clan?.clan_members?.some(m => m.user_id === user?.id) ?? false;
  const isCreator = clan?.creator_id === user?.id;

  const handleLeaveClan = async () => {
    if (!user || !clan) return;
    try {
      const { error } = await supabase
        .from('clan_members')
        .delete()
        .eq('clan_id', clan.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success(t('clans.left_success'));
      navigate('/clans');
    } catch {
      toast.error(t('clans.leave_failed'));
    }
    setShowLeaveConfirm(false);
  };

  const handleDeleteClan = async () => {
    if (!user || !clan) return;
    try {
      const { error } = await supabase.from('clans').delete().eq('id', clan.id);
      if (error) throw error;
      toast.success(t('clans.deleted_success'));
      navigate('/clans');
    } catch {
      toast.error(t('clans.delete_failed'));
    }
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ height: 32, background: '#1C2538', borderRadius: 8, width: '33%', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ height: 200, background: '#1C2538', borderRadius: 16, animation: 'shimmer 1.5s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 100, background: '#1C2538', borderRadius: 12, animation: 'shimmer 1.5s infinite' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!clan) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('clans.not_found')}</p>
        <Link to="/clans" style={{ color: '#FFD60A', marginTop: 16, display: 'inline-block' }}>{t('common.back')}</Link>
      </div>
    );
  }

  const sortedMembers = [...(clan.clan_members || [])].sort(
    (a, b) => (b.profiles?.reputation || 0) - (a.profiles?.reputation || 0)
  );

  const totalCoins = sortedMembers.reduce((s, m) => s + (m.profiles?.coins || 0), 0);
  const totalReputation = sortedMembers.reduce((s, m) => s + (m.profiles?.reputation || 0), 0);
  const avgReputation = sortedMembers.length > 0 ? Math.round(totalReputation / sortedMembers.length) : 0;
  const memberCount = sortedMembers.length;
  const levelInfo = getClanLevel(clan.level);

  // Clan power score (0–100 visual scale)
  const powerScore = Math.min(100, Math.round(
    (Math.min(clan.level / 5, 1) * 30) +
    (Math.min(memberCount / 20, 1) * 25) +
    (Math.min(totalReputation / 50000, 1) * 25) +
    (Math.min(clan.xp / 15000, 1) * 20)
  ));

  const top3 = sortedMembers.slice(0, 3);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>
      <Link to="/clans" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#64748B', textDecoration: 'none', marginBottom: 20, fontSize: 14 }}>
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* ===== CLAN HEADER ===== */}
        <div style={{
          background: 'linear-gradient(135deg, #141C2B 0%, #0F172A 100%)',
          border: `1px solid ${levelInfo.color}30`,
          borderRadius: 20, padding: isMobile ? 20 : 32, marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: `radial-gradient(circle, ${levelInfo.color}12, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{
            display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between', gap: 16,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 20 }}>
              <ClanLevelShield level={clan.level} size={isMobile ? 56 : 72} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontFamily: "'Bangers', cursive",
                    fontSize: isMobile ? 28 : 40, color: '#FFD60A',
                    margin: 0, lineHeight: 1.1,
                  }}>{clan.name}</h1>
                  <ClanBadge level={clan.level} size={isMobile ? 'sm' : 'md'} />
                </div>
                {clan.description && (
                  <p style={{ color: '#94A3B8', marginTop: 6, fontSize: isMobile ? 13 : 14, lineHeight: 1.4, maxWidth: 400 }}>
                    {clan.description}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 13 }}>
                    <Users size={14} /> {memberCount} {t('clans.members')}
                  </span>
                  <span style={{ color: '#334155' }}>|</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 13 }}>
                    <Zap size={14} color={levelInfo.color} /> {clan.xp.toLocaleString()} XP
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignSelf: isMobile ? 'stretch' : 'flex-start' }}>
              <button
                onClick={copyInvite}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.3)',
                  color: '#FFD60A', cursor: 'pointer', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,214,10,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,214,10,0.1)'; }}
              >
                <Copy size={16} />
                {t('clans.copy_link')}
              </button>
              {isMember && !isCreator && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
                    color: '#FF4757', cursor: 'pointer', justifyContent: 'center',
                  }}
                >
                  <LogOut size={16} />
                  {t('clans.leave')}
                </button>
              )}
              {isCreator && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
                    color: '#FF4757', cursor: 'pointer', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                  {t('clans.delete_clan')}
                </button>
              )}
            </div>
          </div>

          {/* XP Bar */}
          <div style={{ marginTop: 20 }}>
            <ClanXPBar xp={clan.xp} level={clan.level} />
          </div>
        </div>

        {/* ===== STATS GRID ===== */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 16, marginBottom: 20,
        }}>
          <StatCard
            icon={<Users size={20} />}
            label={t('clans.stat_members')}
            value={memberCount.toString()}
            accent="#3B82F6"
            isMobile={isMobile}
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label={t('clans.stat_avg_rep')}
            value={avgReputation.toLocaleString()}
            accent="#10B981"
            isMobile={isMobile}
          />
          <StatCard
            icon={<Coins size={20} />}
            label={t('clans.stat_total_coins')}
            value={totalCoins.toLocaleString()}
            accent="#FFD60A"
            isMobile={isMobile}
          />
          <StatCard
            icon={<Target size={20} />}
            label={t('clans.stat_total_rep')}
            value={totalReputation.toLocaleString()}
            accent="#E040FB"
            isMobile={isMobile}
          />
        </div>

        {/* ===== CLAN POWER + HALL OF FAME (side by side on desktop) ===== */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 12 : 20, marginBottom: 20,
        }}>
          {/* Clan Power */}
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
            borderRadius: 16, padding: isMobile ? 20 : 28,
          }}>
            <h3 style={{
              fontFamily: "'Bangers', cursive", fontSize: isMobile ? 20 : 24,
              color: '#FFD60A', margin: '0 0 16px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Zap size={20} /> {t('clans.clan_power')}
            </h3>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div style={{
                height: 14, borderRadius: 7, overflow: 'hidden',
                background: '#0B1120',
              }}>
                <div style={{
                  height: '100%', borderRadius: 7,
                  width: `${powerScore}%`,
                  background: powerScore > 80
                    ? 'linear-gradient(90deg, #FFD60A, #E040FB, #00D4FF)'
                    : powerScore > 50
                    ? 'linear-gradient(90deg, #FFD60A, #FF6B35)'
                    : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                  transition: 'width 1s ease-out',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>{t('clans.power_score')}</span>
              <span style={{
                fontFamily: "'Bangers', cursive", fontSize: 28, color: levelInfo.color,
              }}>
                {powerScore}
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: t('clans.power_level'), val: `${clan.level}/5` },
                { label: t('clans.power_members'), val: memberCount.toString() },
                { label: t('clans.xp_label'), val: clan.xp.toLocaleString() },
              ].map(item => (
                <span key={item.label} style={{
                  background: '#0B1120', padding: '4px 10px', borderRadius: 8,
                  fontSize: 11, color: '#94A3B8', fontWeight: 600,
                }}>
                  {item.label}: <span style={{ color: '#E2E8F0' }}>{item.val}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Hall of Fame */}
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
            borderRadius: 16, padding: isMobile ? 20 : 28,
          }}>
            <h3 style={{
              fontFamily: "'Bangers', cursive", fontSize: isMobile ? 20 : 24,
              color: '#FFD60A', margin: '0 0 16px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Crown size={20} /> {t('clans.hall_of_fame')}
            </h3>
            {top3.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {top3.map((member, i) => {
                  const rankColors = ['#FFD60A', '#C0C0C0', '#CD7F32'];
                  return (
                    <div key={member.user_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#0B1120', borderRadius: 12, padding: '12px 16px',
                      border: i === 0 ? `1px solid ${rankColors[0]}30` : '1px solid transparent',
                    }}>
                      <span style={{
                        fontFamily: "'Bangers', cursive", fontSize: 22,
                        color: rankColors[i] || '#64748B', width: 28, textAlign: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i === 0 ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                        color: i === 0 ? '#0B1120' : '#FFD60A',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {member.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                          @{member.profiles?.username || 'unknown'}
                          {member.role === 'admin' && <Crown size={11} color="#FFD60A" />}
                        </span>
                      </div>
                      <span style={{ color: rankColors[i] || '#64748B', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                        {(member.profiles?.reputation || 0).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#475569', fontSize: 14, textAlign: 'center', padding: 20 }}>
                {t('clans.no_members')}
              </p>
            )}
          </div>
        </div>

        {/* ===== CLAN CHAT ===== */}
        <div style={{ marginBottom: 20 }}>
          <ClanChat clanId={clan.id} />
        </div>

        {/* ===== FULL MEMBERS LIST ===== */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: 16, padding: isMobile ? 20 : 32,
        }}>
          <h2 style={{
            fontFamily: "'Bangers', cursive",
            fontSize: isMobile ? 22 : 30, color: '#FFD60A',
            margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Trophy size={22} /> {t('clans.all_members')}
          </h2>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '30px 1fr 70px' : '40px 1fr 100px 100px',
            padding: '0 12px 12px',
            borderBottom: '1px solid rgba(255,214,10,0.1)',
            color: '#475569', fontSize: 12, fontWeight: 600,
          }}>
            <div>#</div>
            <div>{t('leaderboard.player')}</div>
            <div style={{ textAlign: 'right' }}>{t('leaderboard.reputation')}</div>
            {!isMobile && <div style={{ textAlign: 'right' }}>{t('leaderboard.coins')}</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {sortedMembers.map((member, i) => (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '30px 1fr 70px' : '40px 1fr 100px 100px',
                  alignItems: 'center',
                  background: '#0B1120', borderRadius: 10, padding: '12px',
                  border: i === 0 ? '1px solid rgba(255,214,10,0.2)' : '1px solid transparent',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111827'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0B1120'; }}
              >
                <span style={{
                  fontFamily: "'Bangers', cursive", fontSize: 18,
                  color: i === 0 ? '#FFD60A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#475569',
                }}>
                  {i + 1}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 0 ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                    color: i === 0 ? '#0B1120' : '#FFD60A', fontWeight: 700, fontSize: 13,
                  }}>
                    {member.profiles?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span style={{
                    color: '#E2E8F0', fontWeight: 500, fontSize: 14,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    @{member.profiles?.username || 'unknown'}
                    {member.role === 'admin' && <Crown size={11} color="#FFD60A" />}
                  </span>
                </div>
                <div style={{ textAlign: 'right', color: '#E2E8F0', fontWeight: 700, fontSize: 13 }}>
                  {(member.profiles?.reputation || 0).toLocaleString()}
                </div>
                {!isMobile && (
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <Coins size={14} color="#FFD60A" />
                    <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 13 }}>
                      {(member.profiles?.coins || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Leave Clan Confirmation Modal */}
      {showLeaveConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setShowLeaveConfirm(false)}>
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,71,87,0.3)',
            borderRadius: 16, padding: 32, maxWidth: 420, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#E2E8F0', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              {t('clans.leave_title')}
            </h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {t('clans.leave_message')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleLeaveClan} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#FF4757', color: '#fff', fontWeight: 700, fontSize: 14,
              }}>
                {t('clans.leave_confirm')}
              </button>
              <button onClick={() => setShowLeaveConfirm(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid #334155', color: '#94A3B8', fontWeight: 700, fontSize: 14,
              }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Clan Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,71,87,0.3)',
            borderRadius: 16, padding: 32, maxWidth: 420, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#FF4757', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              {t('clans.delete_title')}
            </h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {t('clans.delete_message')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleDeleteClan} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#FF4757', color: '#fff', fontWeight: 700, fontSize: 14,
              }}>
                {t('common.delete')}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid #334155', color: '#94A3B8', fontWeight: 700, fontSize: 14,
              }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Stat Card Sub-component ---- */
function StatCard({ icon, label, value, accent, isMobile }: {
  icon: React.ReactNode; label: string; value: string; accent: string; isMobile: boolean;
}) {
  return (
    <div style={{
      background: '#141C2B', borderRadius: 14,
      padding: isMobile ? '16px 14px' : '20px 22px',
      border: `1px solid ${accent}20`,
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -12, right: -12,
        width: 60, height: 60, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}10, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ color: accent, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#94A3B8' }}>{label}</span>
      </div>
      <span style={{
        fontFamily: "'Bangers', cursive",
        fontSize: isMobile ? 22 : 28,
        color: '#E2E8F0', lineHeight: 1,
      }}>
        {value}
      </span>
    </div>
  );
}
