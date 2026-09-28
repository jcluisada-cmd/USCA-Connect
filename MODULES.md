# USCA Connect — Modules détaillés

> Fichier à lire **à la demande** quand la session concerne un module spécifique.
> Pour la vue d'ensemble : voir `CLAUDE.md` §5.

---

## §1. Login unifié (`index.html`)

- Onglets Patient / Soignant
- Auto-redirect si session existante (pas de double login)
- Mode dev admin : triple-tap sur le logo
- Splash screen au chargement, bannière WebView iOS auto si détecté
- Date de naissance patient : auto-formatage JJ/MM/AAAA (clavier numérique)
- Messages d'erreur auth précis (réseau / identifiants / rate-limit)

| Parcours | Comment | Persistance |
|---|---|---|
| Patient | Chambre + date naissance → vérification BDD | localStorage, 30 jours |
| Soignant | prenom.nom + mot de passe → Supabase Auth (email @aphp.fr) | localStorage, session Supabase |

Routing par rôle :
- `role='externe'` → `/extern/`
- `role='etudiant_ide'` → `/etudiant/`
- `role='pds'` → `/pds/` (v4.39, compte partagé `usca.pds@aphp.fr` / `usca_pds`)
- autres rôles soignants → `/admin/`

---

## §X. Dashboard Poste de Soins (`/pds/index.html`, v4.39)

Sous-app pour l'équipe IDE du Poste de Soins infirmier (24/7, 1 IDE en poste, en charge de tous les patients hospitalisés).

**Auth** : compte unique partagé `usca.pds@aphp.fr` / `usca_pds` (login : `usca.pds`), rôle `pds`. Pas de signature nominale du Cushman (timestamp = seule traçabilité).

**Home** :
- Topbar indigo : titre + horloge + bouton « 🔔 Appeler médecins USCA » (push à tous les médecins via `send-push`) + toggle dark/light + logout
- Bandeau stats 4 compteurs colorés : Cushman à refaire (rouge si > 0) / Demande permission / Absents (bleu) / Messages (rouge si > 0)
- Grille de cartes patient triées par chambre croissante, anonymisées : pill chambre + J + sexe + âge + bouton « 🔔 Appeler » compact (push patient + log `evenements` type `convocation_pds`)
- 3 états visuels :
  - Normal : fond blanc, bordure slate, chambre pill indigo plein
  - Urgent : fond rouge pâle, bordure rouge, chambre pill rouge (Cushman dernier ≥7 ET rappel échu)
  - En permission : fond bleu pâle, bordure pointillée discrète, chambre **inversée** (bord bleu, fond blanc, texte bleu), bouton Appeler caché, remplacé par pill « 🚶 Retour 18h » (ou « Retour 25/05 à 18h » si pas même jour)
