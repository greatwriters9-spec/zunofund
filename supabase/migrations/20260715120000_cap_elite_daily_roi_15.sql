-- Align Elite tier marketing cap with admin target (max daily ROI 15%).
UPDATE public.investment_plans
SET daily_roi = 15, updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE lower(trim(name)) = 'elite'
  AND daily_roi > 15;
