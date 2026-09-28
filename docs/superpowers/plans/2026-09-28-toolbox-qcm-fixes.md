# Plan — Réparer la Toolbox Vite + corriger le QCM externe (2026-09-28)

> Issu de l'audit externe du 2026-09-28 (PR #2 : faille `profiles` + bouton ↺, prérequis).
> 3 lots indépendants, **une PR par lot**, dans l'ordre A → B → C. Version cible : v4.52 (A), v4.53 (B), v4.54 (C).

---

## Lot A — Toolbox : liens `../` cassés (🔴 bloquant, admin + externe)

**Cause (vérifiée).** `staff/toolbox-app/src/App.jsx` a gardé les chemins de l'ancienne
`staff/toolbox.html` (servie depuis `/staff/`). La Toolbox Vite est servie depuis
`/staff/toolbox-app/dist/` → `../ressources_doc/index.json` se résout en
`/staff/toolbox-app/ressources_doc/index.json` (inexistant ; Cloudflare renvoie l'index
racine → JSON invalide). Cassé depuis v4.44 côté admin, depuis v4.50 côté externe.

**Occurrences** (`App.jsx`) :

| Ligne | Chemin | Onglet |
|---|---|---|
| 575 | `../fiches-traitements/fiches_expert/fiche_*.pdf` | Fiches expert |
| 1077, 1121 | `../ressources_doc/index.json`, `../ressources_doc/<fichier>` | Ressources |
| 1387 | `../postcure/medecin.html` | Post-cure |
| 1388 | `../etudiant/?preview=demo` | Livret IFSI (démo) |
| 1472 | `../metaboscope/dist/index.html` | MetaboScope |
| 1485 | `../eeg_ect/fiche_*.html` | EEG/ECT |
| 1592 | `../fiches-substances/…`, `../fiches-traitements/fiches_patient/…` | Fiches patient |

**Étapes**
1. Ajouter en tête de `App.jsx` une constante unique `const SITE = "/";` et remplacer chaque
   `"../` par `SITE + "` (chemins absolus depuis la racine, comme déjà fait pour `/shared/*` et `/sw.js`).
   Re-grepper `\.\./` dans `src/` pour ne rien oublier.
