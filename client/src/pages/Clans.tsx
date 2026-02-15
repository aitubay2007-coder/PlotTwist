import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Link as LinkIcon, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';
import { ClanBadge } from '../components/ClanBadge';

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

export default function Clans() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clans, setClans] = useState<ClanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanDesc, setNewClanDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const isMobile = useIsMobile();

  // Auto-open create modal from URL param (e.g. /clans?action=create)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) fetchClans();
    else setLoading(false);
  }, [isAuthenticated, user]);

  const fetchClans = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('clan_members')
        .select('role, joined_at, clans(id, name, description, invite_code, xp, level, created_at)')
        .eq('user_id', user.id);

      if (error) throw error;
      setClans((data as unknown as ClanRow[]) || []);
    } catch {
      setClans([]);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      toast.error(t('challenges.login_required'));
      navigate('/login');
      return;
    }
    setShowCreate(true);
  };

  const openJoin = () => {
    if (!isAuthenticated) {
      toast.error(t('challenges.login_required'));
      navigate('/login');
      return;
    }
    setShowJoin(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t('challenges.login_required'));
      navigate('/login');
      return;
    }
    try {
      const { data: clanData, error: clanError } = await supabase
        .from('clans')
        .insert({
          name: newClanName,
          description: newClanDesc || null,
          creator_id: user.id,
          invite_code: generateInviteCode(),
        })
        .select('id')
        .single();

      if (clanError) throw clanError;

      const { error: memberError } = await supabase
        .from('clan_members')
        .insert({
          clan_id: clanData.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      toast.success(t('clans.created_success'));
      setShowCreate(false);
      setNewClanName('');
      setNewClanDesc('');
      fetchClans();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : t('clans.create_failed');
      console.error('Clan creation error:', err);
      toast.error(msg, { duration: 6000 });
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t('challenges.login_required'));
      navigate('/login');
      return;
    }
    try {
      const { data: clan, error: findError } = await supabase
        .from('clans')
        .select('id')
        .eq('invite_code', joinCode.trim())
        .single();

      if (findError || !clan) {
        toast.error(t('clans.not_found'));
        return;
      }

      const { data: existing } = await supabase
        .from('clan_members')
        .select('id')
        .eq('clan_id', clan.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast.error(t('clans.already_joined'));
        return;
      }

      const { error: joinError } = await supabase
        .from('clan_members')
        .insert({
          clan_id: clan.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) throw joinError;

      toast.success(t('clans.joined_success'));
      setShowJoin(false);
      setJoinCode('');
      fetchClans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('clans.join_failed'));
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: 0, textShadow: '2px 2px 0 #000' }}>
          {t('clans.title')}
        </h1>
        {/* Always show buttons — if not logged in, openCreate/openJoin will redirect to login */}
        <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' as const : 'row' as const, width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={openJoin}
            style={{
              padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: 'transparent', border: '2px solid #FFD60A', color: '#FFD60A',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <LinkIcon size={16} />
            {t('clans.join')}
          </button>
          <button
            onClick={openCreate}
            style={{
              padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: '#FFD60A', border: 'none', color: '#0B1120',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Plus size={16} />
            {t('clans.create')}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 24 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 160, background: '#141C2B', borderRadius: 12, border: '1px solid #243044' }} />
          ))}
        </div>
      ) : clans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Users size={64} color="#64748B" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#64748B', fontSize: 18, marginBottom: 24 }}>{t('clans.no_clans')}</p>
          <button
            onClick={openCreate}
            style={{
              padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <Plus size={18} />
            {t('clans.create')}
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 24 }}
        >
          {clans.map((clan, i) => (
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
                  borderRadius: 14, padding: 24, transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,214,10,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,214,10,0.2)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clan.clans.name}</h3>
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
                  <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 12px' }}>{clan.clans.description}</p>
                )}
                <div style={{ color: '#64748B', fontSize: 12 }}>
                  {t('clans.joined')} {new Date(clan.joined_at).toLocaleDateString()}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50, padding: 16,
              background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: '#141C2B', border: '1px solid rgba(255,214,10,0.3)',
                borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: 0 }}>{t('clans.create')}</h2>
                <button onClick={() => setShowCreate(false)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {!isAuthenticated ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ color: '#64748B', fontSize: 16, marginBottom: 20 }}>{t('challenges.login_required')}</p>
                  <button
                    onClick={() => { setShowCreate(false); navigate('/login'); }}
                    style={{
                      padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 15,
                    }}
                  >
                    {t('nav.login')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.name')}</label>
                    <input
                      type="text" value={newClanName} onChange={(e) => setNewClanName(e.target.value)}
                      required
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
                        background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.description')}</label>
                    <textarea
                      value={newClanDesc} onChange={(e) => setNewClanDesc(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14, resize: 'none',
                        background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
                      }}
                    />
                  </div>
                  <button type="submit" style={{
                    width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                  }}>
                    {t('clans.create')}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50, padding: 16,
              background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowJoin(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: '#141C2B', border: '1px solid rgba(255,214,10,0.3)',
                borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: 0 }}>{t('clans.join')}</h2>
                <button onClick={() => setShowJoin(false)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {!isAuthenticated ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ color: '#64748B', fontSize: 16, marginBottom: 20 }}>{t('challenges.login_required')}</p>
                  <button
                    onClick={() => { setShowJoin(false); navigate('/login'); }}
                    style={{
                      padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 15,
                    }}
                  >
                    {t('nav.login')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('clans.enter_code')}</label>
                    <input
                      type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="abc123def456" required
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
                        background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
                      }}
                    />
                  </div>
                  <button type="submit" style={{
                    width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 16,
                  }}>
                    {t('clans.join_btn')}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
