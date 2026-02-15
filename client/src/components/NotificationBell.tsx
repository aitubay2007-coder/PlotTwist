import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Swords, Trophy, TrendingUp, Users, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  challenge_received: Swords,
  challenge_accepted: Swords,
  challenge_declined: Swords,
  prediction_resolved: Trophy,
  bet_won: TrendingUp,
  clan_joined: Users,
};

export default function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        // Deduplicate: only add if not already in list
        setNotifications(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]);
        setUnreadCount(c => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const timeAgo = (date: string) => {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return t('notifications.just_now');
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 8, position: 'relative', display: 'flex', alignItems: 'center',
        }}
      >
        <Bell size={22} color={unreadCount > 0 ? '#FFD60A' : '#64748B'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#FF4757', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 340, maxHeight: 420, overflowY: 'auto',
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.2)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 999,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid rgba(255,214,10,0.1)',
          }}>
            <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 15 }}>
              {t('notifications.title')}
            </span>
            {notifications.some(n => !n.read) && (
              <button onClick={markAllRead} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#64748B', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Check size={14} /> {t('notifications.mark_all_read')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Bell size={32} color="#334155" style={{ margin: '0 auto 8px' }} />
              <p style={{ color: '#475569', fontSize: 13 }}>{t('notifications.empty')}</p>
            </div>
          ) : (
            notifications.map(n => {
              const IconComp = TYPE_ICONS[n.type] || Bell;
              return (
                <div key={n.id} style={{
                  display: 'flex', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,214,10,0.05)',
                  background: n.read ? 'transparent' : 'rgba(255,214,10,0.03)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,214,10,0.1)',
                  }}>
                    <IconComp size={16} color="#FFD60A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                    {n.body && <div style={{ color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD60A', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
