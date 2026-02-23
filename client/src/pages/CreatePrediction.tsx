import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Globe, Lock } from 'lucide-react';
import { supabase, withTimeout } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function CreatePrediction() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'official' | 'private'>('official');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadlineDate) {
      toast.error(t('create.fill_required'));
      return;
    }

    const deadlineAt = new Date(`${deadlineDate}T${deadlineTime || '23:59'}`).toISOString();

    setLoading(true);
    try {
      const { data, error } = await withTimeout(supabase.rpc('create_prediction', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_type: type,
        p_deadline_at: deadlineAt,
      }), 8000);

      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result.error) { toast.error(result.error); return; }

      toast.success(t('create.success'));

      if (type === 'private' && result.visibility_token) {
        navigate(`/p/${result.visibility_token}`);
      } else {
        navigate(`/prediction/${result.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{
          fontFamily: "'Bangers', cursive", fontSize: isMobile ? 28 : 36,
          color: '#FFD60A', marginBottom: 24, letterSpacing: 1.5,
        }}>
          {t('predictions.create')}
        </h1>

        <form onSubmit={handleSubmit} style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: 16, padding: isMobile ? 20 : 32,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Type selector */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {t('create.type')}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['official', 'private'] as const).map(tp => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setType(tp)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                    fontWeight: 700, fontSize: 14, border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: type === tp ? '#FFD60A' : '#0B1120',
                    color: type === tp ? '#0B1120' : '#64748B',
                    transition: 'all 0.2s',
                  }}
                >
                  {tp === 'official' ? <Globe size={16} /> : <Lock size={16} />}
                  {t(`create.${tp}`)}
                </button>
              ))}
            </div>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>
              {type === 'official' ? t('create.official_hint') : t('create.private_hint')}
            </p>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t('create.title')} *
            </label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('create.title_placeholder')}
              maxLength={200} required style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t('create.description')}
            </label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder={t('create.description_placeholder')}
              maxLength={1000} rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {t('create.deadline')} *
              </label>
              <input
                type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} required style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {t('create.time')}
              </label>
              <input
                type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            cursor: 'pointer', fontWeight: 700, fontSize: 16,
            background: '#FFD60A', color: '#0B1120',
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
          }}>
            {loading ? t('common.loading') : t('predictions.create')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
