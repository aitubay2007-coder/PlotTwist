import { useState, useEffect, useRef } from 'react';
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
  const [showName, setShowName] = useState('');
  const [shows, setShows] = useState<Show[]>([]);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true });
  }, [isAuthenticated, navigate]);

  // Fetch existing shows for autocomplete
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('shows').select('id, title, category').order('title');
        if (error) console.error('Shows fetch error:', error);
        if (data) setShows(data);
      } catch (err) {
        console.error('Shows fetch failed:', err);
      }
    })();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter existing shows for suggestions
  const suggestions = category && showName.trim().length >= 1
    ? shows.filter(s => s.category === category && (s.title ?? '').toLowerCase().includes(showName.trim().toLowerCase()))
    : [];

  // Find or create show, returns show ID
  async function findOrCreateShow(): Promise<string | null> {
    const trimmed = showName.trim();
    if (!trimmed || !category) return null;

    const existing = shows.find(
      s => s.category === category && (s.title ?? '').toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from('shows')
      .insert({ title: trimmed, category })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !showName.trim() || !category || !deadline || !user) {
      toast.error(t('create.fill_required'));
      return;
    }
    setLoading(true);
    try {
      const showId = await findOrCreateShow();
      if (!showId) throw new Error(t('create.failed'));

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
            <Label>{t('create.category')} *</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => { setCategory(c.key); setShowName(''); }}
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
          </div>

          {/* Show Name Input with Autocomplete */}
          {category && (
            <div style={{ position: 'relative' }} ref={suggestionsRef}>
              <Label>{t('create.show_name')} *</Label>
              <input
                type="text"
                value={showName}
                onChange={e => { setShowName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t('create.show_name_placeholder')}
                required
                maxLength={120}
                style={inputStyle}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#1C2538', border: '1px solid #243044', borderRadius: 10,
                  marginTop: 4, maxHeight: 180, overflowY: 'auto',
                }}>
                  {suggestions.slice(0, 8).map(s => (
                    <button
                      key={s.id} type="button"
                      onClick={() => { setShowName(s.title); setShowSuggestions(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: 'transparent', border: 'none', color: '#E2E8F0',
                        fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #243044',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#243044')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{t('create.show_name_hint')}</p>
            </div>
          )}

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
