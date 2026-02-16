import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';

export interface PredictionCardPrediction {
  id: string;
  title: string;
  total_yes: number;
  total_no: number;
  total_pool: number;
  deadline: string;
  mode?: 'official' | 'unofficial';
  status: 'active' | 'resolved_yes' | 'resolved_no' | 'cancelled';
  shows?: { title: string; category?: string };
  profiles?: { username: string };
}

interface PredictionCardProps {
  prediction: PredictionCardPrediction;
}

function formatRelativeTime(deadline: string, t: TFunction): string {
  const now = new Date();
  const end = new Date(deadline);
  if (isNaN(end.getTime())) return '—';
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs <= 0) return t('predictions.expired');
  if (diffDays > 0) return t('predictions.days_left', { count: diffDays });
  if (diffHours > 0) return t('predictions.hours_left', { count: diffHours });
  if (diffMins > 0) return t('predictions.minutes_left', { count: diffMins });
  return t('predictions.ending_soon');
}

const badgeBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 20,
};

function getStatusBadge(
  status: PredictionCardPrediction['status'],
  deadline: string,
  t: TFunction
) {
  const deadlineMs = new Date(deadline).getTime();
  const isExpired = !isNaN(deadlineMs) && deadlineMs <= Date.now();

  if (status === 'cancelled' || (status === 'active' && isExpired)) {
    return (
      <span style={{ ...badgeBase, background: 'rgba(255,71,87,0.15)', color: '#FF4757' }}>
        {t('predictions.expired')}
      </span>
    );
  }
  if (status === 'resolved_yes' || status === 'resolved_no') {
    return (
      <span style={{ ...badgeBase, background: 'rgba(255,214,10,0.15)', color: '#FFD60A' }}>
        {t('predictions.resolved')}
      </span>
    );
  }
  return (
    <span style={{ ...badgeBase, background: 'rgba(46,213,115,0.15)', color: '#2ED573' }}>
      {t('predictions.active')}
    </span>
  );
}

export default function PredictionCard({ prediction }: PredictionCardProps) {
  const { t } = useTranslation();
  const {
    id,
    title,
    total_yes,
    total_no,
    total_pool,
    deadline,
    status,
    shows,
    profiles,
  } = prediction;

  const total = (total_yes ?? 0) + (total_no ?? 0) || 1;
  const yesPercent = ((total_yes ?? 0) / total) * 100;
  const category = shows?.category ?? 'other';

  return (
    <Link to={`/prediction/${id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <motion.article
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          background: '#141C2B', border: '1px solid rgba(255,214,10,0.15)',
          borderRadius: 12, padding: 16, cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(255,214,10,0.4)';
          e.currentTarget.style.background = '#1C2538';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,214,10,0.15)';
          e.currentTarget.style.background = '#141C2B';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              ...badgeBase,
              background: 'rgba(255,214,10,0.12)', color: '#FFD60A', textTransform: 'capitalize',
            }}>
              {t(`categories.${category}`, { defaultValue: category })}
            </span>
            {prediction.mode === 'unofficial' ? (
              <span style={{ ...badgeBase, background: 'rgba(224,64,251,0.15)', color: '#E040FB' }}>
                {t('predictions.unofficial_badge')}
              </span>
            ) : (
              <span style={{ ...badgeBase, background: 'rgba(0,212,255,0.12)', color: '#00D4FF' }}>
                {t('predictions.official_badge')}
              </span>
            )}
          </div>
          {getStatusBadge(status, deadline, t)}
        </div>

        <h3 style={{
          fontWeight: 600, color: '#E2E8F0', marginBottom: 4,
          fontSize: 15, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </h3>

        {shows?.title && profiles?.username && (
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
            {shows.title} · @{profiles.username}
          </p>
        )}
        {shows?.title && !profiles?.username && (
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>{shows.title}</p>
        )}
        {!shows?.title && profiles?.username && (
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>@{profiles.username}</p>
        )}

        {/* YES/NO bar */}
        <div style={{
          height: 6, borderRadius: 3, overflow: 'hidden',
          display: 'flex', background: '#0B1120', marginBottom: 12,
        }}>
          <div style={{ width: `${yesPercent}%`, background: '#2ED573', transition: 'width 0.3s' }} />
          <div style={{ width: `${100 - yesPercent}%`, background: '#FF4757', transition: 'width 0.3s' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: '#FFD60A', fontWeight: 600 }}>
            {t('predictions.pool')}: {(total_pool ?? 0).toLocaleString()}
          </span>
          <span style={{ color: '#64748B' }}>
            {formatRelativeTime(deadline, t)}
          </span>
        </div>
      </motion.article>
    </Link>
  );
}
