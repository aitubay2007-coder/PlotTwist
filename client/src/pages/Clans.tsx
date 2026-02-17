import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Link as LinkIcon, X, Search, Trophy, Crown, Zap } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';
import { ClanBadge } from '../components/ClanBadge';
import { getClanLevel } from '../types';

interface ClanRow {
  role: string;
  joined_at: string;
  clans: {
    id: string;
    name: string;
    description: string | null;
    invite_code: string;
    xp: number;
    level: number;
    created_at: string;
  };
}

interface PublicClan {
  id: string;
  name: string;
  description: string | null;
  xp: number;
  level: number;
  created_at: string;
  member_count?: number;
}

type Tab = 'my' | 'browse' | 'top';
type TopPeriod = 'week' | 'month' | 'all';

export default function Clans() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [myClans, setMyClans] = useState<ClanRow[]>([]);
  const [allClans, setAllClans] = useState<PublicClan[]>([]);
  const [topClans, setTopClans] = useState<PublicClan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanDesc, setNewClanDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<Tab>('browse');
  const [topPeriod, setTopPeriod] = useState<TopPeriod>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningClanId, setJoiningClanId] = useState<string | null>(null);
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [myMemberClanIds, setMyMemberClanIds] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (tab === 'my') fetchMyClans();
    else if (tab === 'browse') fetchAllClans();
    else if (tab === 'top') fetchTopClans();
  }, [tab, topPeriod, isAuthenticated, user]);

  const fetchMyClans = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('clan_members')
        .select('role, joined_at, clans(id, name, description, invite_code, xp, level, created_at)')
        .eq('user_id', user.id), 8000);
      if (error) throw error;
      const rows = (data as unknown as ClanRow[]) || [];
      setMyClans(rows);
      setMyMemberClanIds(new Set(rows.map(r => r.clans?.id).filter(Boolean)));
    } catch {
      setMyClans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClans = async () => {
    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase
        .from('clans')
        .select('id, name, description, xp, level, created_at')
        .order('created_at', { ascending: false })
        .limit(50), 8000);
      if (error) throw error;
      setAllClans((data as PublicClan[]) || []);

      // Also fetch user's clan memberships
      if (user) {
        const { data: memberData } = await supabase
          .from('clan_members')
          .select('clan_id')
          .eq('user_id', user.id);
        if (memberData) setMyMemberClanIds(new Set(memberData.map(m => m.clan_id)));
      }
    } catch {
      setAllClans([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopClans = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('clans')
        .select('id, name, description, xp, level, created_at')
        .order('xp', { ascending: false })
        .limit(20);

      if (topPeriod === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        query = query.gte('created_at', weekAgo);
      } else if (topPeriod === 'month') {
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        query = query.gte('created_at', monthAgo);
      }

      const { data, error } = await withTimeout(query, 8000);
      if (error) throw error;
      setTopClans((data as PublicClan[]) || []);
    } catch {
      setTopClans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoin = async (clanId: string) => {
    if (!user) {
      toast.error(t('challenges.login_required'));
      navigate('/login');
      return;
    }
    setJoiningClanId(clanId);
    try {
      const { data: existing } = await supabase
        .from('clan_members')
        .select('id')
        .eq('clan_id', clanId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast.error(t('clans.already_joined'));
        return;
      }

      const { error } = await supabase
        .from('clan_members')
        .insert({ clan_id: clanId, user_id: user.id, role: 'member' });
      if (error) throw error;

      toast.success(t('clans.joined_success'));
      setMyMemberClanIds(prev => new Set([...prev, clanId]));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('clans.join_failed'));
    } finally {
      setJoiningClanId(null);
    }
  };

  const generateInviteCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const openCreate = () => {
    if (!isAuthenticated) { toast.error(t('challenges.login_required')); navigate('/login'); return; }
    setShowCreate(true);
  };

  const openJoin = () => {
    if (!isAuthenticated) { toast.error(t('challenges.login_required')); navigate('/login'); return; }
    setShowJoin(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error(t('challenges.login_required')); navigate('/login'); return; }
    try {
      const { data: clanData, error: clanError } = await supabase
        .from('clans')
        .insert({ name: newClanName, description: newClanDesc || null, creator_id: user.id, invite_code: generateInviteCode() })
        .select('id')
        .single();
      if (clanError || !clanData) throw clanError || new Error('Failed to create clan');

      const { error: memberError } = await supabase
        .from('clan_members')
        .insert({ clan_id: clanData.id, user_id: user.id, role: 'admin' });
      if (memberError) throw memberError;

      toast.success(t('clans.created_success'));
      setShowCreate(false);
      setNewClanName('');
      setNewClanDesc('');
      if (tab === 'my') fetchMyClans();
      else fetchAllClans();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : t('clans.create_failed');
      toast.error(msg, { duration: 6000 });
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error(t('challenges.login_required')); navigate('/login'); return; }
    if (joiningByCode) return;
    setJoiningByCode(true);
    try {
      const { data: clan, error: findError } = await supabase
        .from('clans').select('id').eq('invite_code', joinCode.trim()).single();
      if (findError || !clan) { toast.error(t('clans.not_found')); return; }

      const { data: existing } = await supabase
        .from('clan_members').select('id').eq('clan_id', clan.id).eq('user_id', user.id).maybeSingle();
      if (existing) { toast.error(t('clans.already_joined')); return; }

      const { error: joinError } = await supabase
        .from('clan_members').insert({ clan_id: clan.id, user_id: user.id, role: 'member' });
      if (joinError) throw joinError;

      toast.success(t('clans.joined_success'));
      setShowJoin(false);
      setJoinCode('');
      if (tab === 'my') fetchMyClans();
      else fetchAllClans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('clans.join_failed'));
    } finally {
      setJoiningByCode(false);
    }
  };

  const filteredAllClans = allClans.filter(c =>
    (c.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: 0, textShadow: '2px 2px 0 #000' }}>
          {t('clans.title')}
        </h1>
        <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' as const : 'row' as const, width: isMobile ? '100%' : 'auto' }}>
          <button onClick={openJoin} style={{
            padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
            background: 'transparent', border: '2px solid #FFD60A', color: '#FFD60A',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <LinkIcon size={16} /> {t('clans.join')}
          </button>
          <button onClick={openCreate} style={{
            padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
            background: '#FFD60A', border: 'none', color: '#0B1120',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Plus size={16} /> {t('clans.create')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none',
      }}>
        {([
          { key: 'browse' as Tab, icon: <Search size={14} />, label: t('clans.browse_all') },
          { key: 'top' as Tab, icon: <Trophy size={14} />, label: t('clans.top_clans') },
          { key: 'my' as Tab, icon: <Users size={14} />, label: t('clans.my_clans') },
        ]).map(({ key, icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: isMobile ? '8px 14px' : '10px 20px',
            borderRadius: 20, border: tab === key ? 'none' : '1px solid #243044',
            cursor: 'pointer', fontSize: isMobile ? 12 : 14, fontWeight: 700,
            background: tab === key ? '#FFD60A' : '#141C2B',
            color: tab === key ? '#0B1120' : '#94A3B8',
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ===== BROWSE ALL CLANS ===== */}
      {tab === 'browse' && (
        <>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('clans.search_placeholder')}
              style={{
                width: '100%', padding: '12px 16px 12px 42px', borderRadius: 12, fontSize: 14,
                background: '#141C2B', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
              }}
            />
          </div>
          {loading ? (
            <LoadingSkeleton isMobile={isMobile} />
          ) : filteredAllClans.length === 0 ? (
            <EmptyState text={t('clans.no_clans_found')} />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}
            >
              {filteredAllClans.map((clan, i) => (
                <ClanCard
                  key={clan.id}
                  clan={clan}
                  index={i}
                  isMobile={isMobile}
                  isMember={myMemberClanIds.has(clan.id)}
                  isJoining={joiningClanId === clan.id}
                  onJoin={() => handleQuickJoin(clan.id)}
                  t={t}
                />
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* ===== TOP CLANS ===== */}
      {tab === 'top' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['all', 'month', 'week'] as TopPeriod[]).map(p => (
              <button key={p} onClick={() => setTopPeriod(p)} style={{
                padding: '8px 16px', borderRadius: 20,
                border: topPeriod === p ? 'none' : '1px solid #243044',
                cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: topPeriod === p ? '#E040FB' : '#141C2B',
                color: topPeriod === p ? '#fff' : '#94A3B8',
              }}>
                {t(`clans.period_${p}`)}
              </button>
            ))}
          </div>
          {loading ? (
            <LoadingSkeleton isMobile={isMobile} />
          ) : topClans.length === 0 ? (
            <EmptyState text={t('clans.no_clans_found')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topClans.map((clan, i) => {
                const levelInfo = getClanLevel(clan.level ?? 1);
                const rankColors = ['#FFD60A', '#C0C0C0', '#CD7F32'];
                return (
                  <Link
                    key={clan.id}
                    to={`/clan/${clan.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        background: '#141C2B', borderRadius: 12, padding: isMobile ? '14px 12px' : '16px 20px',
                        border: i < 3 ? `1px solid ${rankColors[i]}30` : '1px solid #243044',
                        cursor: 'pointer', transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1C2538'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#141C2B'; }}
                    >
                      <span style={{
                        fontFamily: "'Bangers', cursive", fontSize: 24,
                        color: rankColors[i] || '#475569', width: 32, textAlign: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      {i < 3 && <Crown size={16} color={rankColors[i]} style={{ flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#E2E8F0', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clan.name}
                          </span>
                          <ClanBadge level={clan.level ?? 1} size="sm" />
                        </div>
                        {clan.description && (
                          <p style={{ color: '#64748B', fontSize: 12, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clan.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: levelInfo.color, fontWeight: 700, fontSize: 14 }}>
                          <Zap size={14} /> {(clan.xp ?? 0).toLocaleString()}
                        </div>
                        <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                          {t('clans.level')} {clan.level ?? 1}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== MY CLANS ===== */}
      {tab === 'my' && (
        <>
          {!isAuthenticated ? (
            <EmptyState text={t('challenges.login_required')} />
          ) : loading ? (
            <LoadingSkeleton isMobile={isMobile} />
          ) : myClans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Users size={56} color="#64748B" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#64748B', fontSize: 16, marginBottom: 20 }}>{t('clans.no_clans')}</p>
              <button onClick={openCreate} style={{
                padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Plus size={18} /> {t('clans.create')}
              </button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}
            >
              {myClans.filter(clan => clan.clans).map((clan, i) => (
                <motion.div
                  key={clan.clans.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/clan/${clan.clans.id}`}
                    style={{
                      display: 'block', textDecoration: 'none',
                      background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
                      borderRadius: 14, padding: 20, transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,214,10,0.5)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,214,10,0.2)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clan.clans.name}</h3>
                        <ClanBadge level={clan.clans.level || 1} size="sm" />
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        background: 'rgba(255,214,10,0.15)', color: '#FFD60A',
                        padding: '4px 10px', borderRadius: 12, flexShrink: 0,
                      }}>
                        {clan.role}
                      </span>
                    </div>
                    {clan.clans.description && (
                      <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clan.clans.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#64748B' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} /> {(clan.clans.xp ?? 0).toLocaleString()} XP
                      </span>
                      <span>{t('clans.joined')} {clan.joined_at ? new Date(clan.joined_at).toLocaleDateString() : '—'}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <ModalOverlay onClose={() => setShowCreate(false)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: 0 }}>{t('clans.create')}</h2>
              <button onClick={() => setShowCreate(false)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            {!isAuthenticated ? (
              <LoginPrompt onClose={() => setShowCreate(false)} navigate={navigate} t={t} />
            ) : (
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.name')}</label>
                  <input type="text" value={newClanName} onChange={(e) => setNewClanName(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.description')}</label>
                  <textarea value={newClanDesc} onChange={(e) => setNewClanDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
                </div>
                <button type="submit" style={{
                  width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                }}>
                  {t('clans.create')}
                </button>
              </form>
            )}
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Join Modal */}
      <AnimatePresence>
        {showJoin && (
          <ModalOverlay onClose={() => setShowJoin(false)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: 0 }}>{t('clans.join')}</h2>
              <button onClick={() => setShowJoin(false)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            {!isAuthenticated ? (
              <LoginPrompt onClose={() => setShowJoin(false)} navigate={navigate} t={t} />
            ) : (
              <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.enter_code')}</label>
                  <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="abc123def456" required style={inputStyle} />
                </div>
                <button type="submit" disabled={joiningByCode || !joinCode.trim()} style={{
                  width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                  opacity: joiningByCode ? 0.6 : 1,
                }}>
                  {joiningByCode ? t('common.loading') : t('clans.join_btn')}
                </button>
              </form>
            )}
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===== Sub-components ===== */

function ClanCard({ clan, index, isMobile, isMember, isJoining, onJoin, t }: {
  clan: PublicClan; index: number; isMobile: boolean; isMember: boolean;
  isJoining: boolean; onJoin: () => void; t: (k: string) => string;
}) {
  const levelInfo = getClanLevel(clan.level ?? 1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        background: '#141C2B', border: '1px solid #243044',
        borderRadius: 14, padding: isMobile ? 16 : 20, transition: 'border-color 0.2s',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clan.name}
          </h3>
          <ClanBadge level={clan.level ?? 1} size="sm" />
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: levelInfo.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          <Zap size={12} /> {(clan.xp ?? 0).toLocaleString()}
        </span>
      </div>

      {clan.description && (
        <p style={{ color: '#64748B', fontSize: 13, margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {clan.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <Link to={`/clan/${clan.id}`} style={{
          color: '#FFD60A', fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          {t('clans.view_clan')} →
        </Link>

        {isMember ? (
          <span style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: 'rgba(46,213,115,0.12)', color: '#2ED573',
          }}>
            {t('clans.member')}
          </span>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); onJoin(); }}
            disabled={isJoining}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: '#FFD60A', color: '#0B1120',
              opacity: isJoining ? 0.5 : 1,
            }}
          >
            {isJoining ? '...' : t('clans.join_btn')}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, padding: 16,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.3)',
          borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function LoginPrompt({ onClose, navigate, t }: { onClose: () => void; navigate: (p: string) => void; t: (k: string) => string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <p style={{ color: '#64748B', fontSize: 16, marginBottom: 20 }}>{t('challenges.login_required')}</p>
      <button
        onClick={() => { onClose(); navigate('/login'); }}
        style={{ padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 15 }}
      >
        {t('nav.login')}
      </button>
    </div>
  );
}

function LoadingSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: 140, background: '#141C2B', borderRadius: 14, border: '1px solid #243044' }} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <Users size={48} color="#475569" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: '#64748B', fontSize: 16 }}>{text}</p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
  background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
};
