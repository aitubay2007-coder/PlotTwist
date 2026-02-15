-- PlotTwist: Resolve Prediction & Distribute Winnings
-- Run this in Supabase SQL Editor

-- ==========================================
-- RPC: Resolve a prediction and pay out winners
-- ==========================================
CREATE OR REPLACE FUNCTION public.resolve_prediction(
  pred_id UUID,
  outcome TEXT  -- 'yes' or 'no'
)
RETURNS JSON AS $$
DECLARE
  pred RECORD;
  winning_side TEXT;
  losing_side TEXT;
  winning_pool INTEGER;
  total_pool INTEGER;
  bet RECORD;
  payout INTEGER;
  winners_count INTEGER := 0;
  total_paid INTEGER := 0;
BEGIN
  -- 1. Get prediction
  SELECT * INTO pred FROM public.predictions WHERE id = pred_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Prediction not found');
  END IF;

  -- 2. Check it's still active
  IF pred.status != 'active' THEN
    RETURN json_build_object('error', 'Prediction already resolved');
  END IF;

  -- 3. Check caller is the creator
  IF pred.creator_id != auth.uid() THEN
    RETURN json_build_object('error', 'Only the creator can resolve');
  END IF;

  -- 4. Validate outcome
  IF outcome NOT IN ('yes', 'no') THEN
    RETURN json_build_object('error', 'Invalid outcome');
  END IF;

  -- 5. Set sides
  winning_side := outcome;
  losing_side := CASE WHEN outcome = 'yes' THEN 'no' ELSE 'yes' END;
  winning_pool := CASE WHEN outcome = 'yes' THEN pred.total_yes ELSE pred.total_no END;
  total_pool := pred.total_pool;

  -- 6. Update prediction status
  UPDATE public.predictions
  SET status = CASE WHEN outcome = 'yes' THEN 'resolved_yes' ELSE 'resolved_no' END
  WHERE id = pred_id;

  -- 7. Pay out winners proportionally
  IF winning_pool > 0 AND total_pool > 0 THEN
    FOR bet IN
      SELECT b.user_id, b.amount
      FROM public.bets b
      WHERE b.prediction_id = pred_id AND b.position = winning_side
    LOOP
      -- Payout = (bet_amount / winning_pool) * total_pool
      payout := ROUND((bet.amount::NUMERIC / winning_pool::NUMERIC) * total_pool::NUMERIC);

      -- Add coins to winner
      UPDATE public.profiles
      SET coins = coins + payout,
          reputation = reputation + 10
      WHERE id = bet.user_id;

      -- Log transaction
      INSERT INTO public.transactions (user_id, type, amount, reference_id, description)
      VALUES (bet.user_id, 'bet_won', payout, pred_id, 'Won prediction bet');

      winners_count := winners_count + 1;
      total_paid := total_paid + payout;
    END LOOP;
  END IF;

  -- 8. Give reputation to losers too (participation bonus)
  UPDATE public.profiles
  SET reputation = reputation + 2
  WHERE id IN (
    SELECT b.user_id FROM public.bets b
    WHERE b.prediction_id = pred_id AND b.position = losing_side
  );

  RETURN json_build_object(
    'success', true,
    'outcome', outcome,
    'winners', winners_count,
    'total_paid', total_paid,
    'total_pool', total_pool
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
