# USCA Connect — Changelog

> Une ligne par version. Pour le détail d'une version : voir `CLAUDE_ARCHIVE.md` §B.
> Pour la version courante en détail : voir l'en-tête de `CLAUDE.md`.

## v4.50 — 2026-09-22
**Sécurité + hygiène (suite audit général 2026-09-22).** (1) `functions/api/delete-user.js` : la suppression d'un compte Auth vérifiait seulement la *présence* du header `Authorization` → n'importe qui pouvait supprimer un compte soignant. Désormais : `userId` validé (format UUID), JWT de l'appelant **validé** via `GET /auth/v1/user` (401 sinon), puis `profiles.is_admin = true` exigé (403 sinon). (2) CDN épinglés : `@supabase/supabase-js@2` → `@2.117.0` (version actuellement servie, comportement inchangé) sur les 6 pages racine ; `react`/`react-dom@18` → `@18.3.1` dans l'ancienne `staff/toolbox.html` (conservée : liens du livret IFSI). (3) `extern/` (iframe Toolbox) et `etudiant/` (retour mode démo) passent sur la Toolbox Vite `staff/toolbox-app/dist/` comme `admin/` depuis v4.44 → fin de Babel in-browser pour les externes. (4) SW : `shared/modules-config.js` + `shared/module-visibility.js` ajoutés au pré-cache. (5) `migrations/supabase-migration-v41.sql` (à exécuter manuellement) : purge `cron.job_run_details` > 7 j (218 k lignes / 101 Mo), job quotidien de purge, `VACUUM FULL` de `net._http_response` (168 Mo de bloat). Service Worker : `usca-v4.49` → `usca-v4.50`.

