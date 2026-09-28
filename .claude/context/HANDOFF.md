# HANDOFF — USCA Connect

> Point d'entrée pour reprendre le travail. Lire ce fichier en premier, avant `STATE.md` /
> `DECISIONS.md`. Mis à jour au 2026-09-28 (checkpoint consolidé de toutes les sessions du jour,
> avant archivage des sessions).

## Current objective

Pas de tâche en vol. La journée du 2026-09-28 a traité l'audit externe (faille `profiles`, Toolbox,
QCM externe). Un seul chantier est **fini mais non fusionné** : création des comptes soignants
côté serveur (branche `claude/wonderful-colden-130189`).

## Current state

- **Sur `main` et en prod** (`19b3618`, SW `usca-v4.53`) :
  - v4.51 — faille `profiles` + bouton ↺ externe ; migration v42 **exécutée** (vérifié en BDD live 2026-09-28).
  - v4.52 — Toolbox Vite : liens internes en chemins absolus (lot A du plan).
  - PR #3 — faits périmés corrigés dans les fichiers d'instructions Claude.
  - v4.53 — 4 bugs QCM externe (lot B) : reprise d'une session complète, bouton Suivant à double action,
    carte « Signalements QCM » ajoutée, filtre `user_id` dans `QCMEngine.getMy*`.
- **Fini, non fusionné** : création de comptes côté serveur (`0f35156`, branche poussée). Numérotée « v4.52 »
  par erreur → à renuméroter v4.54. Migration v43 **non exécutée**.
- **À faire** : lot C du plan (contenu QCM EDN, validation clinique JC) ; backlog dans `STATE.md`.

## Important changes (2026-09-28, sur main)

`extern/index.html`, `shared/qcm-engine.js`, `admin/index.html`, `shared/supabase.js`,
`staff/toolbox-app/src/App.jsx` + `dist/`, `migrations/supabase-migration-v42.sql`, `sw.js`,
`CHANGELOG.md`, `CLAUDE.md`, `MODULES.md`, `DB_SCHEMA.md`, `.claude/settings.json`, `.claude/context/*`,
`docs/superpowers/plans/2026-09-28-toolbox-qcm-fixes.md`.

## Decisions needed to continue

- **Fusionner la branche « comptes côté serveur »** (JC) — puis, dans l'ordre : déployer, tester une création
  de compte depuis admin/, exécuter `migrations/supabase-migration-v43.sql`, désactiver « Allow new users to
  sign up » (Supabase → Auth).
- **Rôles du mode tuteur** (`extern/index.html` ~l.789) : restreindre à médecin/admin ou corriger la doc.
- **Lot C QCM** : valider chaque correction clinique proposée dans le plan avant application.
- Toujours en attente (2026-09-22) : RLS `patients` lisible en anon — spec d'impact d'abord.

## Verification

- v4.53 : `node --check` OK ; Playwright avec Supabase simulé (stubs de `shared/supabase.js`/`auth.js`
  servis par `page.route`) → 4 scénarios OK sur le nouveau code, les 4 bugs reproduits sur l'ancien.
  **Non testé avec une vraie session externe** : lancer une session, répondre à la dernière question,
  fermer par ✕, reprendre → le score doit s'afficher directement.
- v4.52 : Playwright statique, 0 réponse ≥ 400 ; **reste à valider par JC** : onglet Toolbox dans admin/ et extern/.
- v4.51 : testé sur Postgres local (15 scénarios) ; policies/trigger/RPC présents en BDD live.
- `origin/main` = `main` local (dépôt principal avancé en fast-forward) ; worktrees propres.

## Open issues

- `push_subscriptions` publics ; advisors Supabase (SECURITY DEFINER exécutables par anon, search_path,
  leaked-password protection off).
- Bundles `staff/toolbox-app/dist/assets/*` hors pré-cache SW.
- Warning `failed to delete .git/worktrees/unruffled-euclid-4c2c65` à chaque fetch/push (bénin) →
  `git worktree prune` une fois les sessions fermées.
- Branches distantes obsolètes supprimables : `claude/compassionate-keller-ucoalh` (= PR #3), `cf-bisect`,
  `cloudflare/workers-autoconfig`. **Ne pas supprimer** `claude/wonderful-colden-130189`.

## Important failed attempts

- Test Playwright de `extern/` : un Service Worker enregistré au 1er chargement sert les vrais scripts
  et contourne `page.route` → désinscrire le SW + vider `caches` avant, et `route('**/sw.js', abort)`.
- Résolution de conflit de rebase refusée une fois par le classifieur de permissions (« ressources
  partagées ») tant que JC n'avait pas autorisé explicitement le rebase sur `main`.

## Next action

Rebaser `claude/wonderful-colden-130189` sur `main`, renuméroter en v4.54 (CHANGELOG, CLAUDE.md, `sw.js`),
`node --check`, pousser sur `main`, puis faire tester une création de compte à JC avant la migration v43.

## Read if needed

- `STATE.md` — backlog complet et état des branches.
- `DECISIONS.md` §« Sessions parallèles & versions (2026-09-28) ».
- `docs/superpowers/plans/2026-09-28-toolbox-qcm-fixes.md` — lot C.
- `CHANGELOG.md` §v4.51 à v4.53 ; `git show 0f35156` pour la branche comptes.
