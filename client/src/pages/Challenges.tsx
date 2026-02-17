import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Swords, Check, X, Clock, Trophy } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

interface ChallengeRow {
  id: string;
  challenger_id: string;
  challenged_id: string;
  prediction_id: string;
  challenger_position: string;
  challenged_position: string;
  amount: number;
  status: string;
  created_at: string;
  predictions: { title: string } | null;
  challenger: { username: string; avatar_url: string | null } | null;
  challenged: { username: string; avatar_url: string | null } | null;
}

export default function Challenges() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [actionId, setActionId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isAuthenticated && user) fetchChallenges();
    else setLoading(false);
  }, [isAuthenticated, user]);

  const fetchChallenges = async () => {
    if (!user) return;
    try {
      const { data, error } = await withTimeout(supabase
        .from('challenges')
        .select('*, predictions(title), challenger:profiles!challenger_id(username, avatar_url), challenged:profiles!challenged_id(username, avatar_url)')
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false }), 8000);

      if (error) throw error;
      setChallenges((data as unknown as ChallengeRow[]) || []);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    setActionId(id);
    try {
      const { data, error } = await supabase.rpc('accept_challenge', {
        challenge_id_param: id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (result.error) {
        toast.error(result.error === 'Insufficient coins' ? t('predictions.insufficient_coins') : result.error);
        return;
      }
      toast.success(t('challenges.accepted_success'));
      fetchChallenges();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('challenges.failed'));
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionId(id);
    try {
      const { data, error } = await supabase.rpc('decline_challenge', {
        challenge_id_param: id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t('challenges.declined_success'));
      fetchChallenges();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('challenges.failed'));
    } finally {
      setActionId(null);
    }
  };

  const incoming = challenges.filter((c) => c.challenged_id === user?.id);
  const outgoing = challenges.filter((c) => c.challenger_id === user?.id);
  const activeList = tab === 'incoming' ? incoming : outgoing;

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <Swords size={64} color="#64748B" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748B', fontSize: 18 }}>{t('challenges.login_required')}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 4rem)', maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? 32 : 48, color: '#FFD60A', margin: '0 0 32px', textShadow: '2px 2px 0 #000' }}>
        {t('challenges.title')}
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <button
          onClick={() => setTab('incoming')}
          style={{
            padding: isMobile ? '10px 14px' : '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            background: tab === 'incoming' ? '#FFD60A' : '#141C2B',
            color: tab === 'incoming' ? '#0B1120' : '#64748B',
            border: tab === 'incoming' ? 'none' : '1px solid rgba(255,214,10,0.2)',
          }}
        >
          {t('challenges.incoming')} ({incoming.length})
        </button>
        <button
          onClick={() => setTab('outgoing')}
          style={{
            padding: isMobile ? '10px 14px' : '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            background: tab === 'outgoing' ? '#FFD60A' : '#141C2B',
            color: tab === 'outgoing' ? '#0B1120' : '#64748B',
            border: tab === 'outgoing' ? 'none' : '1px solid rgba(255,214,10,0.2)',
          }}
        >
          {t('challenges.outgoing')} ({outgoing.length})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 96, background: '#141C2B', borderRadius: 12 }} />
          ))}
        </div>
      ) : activeList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Swords size={64} color="#64748B" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#64748B', fontSize: 18 }}>{t('challenges.no_challenges')}</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeList.map((challenge, i) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
                borderRadius: 14, padding: 20,
              }}
            >
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' as const : 'row' as const, alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 12 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,214,10,0.15)', color: '#FFD60A', fontSize: 13, fontWeight: 700,
                    }}>
                      {(tab === 'incoming' ? challenge.challenger?.username : challenge.challenged?.username)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span style={{ color: '#E2E8F0', fontWeight: 500 }}>
                      @{tab === 'incoming' ? challenge.challenger?.username : challenge.challenged?.username}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                      background: challenge.status === 'pending' ? 'rgba(255,214,10,0.15)' :
                        challenge.status === 'accepted' ? 'rgba(46,213,115,0.15)' :
                        challenge.status === 'resolved' ? 'rgba(139,92,246,0.15)' : 'rgba(255,71,87,0.15)',
                      color: challenge.status === 'pending' ? '#FFD60A' :
                        challenge.status === 'accepted' ? '#2ED573' :
                        challenge.status === 'resolved' ? '#8B5CF6' : '#FF4757',
                    }}>
                      {challenge.status === 'pending' ? t('challenges.pending') :
                       challenge.status === 'accepted' ? t('challenges.accepted') :
                       challenge.status === 'resolved' ? t('challenges.resolved') :
                       t('challenges.declined')}
                    </span>
                  </div>
                  <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 6px' }}>{challenge.predictions?.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 18 }}>
                      {(challenge.amount ?? 0).toLocaleString()} {t('common.coins')}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: (tab === 'incoming' ? challenge.challenged_position : challenge.challenger_position) === 'yes' ? '#2ED573' : '#FF4757',
                    }}>
                      {t('challenges.your_bet')}: {(tab === 'incoming' ? challenge.challenged_position : challenge.challenger_position)?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {tab === 'incoming' && challenge.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginLeft: isMobile ? 0 : 16, alignSelf: isMobile ? 'flex-end' as const : undefined }}>
                    <button
                      onClick={() => handleAccept(challenge.id)}
                      disabled={actionId === challenge.id}
                      style={{
                        padding: 12, borderRadius: 10, border: 'none', cursor: actionId === challenge.id ? 'not-allowed' : 'pointer',
                        background: 'rgba(46,213,115,0.15)', color: '#2ED573',
                        opacity: actionId === challenge.id ? 0.5 : 1,
                      }}
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => handleDecline(challenge.id)}
                      disabled={actionId === challenge.id}
                      style={{
                        padding: 12, borderRadius: 10, border: 'none', cursor: actionId === challenge.id ? 'not-allowed' : 'pointer',
                        background: 'rgba(255,71,87,0.15)', color: '#FF4757',
                        opacity: actionId === challenge.id ? 0.5 : 1,
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}

                {challenge.status === 'pending' && tab === 'outgoing' && (
                  <div style={{ marginLeft: isMobile ? 0 : 16, alignSelf: isMobile ? 'flex-end' as const : undefined }}>
                    <Clock size={24} color="#FFD60A" />
                  </div>
                )}

                {challenge.status === 'resolved' && (
                  <div style={{ marginLeft: isMobile ? 0 : 16, alignSelf: isMobile ? 'flex-end' as const : undefined, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Trophy size={20} color="#8B5CF6" />
                    <span style={{ color: '#8B5CF6', fontWeight: 700, fontSize: 14 }}>
                      {t('challenges.resolved')}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
