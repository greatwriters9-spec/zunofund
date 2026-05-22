-- Run in Supabase SQL Editor (as postgres) OR via: node scripts/test-daily-compound.mjs --prepare
-- Prepares all non-admin investors with balance for the next compound tick.

SELECT public.admin_prepare_investors_for_compound(true, true);

SELECT eligibility, count(*) AS n
FROM public.compound_eligibility_report()
GROUP BY 1
ORDER BY 1;

SELECT public.run_daily_investment_jobs();

SELECT eligibility, count(*) AS n
FROM public.compound_eligibility_report()
GROUP BY 1
ORDER BY 1;
