# HANDOFF — USCA Connect

> Point d'entrée pour reprendre le travail. Lire ce fichier en premier, avant `STATE.md` /
> `DECISIONS.md`. Mis à jour au 2026-09-22 (audit général + v4.50).

## Current objective

Aucun chantier ouvert. La session du 2026-09-22 a fait un audit général (prod, BDD Supabase
live, code) après 3 mois sans activité, puis livré les correctifs validés par JC (v4.50).

## Current state

- **Terminé (v4.50, commit `a2d1c80`, poussé, vérifié en prod)** :
  - `functions/api/delete-user.js` sécurisé (JWT validé + `is_admin` exigé + userId UUID).
  - `@supabase/supabase-js` épinglé `@2.117.0` (6 pages) ; react/react-dom `@18.3.1` dans
    l'ancienne `staff/toolbox.html` (conservée pour les liens du livret IFSI).
  - `extern/` et `etudiant/` basculés sur la Toolbox Vite (`staff/toolbox-app/dist/`).
  - SW `usca-v4.50` (+ pré-cache `shared/modules-config.js`, `shared/module-visibility.js`).
- **Terminé** : purge BDD v41 — DELETE + `cron.schedule` lancés par JC (SQL Editor), `VACUUM FULL`
  par Claude via MCP (autorisé, contrairement au DELETE) → BDD 288 Mo → 20 Mo, job de purge actif.
- **À faire / reporté** : voir `STATE.md` §« Sécurité & exploitation ».

## Important changes

`functions/api/delete-user.js`, `index.html`, `patient/index.html`, `admin/index.html`,
`extern/index.html`, `etudiant/index.html`, `pds/index.html`, `staff/toolbox.html`, `sw.js`,
`migrations/supabase-migration-v41.sql`, `CHANGELOG.md`, `CLAUDE.md`, `.claude/context/*`.

## Decisions needed to continue

- RLS `patients` / `substances_patient` lisibles en anon : **reporté par JC** — il faut d'abord
  une spec mesurant l'impact sur la connexion patient (voir `DECISIONS.md` §Audit 2026-09-22).
- Mot de passe sur `affiche-equipe.html` : **conservé par choix de JC**, ne pas re-proposer.

## Verification

- Prod après déploiement : `sw.js` = `usca-v4.50` ; `POST /api/delete-user` → 401 (faux jeton),
  401 (sans header), 400 (userId non UUID) ; pages servent `supabase-js@2.117.0` ;
  extern/étudiant/admin référencent `toolbox-app/dist/index.html`.
- Preview locale : Toolbox Vite rendue OK en `?embedded=true` (⚠️ avec `npx serve`, utiliser
  l'URL `/staff/toolbox-app/dist/` avec slash final — sinon 404 sur `assets/`, artefact local
  uniquement ; Cloudflare redirige correctement).
- **Non testé** : chemin positif de `delete-user` (suppression réelle par un admin) — nécessite
  une session admin. À valider par JC en supprimant un compte de test depuis admin/.
- **Non testé** : onglet Toolbox d'extern/ avec une vraie session externe (garde de session).
- Backend sain : cron `usca-push-reminders` chaque minute, 0 échec/7 j, appels push en 200.

## Open issues

- `push_subscriptions` en SELECT/UPDATE/DELETE publics ; advisors Supabase (fonctions
  SECURITY DEFINER exécutables par anon, search_path mutable, leaked-password protection off).
- Bundles `staff/toolbox-app/dist/assets/*` hors pré-cache SW.
- Résidu `.git/worktrees/unruffled-euclid-4c2c65` verrouillé (warning bénin au push).

## Important failed attempts

- `execute_sql` avec `DELETE FROM cron.job_run_details` / `cron.schedule` → refusé par le
  classifieur de permissions (« mass delete »). Ne pas retenter : passer par JC + v41.

## Next action

Au choix de JC : spec RLS patients, étape 4 Workbox, ou MetaboScope chantier B.

## Read if needed

- `STATE.md` — backlog complet + constats de l'audit.
- `DECISIONS.md` — arbitrages de l'audit 2026-09-22 (affiche, RLS patients, purge).
- `CHANGELOG.md` §v4.50.
- `SETUP_PUSH.md` — si travail sur les notifications / cron.
