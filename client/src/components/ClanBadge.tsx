import { useTranslation } from 'react-i18next';
import { Shield, Star, Gem, Crown, Zap } from 'lucide-react';
import { getClanLevel, getNextLevelXP, getCurrentLevelXP } from '../types';

const LEVEL_ICONS = [Shield, Star, Star, Crown, Gem];

/* ---- Badge (icon + title) ---- */
export function ClanBadge({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const info = getClanLevel(level);
  const Icon = LEVEL_ICONS[Math.min(level - 1, 4)];
  const s = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  const fs = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
  const px = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const py = size === 'sm' ? 2 : size === 'lg' ? 6 : 4;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 3 : 5,
      padding: `${py}px ${px}px`, borderRadius: 20,
      background: `${info.color}18`,
      border: `1px solid ${info.color}40`,
      fontSize: fs, fontWeight: 800, color: info.color,
      letterSpacing: 0.5, textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <Icon size={s} strokeWidth={2.5} />
      {info.title}
    </span>
  );
}

/* ---- XP Progress Bar ---- */
export function ClanXPBar({ xp, level, showLabel = true }: { xp: number; level: number; showLabel?: boolean }) {
  const { t } = useTranslation();
  const info = getClanLevel(level);
  const currentMin = getCurrentLevelXP(level);
  const nextTarget = getNextLevelXP(level);
  const isMaxLevel = level >= 5;
  const progress = isMaxLevel ? 100 : Math.min(100, ((xp - currentMin) / (nextTarget - currentMin)) * 100);

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6, fontSize: 12,
        }}>
          <span style={{ color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} color={info.color} />
            {t('clans.level')} {level}
          </span>
          <span style={{ color: '#64748B', fontWeight: 500 }}>
            {isMaxLevel
              ? `${xp.toLocaleString()} XP — MAX`
              : `${xp.toLocaleString()} / ${nextTarget.toLocaleString()} XP`
            }
          </span>
        </div>
      )}
      <div style={{
        height: 8, borderRadius: 4, overflow: 'hidden',
        background: '#1C2538',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          borderRadius: 4,
          background: isMaxLevel
            ? `linear-gradient(90deg, ${info.color}, #E040FB, #00D4FF)`
            : `linear-gradient(90deg, ${info.color}99, ${info.color})`,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
    </div>
  );
}

/* ---- Level Shield (large decorative) ---- */
export function ClanLevelShield({ level, size = 64 }: { level: number; size?: number }) {
  const info = getClanLevel(level);
  const Icon = LEVEL_ICONS[Math.min(level - 1, 4)];

  return (
    <div style={{
      width: size, height: size,
      borderRadius: 16,
      background: `linear-gradient(135deg, ${info.color}25, ${info.color}08)`,
      border: `2px solid ${info.color}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Icon size={size * 0.45} color={info.color} strokeWidth={2} />
      <span style={{
        position: 'absolute', bottom: -4, right: -4,
        background: info.color, color: '#0B1120',
        fontSize: size * 0.2, fontWeight: 900,
        width: size * 0.35, height: size * 0.35,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {level}
      </span>
    </div>
  );
}
