# STATE — USCA Connect

> État actuel du projet. Pas un historique — voir `CHANGELOG.md` / `CLAUDE_ARCHIVE.md` pour ça.
> Dernière vérification : 2026-09-22 (audit général : prod, BDD Supabase live, code).

## Version courante

**v4.50** (2026-09-22) — sécurisation `delete-user`, CDN Supabase/React épinglés, extern/étudiant sur Toolbox Vite, SW `usca-v4.50`. Précédée de **v4.49** (2026-06-18) — Tailwind pré-compilé livré et confirmé en réalité :
`grep -rn "tailwindcss/browser" --include="*.html" .` sur l'arbre de travail principal
ne retourne **aucun résultat** (les seules occurrences restantes sont dans
`.claude/worktrees/*` — des worktrees Git obsolètes, hors périmètre, à ignorer).
CDN runtime retiré des 6 pages racine, remplacé par `shared/tailwind.css`
(généré via `@tailwindcss/cli@4.3.1` épinglé, `npm run build:css`). SW `usca-v4.49`.

**Correction apportée par cet audit** : `docs/superpowers/plans/2026-06-18-tailwind-precompile.md`
a toutes ses cases `- [ ]` non cochées (y compris Steps 6/7 de validation prod et Task 8
doc) — ce qui donnerait l'impression que le chantier est encore ouvert. **Ce n'est pas le
cas** : CHANGELOG.md et CLAUDE.md documentent déjà la livraison v4.49, et le code réel
confirme l'absence de CDN. Le plan n'a simplement pas été mis à jour case par case
(numérotation de version différente aussi : le plan visait v4.52, la livraison réelle
s'est faite en v4.49 — 3 versions "économisées" car les lots ont été groupés). Ignorer
les cases non cochées de ce plan ; se fier à CHANGELOG.md + `git log`.

## Fonctionnalités terminées (aperçu — détail dans `MODULES.md`)

- Login unifié (`index.html`) : onglets Patient/Soignant, mode dev, splash, bannière WebView iOS.
- Module Patient (`patient/`) : 9 cartes + post-cure, bouton craving.
- Module Soignant (`admin/`) : Dashboard + Toolbox (iframe) + Planning.
- Module Externe (`extern/`) : dashboard lecture seule + QCM EDN + mode tuteur.
- Module Livret IFSI (`etudiant/`) : SPA 14 chapitres, vue tuteur, export HTML.
- Module Post-cure (P8) : 100% local non-HDS, aucune donnée patient serveur.
- Dashboard PdS (`pds/`) : livré v4.39, sous-app + Cushman + transmissions.
- Toolbox V1 : 4 grandes + 5 petites cartes, dark mode sync, **migrée Vite** (v4.44, fin Babel in-browser).
- **Chantier modernisation incrémentale** : étape 1 (Toolbox→Vite, v4.44) ✅, étape 2 (dark
  mode sans reload, v4.45) ✅, étape 3 (Tailwind pré-compilé, v4.49) ✅. Reste étape 4 (Workbox) — voir À FAIRE.

## En cours

Rien en cours. v4.50 livrée et vérifiée en prod le 2026-09-22 (commit `a2d1c80`).
Purge BDD v41 exécutée (20 Mo). Aucune action en attente.

## Git — état local

- Branche `main`, synchronisée avec `origin/main`.
- Non commités volontairement (config locale, non applicatif) : `.claude/settings.local.json`,
  `.claude/launch.json`.
- `git push`/`fetch` affichent `failed to delete '.git/worktrees/unruffled-euclid-4c2c65':
  Permission denied` — résidu de worktree verrouillé, sans impact (push OK). Nettoyage :
  `git worktree prune` après fermeture des processus qui tiennent le dossier.

## À FAIRE (backlog actif)

### Sécurité & exploitation — audit 2026-09-22 (vérifié sur la BDD live + code)

- [x] ✅ v4.50 — 🔴 `functions/api/delete-user.js:38-44` : vérifie seulement la *présence* du header Authorization,
  ni validité JWT ni `is_admin` → n'importe qui peut supprimer un compte soignant (UUIDs visibles via
  `contenus_partages.cree_par`, lisible en anon). Fix : `GET /auth/v1/user` + contrôle `profiles.is_admin`.
