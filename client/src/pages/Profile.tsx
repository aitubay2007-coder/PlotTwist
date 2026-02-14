import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Coins, Star, Target, BarChart3, Gift, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAuthenticated, fetchProfile, setShowLogoutConfirm } = useAuthStore();
  const [claimingBonus, setClaimingBonus] = useState(false);
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
      // Add 50 coins via RPC
      const { error } = await supabase.rpc('increment_coins', {
        user_id_param: user.id,
        amount_param: 50,
      });
      if (error) throw error;

      // Log the transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'daily_bonus',
        amount: 50,
        description: 'Daily bonus',
      });

      toast.success(t('profile.bonus_claimed'));
      await fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('profile.bonus_failed'));
    } finally {
      setClaimingBonus(false);
    }
  };

  const stats = [
    { icon: <Coins size={32} color="#FFD60A" />, value: user.coins.toLocaleString(), label: t('profile.coins'), color: '#FFD60A' },
    { icon: <Star size={32} color="#FFD60A" />, value: user.reputation.toLocaleString(), label: t('profile.reputation'), color: '#E2E8F0' },
    { icon: <Target size={32} color="#FFD60A" />, value: '—', label: t('profile.predictions_made'), color: '#E2E8F0' },
    { icon: <BarChart3 size={32} color="#FFD60A" />, value: '—', label: t('profile.win_rate'), color: '#E2E8F0' },
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
              {user.country && <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{user.country}</p>}
              <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
                {t('profile.joined')} {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDailyBonus}
                disabled={claimingBonus}
                style={{
                  padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: 'rgba(46,213,115,0.15)', border: 'none', color: '#2ED573',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: claimingBonus ? 0.5 : 1,
                }}
              >
                <Gift size={16} />
                {claimingBonus ? '...' : t('profile.daily_bonus')}
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

        {/* Recent Activity */}
        <div style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: 16, padding: 32,
        }}>
          <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: 30, color: '#FFD60A', margin: '0 0 16px' }}>
            {t('profile.recent_activity')}
          </h2>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#64748B' }}>{t('profile.recent_activity_empty')}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
