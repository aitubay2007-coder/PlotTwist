import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageCircle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useMediaQuery';

interface ChatMessage {
  id: string;
  clan_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  } | null;
}

const MAX_LENGTH = 500;

export default function ClanChat({ clanId }: { clanId: string }) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottom.current = gap < 80;
    setShowScroll(gap > 200);
  }, []);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clan_messages')
        .select('id, clan_id, user_id, content, created_at, profiles(username, avatar_url)')
        .eq('clan_id', clanId)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages((data as unknown as ChatMessage[]) || []);
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    };

    fetchMessages();
  }, [clanId, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`clan-chat-${clanId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clan_messages', filter: `clan_id=eq.${clanId}` },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          // Fetch profile info for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newMessage.user_id)
            .single();

          const enriched: ChatMessage = {
            ...newMessage,
            profiles: profile,
          };

          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === enriched.id)) return prev;
            return [...prev, enriched];
          });

          if (isNearBottom.current) {
            setTimeout(() => scrollToBottom(true), 50);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'clan_messages', filter: `clan_id=eq.${clanId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clanId, scrollToBottom]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMsg.trim();
    if (!text || !user || sending) return;

    setSending(true);
    const { error } = await supabase
      .from('clan_messages')
      .insert({ clan_id: clanId, user_id: user.id, content: text });

    if (error) {
      console.error('Send message error:', error);
      toast.error(t('common.error'));
      setSending(false);
      return;
    }
    setNewMsg('');
    setSending(false);
  };

  // Format time
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return time;
    if (diffDays === 1) return `${t('chat.yesterday')} ${time}`;
    if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  };

  // Group consecutive messages by same user
  const isNewGroup = (i: number) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    const curr = messages[i];
    if (prev.user_id !== curr.user_id) return true;
    // New group if > 5 min gap
    return new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
  };

  const isMe = (msg: ChatMessage) => msg.user_id === user?.id;

  return (
    <div style={{
      background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
      borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: isMobile ? 420 : 500, position: 'relative' as const,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,214,10,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <MessageCircle size={18} color="#FFD60A" />
        <h3 style={{
          fontFamily: "'Bangers', cursive", fontSize: isMobile ? 18 : 22,
          color: '#FFD60A', margin: 0,
        }}>
          {t('chat.title')}
        </h3>
        <span style={{ color: '#475569', fontSize: 12, marginLeft: 'auto' }}>
          {messages.length} {t('chat.messages_count')}
        </span>
      </div>

      {/* Messages List */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 2,
          scrollBehavior: 'smooth',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 40, borderRadius: 12, background: '#1C2538',
                width: i % 2 === 0 ? '60%' : '75%',
                animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <MessageCircle size={40} color="#334155" />
            <p style={{ color: '#475569', fontSize: 14, textAlign: 'center' }}>
              {t('chat.empty')}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const mine = isMe(msg);
              const newGroup = isNewGroup(i);
              return (
                <div key={msg.id} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                  marginTop: newGroup ? 12 : 1,
                }}>
                  {/* Username + time for new groups */}
                  {newGroup && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 3,
                      flexDirection: mine ? 'row-reverse' : 'row',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: mine ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                        color: mine ? '#0B1120' : '#FFD60A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {((msg.profiles?.username || '?')[0] || '?').toUpperCase()}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: mine ? '#FFD60A' : '#94A3B8' }}>
                        {mine ? t('chat.you') : `@${msg.profiles?.username || 'unknown'}`}
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                  {/* Message bubble */}
                  <div style={{
                    maxWidth: '78%',
                    padding: '8px 14px',
                    borderRadius: mine
                      ? '14px 14px 4px 14px'
                      : '14px 14px 14px 4px',
                    background: mine
                      ? 'rgba(255,214,10,0.12)'
                      : '#0B1120',
                    border: mine
                      ? '1px solid rgba(255,214,10,0.2)'
                      : '1px solid #1C2538',
                    color: '#E2E8F0',
                    fontSize: 14, lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {showScroll && (
        <button
          onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute', bottom: 70, right: 24,
            width: 36, height: 36, borderRadius: '50%',
            background: '#FFD60A', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 5,
          }}
        >
          <ChevronDown size={20} color="#0B1120" />
        </button>
      )}

      {/* Input */}
      {isAuthenticated ? (
        <form
          onSubmit={handleSend}
          style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,214,10,0.1)',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={t('chat.placeholder')}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 12, fontSize: 14,
                background: '#0B1120', border: '1px solid #243044',
                color: '#E2E8F0', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,214,10,0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#243044'; }}
            />
            {newMsg.length > MAX_LENGTH * 0.8 && (
              <span style={{
                position: 'absolute', right: 10, bottom: -16,
                fontSize: 10, color: newMsg.length >= MAX_LENGTH ? '#EF4444' : '#64748B',
              }}>
                {newMsg.length}/{MAX_LENGTH}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!newMsg.trim() || sending}
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none',
              background: newMsg.trim() ? '#FFD60A' : '#1C2538',
              color: newMsg.trim() ? '#0B1120' : '#475569',
              cursor: newMsg.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            <Send size={18} />
          </button>
        </form>
      ) : (
        <div style={{
          padding: '14px 20px', borderTop: '1px solid rgba(255,214,10,0.1)',
          textAlign: 'center', color: '#64748B', fontSize: 13,
        }}>
          {t('chat.login_required')}
        </div>
      )}
    </div>
  );
}
