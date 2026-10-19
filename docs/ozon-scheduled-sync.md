# Ozon scheduled finance sync

This change is staged for review and is **not deployed**. It does not create ERP sales reports or warehouse movements.

## Setup after review

1. Deploy `supabase/functions/ozon-scheduled-sync/index.ts` as a **new** Edge Function, leaving `ozon-sync` untouched. Its scheduler endpoint must accept the dedicated secret header; protect the endpoint with the secret and ensure JWT verification settings are compatible with server-to-server invocation. Never expose the secret to the frontend.
2. Set a strong random `OZON_SYNC_CRON_SECRET` in Supabase Edge Function secrets.
3. Set GitHub Actions repository secrets: `OZON_SYNC_URL` = the new function URL, and `OZON_SYNC_CRON_SECRET` = the **same** secret.
4. Run `workflow_dispatch` once and verify `ozon_sync_runs.status='completed'`, its period, operation counts and absence of errors.
5. Only then enable scheduled reporting based on freshness checks. GitHub scheduled workflows can be delayed; they are not guaranteed to finish before a 09:00 Moscow report.

The job runs Mondays and Wednesdays at 05:00 UTC (08:00 Moscow). Financial periods are computed automatically from the last Sunday at least 14 days old. Recent order trends require a **separate order-sync implementation**; this function only syncs Ozon financial accruals.

## Security and operational caveats

- Do not copy any real secret into GitHub source code, issues or pull requests.
- The current implementation uses a best-effort in-flight check; a DB-level lock is preferable before production if overlapping jobs are possible.
- Existing `ozon_sync_runs` defaults and Edge Function JWT gateway settings must be verified before deploying.
- The source of three deployed functions has been preserved in this branch for reproducibility. These copies are not credentials.
