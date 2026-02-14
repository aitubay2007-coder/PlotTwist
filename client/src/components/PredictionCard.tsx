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

function getStatusBadge(
  status: PredictionCardPrediction['status'],
  deadline: string,
  t: TFunction
) {
  const now = new Date();
  const end = new Date(deadline);
  const isExpired = end.getTime() <= now.getTime();

  if (status === 'cancelled' || (status === 'active' && isExpired)) {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-pt-red/20 text-pt-red">
        {t('predictions.expired')}
      </span>
    );
  }
  if (status === 'resolved_yes' || status === 'resolved_no') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-pt-yellow/20 text-pt-yellow">
        {t('predictions.resolved')}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-pt-green/20 text-pt-green">
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

  const total = total_yes + total_no || 1;
  const yesPercent = (total_yes / total) * 100;
  const category = shows?.category ?? 'other';

  return (
    <Link to={`/prediction/${id}`} className="block">
      <motion.article
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="bg-pt-card hover:bg-pt-card-hover border border-pt-yellow/20 hover:border-pt-yellow/50 rounded-lg p-4 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-pt-yellow/20 text-pt-yellow capitalize">
            {t(`categories.${category}`, { defaultValue: category })}
          </span>
          {getStatusBadge(status, deadline, t)}
        </div>

        <h3 className="font-semibold text-pt-white mb-1 line-clamp-2">{title}</h3>
        {shows?.title && profiles?.username && (
          <p className="text-sm text-pt-gray mb-3">
            {shows.title} · @{profiles.username}
          </p>
        )}
        {shows?.title && !profiles?.username && (
          <p className="text-sm text-pt-gray mb-3">{shows.title}</p>
        )}
        {!shows?.title && profiles?.username && (
          <p className="text-sm text-pt-gray mb-3">@{profiles.username}</p>
        )}

        {/* YES/NO bar */}
        <div className="h-2 rounded-full overflow-hidden bg-pt-dark flex mb-3">
          <div
            className="bg-pt-green transition-all"
            style={{ width: `${yesPercent}%` }}
          />
          <div
            className="bg-pt-red transition-all"
            style={{ width: `${100 - yesPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-pt-yellow font-medium">
            {t('predictions.pool')}: {total_pool.toLocaleString()}
          </span>
          <span className="text-pt-gray">
            {formatRelativeTime(deadline, t)}
          </span>
        </div>
      </motion.article>
    </Link>
  );
}
