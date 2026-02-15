import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { key: 'anime', emoji: '🎌' },
  { key: 'series', emoji: '📺' },
  { key: 'movie', emoji: '🎬' },
  { key: 'sport', emoji: '⚽' },
  { key: 'music', emoji: '🎵' },
  { key: 'other', emoji: '🌍' },
] as const;

interface Show {
  id: string;
  title: string;
  category: string;
}

export default function CreatePrediction() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [showId, setShowId] = useState('');
  const [shows, setShows] = useState<Show[]>([]);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [showsLoading, setShowsLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true });
  }, [isAuthenticated, navigate]);

  // Fetch shows from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('shows').select('id, title, category').order('title');
        if (error) console.error('Shows fetch error:', error);
        if (data) setShows(data);
      } catch (err) {
        console.error('Shows fetch failed:', err);
      } finally {
        setShowsLoading(false);
      }
    })();
  }, []);

  // Filter shows by selected category
  const filteredShows = category ? shows.filter(s => s.category === category) : shows;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !showId || !deadline || !user) {
      toast.error(t('create.fill_required'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('predictions').insert({
        title,
        description: description || null,
        show_id: showId,
        creator_id: user.id,
        deadline: new Date(deadline).toISOString(),
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

          {/* Category Selector */}
          <div>
            <Label>{t('create.select_show')} *</Label>
            {showsLoading ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: 36, width: 80, background: '#1C2538', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.key} type="button" onClick={() => { setCategory(c.key); setShowId(''); }}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                        background: category === c.key ? '#FFD60A' : '#1C2538',
                        color: category === c.key ? '#0B1120' : '#94A3B8',
                      }}>
                      {c.emoji} {t(`categories.${c.key}`) || c.key}
                    </button>
                  ))}
                </div>

                {/* Show within category */}
                {category && filteredShows.length > 0 && (
                  <select value={showId} onChange={e => setShowId(e.target.value)} required style={inputStyle}>
                    <option value="">{t('create.select_show_placeholder')}</option>
                    {filteredShows.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}
                {category && filteredShows.length === 0 && (
                  <p style={{ color: '#64748B', fontSize: 13 }}>{t('create.no_shows_in_category')}</p>
                )}
              </>
            )}
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
};