- [ ] 🔴 (**reporté par JC 2026-09-22** — implications sur la connexion patient à mesurer avant d'agir) RLS `patients_select_all` (USING true, rôle public) : table patients lisible avec la clé anon,
  y compris le couple chambre + DDN = identifiants de connexion patient. Fix : RPC `verify_patient`
  SECURITY DEFINER, SELECT table réservé à `authenticated`. Idem `substances_patient_select_all`.
- [ ] ~~🔴 `affiche-equipe.html:164` publique avec le mot de passe staff commun~~ — **choix JC 2026-09-22 : conservé volontairement en ligne**, ne pas re-proposer.
- [ ] 🟠 `push_subscriptions` : SELECT/UPDATE/DELETE `true` pour public.
- [ ] 🟠 `contenus_partages` SELECT/INSERT `true` — risque déjà accepté (DECISIONS v4.42), à réévaluer.
- [x] ✅ 2026-09-22 — v41 exécutée (bloc 1 et 2 par JC, VACUUM par Claude) : **BDD 288 Mo → 20 Mo**, job `usca-purge-cron-history` (03:15 UTC) actif. Était : BDD 288 Mo dont 101 Mo `cron.job_run_details` (218 k lignes depuis avril, cron à la minute,
  jamais purgé) + 168 Mo de bloat `net._http_response`. Fix : purge >7 j + job de purge planifié +
  `VACUUM FULL net._http_response`.
- [x] ✅ v4.50 (→ `@2.117.0`) — 🟠 CDN flottant `@supabase/supabase-js@2` sur les 6 pages racine → épingler une version exacte.
- [x] ✅ v4.50 (react/react-dom de l'ancienne toolbox.html épinglés 18.3.1 ; fichier conservé pour les liens `lien_toolbox` du livret IFSI) — 🟠 `extern/index.html:739` et `etudiant/index.html:188` chargent encore l'ancienne `staff/toolbox.html`
  (Babel in-browser + `react@18` flottant unpkg) — la migration Vite v4.44 n'a couvert que `admin/`.
- [~] 🟡 SW : shared/module-visibility.js + modules-config.js ajoutés v4.50 ; reste bundles `toolbox-app/dist/assets/*` hors pré-cache.
- [ ] 🟡 Advisors Supabase : `save_volet_patient`/`rls_auto_enable` SECURITY DEFINER exécutables par anon,
  search_path mutable, leaked-password protection désactivée, 63 `auth_rls_initplan`.

### MetaboScope (prioritaire — voir `METABOSCOPE_APP.md` pour la roadmap complète)

- **Décision 2026-05-08** : `metaboscope/` dans USCA-Connect = source unique (repo d'origine figé).
- [x] Chantier A — Import docs/audits (livré 2026-05-08).
- [x] **Phase B — Intégration iframe Toolbox** : en réalité déjà livrée (constaté par l'audit du 2026-09-22) —
  iframe `../metaboscope/dist/index.html` dans `staff/toolbox-app/src/App.jsx:1467-1479`, pré-cache `sw.js:74-76`,
  bundles servis en prod (200). L'item « P0 bloquant » était périmé.
- [x] Chantier C — UX & cohérence USCA (livré v4.29→v4.33). C.3/C.4 abandonnés 2026-05-09.
- [ ] **Chantier B — Couverture v1.1** (P2) : ingestion ~30 molécules 1ère vague (anticoagulants
  oraux directs, statines, antifongiques azolés, immunosuppresseurs, macrolides). Arbitrer 30
  conflits puissance avant ingestion.
- [ ] **Chantier D — Workflow décisionnel** (P2) : Mode Ordonnance, suggestions alternatives,
  calculateurs combinés, bookmarks localStorage.
- [ ] **Chantier E — Couverture addicto avancée** (P3) : scénarios précâblés, PGx actionnable, veille NPS.
- [ ] **Chantier F — Hygiène technique** (P5) : décision build dist/, SW pré-cache bundles hashés, tests, a11y, perf.
- [ ] **6 décisions à trancher avec JC** avant exécution — voir `METABOSCOPE_APP.md` §8.

### Notifications push

- [ ] **V2 médecins — étape suivante** : étendre aux séances de thérapie complémentaire (V1 shippée v3.99).

### Chantier modernisation incrémentale

- [ ] **Étape 4 — Workbox** (dernière étape, pas encore planifiée en détail).

### Tech debt (priorité basse)

- [ ] Planning A/B stocké en BDD (aujourd'hui dupliqué client + cron).
- [ ] Silence soignant configurable par profil (`profiles.push_quiet_hours JSONB`).
- [ ] Toolbox — latence résiduelle (partiellement résolue par Vite v4.44 + CSS vars v4.45).

### Features applicatives (non planifiées dans l'immédiat)

- [ ] Formulaire pré-admission QR code salle d'attente.
- [ ] Annuaire patients post-sortie.
- [ ] UI "Mes appareils de confiance".
- [ ] Livret IFSI — export PDF (P4).
- [ ] Ressources Toolbox — GitHub Action régénération `index.json`.
- [ ] Toolbox — Fiches Expert hors antipsychotiques (BZD, TSO, thymorégulateurs, stimulants, antidépresseurs).