- Badges notifications (n'affiche que ce qui existe) : 🚶 Demande (amber) / 🚶 En permission (sky) / 📋 Cushman à refaire (red) / 💬 N (pink)
- ~~Sections secondaires Transmissions/Messages globaux~~ → **supprimées en v4.41** (JC : pas validé, infos déjà accessibles via détail patient)

**Vue détail patient** (tap sur carte) :
- Topbar bleu : ← Retour, Ch. X, J[N], bouton « 🔔 Appeler patient »
- Layout 2 colonnes tablette / empilé mobile
- Colonne gauche :
  - Identité : Chambre (+ bouton ✏️ Changer), Entrée + jour hospit, Sortie prévue, Type sortie tag coloré (RAD bleu / Post-cure vert / Autre gris)
  - Cushman : gros chiffre coloré (vert ≤3 / ambre 4-6 / rouge ≥7), timestamp, callout « → ≥7 : Donner BZD SB » si applicable, tableau 7 derniers (lignes ≥7 surlignées), bouton « + Nouveau Cushman »
- Colonne droite, 3 onglets (**Transmissions par défaut** depuis v4.41) :
  - Transmissions : fil chronologique avec tags Médical (violet) / Paramédical (vert), formulaire publier (PdS écrit en paramédical, médecin en médical, RLS force le type selon rôle)
  - Messages : conversation bulles (patient gauche slate / soignant droite indigo), formulaire envoi, identifiant auteur soignant affiché (`email.split('@')[0]`, ex: `jc.luisada`)
  - Permissions : lecture seule (PdS ne valide pas), badges statut (en_attente jaune / validee vert / refusee rouge), motif si renseigné, motif_refus_libre si refusée
- Modal Changer chambre : input prefilé, UPDATE simple sans déconnexion patient (session découplée via UUID `patient.id`)

**Module partagé** `shared/cushman.js` (utilisé par /pds/ et /admin/) :
- `ITEMS` : 7 items × 4 niveaux (FC, PA, FR, Tremblements, Sueurs, Agitation, Sensoriels). Référentiel identique à Toolbox V1 (`staff/toolbox.html:336-342`)
- `saveScore`, `getScores`, `isOverdue`, `colorFor`, `openModal`
- Modal interactive : 7 items en boutons radio, score recalculé live, callout « → Donner BZD SB » si ≥7, case rappel cochée par défaut avec intervalle modifiable (4h, stocké dans `cushman_scores.rappel_intervalle_h`)
- Calcul « Cushman à refaire » client-side : `lastScore.score_total >= 7 && (now - saisi_le) > rappel_intervalle_h * 1h`

**Intégration côté médecin** (`/admin/`) :
- Rôle `pds` ajouté aux labels (« Poste de Soins ») et couleurs (`bg-emerald-100 text-emerald-800`) dans la gestion des comptes
- Fiche patient enrichie : encart Cushman (gros chiffre + sparkline 7j + ligne action si ≥7), mini-stream 5 dernières transmissions + bouton « + Ajouter transmission » (forcé en `medical` via RLS), bouton « ✏️ Changer chambre ». **Depuis v4.41** : Cushman et Transmissions wrappés en `<details>` (accordion repliés par défaut, summary montre score Cushman coloré + compte transmissions pour vue d'ensemble sans cliquer).

**Intégration côté patient** (`/patient/`) :
- `checkChambreSync()` au load + `visibilitychange` : compare `localStorage.patient_session.chambre` ↔ valeur fraîche BDD
- Si différent : bandeau jaune fixed top fermable « ℹ️ Votre nouvelle chambre est X, c'est aussi l'identifiant à utiliser si vous devez vous reconnecter à l'application. » + maj localStorage au clic ✕

**Décisions explicitement rejetées** (anti-régression) :
- Pas de score COWS dans ce chantier
- Pas de logique conditionnelle Cushman selon substance (sur toutes les cartes, jugement clinique PdS)
- Pas de push notifications PdS (rappels visuels suffisent)
- Pas de notion « médecin référent »
- Pas de tag « Observation libre » (seulement Médical + Paramédical)
- Pas de bouton « Appeler médecins » par patient (un seul bouton global en topbar)
- Pas de log d'administration de BZD dans l'app
- Pas de push patient sur changement chambre (bandeau in-app à la place)
- Pas de log auto transmission sur changement chambre (silencieux)
- Pas de nom/prénom patient sur le dashboard PdS (anonymisation totale)
- Pas de substance affichée
- Pas de lien « Voir dossier post-cure » dans Identité
- Pas d'ateliers ni Toolbox dans le scope PdS
- Pas de validation des permissions par le PdS (reste médecin)

Spec design : `docs/superpowers/specs/2026-05-21-role-pds-dashboard-design.md`. Plan d'implémentation : `docs/superpowers/plans/2026-05-22-role-pds-dashboard.md`.

---

## §2. Module Patient (`patient/index.html`) — 9 cartes + post-cure

### Ordre des cartes
Programme → Journal → Traitements → Ateliers → Stratégies → Permission → Messages → Mon avis

Bouton **« J'ai un craving »** : pleine largeur rouge, en haut, avant les cartes.

### Détail des cartes

| Carte | Contenu |
|---|---|
| **Programme** | Timeline, navigation date, routine, groupes semaine A+B colorés, badge semaine A/B, horaires individuels, boutons Présent/Absent, "Demander une séance" |
| **Mon journal** | Agenda craving (semaine/mois/3mois/1an), courbe tendance, stats |
| **Traitements** | Fiches prescrites, 29 fiches HTML, 16 fiches substances, navigation par catégorie |
| **Ateliers** | Navigation date, Présent/Absent par groupe, demande de séance, historique, stats, animateur/lieu affichés |
| **Mes stratégies** | Plan prévention guidé (5 catégories Marlatt), section éducative |
| **Permission** | Demande sortie (48h max, 20h retour), statut en attente / validée / refusée |
| **Messages** | Conversation bidirectionnelle patient ↔ équipe (compose box + chat-style, patient à droite, soignant à gauche). Convention `cree_par IS NULL` = patient |
| **Mon avis** | Feedback structuré sur l'application (email ou copie) |
| **Faire une demande de post-cure** | Lien vers formulaire patient standalone (postcure/patient.html) |

### Badges notification patient
Ronds rouges sur Messages, Traitements, Programme, Ateliers.

### Pop-up présence ateliers (v4.13)
Trigger 2.5s après ouverture si :
- heure ≥ 8h30 locale
- au moins un atelier aujourd'hui (`getGroupesForDay()` avec `debut !== null`)
- pas annulé via `groupe_modifications`
- patient pas dans `exclusions[]`
- `participations.present` non encore renseigné
- pas déjà fermé aujourd'hui (localStorage `groupe_presence_dismissed_<YYYY-MM-DD>`)

### App exportée HTML autonome
- Signal craving + agenda + stratégies modifiables
- Fiches traitements et substances embarquées
- PIN local SHA-256, dark mode, export/import JSON
- Tutoriel au premier lancement
- Stockage localStorage uniquement (pas de serveur)

---

## §3. Module Soignant (`admin/index.html`) — 3 onglets

### Onglet Dashboard
- Liste patients avec badges craving / permission, admission
- Détail patient :
  - Journal craving
  - Fiches traitements (29 HTML) + Fiches substances (16 HTML, catégorisées 6 catégories violet)
  - Permissions (modif + suppression, mini-form inline 4 champs date/heure + motif)
  - Événements
  - Messages (compose inline unifiée : sélecteur type note/lien/consigne + titre + texte)
  - Voir comme patient
  - Dossier post-cure (accordion, 4 checkboxes workflow, structure + date)
  - Export PDF / HTML
  - Supprimer séjour
- Entrées/Sorties : sorties prévues auto, liste d'attente CRUD
- Section "Mon élève" (livret IFSI) + section "Mon externe" (QCM EDN)

### Onglet Toolbox
Iframe vers `staff/toolbox-app/dist/index.html` (Toolbox Vite, depuis v4.44) avec dark mode synchronisé (URL param `?theme=`).

### Onglet Planning
- Navigation semaine ← → avec dates et badge Semaine A/B
- Groupes dynamiques
- Réunions de la semaine (masquées si heure passée)
- Section "Historique de la semaine" dépliable
- Staff Psychiatrie filtré par jours de présence

### Gestion comptes (admin)
- Création, modification rôle/nom, toggle admin
- Jours de présence par soignant (array [1-5], filtre Staff Psy)
- Suppression complète (profil + compte Auth via Cloudflare Function)
- Désignation animateurs pour les groupes
- Matrix Modules par rôle (P5, accordion 18×5, table `role_modules_hidden`)

### Modal Paramètres
- Section "Mes notifications" : 5 checkboxes événements + 3 réglages silence perso (visible role=medecin uniquement)
- Section "Pause vacances" : date picker + bouton reprise immédiate
- Section "Personnalisation" : bouton "Activer le mode édition modules" (admin only)
- Toggle activation push (engrenage ⚙️ dans le header admin)
- Scroll : container `flex flex-col max-h-[90vh] overflow-hidden`, header sticky, body `overflow-y-auto flex-1`
- Fermeture par clic overlay ou touche Escape

### Pop-up onboarding notifications
Modal `modal-notif-prompt` (admin médecin uniquement et patient). Trigger 1.5s après showAdminApp/showPatientApp si :
- `Notification.permission === 'default'`
- délai 7 jours via `localStorage.notif_prompt_last_asked`
- détection iOS Safari onglet → affiche les 3 étapes d'installation PWA

---

## §4. Module Externe (`extern/index.html`) — 3 onglets

### Garde session
`role='externe'` → redirect `/extern/`

### Onglet Dashboard
- Accordion "Patients" : 3 sous-onglets Chambres / Sorties / Attente avec CRUD complet
- Détail patient identique admin (journal craving, fiches, permissions, actions, exports PDF/HTML, voir comme patient)
- Carte Mon QCM EDN
- Checklist personnelle (stockée dans `profiles.checklist_items`, debounce 600ms)
- Questions au tuteur
- Signalements + Export

### Onglet Toolbox
Iframe lazy-load `../staff/toolbox-app/dist/index.html?embedded=true` (Toolbox Vite, comme `admin/` — depuis v4.50 ; avant : `staff/toolbox.html`). Les liens internes de la Toolbox (ressources, fiches, EEG/ECT, MetaboScope, post-cure) sont en chemins **absolus depuis la racine** (`/ressources_doc/…`) depuis v4.52.

### Onglet Planning
Copie complète du planning admin, lazy-load.

### QCM EDN
- Sélecteur item uniquement
- Mode entraînement séquentiel
- Correction + explication immédiate
- Boutons 💬 Explication + 👎 Signalement par question
- Score final persisté (`qcm_sessions` + `qcm_reponses`)
- Export app autonome HTML standalone (Blob + URL.createObjectURL, 477 questions embarquées)

### Mode tuteur (`?preview=tuteur`)
- Bandeau orange via `#tuteur-banner`
- "Voir toutes les questions" par item avec explications
- Masque Toolbox/Planning de la nav (focus QCM uniquement)
- Boutons 👎 préservés

### Lazy-load data
- `index.json` au démarrage
- `item_*.json` à la sélection (cache mémoire session)

### Vue tuteur dans admin
- Section "Mon externe" pour médecin/admin (analogue à "Mon élève")
- Stats sessions, signalements en attente, réponse aux flags via modal
- Questions de l'externe avec réponse inline
- Bouton ↺ réinitialisation (RPC `reset_externe_data`, v42 : supprime sessions/réponses/flags/questions + vide la checklist au changement d'externe, affiche le bilan)
- Tous les médecins voient l'externe (pas de tuteur désigné)
- Accordion "Mes élèves" unifié : IFSI + QCM en sous-sections

---

## §5. Module Livret IFSI (`etudiant/index.html`)

### SPA mobile-first
- 14 chapitres (~90 questions)
- 6 types de questions : fill_in, QCM single/multi, vrai/faux, table_fill, texte_libre
- Auto-correction normalisée (casse/accents/ponctuation + mots-clés)
- Feedback visuel (emerald/amber/rose)
- Persistance debounced 500ms

### Lexique 21 acronymes
ELSA, USCA, CSAPA, CAARUD, CJC, OH, AA, RDR, TSO, THC, CBD, GHB, SLAM, PTSD, CPOA, TS, CMP, TDAH, ASPDT, AAH, ALD.

### Vue tuteur
- Section "Mon élève" admin (IDE/médecin/admin)
- Mode lecture seule (`?stage=<id>`)
- Bouton "Marquer comme vu" par question
- Bandeau orange, inputs disabled, feedback toujours visible

### Édition élève admin
- Modal (nom, IFSI, promo, dates, IDE référent·e)
- Menu ⋯ : clôturer / réinitialiser / supprimer

### Aperçu Toolbox
Carte "📘 Livret IFSI" → `/etudiant/?preview=demo`.

### Export HTML imprimable
Bouton ⬇ génère HTML avec questions + réponses + explications.

### Workflow "1 élève à la fois"
Entre 2 stages → ✏️ modifier l'identité + ⋯ réinitialiser progression + nouveau mot de passe → livret vierge.

---

## §6. Module Post-cure (P8) — 100% local, conforme non-HDS

### Volet patient (`postcure/patient.html`)
- 6 étapes
- Génération ZIP+PDF
- Envoi par email
- Standalone

### Volet médecin (`postcure/medecin.html`)
- Formulaire médical complet
- Uploads
- Pré-remplissage depuis dashboard
- Standalone ou lié patient

### Données partagées (`shared/postcure-structures.js`)
14 structures post-cure (engagements, checklists).

### Dashboard
- Accordion "Dossier post-cure" dans Chambre XX
- Structure + date
- 4 checkboxes workflow

### PDFs
- Police 9pt
- Sections barre colorée latérale
- Marges 20mm
- Smart page breaks
- Footer USCA

### Sécurité
Aucune donnée patient stockée sur serveur — seuls des flags workflow dans `patients.postcure_statut` (JSONB).

### Dark mode
Synchronisé entre app principale et formulaires post-cure.

---

## §7. Toolbox Soignant V1 (`staff/toolbox.html`)

> Depuis v4.44, la Toolbox servie est la sous-app Vite `staff/toolbox-app/` (source `src/App.jsx`, build commité `dist/`, `base: './'`). Servie depuis `/staff/toolbox-app/dist/`, elle doit utiliser des liens **absolus** vers les dossiers du site (`/ressources_doc/`, `/fiches-traitements/`, `/fiches-substances/`, `/eeg_ect/`, `/metaboscope/dist/`, `/postcure/`, `/etudiant/`, `/shared/`, `/sw.js`) : un `../` résoudrait vers `/staff/toolbox-app/…` (404). Corrigé v4.52.

### Accueil — 4 grandes + 5 petites cartes (depuis v4.14)

| Carte | Type | Contenu |
|---|---|---|
| **Protocoles USCA** | Grande | Court-circuit hub → directement `case "substances"` (7 protocoles). BackBtn revient sur `home`. |
| **Ressources USCA** | Grande | Manifest-driven : `ressources_doc/index.json`. 4 accordions (Fiches / Articles / Recos / Algos), tags thématiques colorés. |
| **Fiches Traitements et Substances** | Grande | 3 sections : Fiches Traitements Patient (29 HTML), Fiches Substances (16 HTML), Fiches Traitements Expert (8 PDFs antipsychotiques). Classes médicamenteuses repliables par défaut. |
| **Dossier post-cure** | Grande | → Ouvre `postcure/medecin.html` |
| **Scores** | Petite | Cushman, COWS, AUDIT, PHQ-9, GAD-7 |
| **EEG / ECT** | Petite | Hub : Pratique ECT (`fiche_ect.html` Pitié canonique) + 7 fiches EEG handbook (Technical, Normal, Sommeil, Artefacts, Épileptiforme, Status, EEG en réanimation) |
| **Interactions (MetaboScope)** | Petite | Comparateur léger interne (à remplacer par iframe MetaboScope) |
| **ELSA** | Petite | Hub : Liaisons en cours (ToDo + drag-and-drop + checklist), Admission & Orientation, Fiches réflexes (5) + scores repérage |
| **Feedback** | Petite | Bug, suggestion, correction → email |

### Pattern iframe + ↗
Quand une carte EEG/ECT est cliquée, la fiche s'affiche en iframe au sein de la Toolbox (`height: calc(100vh - 180px)`). Header iframe : ← retour + nom de la fiche tronqué + ↗ ouvrir en nouvel onglet (utile impression A4, séance ECT).

### Pharmacopée (Scores → OUTILS)
- **Convertisseur BZD** → diazépam (seuil hospitalisation >40 mg DZP-eq)
- **Convertisseur CPZ** → chlorpromazine (14 molécules G1/G2, alerte haute dose >1000 mg CPZ-eq/j, vigilance addicto OH/BZD/opioïdes)

### Sevrage/maintien
diazépam, oxazépam, baclofène, acamprosate, naltrexone, nalméfène, topiramate, NAC, méthadone, buprénorphine, disulfirame.

### Psychotropes
méthylphénidate, lisdexamfétamine, sertraline, venlafaxine, vortioxétine, cyamémazine, chlorpromazine, alimémazine.

### Non pharmaco
NADA, hypnose, TRV, tDCS.

### Règles cliniques
- Toujours préciser **AMM / hors AMM**
- Toujours indiquer le **niveau de preuve** (A, B, C, D)
- Toujours lister les **contre-indications**

### Dark mode
Sync via URL param `?theme=dark|light` lu par les iframes de fiches au chargement (pas de postMessage runtime).

---

## §8. Personnalisation modules soignant (P5)

### Modèle "absence = visible"
Table `role_modules_hidden` (PK `(role, module_id)`). Aucune ligne pour un (rôle, module) → visible.
Conséquences : BDD légère (~50 lignes max), nouveau module = aucune migration.

### Inventaire (`shared/modules-config.js`)
18 modules × 5 rôles (`medecin`, `ide`, `psychologue`, `pharmacien`, `secretaire`).

### Helpers (`shared/module-visibility.js`)
- `apply(profile)` : injecte `<style>` dynamique avec `[data-module="X"]{display:none!important}`, bypass admin
- `setEnabled(bool)` : toggle du style
- `toggleHidden(role, id, bool)` : upsert/delete BDD avec error handling
- `fetchHiddenMap()` : retour `{role: Set<moduleId>}`
- `mountEditButtons(callback)` : idempotent, injecte ⚙️ par module

### Edit mode admin
Modale Paramètres → bandeau sticky indigo + bouton ⚙️ par module + popover 5 checkboxes par rôle.

### Matrix Comptes
Table 18×5 (modules × rôles) groupée par strate (Onglets / Dashboard / Patient / Toolbox).

### Bypass admin
`is_admin=true` voit tout.

### Limite
Masquage UI ≠ sécurité BDD. Les RLS des tables patients/messages/etc. restent inchangées — un user avec accès API peut toujours lire les données qu'on cache visuellement.

---

## §9. Auth avancée

### Client Supabase robuste
- `safeStorage` : tente localStorage, fallback sessionStorage (Safari restrictif / navigation privée)
- `flowType: 'pkce'` (plus robuste sur Safari)
- `autoRefreshToken: true`

### Appareils de confiance (table `device_tokens`)
- Auto-login 90 jours, max 5 appareils par soignant
- Token 32 bytes (`crypto.getRandomValues`)
- Détection appareil (iPhone/iPad/Android/Mac/Windows)
- Déconnexion = révoque le token de cet appareil

### Suppression compte
Cloudflare Pages Function `functions/api/delete-user.js` comme proxy sécurisé (la `service_role` key n'est jamais côté client).

### Détection WebView iOS
Bannière automatique jaune "Ouvrir dans Safari" quand l'app est dans un WebView iOS (QR code scanné depuis l'app caméra). Détection : iOS + pas Safari natif (CriOS/FxiOS/EdgiOS).

### Structure localStorage session
```javascript
localStorage.setItem('usca_session', JSON.stringify({
  type: 'patient' | 'soignant' | 'admin',
  // Patient : patient_id, prenom, chambre, expires (= date_sortie_prevue)
  // Soignant : profil, expires (6 mois)
  // Admin : supabase_managed=true, profile_id, nom, role, modules
  created_at: '2026-04-15T10:30:00Z',
  theme: 'light' | 'dark'
}));
```

---

## §10. Notifications push

> Pour le setup infrastructure (migrations, Edge Functions, secrets) : voir `SETUP_PUSH.md`.

### V1 patient (v3.99)
Migrations v25-v27 + Edge Functions Supabase + VAPID + pg_cron (rappels 5 min). Events planifiés + messages + permissions + rappels 5 min (events uniquement).

### V2 médecins (v4.01)
- Migration v29 : `push_subscriptions.patient_id` nullable + `profile_id` avec CHECK XOR
- Tables `push_last_message_staff` et `push_reminders_sent_groupe`
- Edge Function `send-push` accepte `patient_id` | `profile_id` | `profile_ids[]`
- SW priorise `profile_id` puis fallback `patient_id` (clés IndexedDB séparées, cleanup au logout)
- Engrenage ⚙️ header admin → modal Paramètres avec toggle activation push
- Message patient → push à tous les médecins abonnés (fire-and-forget)
- Cron-reminders étendu : rappels consultations perso au créateur + rappels groupes A/B aux animateurs

### V2 silence soignant (v4.02)
Push staff autorisés uniquement lundi-vendredi 8h30→18h hors jours fériés France. Patients jamais bloqués.

### V2 pause vacances (v4.03)
`profiles.push_pause_until DATE`, section "Pause vacances" modal Paramètres admin.

### V3 personnalisable par compte (v4.10)
Migration v34 : `profiles.push_preferences JSONB` (NULL = défauts système). 5 checkboxes événements (`message_patient`, `permission_demande`, `alerte_craving`, `groupe_rappel`, `rdv_perso`) + 3 réglages silence perso. Les prefs perso peuvent **durcir** mais pas assouplir le silence weekend/férié (sécurité par défaut).

### Push patient atelier (v4.13)
10 min avant atelier à TOUS les patients hospitalisés abonnés. Anti-doublon via migration v36 : colonne `patient_id UUID NULL` ajoutée à `push_reminders_sent_groupe` + CHECK XOR + 2 UNIQUE partiels. Tag PWA dédié `atelier-<slug>-<date>`.

---

## §11. Conventions cliniques (sources de vérité par priorité)

1. **Référentiel USCA 2.2** et addendum (documents internes)
2. **Recommandations HAS** : TSO, arrêt BZD, TDAH adulte, opioïdes, RdRD, hépatite C
3. **Guidelines SFA** (Société Française d'Alcoologie)
4. **NICE guidelines** (alcool, drogues, TDAH, tabac, gambling, TCA)
5. **Littérature PubMed**
