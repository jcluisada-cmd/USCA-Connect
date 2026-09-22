-- ════════════════════════════════════════════════════════════════════
-- Migration v41 — Purge de l'historique pg_cron + récupération d'espace (2026-09-22)
-- ════════════════════════════════════════════════════════════════════
-- Contexte (audit 2026-09-22) : la BDD pesait 288 Mo pour ~3 patients.
--   - cron.job_run_details : 218 k lignes / 101 Mo — le job `usca-push-reminders`
--     tourne chaque minute depuis avril et pg_cron ne purge jamais son historique.
--   - net._http_response : 168 Mo d'espace mort (bloat) pour ~360 lignes vivantes
--     (pg_net supprime les réponses après 6 h, mais l'espace n'est pas rendu au disque).
-- Aucune donnée applicative touchée : uniquement des journaux techniques.
--
-- À exécuter dans Supabase → SQL Editor, en 3 blocs SÉPARÉS
-- (VACUUM FULL ne peut pas tourner dans une transaction).
-- ════════════════════════════════════════════════════════════════════

-- ── Bloc 1 : purge de l'historique > 7 jours ─────────────────────────
delete from cron.job_run_details where start_time < now() - interval '7 days';

-- ── Bloc 2 : job quotidien de purge (03:15 UTC) — évite la re-croissance ─
-- Bloc DO (pas un SELECT) : le SQL Editor Supabase ajoute « limit 100 » aux SELECT,
-- ce qui cassait `select cron.schedule(...)` (erreur 42601 near "limit").
do $$
begin
  perform cron.schedule(
    'usca-purge-cron-history',
    '15 3 * * *',
    $job$delete from cron.job_run_details where start_time < now() - interval '7 days'$job$
  );
end $$;

-- ── Bloc 3 : rendre l'espace disque (à lancer seul, hors transaction) ──
vacuum full cron.job_run_details;
vacuum full net._http_response;

-- ── Vérification ─────────────────────────────────────────────────────
-- select pg_size_pretty(pg_database_size(current_database()));   -- attendu : ~20-30 Mo
-- select jobname, schedule, active from cron.job;                -- 2 jobs attendus
