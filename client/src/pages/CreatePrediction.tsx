import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap, Globe, Users, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function CreatePrediction() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'official' | 'unofficial'>('official');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true });
  }, [isAuthenticated, navigate]);

  // Official predictions are always public
  useEffect(() => {
    if (mode === 'official') setVisibility('public');
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline || !user) {
      toast.error(t('create.fill_required'));
      return;
    }
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      toast.error(t('create.fill_required'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('predictions').insert({
        title,
        description: description || null,
        creator_id: user.id,
        mode,
        visibility,
        deadline: deadlineDate.toISOString(),
      });
      if (error) throw error;
      toast.success(t('create.success'));
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('create.failed');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 44, color: '#FFD60A', marginBottom: 32, textShadow: '2px 2px 0 #000' }}>
          {t('create.title')}
        </h1>

        <form onSubmit={handleSubmit} style={{ background: '#141C2B', border: '1px solid #243044', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Mode Selector */}
          <div>
            <Label>{t('create.mode_label')} *</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                onClick={() => setMode('official')}
                style={{
                  padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                  border: mode === 'official' ? '2px solid #FFD60A' : '2px solid #243044',
                  background: mode === 'official' ? 'rgba(255,214,10,0.08)' : '#0B1120',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                <Globe size={22} color={mode === 'official' ? '#FFD60A' : '#64748B'} />
                <span style={{ fontWeight: 700, fontSize: 14, color: mode === 'official' ? '#FFD60A' : '#94A3B8' }}>
                  {t('create.mode_official')}
                </span>
                <span style={{ fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 1.3 }}>
                  {t('create.mode_official_desc')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('unofficial')}
                style={{
                  padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                  border: mode === 'unofficial' ? '2px solid #E040FB' : '2px solid #243044',
                  background: mode === 'unofficial' ? 'rgba(224,64,251,0.08)' : '#0B1120',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                <Users size={22} color={mode === 'unofficial' ? '#E040FB' : '#64748B'} />
                <span style={{ fontWeight: 700, fontSize: 14, color: mode === 'unofficial' ? '#E040FB' : '#94A3B8' }}>
                  {t('create.mode_unofficial')}
                </span>
                <span style={{ fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 1.3 }}>
                  {t('create.mode_unofficial_desc')}
                </span>
              </button>
            </div>
          </div>

          {/* Visibility (only for unofficial) */}
          {mode === 'unofficial' && (
            <div>
              <Label>{t('create.visibility_label')}</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  style={{
                    padding: '12px', borderRadius: 10, cursor: 'pointer',
                    border: visibility === 'public' ? '2px solid #2ED573' : '2px solid #243044',
                    background: visibility === 'public' ? 'rgba(46,213,115,0.08)' : '#0B1120',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <Globe size={16} color={visibility === 'public' ? '#2ED573' : '#64748B'} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: visibility === 'public' ? '#2ED573' : '#94A3B8' }}>
                    {t('create.visibility_public')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  style={{
                    padding: '12px', borderRadius: 10, cursor: 'pointer',
                    border: visibility === 'private' ? '2px solid #F59E0B' : '2px solid #243044',
                    background: visibility === 'private' ? 'rgba(245,158,11,0.08)' : '#0B1120',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <Lock size={16} color={visibility === 'private' ? '#F59E0B' : '#64748B'} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: visibility === 'private' ? '#F59E0B' : '#94A3B8' }}>
                    {t('create.visibility_private')}
                  </span>
                </button>
              </div>
              {visibility === 'private' && (
                <p style={{ color: '#F59E0B', fontSize: 12, marginTop: 8, background: 'rgba(245,158,11,0.06)', padding: '8px 12px', borderRadius: 8 }}>
                  {t('create.private_notice')}
                </p>
              )}
            </div>
          )}

          {/* Prediction Title */}
          <div>
            <Label>{t('create.prediction_title')} *</Label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('create.prediction_placeholder')} required maxLength={200}
              style={inputStyle}
            />
            <p style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{title.length}/200</p>
          </div>

          {/* Description */}
          <div>
            <Label>{t('create.description')}</Label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder={t('create.description_placeholder')} rows={3} maxLength={500}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          {/* Deadline */}
          <div>
            <Label>{t('create.deadline_label')} *</Label>
            <input
              type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              min={minDate} required style={inputStyle}
            />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#FFD60A', color: '#0B1120', fontWeight: 700, fontSize: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: loading ? 0.5 : 1,
          }}>
            <Zap size={18} />
            {loading ? t('common.loading') : t('create.submit')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{children}</label>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
  background: '#0B1120', border: '1px solid #243044', color: '#E2E8F0', outline: 'none',
  boxSizing: 'border-box',
};
