import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

export default function PredictionComments({ predictionId }: { predictionId: string }) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${predictionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prediction_comments', filter: `prediction_id=eq.${predictionId}` },
        () => { fetchComments(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [predictionId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('prediction_comments')
        .select('*, profiles(username, avatar_url)')
        .eq('prediction_id', predictionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments((data as unknown as Comment[]) || []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('prediction_comments').insert({
        prediction_id: predictionId,
        user_id: user.id,
        content: text.trim(),
      });
      if (error) throw error;
      setText('');
      await fetchComments();
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase.from('prediction_comments').delete().eq('id', commentId);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const timeAgo = (date: string) => {
    const parsed = new Date(date).getTime();
    if (isNaN(parsed)) return '—';
    const ms = Date.now() - parsed;
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return t('comments.just_now');
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div style={{
      background: '#141C2B', border: '1px solid #243044',
      borderRadius: 16, padding: isMobile ? 18 : 24, marginTop: 20,
    }}>
      <h3 style={{
        fontFamily: "'Bangers', cursive", fontSize: isMobile ? 20 : 24,
        color: '#FFD60A', margin: '0 0 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <MessageCircle size={20} />
        {t('comments.title')} ({comments.length})
      </h3>

      {/* Comments list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 56, background: '#0B1120', borderRadius: 10, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <MessageCircle size={32} color="#334155" style={{ margin: '0 auto 8px' }} />
          <p style={{ color: '#475569', fontSize: 13 }}>{t('comments.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
          {comments.map(comment => (
            <div key={comment.id} style={{
              display: 'flex', gap: 10,
              padding: '12px 14px',
              background: '#0B1120', borderRadius: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: comment.user_id === user?.id ? '#FFD60A' : 'rgba(255,214,10,0.15)',
                color: comment.user_id === user?.id ? '#0B1120' : '#FFD60A',
                fontSize: 13, fontWeight: 700,
              }}>
                {comment.profiles?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#FFD60A', fontSize: 13, fontWeight: 600 }}>
                    @{comment.profiles?.username || 'unknown'}
                  </span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{timeAgo(comment.created_at)}</span>
                  {comment.user_id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: 2, marginLeft: 'auto',
                      }}
                    >
                      <Trash2 size={13} color="#64748B" />
                    </button>
                  )}
                </div>
                <p style={{ color: '#E2E8F0', fontSize: 14, marginTop: 4, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      {isAuthenticated ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t('comments.placeholder')}
            maxLength={500}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 12,
              background: '#0B1120', border: '1px solid rgba(255,214,10,0.2)',
              color: '#E2E8F0', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            style={{
              padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: text.trim() ? '#FFD60A' : '#1C2538',
              color: text.trim() ? '#0B1120' : '#475569',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      ) : (
        <p style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
          {t('comments.login_required')}
        </p>
      )}
    </div>
  );
}