## v4.49 — 2026-06-18
**Tailwind pré-compilé (étape 3 modernisation incrémentale).** Le CDN runtime `@tailwindcss/browser@4` — qui recompilait le CSS dans le navigateur à **chaque** chargement — est retiré des **6 pages racine** (`index`, `patient`, `admin`, `extern`, `etudiant`, `pds`) et remplacé par une feuille statique unique `shared/tailwind.css`. Toolchain dev-only à la racine : `package.json` + `@tailwindcss/cli@4.3.1` **épinglé** (pas de `^`), `npm run build:css`, input `tailwind.input.css` (`@import "tailwindcss" source(none)` + `@source` explicites des 6 pages/`shared`/post-cure + `@custom-variant dark` déplacé hors des `<style>` inline). Sur chaque page : `<script CDN>` + `<style inline>` → `<link rel="stylesheet" href="…/shared/tailwind.css">`. CSS ~62 Ko minifié, pré-caché par le SW → fin de la recompilation in-browser (gain CPU mobile, suppression d'une dépendance CDN runtime). Migration page par page (pilote `etudiant`, puis 2 lots `extern`+`pds` et `patient`+`admin`+`index`), CDN conservé jusqu'à validation. Vérif déterministe : toutes les classes `dark:` (69) et arbitraires (`[...]`) des pages confirmées présentes ; revue groupée 0 finding. Sous-apps Vite (`metaboscope/`, `staff/toolbox-app/`) non concernées. Service Worker : `usca-v4.45` → `usca-v4.49`. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-18-tailwind-precompile*`.

## v4.45 — 2026-06-18
**Toolbox : dark mode sans rechargement.** Le toggle clair/sombre rechargeait toute l'iframe (les couleurs JS `C` étaient figées au chargement du module). Les couleurs sont désormais des **variables CSS** (`:root` = light, `html.dark` = dark) : `C.x[y]` renvoie `var(--c-x-y)`, et le toggle bascule simplement la classe `.dark` sur `<html>` → le navigateur recalcule toutes les couleurs **instantanément, sans reload ni re-render React**. Les 8 fonds translucides (ex-`C.t[600]+"15"`, incompatibles avec `var()`) passent par un helper `alpha15()` (`color-mix(in srgb, … 8%, transparent)`). **Aucune couleur modifiée** (mêmes valeurs hex, juste routées via variables) — seul le rechargement disparaît. Touche `staff/toolbox-app/` (App.jsx + styles.css + index.html) ; le code mort de restauration de vue (sessionStorage, lié au reload) est laissé inerte. Levier 2 du chantier de modernisation. Service Worker : `usca-v4.44` → `usca-v4.45`.

## v4.44 — 2026-06-18
**Toolbox V1 migrée vers Vite (fin du Babel in-browser).** La Toolbox (`staff/toolbox.html`) transpilait son React via Babel standalone dans le navigateur (~3 Mo téléchargés + transpilation de 1652 lignes de JSX à chaque ouverture) — source de lenteur (~500 ms) et de fragilité (cf. écran blanc v4.43). Migration vers une sous-app Vite isolée `staff/toolbox-app/` calquée sur `metaboscope/` : **port 1:1** du composant en JS (aucune logique modifiée), **React/ReactDOM bundlés** (fin de la dépendance CDN unpkg → l'écran blanc CDN devient structurellement impossible), `dist/` commité servi en iframe. Bundle **240 Ko (gzip 70 Ko)** vs ~3 Mo de Babel, **zéro transpilation runtime** → ouverture quasi instantanée. Seuls `admin/index.html` (URL iframe) et `sw.js` (pré-cache `LOCAL_ASSETS`) touchés hors du nouveau dossier. Ancien `staff/toolbox.html` conservé temporairement (rollback en 1 ligne) jusqu'à validation visuelle prod, puis suppression. Étape 1 du chantier de modernisation incrémentale (étapes suivantes : Tailwind pré-compilé, Workbox). Spec/plan : `docs/superpowers/specs|plans/2026-06-18-toolbox-vite-migration*`. Service Worker : `usca-v4.43` → `usca-v4.44`.

## v4.43 — 2026-06-18
**Fix urgent écran blanc Toolbox (épinglage Babel).** L'URL CDN `@babel/standalone` non épinglée (`staff/toolbox.html`) a basculé de 7.x vers **8.0.x** (version majeure, breaking) les 16-17/06/2026, cassant la transpilation in-browser → **écran blanc total de la Toolbox sur tous les navigateurs** (Chrome + Edge). Diagnostic : code projet inchangé depuis 3 semaines, prod servie intacte, dates de publication npm de Babel 8 correspondant exactement au « depuis quelques jours ». Correctif : épinglage `@babel/standalone@7.29.7` (dernière 7.x stable, = version servie avant le 16/06). Pansement avant la migration Vite (v4.44) qui supprime la cause racine. Service Worker : `usca-v4.42` → `usca-v4.43`.

## v4.42 — 2026-05-29
**Modifier / supprimer ses propres messages (conversation patient ↔ soignants).** Chaque émetteur peut désormais éditer et supprimer les messages `contenus_partages` qu'il a écrits, depuis les 3 interfaces (patient, admin, PdS). UX : petite icône crayon ✏️ sur ses propres bulles → menu inline « Modifier le message » / « Supprimer le message » (rouge, `confirm()` de validation). L'édition bascule la bulle en `textarea` (Valider/Annuler) → `updateContenu`. Un message édité affiche « (modifié) » près de l'horodatage. Migration v40 : colonne `contenus_partages.modifie_le TIMESTAMPTZ`, nouvelle policy `contenus_update_own`, et resserrement de DELETE (`contenus_delete_auth` trop large `auth.role()='authenticated'` → `contenus_delete_own`). Prédicat commun : `(auth.uid() = cree_par) OR (auth.uid() IS NULL AND cree_par IS NULL)` — chacun ne touche que ses messages (soignant via uid, patient anon via cree_par NULL ; compte PdS partagé ⇒ les PdS partagent leurs messages). Helper `db.updateContenu(id, contenu)` ajouté à `shared/supabase.js` ; `db.deleteContenu` existait déjà. Risque connu maintenu (non aggravé) : un patient anon ne peut pas être distingué d'un autre au niveau RLS (même modèle que l'INSERT ouvert v21). Spec : `docs/superpowers/specs/2026-05-29-messages-edit-delete-design.md`. Service Worker : `usca-v4.41` → `usca-v4.42`.

## v4.41 — 2026-05-22
**Itérations post-livraison v4.39 + résolution incident CF Pages.** Home PdS allégé : suppression des sections globales « Transmissions récentes » et « Messages patients récents » (JC : pas validé), home affiche désormais uniquement les cartes patient. Vue détail patient PdS : **onglet Transmissions placé en premier et défaut à l'ouverture** (au lieu de Messages). Messages — affichage auteur partout : enrichissement `db.getContenus()` avec JOIN `profiles!cree_par(email)`, rendu `email.split('@')[0]` (ex: `jc.luisada`) côté patient (au-dessus bulle staff), admin (entête bulle staff), pds (timestamp). Migration v39 : `DROP POLICY profiles_select_auth + CREATE POLICY profiles_select_all USING true` — pour permettre aux patients (anon, pas de session Supabase Auth) de lire les emails via JOIN. Admin médecin : encart Cushman + carte Transmissions désormais wrappés dans `<details>` (accordion repliés par défaut), summary affiche score Cushman coloré + compte transmissions pour vue d'ensemble sans cliquer. Fix bug PdS : query patients utilisait colonne `ddn` inexistante → corrigé en `date_naissance` (Supabase ne renvoie pas d'erreur visible pour colonne manquante, juste data vide → "Aucun patient" trompeur). **Incident CF Pages 22/05** : deploys v4.39 ont échoué pendant un incident plateforme CF (503 sur /accounts/.../flags) ; suppression manuelle d'un déploiement "In progress" depuis le dashboard CF a déclenché une pollution des blobs (CF Pages déduplique par hash de contenu). Résolu par rollback API vers v4.38 fc8a9c7c + cache-bust (commentaire trivial ajouté en début de index.html, patient/index.html, pds/index.html, shared/cushman.js — commit `5dc6f9e`). Apprentissages sauvés dans `feedback_cf_pages_blob_corruption.md` et `project_cf_pages_incident_2026-05-22.md` (mémoire). Service Worker : `usca-v4.39` → `usca-v4.40` → `usca-v4.41`.

## v4.39 — 2026-05-22
**Dashboard PdS (Poste de Soins infirmier USCA)** : sous-app `/pds/` avec compte partagé `usca.pds@aphp.fr` / `usca_pds` (rôle `pds`). Migration v38 : tables `cushman_scores` (sevrage alcool CIWA-Ar FR, items JSONB 7 niveaux 0-3, score_total 0-21, rappel_intervalle_h INT NULL) et `transmissions` (medical/paramedical, RLS par rôle pds+ide pour para, medecin pour medical). Module `shared/cushman.js` : saisie modale interactive (7 items × 4 niveaux radio, score live, callout « Donner BZD SB » si ≥7, case rappel cochée par défaut avec intervalle modifiable). Home PdS : cartes patient anonymisées (chambre + J + sexe + âge, **pas de nom**), tri ordre chambres croissant, 3 états (normal / urgent Cushman ≥7 rappel échu / en permission bleu pâle pointillé chambre inversée), badges notifs (🚶 Demande / 🚶 En permission / 📋 Cushman à refaire / 💬 N msg), bandeau stats 4 compteurs colorés, sections Transmissions et Messages globaux. Bouton « 🔔 Appeler médecins USCA » (topbar, push tous médecins) et « 🔔 Appeler » par carte (push patient + log evenements type `convocation_pds`). Vue détail patient : 2 colonnes tablette (Identité Chambre+Entrée+Sortie+Type sortie tag coloré RAD/Post-cure/Autre / Cushman gros chiffre + callout + tableau 7 derniers / bouton + Nouveau), onglets Messages (conversation bulles), Transmissions (fil avec 2 tags + formulaire publier), Permissions (lecture seule), modal Changer chambre (UPDATE simple sans déconnexion patient car session découplée via UUID). Côté médecin (`/admin/`) : rôle `pds` ajouté aux labels/couleurs/selects (émeraude foncé), encart Cushman + sparkline 7j + ligne action si ≥7 dans la fiche patient, mini-stream 5 dernières transmissions + bouton « + Ajouter transmission » (forcé en `medical` par la RLS), bouton « ✏️ Changer chambre ». Côté patient (`/patient/`) : checkChambreSync au load + visibilitychange, bandeau fermable « ℹ️ Votre nouvelle chambre est X, c'est aussi l'identifiant à utiliser si vous devez vous reconnecter » avec maj localStorage au clic ✕. Spec + plan : `docs/superpowers/specs/2026-05-21-role-pds-dashboard-design.md` et `docs/superpowers/plans/2026-05-22-role-pds-dashboard.md`. Service Worker : `usca-v4.38` → `usca-v4.39`.

## v4.38 — 2026-05-20
**Badge messages non lus sur carte patient dashboard** : ajout d'un badge violet sur la carte patient du dashboard soignant (à côté du badge cyan permission et du badge rouge craving) indiquant le nombre de messages envoyés par le patient que le soignant connecté n'a pas encore consultés. Réutilise le système `getLastMsgSeen/markPatientMsgsSeen` existant (localStorage par soignant, clé `usca_admin_msg_seen_{patientId}`). Nouvelle méthode `db.getMessagesPatientsRecents()` dans `shared/supabase.js` : SELECT léger (patient_id + created_at) des messages `cree_par IS NULL`. Variable globale `loadedMessagesPatients` chargée dans `loadDashboardStats()` en parallèle des alertes/permissions. Filtre côté client `m.patient_id === p.id && m.created_at > lastSeenMsg` → badge masqué automatiquement quand le médecin ouvre le modal messages (qui appelle `markPatientMsgsSeen`) puis revient au dashboard. Cohérent avec badge violet déjà présent dans la vue détail patient. Service Worker : `usca-v4.37` → `usca-v4.38`.

## v4.37 — 2026-05-19
**Fiche patient Chlorpromazine (Largactil)** : nouvelle fiche patient intégrée dans la Toolbox + catalogue `shared/fiches-catalogue.js`. Service Worker : `usca-v4.36` → `usca-v4.37`.

## v4.36 — 2026-05-11
**MetaboScope G.1 — Refonte classification 147 molécules** : audit complet des 147 molécules a révélé 40 anomalies de rangement (héritage chronologie d'ingestion S1-S13). Stratégie actée : champ `bucket?: ClassBucket` explicite sur `Molecule` (override) + fallback regex `classes.ts`. 2 nouveaux buckets ajoutés : `anticraving` (4 mol : Acamprosate, Baclofène, Disulfirame, Nalméfène) et `sevrage_tabac` (3 mol : Varénicline, Nicotine sevrage, Nicotine TSN). 33 molécules patchées explicitement : 4 anti-craving + 3 sevrage tabac (sortis de `opioides_tso.json`) + 13 drogues classiques (Alcool×3, Cocaïne×3, Héroïne, 6-MAM, MDMA, THC, CBD, CBN, Tabac fumé) + 3 dérivés GHB + Ibogaïne + 4 TDAH non-stim (Atomoxétine, Guanfacine, Modafinil, Bupropion → bucket `stim`) + Xylazine (sort de NPS opioïdes, va en `nps_autres`) + Tianeptine NPS + Mitragynine + NAC + Oxybate. Distribution finale 147 mol : antidep 14 · antipsy 18 · bzd 19 · thymo 13 · opioid 18 · stim 8 · drogues 32 · anticraving 4 · sevrage_tabac 3 · nps_autres 18. `ClassBucket` déplacé de `classes.ts` vers `types/molecule.ts` (évite cycle import). Regex `drogues` enrichi (entactogène, phénéthylamine, tryptamine, Iboga, psilocyb, drogue licite/récréative). Service Worker : `usca-v4.35` → `usca-v4.36`. METABOSCOPE_APP.md §10 G.1 marqué livré.

## v4.35 — 2026-05-11
**MetaboScope D.1 Mode Ordonnance** : chantier D.1 livré (workflow décisionnel `METABOSCOPE_APP.md` §4). Nouveau bouton `📋 Ordonnance` sur `/interactions` → modal saisie textarea (1 DCI/ligne, dose ignorée) avec parser fuzzy (`src/utils/parseOrdonnance.ts` — délègue à `searchMolecules()`, extraction dose via regex `mg|µg|g|ui|ml|cp`, confidence high/medium/low/none). Phase review : checkboxes par ligne avec match top + alternatives, `🟢 probable` pré-coché. Charger panier remplace contenu courant + bascule auto en mode analyse. En mode analyse, nouveau bouton `🖨️ Rapport imprimable A4` → overlay plein écran avec composant `RapportPrint` rendant : composition · alertes critiques (Mécanisme + Conduite à tenir, badge Red/Amber au lieu du décompte numérique opaque) · vigilance · matrix triangulaire annotée (PD/PK/PGx couleur-codés) · détail couples (tags + commentaire) · disclaimer USCA. Règles `@media print` dans `index.css` : `@page A4 portrait`, force palette light depuis theme-dark, anti-titre-orphelin (`break-after: avoid` sur h2 + `break-before: avoid` sur sibling), `break-inside: avoid` sur cards/matrix/couples. Sync thème respecté (light/dark à l'écran, force light à l'impression). Mockup HTML conservé dans `metaboscope/docs/mockups/` comme spec visuelle. Service Worker : `usca-v4.34` → `usca-v4.35`, bundles MetaboScope regénérés.

## v4.34 — 2026-05-11
**Fix bug timezone permission patient** : la concaténation string `dateDebut + 'T' + heureDebut + ':00'` envoyée à Postgres `TIMESTAMPTZ` était interprétée comme UTC (pas de suffixe TZ), provoquant un décalage +2h en CEST (mai-oct) — une demande "17h-19h" apparaissait "19h-21h" côté admin. Fix : sérialisation via `new Date(...).toISOString()` comme le code admin. Bug latent depuis le commit initial (c9e8fd4), masqué en hiver (UTC+1 → décalage 1h subtil). Blocage dur retour > 20h remplacé par avertissement amber non-bloquant ("⚠️ Heure de retour tardive — la demande sera transmise au médecin"), input `max="20:00"` HTML5 retiré.

## v4.33 — 2026-05-09
**Permissions** : motifs de refus structurés côté médecin (3 codes pré-définis multi-sélectionnables — "Demande trop tardive", "Le retour ne peut pas être après 20h", "Objectif de permission à rediscuter" — + commentaire libre) avec dropdown in-card sur le bouton Refuser, push patient au refus avec récap motifs, affichage des motifs sous le badge "Refusée" côté patient (migration v37 : `permissions.motifs_refus_codes text[]` + `motif_refus_libre text`). Formulaire patient : bandeau info "Permissions autorisées entre 10h et 20h", input retour `max="20:00"` HTML5, fix bug logique validation (`parseInt('20:30'.split(':')[0])===20` laissait passer 20h01-20h59, maintenant comparaison en minutes), valeur par défaut départ passée à 10h00. **MetaboScope C.5** : disclaimer pied de page enrichi (mention pharmacien clinicien USCA ajoutée à `DISCLAIMER_TEXT`) + mini-bandeau 1 ligne non-sticky dans le footer Layout (au-dessus du bouton "Disclaimer complet"). C.3 (liens fiches Toolbox) et C.4 (optim tablette) abandonnés — voir `METABOSCOPE_APP.md` §3.

## v4.32 — 2026-05-09
Workflow 2-phases dans Interactions MetaboScope : (1) phase sélection par défaut avec badges classes thérapeutiques dépliables (8 buckets, tous repliés au boot, persistance localStorage), bouton + sur chaque mol, FAB "Analyser →" en bas droite (visible si cart ≥ 2) ; (2) phase analyse au clic Analyser → affichage actuel (alertes + cards mol + voies). Bouton "✎ Modifier le panier" pour revenir en sélection. Auto-bascule vers sélection si panier vidé. Bannière flottante Atlas → `/interactions?analyze=1` (mode analyse direct sans repasser par sélection). Toolbox : ancienne petite carte "MetaboScope (Interactions)" supprimée, remplacée par **grande carte "MetaboScope"** placée avant "Dossier post-cure" (palette rouge USCA, gradient C.r[100]). Petites cartes home Toolbox passent de 3 → 2 colonnes (Scores · EEG/ECT).

## v4.31 — 2026-05-09
Atlas MetaboScope : catégories de voies repliables (Cytochromes / UGT / Phase II / Non-CYP / Transporteurs). Header cliquable avec ▾/▸ + compteur (`(N voies)`) + badge de sélection (`X sélectionnée(s)`) + indicateur ⚡ si voies partagées dans une catégorie repliée. Persistance dans `localStorage.metaboscope_expanded_kinds_v1`. Par défaut, seuls les Cytochromes dépliés (les plus utilisés en pratique addicto-psychiatrique) — désamorce la surcharge visuelle au boot.

## v4.30 — 2026-05-09
Refonte MetaboScope (suite v4.29) : `VoieDetailModal` cliquable depuis pills voies (Atlas + Interactions) — insight clinique avec détection auto des paires PK (substrat × inhibiteur/inducteur sur même voie, AUC ↑/↓). Fix lisibilité bannières/sections en light mode : ajout règles `html.theme-light .text-{amber,red,blue,green,indigo}-{100,200,300}` dans `metaboscope/src/index.css` (les classes Tailwind text-*-200/300 conçues pour fond foncé devenaient illisibles sur fond blanc). Contrastes badges intensité Atlas/Interactions renforcés (`bg-slate-300/400` au lieu de `bg-slate-200/black-15%`).

## v4.29 — 2026-05-09
Refonte UX/UI MetaboScope (chantier C complet + chantier H "redesign 2 onglets"). Architecture : 2 onglets `Atlas` + `Interactions` au lieu de 3 modules + HomePage. Atlas : barre de recherche universelle, grille de toggles 30+ voies multi-sélection (1 couleur par voie), mode OU/ET, filtre classes thérapeutiques (8 buckets, persistance localStorage), 3 sections résultats (Substrats / Inhibiteurs / Inducteurs) avec barres d'intensité. Pont Atlas → Interactions : bouton + sur chaque mol, badge dynamique sur tab, bannière flottante "X mol · ⚡ N voies partagées · Analyser →". Interactions : cards mol visuelles avec voies pills (S/I/Ind + intensité), voies partagées avec halo ⚡, alertes PD cumulées en haut cliquables → modal détail. Fiche mol = `MoleculeDetailModal` slide-in. Suppression `HomePage`, `SearchPage`, `MoleculePage` isolée. Routes simplifiées (`/` = Atlas, `/interactions`, redirects legacy). Sync dark/light, deep link `?cart=`, `CartContext` conservés.

## v4.28 — 2026-05-08
Fix dark mode wrappers d'icône Toolbox (`SectionHead` + EEG/ECT preview + input alert) : backgrounds passent en valeur fixe `#243b53` ou `C.bg` au lieu d'utiliser `C.n[800]`/`#fff` que le swap palette inversait en couleurs claires en dark.

## v4.27 — 2026-05-08
Fix dark mode boîtes `.alert`/`.alert.info`/`.alert.crit` dans `shared/ressource-doc.css` — backgrounds amber/teal/red passent en translucide sombre via `--a-50`/`--t-50`/`--r-50` (correctif global : fiches EEG/ECT, ressources, fiches expert).

## v4.26 — 2026-05-08
MetaboScope chantier C : sync dark/light mode USCA (URL param + postMessage live), refonte HomePage par cas d'usage, deep link `?cart=` (préparation liens fiches Toolbox).

## v4.25 — 2026-05-08
Intégration MetaboScope (carte Interactions Toolbox) en iframe + 2 micro-fixes USCA (catch SW hors-scope, meta `mobile-web-app-capable`).

## v4.24 — 2026-05-08
Sync dark mode iframes EEG/ECT ↔ Toolbox global (URL param `?theme=`, détection iframe via `window.self !== window.top`).

## v4.23 — 2026-05-07
Fiche EEG en réanimation (6/6 — batch handbook complet). Vocabulaire ACNS 2021 (LPDs/GPDs/BIPDs).

## v4.22 — 2026-05-06
Fiche Status epilepticus (5/6). Définition ILAE 2015, critères Salzburg, conduite à tenir 4 paliers.

## v4.21 — 2026-05-05
Fiche Activité épileptiforme (4/6). 4 graphoéléments unitaires + patterns groupés généralisés.

## v4.20 — 2026-05-04
Fiche Artefacts (3/6). 3 familles biologique/mécanique/électrique, méthode systématique 3 questions.

## v4.19 — 2026-05-03
Fiche Sommeil (2/6). 5 stades + cycles 90 min, 2 figures Oxford intégrées.

## v4.18 — 2026-05-02
Fiche EEG normal (1/6 du batch handbook). Activité de fond adulte éveillé + variantes physiologiques.

## v4.17 — 2026-04-30
Fiches EEG/ECT en iframe intégré (pattern `selEegFiche`) + fix mise en page fiche ECT (1 colonne permanente).

## v4.16 — 2026-04-29
Fiche pilote EEG « Comprendre un EEG en 10 min » (`fiche_technical.html`, design system partagé `shared/ressource-doc.css`).

## v4.15 — 2026-04-29
Fixes Toolbox post-réorga : carte « Protocoles USCA » court-circuit hub, vue Traitements renommée + accordions Fiches Expert repliables.

## v4.14 — 2026-04-28
Réorga Toolbox V1 (4 grandes + 5 petites cartes) + nouvelle carte EEG/ECT (`fiche_ect.html` Pitié canonique).

## v4.13 — 2026-04-27
Rappels push 9-10 min (au lieu de 4-5) + push 10 min avant atelier aux patients hospitalisés + permissions admin triées chronologiquement + pop-up présence ateliers patient.

## v4.12 — 2026-04-26
Fix modal Paramètres scrollable + pop-up onboarding notifications + retrait notifs craving.

## v4.11 — 2026-04-26
Fix RLS DELETE permissions (migration v35, policy `permissions_delete_auth`).

## v4.10 — 2026-04-25
Notifications push V3 personnalisables (`profiles.push_preferences` JSONB) + permissions modifiables/supprimables + nouveau logo phénix.

## v4.09 — 2026-04-25
Mode paysage activé (`manifest.json: orientation any`).

## v4.08 — 2026-04-25
Fiches substances (16) poussées au patient + fixes PWA install (icon-192) + QCM externe auto-extend + toolbox accordions repliés par défaut.

## v4.07 — 2026-04-27
P5 Personnalisation modules soignant (migration v32 `role_modules_hidden`, modèle « absence = visible »).

## v4.06 — 2026-04-25
Fixes SW : pré-cache de tous les `data/item_*.json` à l'install + `ressources_doc/index.json` en stratégie network-first.

## v4.05 — 2026-04-24
Reclassification fiches patient (Anxiolytiques + split Psychotropes en 4 sous-classes).

## v4.04 — 2026-04-24
Fix RLS `push_subscriptions` (migration v31, SELECT public au lieu d'authenticated).

## v4.03 — 2026-04-24
Push V2 Pause vacances (`profiles.push_pause_until`, migration v30).

## v4.02 — 2026-04-23
Notifications Push V2 : silence soignant (lun-ven 8h30→16h hors fériés) + fix défensif anti-orphelin + garde-fou XOR.

## v4.01 — 2026-04-23
Notifications Push V2 médecins (migration v29, Edge Function `send-push` étendue, modal Paramètres avec toggle activation push, cron-reminders étendu).

## v4.00 — 2026-04-22
Label inclusif patient « Patient·e de 53 ans » (migration v28 `patients.sexe`, F/M/NULL).

## v3.99 — 2026-04-22
Notifications Push patient (migrations v25-v27, Edge Functions Supabase, VAPID, pg_cron rappels 5 min) + page Paramètres patient + QCM tuteur : voir toutes les réponses.

## v3.98 — 2026-04-21
Agenda perso privé par soignant (migration v24) + accordions Planning/Dashboard repliables + Toolbox Ressources « Fiches » replié + correctifs QCM externe / badges messages / DDN / adressage libre.

## v3.97 — 2026-04-21
Fix animateurs fantômes : migration v23 FK `groupe_animateurs → profiles(CASCADE)` + policy DELETE admin + alerte bloquante si suppression Auth échoue.

## v3.86 — 2026-04-20
Messages bidirectionnels patient ↔ équipe (migration v21, convention `cree_par IS NULL` = patient, chat-style).

## v3.85 — 2026-04-20
Carte « Ressources » dans Toolbox (3 accordions Fiches/Articles/Recos, tags thématiques colorés).

## v3.84 — 2026-04-20
Nettoyage Toolbox : suppression « Checklist Séjour J1-J12 » et « Comorbidités psy ».

## v3.83 — 2026-04-20
Bouton ↺ réinitialisation externe + extraction historique CLAUDE.md → CLAUDE_ARCHIVE.md.

## v3.82 — 2026-04-19/20
Refonte extern en 3 onglets (Dashboard / Toolbox / Planning).

## v3.75 — 2026-04-19
Mon externe section admin + accordion Mes élèves unifié + QCM simplifié (sélection item séquentiel).

## v3.71 — 2026-04-19
Module QCM EDN externe (4 tables migration v17 locale, lazy-load 477 questions, dashboard externe).

## v3.70 — 2026-04-17 (nuit)
Fix programme patient (timeline) + Dashboard sorties enrichi (migration v15 `sortie_info`) + Module Livret IFSI P1 complète (migration v16, 14 chapitres, vue tuteur).

## v3.64 — 2026-04-17 (soir)
Fix critique accolade orpheline `admin/index.html` + fix closure Staff Psy + fix post-cure patient + fix DB `updatePostcureStatut`.

## v3.53 — 2026-04-17 (nuit)
Réorga Toolbox 3 grandes + 3 petites + Protocoles USCA hub + ELSA hub + Liaisons drag-and-drop + Entrées/Sorties + Planning dynamique + Exports PDF/HTML + Post-cure P8 (séparation patient/médecin, 100% local non-HDS).

## v3.37 — 2026-04-16 (soir)
P1-P9 batch : modals, déconnexion, Planning A+B, Ateliers patient, App exportée v3, Auth avancée P9 (device tokens, Cloudflare Function, WebView iOS).

## v3.25 et avant
Voir `CLAUDE_ARCHIVE.md` §A bugs historiques. Versions antérieures non listées individuellement.
