-- Store exactly one slug per tier for daily_compound_percent_for_plan (substring-safe).
UPDATE public.investors
SET investment_plan = CASE
  WHEN lower(coalesce(trim(investment_plan), '')) LIKE '%elite%' THEN 'Elite'
  WHEN lower(coalesce(trim(investment_plan), '')) LIKE '%growth%' THEN 'Growth'
  WHEN lower(coalesce(trim(investment_plan), '')) LIKE '%pro%' THEN 'Pro'
  WHEN lower(coalesce(trim(investment_plan), '')) LIKE '%starter%' THEN 'Starter'
  ELSE 'Starter'
END;
