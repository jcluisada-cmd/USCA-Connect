# DECISIONS — USCA Connect

> Décisions architecturales coûteuses à oublier. Pas un journal — une decision par entrée,
> avec le pourquoi. Les micro-décisions et ce qui est redécouvrable depuis le code n'ont pas
> leur place ici.

## MetaboScope = source unique dans `metaboscope/` (2026-05-08)

Le repo MetaboScope d'origine (externe) est **figé** (à archiver sur GitHub). Toute
modification (UI, molécules, audits) se fait désormais directement dans
`USCA-Connect/metaboscope/`. Raison : deux sources de vérité pour le même code
créaient des divergences silencieuses. Voir `METABOSCOPE_APP.md` / `METABOSCOPE_INTEGRATION.md`.

## Toolbox V1 : Babel in-browser → sous-app Vite isolée (v4.44, 2026-06-18)

**Rejeté** : garder Babel standalone en CDN (transpilation JSX à chaque ouverture, ~3 Mo,
~500ms, et fragile face à une CDN qui bascule de version majeure sans prévenir).
**Choisi** : sous-app Vite `staff/toolbox-app/`, port 1:1 du composant, React bundlé,
`dist/` commité, servi en iframe (même patron que `metaboscope/`). Gain : 240 Ko (70 Ko
gzip) vs 3 Mo, zéro transpilation runtime. Déclenché par l'incident Babel 8 ci-dessous.

## Épingler toutes les versions CDN (leçon actionnable, 2026-06-16/17)

Une URL CDN non épinglée (`@babel/standalone` sans version exacte) a basculé silencieusement
de 7.x vers 8.0.x (majeure, breaking) et cassé la transpilation in-browser → écran blanc
total de la Toolbox en prod. Diagnostic confirmé : code projet inchangé depuis 3 semaines,
dates de publication npm de Babel 8 coïncidant exactement avec l'apparition du bug. **Règle
appliquée depuis** : toute dépendance CDN doit être épinglée à une version exacte
(`@tailwindcss/cli@4.3.1`, `@babel/standalone@7.29.7` en pansement avant migration Vite).
Solution structurelle préférée quand possible : bundler (Vite) plutôt que CDN runtime.

## Tailwind CDN runtime → pré-compilé statique (v4.49, chantier 3, 2026-06-18)

**Rejeté** : garder `@tailwindcss/browser@4` en CDN (recompilait tout le CSS dans le
navigateur à *chaque* chargement de page — coût CPU mobile, dépendance runtime tierce).
**Choisi** : toolchain npm dev-only à la racine (`@tailwindcss/cli@4.3.1` épinglé) générant
`shared/tailwind.css` (~62 Ko minifié) une fois, pré-caché par le Service Worker. Migration
page par page (pilote `etudiant`, puis lots) avec le CDN conservé en parallèle jusqu'à
validation prod de chaque tranche — pour permettre un rollback trivial (`git revert`) sans
régression sur les pages non encore migrées. Les sous-apps Vite (`metaboscope/`,
`staff/toolbox-app/`) ne sont pas concernées (déjà bundlées).
**Piège découvert** : le scan statique de `@tailwindcss/cli` ne voit pas les classes
ajoutées après coup — toute classe Tailwind ajoutée sur une page racine nécessite de
relancer `npm run build:css` et de committer `shared/tailwind.css`, sinon elle est absente
du CSS servi en prod sans erreur visible.

## Pas de bundler pour les pages HTML — exception : toolchain CSS dev-only (permanent)

Convention historique du projet : les 6 pages racine restent HTML + CDN (Supabase SDK,
jsPDF), sans étape de build pour le code applicatif — pour rester modifiable "à chaud"
sans pipeline. La toolchain Tailwind CLI introduite en v4.49 est une **exception
consciente et limitée** : elle ne bundle rien, ne transpile rien, ne touche pas le JS —
elle pré-génère un unique fichier CSS statique. Les sous-apps Vite (`metaboscope/`,
`staff/toolbox-app/`) restent le seul endroit où un vrai bundler tourne, et pour une raison
différente (React + JSX, pas les pages HTML elles-mêmes).

## Auth patient faible acceptée (chambre + date de naissance) — risque assumé (permanent)

Le parcours patient n'a pas de mot de passe : chambre + DDN suffisent. **Accepté**
délibérément car (a) réseau hospitalier fermé, (b) rate-limiting client (3 tentatives →
5 min), (c) aucune donnée patient nominative sensible exposée par ce seul accès. Ne pas
"corriger" cette conception sans en discuter avec JC — c'est un choix, pas un oubli.

## RLS ouverte pour les messages patients anonymes — risque maintenu (v4.42, 2026-05-29)

Un patient anonyme (`cree_par IS NULL`) ne peut pas être distingué d'un autre patient
anonyme au niveau RLS pour ses propres messages (`contenus_partages`) — même limite que
l'INSERT ouvert depuis v21. **Accepté** : le compte PdS partagé (`usca.pds@aphp.fr`) partage
aussi ses messages entre soignants PdS par construction — cohérent avec le modèle de compte
partagé, pas une régression à corriger isolément.

## Incident CF Pages — ne jamais supprimer un déploiement "In progress" (2026-05-22)

Suppression manuelle d'un déploiement "In progress" pendant un incident plateforme
Cloudflare (503 sur l'API interne) a **corrompu les blobs déduppliqués par hash** pour
plusieurs pages (index, patient, pds, cushman.js) → 500 en prod même après rollback vers un
commit sain. **Fix qui marche** : cache-bust trivial du contenu (commentaire ajouté) pour
forcer un ré-upload avec un nouveau hash — pas une resuppression, pas un rollback API seul.
**Règle** : ne jamais supprimer un déploiement "In progress" dans le dashboard CF, même en
cas d'anomalie apparente ; attendre qu'il échoue ou termine naturellement.

## Audit sécurité 2026-09-22 — arbitrages de JC

- **Mot de passe staff commun sur `affiche-equipe.html` (publique en ligne) : conservé
  volontairement.** Ne pas re-proposer son retrait.
- **RLS `patients_select_all` / `substances_patient_select_all` (lecture publique via clé anon) :
  correction reportée** — JC veut d'abord mesurer les implications sur la connexion patient.
  ⚠️ Nuance la décision « Auth patient faible acceptée » ci-dessus : ses prémisses (a) réseau
  fermé et (c) aucune donnée sensible exposée **ne tiennent pas** tant que la table `patients`
  (chambre + DDN = identifiants de connexion, substance) est lisible depuis Internet avec la clé
  anon publique. Piste de correctif : RPC `verify_patient(chambre, ddn)` SECURITY DEFINER +
  SELECT de la table réservé à `authenticated` — à spécifier avant exécution (impact sur
  `shared/auth.js` et les lectures patient côté `patient/`).
- **Purge BDD (`migrations/supabase-migration-v41.sql`) : à exécuter par JC** dans le SQL Editor.
  Claude ne peut pas lancer de DELETE de masse sur la BDD de prod (bloqué par le classifieur de
  permissions auto mode) — ne pas tenter de contournement.
