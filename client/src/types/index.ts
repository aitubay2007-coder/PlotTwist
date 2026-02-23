export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  coins_balance: number;
  is_admin: boolean;
  last_daily_bonus: string | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  creator_id: string;
  type: 'official' | 'private';
  title: string;
  description: string | null;
  status: 'open' | 'resolved';
  deadline_at: string;
  resolved_outcome: 'yes' | 'no' | null;
  visibility_token: string | null;
  created_at: string;
  profiles?: { username: string };
}

export interface Bet {
  id: string;
  prediction_id: string;
  user_id: string;
  outcome: 'yes' | 'no';
  amount: number;
  created_at: string;
  username?: string;
  profiles?: { username: string };
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'bet' | 'payout' | 'bonus' | 'refund';
  delta: number;
  created_at: string;
}
