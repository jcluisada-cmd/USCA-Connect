# MASTER PROMPT — EEG / ECT — USCA CONNECT

> **Statut : exécuté — ne pas relancer tel quel.** Les fiches (dont `fiche_ect.html`) et `assets/` vivent dans `eeg_ect/` ; aucun `eeg_ect/index.json` n'existe ; la carte « EEG / ECT » est dans `staff/toolbox-app/src/App.jsx`. Les chemins `EEG_ECT_handbook/`, `USCA-Assistant/` et `staff/toolbox.html` ci-dessous n'existent plus comme cibles. Pour modifier une fiche, éditer `eeg_ect/fiche_*.html` directement.

Tu es un assistant expert :
- en EEG clinique
- en neurophysiologie
- en pédagogie médicale
- en psychiatrie hospitalière
- en sismothérapie (ECT)

Tu travailles pour une PWA hospitalière nommée **USCA Connect** (USCA / ELSA, hôpital Pitié-Salpêtrière, AP-HP).

Les fichiers PDF présents dans le dossier constituent le corpus de référence EEG (manuel d'EEG clinique) :

- `Technical_Aspects_of_EEG.pdf`
- `01_Normal_EEG.pdf`
- `02_Artifacts.pdf`
- `03_Epileptiform.pdf`
- `04_Status_Epilepticus.pdf`
- `05_ICU_EEG.pdf`

> **Important — fiche ECT** : le fichier `fiche_ect.html` présent dans ce dossier est une fiche pratique ECT issue d'un document fourni par les psychiatres de la Pitié-Salpêtrière. Elle est **canonique et distincte** du corpus EEG du handbook. **Ne pas la régénérer ni la modifier** : elle sera intégrée telle quelle dans la nouvelle carte Toolbox "EEG / ECT".

---

# OBJECTIF GLOBAL

Transformer les 6 chapitres EEG en fiches HTML pédagogiques ultra synthétiques, intégrables dans la Toolbox de USCA Connect, destinées :
- aux internes de psychiatrie
- aux psychiatres pratiquant les ECT
- à un usage clinique rapide
- à un usage mobile / PWA
- à un apprentissage visuel rapide des patterns EEG importants

Ce qu'il faut produire :
- reconnaître rapidement les patterns EEG importants
- différencier normal / anormal
- reconnaître les urgences
- reconnaître les artefacts
- comprendre les bases utiles de lecture EEG
- sécuriser la pratique clinique ECT

Ce qu'il NE faut PAS produire :
- un traité de neurophysiologie
- un cours universitaire exhaustif
- une explication complète de l'électronique EEG
- une encyclopédie

---

# CADRAGE PRODUIT — OÙ VIVENT CES FICHES

Les fiches générées s'intègrent dans la **Toolbox V1** (carte "EEG / ECT") de USCA Connect.

**Arborescence cible** :

```
USCA-Assistant/
├── EEG_ECT_handbook/                ← dossier source (PDFs + ce prompt)
│   ├── fiche_ect.html               ← fiche ECT canonique Pitié (à intégrer telle quelle)
│   └── ...PDFs corpus
└── eeg_ect/                         ← DOSSIER À CRÉER, fiches générées + manifest
    ├── index.json                   ← manifest (cf. schéma plus bas)
    ├── fiche_normal_eeg.html
    ├── fiche_artefacts.html
    ├── fiche_epileptiforme.html
    ├── fiche_status_epilepticus.html
    ├── fiche_icu_eeg.html
    ├── fiche_technical.html
    └── assets/
        ├── fig_normal_alpha.png
        ├── fig_spike_wave.png
        └── ...figures extraites des PDFs
```

**Règle d'intégration** : 1 chapitre PDF = 1 fiche HTML autonome (avec figures linkées en chemin relatif), pas de SPA, pas de JS framework. Manifest `index.json` aligné sur le format `ressources_doc/index.json` existant.

---

# CHARTE GRAPHIQUE & DESIGN SYSTEM — OBLIGATOIRE

USCA Connect utilise une charte précise qui DOIT être respectée :

| Rôle | Couleur | Hex |
|---|---|---|
| Primaire (titres, accents) | Indigo | `#4F46E5` |
| Succès / validation | Émeraude | `#10B981` |
| Alerte / urgence | Rouge | `#EF4444` |
| Avertissement | Ambre | `#F59E0B` |
| Fond clair | Slate | `#F8FAFC` |
| Texte | Slate-900 | `#0F172A` |

**Dark mode obligatoire** via `body.dark` (toggle global de l'app). Utiliser des variables CSS (`--bg`, `--text`, `--card-bg`, etc.) avec override dans `body.dark { ... }`. Voir `EEG_ECT_handbook/fiche_ect.html` comme **référence d'implémentation à reproduire** (variables CSS + `body.dark`).

**Design system partagé** : s'inspirer de `shared/ressource-doc.css` (utilisé par toutes les ressources Toolbox actuelles : BZD, antipsychotiques, INCAS). Soit le réutiliser via `<link>`, soit en reprendre les conventions (typographie, cartes, badges, alertes colorées, impression A4).

**Pas de Tailwind CDN dans les fiches** : les fiches Toolbox existantes utilisent du CSS natif via `ressource-doc.css`. Garde la cohérence.

---

# ORIENTATION PÉDAGOGIQUE

Le contenu doit être :
- très synthétique
- clinique
- visuel
- pragmatique
- pédagogique
- mobile-first
- compatible PWA
- lisible rapidement
- sans jargon inutile

Chaque fiche doit pouvoir être comprise :
- en moins de 5 minutes
- par un interne débutant en EEG

---

# PRIORITÉS CLINIQUES

Prioriser :
- EEG normal
- ralentissements pathologiques
- activité épileptiforme (spikes, sharp waves)
- status epilepticus
- ICU EEG (encéphalopathies)
- artefacts fréquents
- pièges fréquents
- sécurité clinique ECT

---

# CHAPITRE TECHNICAL — RÈGLES SPÉCIALES

`Technical_Aspects_of_EEG.pdf` doit être **simplifié massivement**.

À SUPPRIMER :
- électronique complexe
- physique avancée
- équations
- détails d'ingénierie
- théorie excessive

À GARDER UNIQUEMENT :
- fréquence
- amplitude
- bandes alpha / beta / theta / delta
- montage bipolaire vs référentiel
- filtres (HF, LF, notch) — usage pratique seulement
- artefacts liés à la technique
- règles de lecture rapide
- erreurs fréquentes

Objectif : **"Comprendre un EEG en 10 minutes"**.

---

# FIGURES EEG — RÈGLES D'EXTRACTION

Les figures du manuel sont **claires et de qualité**. Elles doivent être conservées telles quelles dans les fiches générées.

**Méthode** :
- extraire les figures pertinentes des PDFs en **PNG ou JPG** (résolution suffisante pour mobile haute densité, pas de gros fichiers > 500 KB sans raison)
- stocker dans `eeg_ect/assets/fig_XX_<nom>.png` (nommage explicite : `fig_normal_alpha.png`, `fig_spike_wave_3hz.png`, etc.)
- référencer en chemin relatif depuis le HTML : `<img src="assets/fig_xx.png" alt="...">`
- ajouter une **légende courte** sous chaque figure (1-2 lignes : ce qu'on voit, où regarder)
- si pertinent, ajouter une **annotation visuelle** par-dessus (flèche CSS, encadré, surbrillance) — mais sans dénaturer la figure originale

**Sélection** : ne pas inclure toutes les figures du PDF. Une figure = un pattern important. Privilégier 3 à 6 figures par fiche maximum.

**Attribution** : usage clinique interne hospitalier (USCA Pitié-Salpêtrière). Les fiches **ne doivent pas être redistribuées publiquement**. Mentionner "Source : manuel d'EEG clinique (usage interne USCA)" en pied de fiche.

---

# STRUCTURE DES FICHES

**Sections obligatoires** (4) — toujours présentes :

1. **Résumé ultra rapide** — 10 à 15 lignes max
2. **Patterns EEG importants** — figures + description + signification clinique
3. **Red flags nécessitant avis neurologique** — format ultra synthétique
4. **Take Home Messages** — 8 à 10 bullet points max

**Sections optionnelles** (4) — à inclure SEULEMENT si pertinent pour le chapitre :

5. **Ce qu'il faut reconnaître visuellement** — bullet points (utile pour Normal, Epileptiforme, Status)
6. **Artefacts fréquents** — tableau (utile principalement pour le chapitre Artefacts)
7. **Ce qu'un psychiatre ECT doit absolument savoir** — checklist (utile pour Normal, Epileptiforme, Technical)
8. **Mini cas cliniques** — 2 à 3 cas courts (utile pour Status, ICU EEG ; à éviter pour Technical)

**Format détaillé d'un pattern** (section 2) :

| Champ | Description |
|---|---|
| Nom | Nom usuel + nom technique si différent |
| Image EEG | Figure extraite du PDF avec légende |
| Description visuelle | 2-3 phrases simples |
| Signification clinique | 1-2 phrases |
| Gravité | Badge (vert / ambre / rouge) |
| Diagnostic différentiel | Liste courte |
| Pièges fréquents | 1-3 items |
| Niveau d'urgence | "Avis neuro immédiat" / "Avis programmé" / "Pas d'urgence" |

**Format des artefacts** (section 6) — tableau :

| Artefact | Aspect visuel | Comment le reconnaître | Piège fréquent |

---

# LONGUEUR — VISER COURT, MAIS PRIVILÉGIER LA PÉDAGOGIE

**Cible** : 400 à 700 lignes par fiche HTML (CSS inline ou linké, hors images). Si tu y arrives en restant clair et complet, tant mieux.

**Mais** : la pédagogie prime sur le quota. Pour des chapitres denses (Status epilepticus, ICU EEG), une fiche peut légitimement aller plus loin. Ne **jamais** sacrifier la clarté ou un pattern important pour rester dans le cap. Ne **jamais** délayer non plus pour atteindre la cible.

**Règles complémentaires** :
- chaque section doit rester lisible sur **1 écran mobile** (un swipe = une idée)
- préférer plusieurs sections courtes à une section fleuve
- si une fiche dépasse ~900 lignes et qu'on peut splitter sans perdre la cohérence (ex : `fiche_status_epilepticus_adulte.html` + `fiche_status_epilepticus_pediatrique.html`), splitter
- si une fiche fait < 300 lignes mais couvre tout, c'est OK (pas besoin de remplir)

---

# JSON MANIFEST — `eeg_ect/index.json`

Un seul manifest pour toutes les fiches, calqué sur `ressources_doc/index.json` (Toolbox actuelle).

**Schéma** :

```json
{
  "version": 1,
  "updated_at": "2026-05-XX",
  "fiches": [
    {
      "slug": "normal_eeg",
      "type": "fiche_eeg",
      "titre": "EEG normal",
      "description": "Rythmes de fond, alpha, sommeil, variantes physiologiques.",
      "fichier": "fiche_normal_eeg.html",
      "tags": ["normal", "alpha", "sommeil"],
      "ordre": 2,
      "duree_lecture_min": 5,
      "patterns": [
        {
          "pattern": "Rythme alpha postérieur",
          "category": "rythme_de_fond",
          "visual_description": "Activité 8-13 Hz, occipitale, bloquée par l'ouverture des yeux.",
          "clinical_significance": "Normal chez l'adulte éveillé yeux fermés.",
          "urgency": "aucune",
          "ect_relevance": "Référence avant ECT pour comparer post-séance.",
          "common_pitfalls": ["Confusion avec mu", "Asymétrie physiologique tolérable < 50%"],
          "differential_diagnosis": ["Rythme mu", "Beta postérieur"],
          "red_flags": ["Asymétrie > 50%", "Disparition unilatérale"]
        }
      ]
    }
  ]
}
```

**Usage du manifest** :
- alimenter la nouvelle carte Toolbox "EEG / ECT" (liste, recherche, tags)
- futur : recherche full-text sur `patterns[]` (chercher "spike wave 3 Hz" → fiche correspondante)
- futur : index unifié si on consolide avec `ressources_doc/index.json`

---

# CONTRAINTES HTML

Chaque fiche doit être :
- **HTML autonome unique** (un seul `.html` par fiche)
- CSS inline ou linké à `shared/ressource-doc.css` (relatif : `../shared/ressource-doc.css`)
- responsive, mobile-first
- compatible PWA (servie par le service worker — pré-cache à prévoir dans `sw.js`)
- **dark mode** via `body.dark` (cf. `fiche_ect.html` comme référence)
- imprimable A4 propre (cf. `@media print` de `fiche_ect.html`)
- sans JavaScript complexe (max : `<details>` natif pour collapsibles, pas de framework)
- sans dépendance externe lourde (pas de Tailwind CDN, pas de CDN icons)

---

# DESIGN UI

Style :
- médical moderne
- minimaliste
- clair
- professionnel
- pédagogique

Composants à utiliser :
- cartes
- badges (vert / ambre / rouge pour gravité)
- alertes colorées (encadrés "⚠️ Red flag", "💡 Astuce", "🔴 Urgence")
- tableaux simples
- `<details>` collapsibles si une section est dense

---

# LIMITATION DU CONTENU — RÈGLE FORTE (anti-copie)

**INTERDICTIONS strictes** :
- ne pas recopier de paragraphes entiers du manuel
- ne pas reproduire de longues citations textuelles
- ne pas paraphraser ligne à ligne en gardant la structure du livre
- ne pas reproduire de tableaux complets du livre tels quels (les redessiner / synthétiser)

**OBLIGATIONS** :
- toujours condenser, synthétiser, hiérarchiser
- reformuler dans un français clinique propre
- orienter contenu pratique / reconnaissance rapide / sécurité ECT
- les **figures originales** sont la seule reproduction directe autorisée (cf. règle figures + usage interne)

**Note de redistribution** : ces fiches sont à usage interne USCA / Pitié-Salpêtrière. Ne pas publier sur internet ouvert (juste sur la PWA, accessible aux soignants identifiés).

---

# SORTIE ATTENDUE — PAR CHAPITRE

Pour chacun des 6 chapitres EEG :

1. fiche HTML complète (`eeg_ect/fiche_<slug>.html`)
2. figures extraites en PNG/JPG (`eeg_ect/assets/fig_<nom>.png`)
3. entrée dans `eeg_ect/index.json` (avec `patterns[]` JSON détaillé)
4. court résumé en clair (3-5 lignes) à placer en commentaire HTML en haut de la fiche

**Au final, livrer aussi** :
- 1 mise à jour de `sw.js` : ajouter le dossier `eeg_ect/` au pré-cache
- 1 patch de `staff/toolbox.html` : ajouter la carte EEG / ECT (cf. réorganisation Toolbox plus bas)

---

# CHAPITRES — ORDRE DE TRAITEMENT

1. `Technical_Aspects_of_EEG.pdf` (allégé massivement → "Comprendre un EEG en 10 min")
2. `01_Normal_EEG.pdf`
3. `02_Artifacts.pdf`
4. `03_Epileptiform.pdf`
5. `04_Status_Epilepticus.pdf`
6. `05_ICU_EEG.pdf`

Le **chapitre Technical** sert de fondation lecture pour les 5 suivants. Le commencer en premier permet de référencer ses notions (alpha, montage, filtres) dans les fiches suivantes sans réexpliquer.

---

# RÉORGANISATION TOOLBOX — CONTEXTE

La carte "EEG / ECT" sera ajoutée dans la nouvelle organisation de la Toolbox V1 (`staff/toolbox.html`) :

**Grandes cartes (4)** :
1. Protocoles USCA par substance
2. Ressources USCA
3. Fiches Traitements et Substances
4. Dossier Post-cure

**Petites cartes (5)** :
- Scores
- **EEG / ECT** ← nouveau, alimenté par `eeg_ect/index.json` + `EEG_ECT_handbook/fiche_ect.html`
- Interactions (MetaboScope) ← renommage de "Interactions"
- ELSA
- Feedback

La carte EEG / ECT ouvre un hub avec :
- **Pratique ECT** → `EEG_ECT_handbook/fiche_ect.html` (fiche canonique Pitié)
- **Fiches EEG (handbook)** → liste alimentée par `eeg_ect/index.json`

---

# OBJECTIF FINAL

Créer une mini référence EEG / ECT clinique :
- ultra rapide
- orientée psychiatrie
- orientée ECT
- visuelle
- utilisable sur mobile
- sécurisante en pratique clinique
- immédiatement exploitable dans USCA Connect
- intégrée à la charte et au design system existant
- conforme aux règles de copyright (figures conservées en usage interne, texte synthétisé)
