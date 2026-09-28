# USCA Connect — Schéma BDD Supabase

> Fichier à lire **à la demande** quand la session concerne le schéma BDD, les migrations, ou les RLS.
> Pour la liste plate des migrations historiques v1-v32 : voir `CLAUDE_ARCHIVE.md` §E.
> Pour le setup push (Edge Functions, secrets) : voir `SETUP_PUSH.md`.

**Projet Supabase** : `pydxfoqxgvbmknzjzecn.supabase.co`

---

## Tables principales

### `profiles` — Profils soignants
- `id` (UUID, FK auth.users)
- `email`, `nom`, `role`
- `is_admin` boolean (séparé du rôle métier)
- `modules_actifs`, `jours_presence` (array [1-5], filtre Staff Psy)
- `checklist_items` (JSONB, externe)
- `push_preferences` (JSONB, v34) — NULL = défauts système
- `push_pause_until` (DATE, v30) — pause vacances
- RLS (v42 + v43) : SELECT `true` ; UPDATE soi-même ou admin (trigger `usca_profiles_protect` : `role`/`is_admin`/`email`/`id` réservés admin) ; **aucune policy INSERT** — profils créés uniquement par `functions/api/create-user.js` (service_role). Inscriptions publiques Supabase Auth désactivées.

### `patients` — Patients hospitalisés
- `chambre`, `DDN`, `admission`, `sortie_prevue`
- `sexe` (F/M/NULL, v28)
- `postcure_statut` (JSONB, v14) — workflow + structure + date
- `sortie_info` (JSONB, v15) — destination RAD/post-cure/autre + checklist documents

### `alertes` — Craving / effet indésirable / urgence / demande
- `patient_id`, `type`, `intensite`, `statut`

### `strategies` — Stratégies de prévention patient
5 catégories Marlatt.

### `evenements` — Événements
`patient_id` nullable (individuels + équipe). Types : `entretien`, `consultation`, `familial`, `rdv_externe`, `reunion`, `staff`, `labo`, `supervision`.

### `permissions` — Demandes de permission
- `statut` (en_attente / validee / refusee)
- `date_debut`, `heure_debut`, `date_retour`, `heure_retour`, `motif`
- `validee_par`, `validee_at`
- `motifs_refus_codes` TEXT[] + `motif_refus_libre` TEXT (v37)

### `cushman_scores` — Scores Cushman (sevrage alcoolique, CIWA-Ar FR) — v38
- `patient_id` UUID FK CASCADE, `saisi_le` TIMESTAMPTZ
- `items` JSONB (7 items × 4 niveaux : fc/pa/fr/tremblements/sueurs/agitation/sensoriels, valeurs 0..3)
- `score_total` INT (0..21, CHECK), `commentaire` TEXT
- `rappel_intervalle_h` INT NULL — si rempli, rappel échu à `saisi_le + h*1h`
- RLS : SELECT authenticated, INSERT pds/ide/medecin
- Index : `(patient_id, saisi_le DESC)`

### `transmissions` — Transmissions médicales / paramédicales (PdS ↔ médecin) — v38
- `patient_id` UUID FK CASCADE, `auteur_id` UUID FK profiles
- `type` TEXT CHECK in ('medical','paramedical')
- `contenu` TEXT (length > 0), `cree_le` TIMESTAMPTZ
- RLS : SELECT authenticated, INSERT para par pds/ide, INSERT med par medecin
- Index : `(patient_id, cree_le DESC)`

### `contenus_partages` — Messages bidirectionnels patient ↔ équipe
- Notes, liens, consignes
- `modifie_le` TIMESTAMPTZ (v40) : non nul = message édité → affichage « (modifié) »
- **Convention** : `cree_par IS NULL` = envoyé par le patient, sinon = soignant
- Migration v21 : policy INSERT ouverte anon (`WITH CHECK (true)`)
- Migration v40 : `contenus_update_own` (UPDATE) + `contenus_delete_own` (DELETE) — prédicat `(auth.uid() = cree_par) OR (auth.uid() IS NULL AND cree_par IS NULL)` : chacun ne modifie/supprime que ses propres messages (soignant via uid, patient anon via `cree_par IS NULL`). Remplace l'ancienne `contenus_delete_auth` (trop large)

### `fiches_traitements_patient` — Fiches traitements prescrites
Checklist par patient.

### `substances_patient` — Fiches substances poussées au patient (v33)
- RLS calquée sur `prescriptions` : SELECT public, INSERT/DELETE authenticated
- Symétrique de `prescriptions` mais sémantique distincte (un traitement ≠ une substance consommée)

---

## Tables groupes

