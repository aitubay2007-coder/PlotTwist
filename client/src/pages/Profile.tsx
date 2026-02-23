import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, LogOut, Edit3 } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Transaction } from '../types';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAuthenticated, fetchProfile, setShowLogoutConfirm, adjustCoins } = useAuthStore();
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myBets, setMyBets] = useState<{ outcome: string; amount: number; status: string; resolved_outcome: string | null }[]>([]);
  const isMobile = useIsMobile();

  const bonusAvailable = useMemo(() => {
    if (!user?.last_daily_bonus) return true;
    const last = new Date(user.last_daily_bonus).getTime();
    return Date.now() - last >= 24 * 60 * 60 * 1000;
  }, [user?.last_daily_bonus]);

  useEffect(() => {
    if (!user) return;

    withTimeout(
      supabase.from('transactions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20),
      8000
    ).then(({ data }) => setTransactions((data || []) as Transaction[])).catch(() => {});

    withTimeout(
      supabase.from('bets').select('outcome, amount, predictions(status, resolved_outcome)')
        .eq('user_id', user.id).limit(100),
      8000
    ).then(({ data }) => {
      const mapped = (data || []).map((b: Record<string, unknown>) => {
        const pred = b.predictions as { status: string; resolved_outcome: string | null } | null;
        return { outcome: b.outcome as string, amount: b.amount as number, status: pred?.status || '', resolved_outcome: pred?.resolved_outcome || null };
      });
      setMyBets(mapped);
    }).catch(() => {});
  }, [user?.id]);

  if (!isAuthenticated || !user) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('profile.login_required')}</p>
        <Link to="/login" style={{ color: '#FFD60A', textDecoration: 'none' }}>{t('nav.login')}</Link>
      </div>
    );
  }

  const { winRate, totalBets } = useMemo(() => {
    const resolved = myBets.filter(b => b.status === 'resolved');
    const won = resolved.filter(b => b.outcome === b.resolved_outcome).length;
    return { totalBets: myBets.length, wonBets: won, winRate: resolved.length > 0 ? Math.round((won / resolved.length) * 100) : 0 };
  }, [myBets]);

  const handleDailyBonus = async () => {
    setClaimingBonus(true);
    try {
      const { data, error } = await withTimeout(supabase.rpc('claim_daily_bonus'), 8000);
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result.error === 'already_claimed') { toast.error(t('profile.bonus_already_claimed')); return; }
      if (result.error) { toast.error(result.error); return; }
      adjustCoins(50);
      toast.success(t('profile.bonus_claimed'));
      fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setClaimingBonus(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await withTimeout(supabase.from('profiles').update({ display_name: editName || null }).eq('id', user.id), 8000);
      if (error) throw error;
      await fetchProfile();
      toast.success(t('profile.saved'));
      setEditOpen(false);
    } catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  };

  const stats = [
    { label: t('profile.coins'), value: user.coins_balance.toLocaleString(), color: '#FFD60A' },
    { label: t('profile.total_bets'), value: totalBets.toString(), color: '#E2E8F0' },
    { label: t('profile.win_rate'), value: totalBets > 0 ? `${winRate}%` : '—', color: '#2ED573' },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: 16, padding: isMobile ? 20 : 28, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FFD60A', fontFamily: "'Bangers', cursive", fontSize: 28, color: '#0B1120',
            }}>
              {user.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 28, color: '#FFD60A', margin: 0 }}>@{user.username}</h1>
              {user.display_name && <p style={{ color: '#E2E8F0', fontSize: 14, marginTop: 2 }}>{user.display_name}</p>}
              <p style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{t('profile.joined')} {new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => { setEditName(user.display_name || ''); setEditOpen(true); }} style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: 'rgba(255,214,10,0.1)', border: 'none', color: '#FFD60A',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Edit3 size={14} /> {t('profile.edit_profile')}
            </button>
            <button onClick={handleDailyBonus} disabled={claimingBonus || !bonusAvailable} style={{
              padding: '10px 16px', borderRadius: 10, cursor: bonusAvailable ? 'pointer' : 'default',
              fontWeight: 600, fontSize: 13, border: 'none',
              background: bonusAvailable ? 'rgba(46,213,115,0.1)' : 'rgba(100,116,139,0.08)',
              color: bonusAvailable ? '#2ED573' : '#475569',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: claimingBonus ? 0.5 : 1,
            }}>
              <Gift size={14} /> {bonusAvailable ? t('profile.daily_bonus') : t('profile.bonus_already_claimed')}
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: 'rgba(255,71,87,0.1)', border: 'none', color: '#FF4757',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <LogOut size={14} /> {t('nav.logout')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
              borderRadius: 14, padding: 16, textAlign: 'center',
            }}>
              <div style={{ fontFamily: "'Bangers', cursive", fontSize: 26, color: s.color }}>{s.value}</div>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
          borderRadius: 16, padding: isMobile ? 18 : 28,
        }}>
          <h3 style={{ fontFamily: "'Bangers', cursive", fontSize: 20, color: '#FFD60A', margin: '0 0 16px' }}>
            {t('profile.recent_transactions')}
          </h3>
          {transactions.length === 0 ? (
            <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {t('profile.no_transactions')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {transactions.map(tx => (
                <div key={tx.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#0B1120', borderRadius: 10,
                }}>
                  <div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: 'rgba(255,214,10,0.08)', color: '#FFD60A', textTransform: 'uppercase',
                    }}>
                      {tx.type}
                    </span>
                    <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{
                    fontWeight: 700, fontSize: 14,
                    color: tx.delta >= 0 ? '#2ED573' : '#FF4757',
                  }}>
                    {tx.delta >= 0 ? '+' : ''}{tx.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit modal */}
        {editOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }} onClick={() => setEditOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#141C2B', border: '1px solid #243044', borderRadius: 16,
              padding: 28, maxWidth: 380, width: '100%',
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E2E8F0', marginBottom: 16 }}>{t('profile.edit_profile')}</h3>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                placeholder={t('profile.display_name')}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
                  background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0',
                  outline: 'none', boxSizing: 'border-box', marginBottom: 16,
                }}
              />
              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 14,
                opacity: saving ? 0.5 : 1,
              }}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
