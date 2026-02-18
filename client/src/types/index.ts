export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  coins: number;
  reputation: number;
  country: string | null;
  last_daily_bonus: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Prediction {
  id: string;
  title: string;
  description: string | null;
  show_id: string | null;
  creator_id: string;
  mode: 'official' | 'unofficial';
  visibility: 'public' | 'private';
  status: 'active' | 'resolved_yes' | 'resolved_no' | 'cancelled';
  deadline: string;
  resolved_at: string | null;
  disputed: boolean;
  total_yes: number;
  total_no: number;
  total_pool: number;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'avatar_url'>;
  bets?: Bet[];
}

export interface PredictionDispute {
  id: string;
  prediction_id: string;
  user_id: string;
  vote: 'yes' | 'no';
  reason: string | null;
  created_at: string;
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

export interface Transaction {
  id: string;
  user_id: string;
  type: 'signup_bonus' | 'bet_placed' | 'bet_won' | 'challenge_sent' | 'challenge_accepted' | 'challenge_won' | 'challenge_refund' | 'daily_bonus';
  amount: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}