### `groupe_animateurs` — Soignants désignés animateurs
- `groupe_slug`, `user_id`
- Migration v23 : FK → `profiles(id) ON DELETE CASCADE` (au lieu d'auth.users)
- Policy DELETE ouverte aux admins

### `groupe_modifications` — Modifications par date
- Annulation, changement heure, exclusions
- `horaires_individuels` (JSONB)

### `groupe_rappels` — Rappels envoyés par l'animateur

### `participations` — Présences/absences aux groupes (patient ou animateur)

### `demandes_seances` — Demandes de séances thérapies complémentaires
`statut` : en_attente / acceptee / refusee.

---

## Tables auth et réunions

### `device_tokens` — Appareils de confiance soignants
```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  appareil TEXT DEFAULT 'Appareil inconnu',
  derniere_utilisation TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_tokens_own" ON device_tokens FOR ALL USING (auth.uid() = user_id);
```
Auto-login 90j, max 5 appareils par soignant.

### `presences_reunions` — Présences aux réunions staff (médecins)

---

## Tables gestion lits

### `liste_attente` — Patients en attente d'admission
- `age`, `ddn`, `addressage`, `date_entree_prevue`, `date_sortie_prevue`
- `pre_admission`, `destination_prevue` (JSONB)
- `commentaire`
- Migration v22 : ajout `pre_admission`, `destination_prevue`, `ddn`, `date_sortie_prevue`

---

## Tables livret IFSI

### `etudiants_stages` — Stage de l'étudiant·e IDE
- `nom`, `IFSI`, `promo`, `dates`, `ide_referent`

### `etudiant_progression` — Progression par question
- Réponses, vu par tuteur

---

## Tables QCM EDN externe

### `tuteur_etudiant` — Lien tuteur↔apprenant
- `type`='externe' ou 'etudiant_ide'

### `qcm_sessions` — Une ligne par série QCM jouée
- `item`, `mode`, `score`
- `questions_json` (depuis v3.98 : toutes les questions de l'item, pas cap 10)

### `qcm_reponses` — Une ligne par question répondue
- `question_source` stable type "Item 76 - Q12"
- `correct`, `temps_ms`

### `qcm_flags` — Signalements externe → tuteur
- `erreur_question` ou `demande_explication`
- `statut` ouvert/traité
- `tuteur_reponse`

### `extern_questions` — Questions textuelles externe → tuteur (v20)
- `user_id`, `message`, `reponse`, `statut` (`ouvert` par défaut)
- Réinitialisation complète d'un externe : RPC `reset_externe_data(uuid)` (v42, médecin/admin)

---

## Tables push (V1 patient + V2 médecins)

### `push_subscriptions`
- `patient_id` UUID NULL (v29)
- `profile_id` UUID NULL (v29)
- CHECK XOR (`profile_id` XOR `patient_id`)
- Endpoint, keys (auth, p256dh)
- Migration v31 : policy `push_subs_read_public` (SELECT `true`) — débloque (a) activation patient (RETURNING évalué contre policy SELECT), (b) trigger message patient→médecin (`getSubscribedMedecinIds()` retournait `[]` en anon)

### `push_last_message_staff`
Anti-doublon messages staff.

### `push_reminders_sent_groupe`
- `profile_id` (animateur) OU `patient_id` (atelier patient v4.13)
- CHECK XOR
- 2 UNIQUE partiels (un par cible)
- Tag PWA dédié `atelier-<slug>-<date>` distinct de `groupe-<slug>-<date>`

---

## Personnalisation modules (P5, v32)

### `role_modules_hidden`
- PK composite `(role, module_id)`
- FK `updated_by → profiles ON DELETE SET NULL`
- RLS : `rmh_read` ouverte authenticated, `rmh_write` réservée `is_admin=true`
- **Modèle "absence = visible"** : la table ne stocke QUE les masquages

---

## Historique migrations v1 → v36

> Pour les détails de v1-v18, voir aussi `CLAUDE_ARCHIVE.md` §E.

| Version | Date | Description |
|---|---|---|
| v1 | — | Schéma initial (profiles, patients, alertes, programmes, groupes) |
| v2 | — | Stratégies, permissions, messages, fiches traitements |
| v3 | — | Evenements |
| v4 | — | Ajustements RLS |
| v5 | — | CASCADE sur alertes et stratégies (suppression patient) |
| v6 | — | Tables groupes (animateurs, modifications, rappels) |
| v7 | — | Horaires individuels (JSONB dans groupe_modifications) |
| v8 | — | Appareils de confiance (device_tokens) |
| v9 | — | Participations aux groupes |
| v10 | — | Demandes de séances thérapies complémentaires |
| v11 | — | Événements d'équipe (patient_id nullable) + présences réunions |
| v12 | — | Liste d'attente (table liste_attente) |
| v13 | — | Jours de présence soignants (profiles.jours_presence) |
| v14 | — | Statut post-cure workflow (patients.postcure_statut JSONB) |
| v15 | — | Infos de sortie (patients.sortie_info JSONB) |
| v16 | — | Livret IFSI — tables etudiants_stages + etudiant_progression |
| v17 | 2026-04-19 | QCM EDN externe — tuteur_etudiant + qcm_sessions + qcm_reponses + qcm_flags. Numérotée v17 localement (côté Supabase nom interne `v15_qcm_edn`) |
| v18 | 2026-04-19 | RLS médecin→externe (sessions/flags visibles par tous médecins) |
| v20 | 2026-04-20 | Questions au tuteur (externe pose/modifie/supprime, tuteur répond) |
| v21 | 2026-04-20 | Policy INSERT `contenus_partages` `WITH CHECK (true)` — patient anon peut envoyer |
| v22 | 2026-04-21 | Liste_attente enrichie (pre_admission, destination_prevue, ddn, date_sortie_prevue) |
| v23 | 2026-04-21 | FK animateurs CASCADE + policy DELETE admin |
| v24 | 2026-04-21 | Agenda perso `cree_par` |
| v25-v27 | 2026-04-22 | Push subscriptions + pg_cron rappels 5 min |
| v28 | 2026-04-22 | `patients.sexe` (F/M/NULL) |
| v29 | 2026-04-23 | Push V2 médecins : `push_subscriptions.patient_id` nullable + `profile_id` avec CHECK XOR + tables `push_last_message_staff` et `push_reminders_sent_groupe` |
| v30 | 2026-04-24 | `profiles.push_pause_until DATE` (pause vacances) |
| v31 | 2026-04-24 | Policy `push_subs_read_public` (SELECT `true`) |
| v32 | 2026-04-27 | P5 Personnalisation modules — `role_modules_hidden` |
| v33 | 2026-04-25 | `substances_patient` (16 fiches substances, RLS calquée prescriptions) |
| v34 | 2026-04-25 | `profiles.push_preferences JSONB` (V3 personnalisable) |
| v35 | 2026-04-26 | Policy `permissions_delete_auth` (DELETE permissions débloqué) |
| v36 | 2026-04-27 | `push_reminders_sent_groupe.patient_id` nullable + CHECK XOR + 2 UNIQUE partiels (push patient atelier) |
| v37 | 2026-05-09 | `permissions.motifs_refus_codes` TEXT[] + `motif_refus_libre` TEXT (motifs structurés de refus médecin) |
| v38 | 2026-05-22 | Dashboard PdS — tables `cushman_scores` (sevrage alcool, items JSONB 7 niveaux + rappel) et `transmissions` (médical/paramédical, RLS par rôle) |
| v39 | 2026-05-22 | `profiles_select_all` (SELECT `true`) — patient anon lit emails auteurs via JOIN (affichage auteur messages) |
| v40 | 2026-05-29 | `contenus_partages.modifie_le` + policy `contenus_update_own` + DELETE resserré `contenus_delete_own` (chacun modifie/supprime ses propres messages) |
| v41 | 2026-09-22 | Purge `cron.job_run_details` + job quotidien + `VACUUM FULL net._http_response` (journaux techniques) |
| v42 | 2026-09-28 | `profiles` : UPDATE soi-même ou admin + trigger `usca_profiles_protect` (role/is_admin/email réservés admin) + INSERT `profiles_insert_self` ; RPC `reset_externe_data(uuid)` (bouton ↺ Mon externe) |
| v43 | 2026-09-28 | `profiles` : suppression des policies INSERT (`profiles_insert_self`, `profiles_insert_auth`) — création de compte côté serveur (`/api/create-user`, service_role) ; + désactiver « Allow new users to sign up » |

---

## Conventions RLS

### Données patient (lecture)
- Patient anon : son propre `patient_id` uniquement (vérifié via session localStorage chambre+DDN)
- Soignants `authenticated` : tous les patients

### Données patient (écriture)
- Patient anon : INSERT autorisé sur `alertes`, `strategies`, `participations`, `permissions_sortie`, `contenus_partages` (v21 ouverte). UPDATE/DELETE sur ses propres messages `contenus_partages` (v40, `cree_par IS NULL`)
- Soignants `authenticated` : INSERT/UPDATE/DELETE selon le contexte. Sur `contenus_partages`, UPDATE/DELETE limités à `auth.uid() = cree_par` (v40)

### Admin
- `is_admin=true` : bypass UI (P5), accès Cloudflare Function suppression compte (`SUPABASE_SERVICE_ROLE_KEY`)

### Push subscriptions
- Lecture publique (v31) — endpoints/clés non secrets, seule la clé privée VAPID permet l'envoi
- Écriture authenticated (sauf création anon pour patient via session localStorage)

---

## Limites du modèle (à connaître)

1. **P5 = masquage UI uniquement** : les RLS des tables patients/messages/etc. restent inchangées. Un user avec accès API peut toujours lire les données qu'on cache visuellement. Si une feature exige un vrai contrôle d'accès données par rôle, il faudra ajouter des policies RLS dédiées indépendamment de P5.

2. **Push silence soignant hardcodé** : la règle "semaine après 16h + weekend + fériés France" est codée dans `supabase/functions/send-push/index.ts`. À configurer par profil → migration future avec `profiles.push_quiet_hours JSONB`. Liste fériés FR à maintenir tant que Pâques pas calculée dynamiquement.

3. **Planning A/B duplicaté** : aujourd'hui côté client (`shared/planning-groupes.js`) et copié en TS dans `cron-reminders` Edge Function. À migrer en BDD (`groupes_planning(slug, jour, heure_debut, heure_fin, semaine, actif)`) quand un autre module aura besoin du planning côté serveur.

4. **Auth patient faible** : chambre+DDN. Mitigation : rate-limiting client (3 tentatives → 5 min), données limitées au patient courant, réseau hospitalier.
