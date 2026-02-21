import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, Star, Target, BarChart3, Gift, LogOut, Edit3, TrendingUp, Trophy, ArrowRight, Lock } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAuthenticated, fetchProfile, setShowLogoutConfirm, adjustCoins } = useAuthStore();
  const [claimingBonus, setClaimingBonus] = useState(false);
  const bonusAvailable = (() => {
    if (!user?.last_daily_bonus) return true;
    const last = new Date(user.last_daily_bonus).getTime();
    return Date.now() - last >= 24 * 60 * 60 * 1000;
  })();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [myPredictions, setMyPredictions] = useState<{ id: string; title: string; status: string; visibility?: string }[]>([]);
  const [myBets, setMyBets] = useState<{ id: string; prediction_id: string; position: string; amount: number; predictions: { title: string; status: string } | null }[]>([]);
  const [activityTab, setActivityTab] = useState<'predictions' | 'bets'>('predictions');
  const isMobile = useIsMobile();

  if (!isAuthenticated || !user) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('profile.login_required')}</p>
      </div>
    );
  }

  const handleDailyBonus = async () => {
    setClaimingBonus(true);
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('claim_daily_bonus', { user_id_param: user.id }),
        8000
      );
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (result.error === 'already_claimed') {
        toast.error(t('profile.bonus_already_claimed'));
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }
      adjustCoins(50);
      toast.success(t('profile.bonus_claimed'));
      fetchProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message === 'Request timeout'
        ? t('common.timeout')
        : err instanceof Error ? err.message : t('profile.bonus_failed');
      toast.error(msg);
    } finally {
      setClaimingBonus(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    // Fetch user's predictions (all, for accurate stats)
    withTimeout(
      supabase.from('predictions').select('id, title, status, visibility')
        .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(100),
      8000
    ).then(({ data, error }) => {
      if (error) console.error('Failed to fetch predictions:', error);
      setMyPredictions(data || []);
    }).catch(() => setMyPredictions([]));

    // Fetch user's bets (all, for accurate win rate)
    withTimeout(
      supabase.from('bets').select('id, prediction_id, position, amount, predictions(title, status)')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      8000
    ).then(({ data, error }) => {
      if (error) console.error('Failed to fetch bets:', error);
      setMyBets((data as unknown as typeof myBets) || []);
    }).catch(() => setMyBets([]));
  }, [user]);

  const openEdit = () => {
    setEditName(user?.display_name || '');
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: editName || null })
        .eq('id', user.id);
      if (error) throw error;
      await fetchProfile();
      toast.success(t('profile.saved'));
      setEditOpen(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const { predictionCount, resolvedBets, winRate } = useMemo(() => {
    const pCount = myPredictions.length;
    const won = myBets.filter(b => {
      const s = b.predictions?.status;
      return (b.position === 'yes' && s === 'resolved_yes') || (b.position === 'no' && s === 'resolved_no');
    }).length;
    const resolved = myBets.filter(b => b.predictions?.status?.startsWith('resolved')).length;
    const wr = resolved > 0 ? Math.round((won / resolved) * 100) : 0;
    return { predictionCount: pCount, wonBets: won, resolvedBets: resolved, winRate: wr };
  }, [myPredictions, myBets]);

  const stats = [
    { icon: <Coins size={32} color="#FFD60A" />, value: (user.coins ?? 0).toLocaleString(), label: t('profile.coins'), color: '#FFD60A' },
    { icon: <Star size={32} color="#FFD60A" />, value: (user.reputation ?? 0).toLocaleString(), label: t('profile.reputation'), color: '#E2E8F0' },
    { icon: <Target size={32} color="#FFD60A" />, value: predictionCount.toString(), label: t('profile.predictions_made'), color: '#E2E8F0' },
    { icon: <BarChart3 size={32} color="#FFD60A" />, value: resolvedBets > 0 ? `${winRate}%` : '—', label: t('profile.win_rate'), color: '#E2E8F0' },
  ];

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile Header */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: 16, padding: isMobile ? 20 : 32, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' as const : 'row' as const, flexWrap: 'wrap', alignItems: isMobile ? 'center' : 'center', gap: isMobile ? 16 : 24, textAlign: isMobile ? 'center' as const : 'left' as const }}>
            <div style={{
              width: isMobile ? 64 : 96, height: isMobile ? 64 : 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FFD60A', fontFamily: "'Bangers', cursive", fontSize: isMobile ? 28 : 40, color: '#0B1120',
            }}>
              {user.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? 28 : 40, color: '#FFD60A', margin: '0 0 4px' }}>
                @{user.username}
              </h1>
              {user.display_name && <p style={{ color: '#E2E8F0', fontSize: 18, marginTop: 4 }}>{user.display_name}</p>}
              <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
                {t('profile.joined')} {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : undefined }}>
              <button
                onClick={openEdit}
                style={{
                  padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: 'rgba(255,214,10,0.15)', border: 'none', color: '#FFD60A',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Edit3 size={16} />
                {t('profile.edit_profile')}
              </button>
              <button
                onClick={handleDailyBonus}
                disabled={claimingBonus || !bonusAvailable}
                style={{
                  padding: '12px 20px', borderRadius: 10, cursor: bonusAvailable ? 'pointer' : 'default', fontWeight: 700, fontSize: 14,
                  background: bonusAvailable ? 'rgba(46,213,115,0.15)' : 'rgba(100,116,139,0.1)',
                  border: 'none', color: bonusAvailable ? '#2ED573' : '#475569',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: claimingBonus ? 0.5 : 1,
                }}
              >
                <Gift size={16} />
                {claimingBonus ? t('common.loading') : bonusAvailable ? t('profile.daily_bonus') : t('profile.bonus_already_claimed')}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: 'rgba(255,71,87,0.15)', border: 'none', color: '#FF4757',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <LogOut size={16} />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              style={{
                background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
                borderRadius: 14, padding: 20, textAlign: 'center',
              }}
            >
              <div style={{ marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: stat.color }}>{stat.value}</div>
              <div style={{ color: '#64748B', fontSize: 14 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Transaction History Link */}
        <Link to="/transactions" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: 14, padding: '16px 24px', marginBottom: 24,
          textDecoration: 'none', transition: 'background 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Coins size={20} color="#FFD60A" />
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: 15 }}>{t('profile.transaction_history')}</span>
          </div>
          <ArrowRight size={18} color="#64748B" />
        </Link>

        {/* My Predictions / My Bets */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: 16, padding: isMobile ? 20 : 32,
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setActivityTab('predictions')}
              style={{
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                background: activityTab === 'predictions' ? '#FFD60A' : '#0B1120',
                color: activityTab === 'predictions' ? '#0B1120' : '#64748B',
                border: activityTab === 'predictions' ? 'none' : '1px solid rgba(255,214,10,0.2)',
              }}
            >
              {t('profile.my_predictions')} ({myPredictions.length})
            </button>
            <button
              onClick={() => setActivityTab('bets')}
              style={{
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                background: activityTab === 'bets' ? '#FFD60A' : '#0B1120',
                color: activityTab === 'bets' ? '#0B1120' : '#64748B',
                border: activityTab === 'bets' ? 'none' : '1px solid rgba(255,214,10,0.2)',
              }}
            >
              {t('profile.my_bets')} ({myBets.length})
            </button>
          </div>

          {activityTab === 'predictions' ? (
            myPredictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Target size={40} color="#64748B" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#64748B' }}>{t('profile.no_predictions')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myPredictions.map(p => (
                  <Link to={`/prediction/${p.id}`} key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#0B1120', borderRadius: 12, padding: '14px 16px',
                    textDecoration: 'none', transition: 'background 0.2s', gap: 8,
                  }}>
                    {p.visibility === 'private' && <Lock size={14} color="#F59E0B" style={{ flexShrink: 0 }} />}
                    <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                    <StatusBadge status={p.status} t={t} />
                  </Link>
                ))}
              </div>
            )
          ) : (
            myBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <TrendingUp size={40} color="#64748B" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#64748B' }}>{t('profile.no_bets')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myBets.map(b => {
                  const predStatus = b.predictions?.status || 'active';
                  const won = (b.position === 'yes' && predStatus === 'resolved_yes') || (b.position === 'no' && predStatus === 'resolved_no');
                  const lost = predStatus.startsWith('resolved') && !won;
                  return (
                    <Link to={`/prediction/${b.prediction_id}`} key={b.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#0B1120', borderRadius: 12, padding: '14px 16px',
                      textDecoration: 'none', transition: 'background 0.2s',
                    }}>
                      <div style={{ flex: 1, overflow: 'hidden', marginRight: 12 }}>
                        <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.predictions?.title || '—'}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          {(b.position ?? '—').toUpperCase()} · {(b.amount ?? 0).toLocaleString()} {t('common.coins_short')}
                        </span>
                      </div>
                      {won && <Trophy size={18} color="#2ED573" />}
                      {lost && <Trophy size={18} color="#FF4757" />}
                      {!won && !lost && <StatusBadge status={predStatus} t={t} />}
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </div>
      </motion.div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setEditOpen(false)}>
          <div style={{
            background: '#141C2B', border: '1px solid rgba(255,214,10,0.3)',
            borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#FFD60A', fontFamily: "'Bangers', cursive", fontSize: 28, marginBottom: 24 }}>
              {t('profile.edit_profile')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {t('profile.display_name')}
                </label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={t('profile.display_name_placeholder')}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    background: '#0B1120', border: '1px solid rgba(255,214,10,0.2)',
                    color: '#E2E8F0', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 15,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
                <button
                  onClick={() => setEditOpen(false)}
                  style={{
                    flex: 1, padding: '14px 0', borderRadius: 10, cursor: 'pointer',
                    background: 'transparent', border: '1px solid #334155', color: '#94A3B8', fontWeight: 700, fontSize: 15,
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: 'rgba(255,214,10,0.15)', color: '#FFD60A', label: t('predictions.active') },
    resolved_yes: { bg: 'rgba(46,213,115,0.15)', color: '#2ED573', label: t('predictions.vote_yes') },
    resolved_no: { bg: 'rgba(255,71,87,0.15)', color: '#FF4757', label: t('predictions.vote_no') },
  };
  const c = config[status] || config.active;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}
