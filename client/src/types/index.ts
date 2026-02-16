export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  reputation: number;
  country: string | null;
  last_daily_bonus: string | null;
  created_at: string;
}

export interface Show {
  id: string;
  title: string;
  category: 'anime' | 'series' | 'movie' | 'sport' | 'music' | 'other';
  poster_url: string | null;
  status: 'ongoing' | 'completed';
  created_at: string;
}

export interface Prediction {
  id: string;
  title: string;
  description: string | null;
  show_id: string;
  creator_id: string;
  status: 'active' | 'resolved_yes' | 'resolved_no' | 'cancelled';
  deadline: string;
  total_yes: number;
  total_no: number;
  total_pool: number;
  created_at: string;
  shows?: Pick<Show, 'title' | 'poster_url' | 'category'>;
  profiles?: Pick<Profile, 'username' | 'avatar_url'>;
  bets?: Bet[];
}

export interface Bet {
  id: string;
  user_id: string;
  prediction_id: string;
  position: 'yes' | 'no';
  amount: number;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'avatar_url'>;
}

export interface Clan {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  invite_code: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'avatar_url'>;
  clan_members?: ClanMember[];
}

export interface ClanLeaderboardEntry {
  id: string;
  name: string;
  description: string | null;
  xp: number;
  level: number;
  created_at: string;
  member_count: number;
  total_reputation: number;
  total_coins: number;
}

export const CLAN_LEVELS = [
  { level: 1, xp: 0, title: 'Rookie', color: '#CD7F32' },
  { level: 2, xp: 500, title: 'Rising', color: '#C0C0C0' },
  { level: 3, xp: 2000, title: 'Veteran', color: '#FFD60A' },
  { level: 4, xp: 5000, title: 'Elite', color: '#00D4FF' },
  { level: 5, xp: 15000, title: 'Legendary', color: '#E040FB' },
] as const;

export function getClanLevel(level: number) {
  return CLAN_LEVELS.find(l => l.level === level) || CLAN_LEVELS[0];
}

export function getNextLevelXP(level: number): number {
  const next = CLAN_LEVELS.find(l => l.level === level + 1);
  return next ? next.xp : CLAN_LEVELS[CLAN_LEVELS.length - 1].xp;
}

export function getCurrentLevelXP(level: number): number {
  const current = CLAN_LEVELS.find(l => l.level === level);
  return current ? current.xp : 0;
}

export interface ClanMember {
  clan_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles?: Pick<Profile, 'username' | 'avatar_url' | 'coins' | 'reputation'>;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  prediction_id: string;
  challenger_position: 'yes' | 'no';
  challenged_position: 'yes' | 'no';
  amount: number;
  status: 'pending' | 'accepted' | 'declined' | 'resolved';
  created_at: string;
  predictions?: Pick<Prediction, 'title'>;
  challenger?: Pick<Profile, 'username' | 'avatar_url'>;
  challenged?: Pick<Profile, 'username' | 'avatar_url'>;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'signup_bonus' | 'bet_placed' | 'bet_won' | 'challenge_sent' | 'challenge_accepted' | 'challenge_won' | 'challenge_refund' | 'daily_bonus';
  amount: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}