2. `npm --prefix staff/toolbox-app ci && npm --prefix staff/toolbox-app run build` → committer `dist/`
   (nouveau hash de bundle ; supprimer l'ancien `dist/assets/index-*.js`).
3. `sw.js` : vérifier que seul `dist/index.html` est pré-caché (les bundles hashés sont cachés à l'usage) ; incrémenter `CACHE_NAME`.
4. **Vérification Playwright** (Chromium préinstallé) : `python3 -m http.server` à la racine,
   ouvrir `/staff/toolbox-app/dist/index.html?embedded=true`, parcourir Ressources, Fiches, EEG/ECT,
   MetaboScope ; échec si une requête renvoie 404 ou si `index.json` ne parse pas.
   Répéter via `/admin/` et `/extern/` (iframe).
5. Vérifier l'aperçu Netlify `usca-toolbox` (même dépôt) : les chemins absolus supposent le site servi à la racine.
6. Docs : `CHANGELOG.md`, `CLAUDE.md` (version), `MODULES.md` §4 (l'iframe externe pointe sur `toolbox-app/dist`, pas `staff/toolbox.html`),
   `.claude/context/HANDOFF.md` (retirer « Non testé : onglet Toolbox d'extern/ »).

**Risque** : faible (chaînes de chemins uniquement). L'ancienne `staff/toolbox.html` (liens du livret IFSI) n'est pas touchée.

---

## Lot B — Moteur QCM externe (🟠 4 bugs fonctionnels)

Fichiers : `extern/index.html`, `shared/qcm-engine.js`.

| # | Bug (vérifié dans le code) | Correctif |
|---|---|---|
| B1 | Session entièrement répondue mais non terminée (✕ au lieu de « Terminer ») : à la reprise `startIdx = sessionQuestions.length` (l.2999) → `showQuestion()` (l.3057) lit une question inexistante → « Erreur reprise » en boucle | Dans la reprise : si toutes les questions ont une réponse → appeler `finishSession()` directement ; sinon borner `idx` |
| B2 | `finishSession()` pose `nextBtn.onclick` (l.3137) en plus du listener (l.3023) ; si l'écran score est fermé par ✕, le bouton reste « Fermer » à la session suivante ; double enregistrement final | Réinitialiser `nextBtn.onclick = null` + libellé au démarrage de chaque session (et dans le handler ✕) ; garde anti double-appel dans `finishSession` |
| B3 | `loadFlags()` (l.2016) cherche `#flags-list` / `#flags-count` absents du HTML → l'externe ne voit jamais les réponses du tuteur à ses 👎 | Ajouter la carte « Mes signalements » dans le dashboard (même gabarit que « Questions au tuteur ») ; `npm run build:css` si nouvelles classes Tailwind |
| B4 | `getMyInProgressSessions()` (`qcm-engine.js:204`) ne filtre pas par utilisateur ; en mode tuteur (`?preview=tuteur`), la RLS v18 expose les sessions des externes → reprise de la session d'un externe, écritures refusées silencieusement | Ajouter `.eq('user_id', (await sb.auth.getUser()).data.user.id)` |

**Aussi (mineur)** : aligner la liste des rôles du mode tuteur (l.789, inclut ide/pharmacien/psychologue/secrétaire) avec la doc « médecin/admin » **ou** mettre la doc à jour — décision JC.

**Vérification** : `node --check` sur les scripts extraits ; scénario Playwright avec session Supabase mockée ou compte de test :
démarrer une session → répondre à tout → ✕ → reprendre (B1) ; terminer → ✕ → nouvelle session, bouton = « Suivant » (B2) ;
carte signalements visible (B3). B4 : test unitaire du filtre (requête construite).

---

## Lot C — Contenu QCM EDN (🟠, **validation clinique JC requise avant commit**)

Fichiers : `data/item_*.json`, `data/index.json`. Format inchangé.

**C1 — Corrections factuelles** (proposition, à valider une par une) :
- `item_75` Q12 : barème 0–1/2–3/4–6 = **Fagerström simplifié (2 questions)** → nommer le test explicitement.
- `item_74` Q5 (explication) : l'IH sévère contre-indique aussi l'oxazépam → reformuler (à vérifier RCP Seresta®).
- `item_76` Q7 vs Q41 : contradiction GGT/CDT → Q7 reformulée ; retirer « sensibilité CDT > GGT ».
- `item_78` Q3 : « hyperthermie maligne (syndrome sérotoninergique) » → « hyperthermie sévère / syndrome sérotoninergique ».
- `item_76` Q14 : « vers 48 h » → « dans les 48 premières heures (6–48 h) ».
- `item_80` Q4 : ajouter le vilantérol aux β2 inhalés autorisés (à vérifier liste AMA en vigueur).
- `item_65` : libellé `index.json` « Troubles psychotiques » → « Trouble délirant persistant » (R2C).

**C2 — Actualisations** : Champix® → varénicline (75-Q6) ; RMO (77-Q3/Q18) ; épidémiologie VIH/VHC + TROD/AAD (78-Q25) ; ANJ (79-Q11).

**C3 — Qualité / biais** (script Python, pas de changement clinique) :
- Bonne réponse = B dans 52 %, D dans 3 % ; = proposition la plus longue dans 71 % → **re-mélanger les options** (seed fixe, `correct` recalculé)
  et signaler les questions où la bonne réponse est nettement la plus longue.
- Dédoublonner (76-Q12/Q31, Q11/Q57, Q7/Q49, Q8/Q25, Q16/Q37/Q46/Q53… ; BZD 74/77/70/110).
- Vérification automatique : 477 → N questions, chaque `correct` pointe une option existante, `index.json.total_questions` recalculé.

**C4 — Enrichissement (backlog, hors v4.54)** : naloxone prête à l'emploi (Prenoxad®/Nyxoid®), BHD retard (Buvidal®),
protoxyde d'azote, opioïdes de synthèse/nitazènes, baclofène (Baclocur®), mésusage prégabaline/tramadol, QRM 5 propositions + rangs A/B.

**Méthode** : générer un fichier de diff lisible (question avant/après) pour relecture par JC, **puis** appliquer.

---

## Transverse
- Prérequis : PR #2 fusionnée + `migrations/supabase-migration-v42.sql` exécutée.
- Chaque lot : incrément `CACHE_NAME`, ligne `CHANGELOG.md`, en-tête `CLAUDE.md`.
- Tâches déjà proposées en sessions séparées : « Fix broken ../ links in Vite Toolbox » (lot A), « Fix extern QCM engine bugs » (lot B).
