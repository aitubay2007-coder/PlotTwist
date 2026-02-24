import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, LogOut, Edit3, TrendingUp, Clock, CheckCircle, XCircle, Lock, Copy } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Transaction } from '../types';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

interface MyBetItem {
  id: string;
  outcome: string;
  amount: number;
  created_at: string;
  prediction_id: string;
  prediction_title: string;
  prediction_status: string;
  prediction_type: string;
  resolved_outcome: string | null;
  visibility_token: string | null;
}

interface MyCreatedPrediction {
  id: string;
  title: string;
  status: 'open' | 'resolved';
  type: 'official' | 'private';
  created_at: string;
  deadline_at: string;
  visibility_token: string | null;
}

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, fetchProfile, setShowLogoutConfirm, adjustCoins } = useAuthStore();
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [myBets, setMyBets] = useState<MyBetItem[]>([]);
  const [myCreated, setMyCreated] = useState<MyCreatedPrediction[]>([]);
  const [activeTab, setActiveTab] = useState<'bets' | 'created' | 'transactions'>('bets');
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
      supabase.from('bets').select('id, outcome, amount, created_at, prediction_id, predictions(title, status, type, resolved_outcome, visibility_token)')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      8000
    ).then(({ data }) => {
      const mapped = (data || []).map((b: Record<string, unknown>) => {
        const pred = b.predictions as { title: string; status: string; type: string; resolved_outcome: string | null; visibility_token: string | null } | null;
        return {
          id: b.id as string,
          outcome: b.outcome as string,
          amount: b.amount as number,
          created_at: b.created_at as string,
          prediction_id: b.prediction_id as string,
          prediction_title: pred?.title || '—',
          prediction_status: pred?.status || '',
          prediction_type: pred?.type || 'official',
          resolved_outcome: pred?.resolved_outcome || null,
          visibility_token: pred?.visibility_token || null,
        };
      });
      setMyBets(mapped);
    }).catch(() => {});

    withTimeout(
      supabase.from('predictions').select('id, title, status, type, created_at, deadline_at, visibility_token')
        .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(50),
      8000
    ).then(({ data }) => {
      setMyCreated((data || []) as MyCreatedPrediction[]);
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
    const resolved = myBets.filter(b => b.prediction_status === 'resolved');
    const won = resolved.filter(b => b.outcome === b.resolved_outcome).length;
    return { totalBets: myBets.length, winRate: resolved.length > 0 ? Math.round((won / resolved.length) * 100) : 0 };
  }, [myBets]);

  const getBetResult = (bet: MyBetItem): 'won' | 'lost' | 'pending' => {
    if (bet.prediction_status !== 'resolved' || !bet.resolved_outcome) return 'pending';
    return bet.outcome === bet.resolved_outcome ? 'won' : 'lost';
  };

  const handleBetClick = (bet: MyBetItem) => {
    if (bet.prediction_type === 'private' && bet.visibility_token) {
      navigate(`/p/${bet.visibility_token}`);
    } else {
      navigate(`/prediction/${bet.prediction_id}`);
    }
  };

  const handleCreatedClick = (p: MyCreatedPrediction) => {
    if (p.type === 'private' && p.visibility_token) {
      navigate(`/p/${p.visibility_token}`);
      return;
    }
    navigate(`/prediction/${p.id}`);
  };

  const handleCopyPrivateLink = async (token: string | null) => {
    if (!token) return;
    const shareUrl = `${window.location.origin}/p/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

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

        {/* Tabs */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.1)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {(['bets', 'created', 'transactions'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '14px 0', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
                  background: activeTab === tab ? 'rgba(255,214,10,0.06)' : 'transparent',
                  color: activeTab === tab ? '#FFD60A' : '#64748B',
                  borderBottom: activeTab === tab ? '2px solid #FFD60A' : '2px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {tab === 'bets' ? <TrendingUp size={14} /> : null}
                {tab === 'bets' ? t('profile.my_bets') : tab === 'created' ? t('profile.created_predictions') : t('profile.recent_transactions')}
                {tab === 'bets' && myBets.length > 0 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: 'rgba(255,214,10,0.15)', color: '#FFD60A',
                  }}>{myBets.length}</span>
                )}
                {tab === 'created' && myCreated.length > 0 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: 'rgba(255,214,10,0.15)', color: '#FFD60A',
                  }}>{myCreated.length}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: isMobile ? 18 : 28 }}>
            {activeTab === 'bets' ? (
              myBets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <TrendingUp size={40} color="#1C2538" style={{ marginBottom: 8 }} />
                  <p style={{ color: '#475569', fontSize: 13 }}>{t('profile.no_bets')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myBets.map(bet => {
                    const result = getBetResult(bet);
                    const resultColor = result === 'won' ? '#2ED573' : result === 'lost' ? '#FF4757' : '#FFD60A';
                    const ResultIcon = result === 'won' ? CheckCircle : result === 'lost' ? XCircle : Clock;

                    return (
                      <motion.div
                        key={bet.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleBetClick(bet)}
                        style={{
                          padding: '14px 16px', background: '#0B1120', borderRadius: 12,
                          cursor: 'pointer', border: '1px solid rgba(255,255,255,0.03)',
                          transition: 'border-color 0.2s',
                        }}
                        whileHover={{ borderColor: 'rgba(255,214,10,0.15)' } as never}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${resultColor}15`,
                          }}>
                            <ResultIcon size={18} color={resultColor} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              color: '#E2E8F0', fontSize: 13, fontWeight: 600, margin: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {bet.prediction_title}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                background: bet.outcome === 'yes' ? 'rgba(46,213,115,0.12)' : 'rgba(255,71,87,0.12)',
                                color: bet.outcome === 'yes' ? '#2ED573' : '#FF4757',
                                textTransform: 'uppercase',
                              }}>
                                {bet.outcome}
                              </span>
                              <span style={{ color: '#64748B', fontSize: 11 }}>
                                {bet.amount} {t('common.coins')}
                              </span>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                background: `${resultColor}12`,
                                color: resultColor,
                              }}>
                                {result === 'won' ? t('profile.bet_won') : result === 'lost' ? t('profile.bet_lost') : t('profile.bet_pending')}
                              </span>
                              {bet.prediction_type === 'private' && (
                                <span style={{ color: '#64748B', fontSize: 10 }}>🔒</span>
                              )}
                            </div>
                          </div>
                          <span style={{ color: '#334155', fontSize: 11, flexShrink: 0 }}>
                            {new Date(bet.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : activeTab === 'created' ? (
              myCreated.length === 0 ? (
                <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                  {t('profile.no_created_predictions')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myCreated.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '12px 14px', background: '#0B1120', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <button
                          onClick={() => handleCreatedClick(p)}
                          style={{
                            border: 'none', background: 'transparent', padding: 0, margin: 0,
                            color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            textAlign: 'left', flex: 1, minWidth: 0,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
                          {p.title}
                        </button>
                        {p.type === 'private' && (
                          <button
                            onClick={() => handleCopyPrivateLink(p.visibility_token)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgba(255,255,255,0.03)',
                              color: '#94A3B8', borderRadius: 7, padding: '4px 8px',
                              cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <Copy size={12} /> {t('common.copy_link')}
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: p.type === 'private' ? 'rgba(224,64,251,0.12)' : 'rgba(255,214,10,0.12)',
                          color: p.type === 'private' ? '#E040FB' : '#FFD60A',
                          display: 'inline-flex', alignItems: 'center', gap: 4, textTransform: 'uppercase',
                        }}>
                          {p.type === 'private' ? <Lock size={10} /> : null}
                          {p.type}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: p.status === 'open' ? 'rgba(46,213,115,0.12)' : 'rgba(148,163,184,0.12)',
                          color: p.status === 'open' ? '#2ED573' : '#94A3B8',
                          textTransform: 'uppercase',
                        }}>
                          {p.status === 'open' ? t('predictions.open') : t('predictions.resolved')}
                        </span>
                        <span style={{ color: '#64748B', fontSize: 11 }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                        <span style={{ color: '#475569', fontSize: 11 }}>
                          {new Date(p.deadline_at).toLocaleString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              transactions.length === 0 ? (
                <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
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
              )
            )}
          </div>
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
