# HANDOFF — USCA Connect

> Point d'entrée pour reprendre le travail. Lire ce fichier en premier, avant `STATE.md` /
> `DECISIONS.md` / la conversation passée. Mis à jour au 2026-09-12 (réorganisation mémoire).

## Current objective

Aucun chantier de code ouvert actuellement. Cette session a réorganisé la mémoire du
projet (migration CLAUDE.md → architecture `.claude/context/{STATE,DECISIONS,HANDOFF}.md`),
pas de code touché.

## Current state

- **v4.49 livrée et confirmée réelle** : chantier 3 (Tailwind pré-compilé) terminé — voir
  `STATE.md` pour la vérification (zéro CDN Tailwind dans l'arbre de travail principal).
- Modernisation incrémentale : étapes 1 (Vite Toolbox), 2 (dark sans reload), 3 (Tailwind
  pré-compilé) livrées. **Étape 4 (Workbox) reste à faire, non planifiée en détail.**
- Aucun changement de code en attente de commit (seuls des fichiers `.claude/` locaux, non
  applicatifs — voir `STATE.md` §Git).

## Important changes (cette session)

- `CLAUDE.md` allégé : §6 (état actuel) et §7 (à faire) déplacés vers `.claude/context/STATE.md` ;
  décisions historiques significatives extraites vers `.claude/context/DECISIONS.md`.
  Le reste (§0-§5, §8, §9 : identité, infra, architecture fichiers, auth, BDD, conventions,
  contacts) reste dans `CLAUDE.md` car permanent et stable.
- Contradiction corrigée : `docs/superpowers/plans/2026-06-18-tailwind-precompile.md` a
  toutes ses cases non cochées mais le chantier est **réellement livré** (confirmé par grep
  sur le code + CHANGELOG + CLAUDE.md). Ne pas se fier aux cases de ce plan pour juger de
  l'avancement — se fier à `STATE.md` / `CHANGELOG.md` / `git log`.
- Anciennes mémoires (`.claude/projects/.../memory/*.md`, système auto-memory global) déjà
  bien structurées selon les règles globales de l'utilisateur — **non touchées**, restent la
  source pour le feedback de collaboration et l'historique de projets ponctuels
  (EEG/ECT, refonte MetaboScope, incidents CF Pages, etc.). Le dossier `.remember/` (système
  de session summaries) est un mécanisme distinct, également non touché.

## Decisions needed to continue

Aucune décision bloquante immédiate. Deux chantiers candidats pour la suite, à trancher
avec JC :
1. **MetaboScope Phase B** (P0 selon `CLAUDE.md` §7 avant réorg / `STATE.md` maintenant) —
   intégration iframe Toolbox, bloquante pour la suite de la roadmap MetaboScope.
2. **Modernisation étape 4 — Workbox** — dernière étape du chantier CDN→statique, pas encore
   spécifiée.
Voir aussi les **6 décisions à trancher** listées dans `METABOSCOPE_APP.md` §8 avant toute
exécution du chantier B MetaboScope.

## Verification / tests

- `grep -rn "tailwindcss/browser" --include="*.html" .` sur l'arbre principal → 0 résultat
  (seules occurrences : worktrees obsolètes sous `.claude/worktrees/`, hors périmètre).
- `git log -10 --oneline` cohérent avec `CHANGELOG.md` (dernier commit applicatif : `a387e2c`,
  alignement du plan chantier 3 sur la réalité — pas de régression).
- Pas de suite de tests automatisés dans ce projet (HTML + CDN, pas de test runner configuré).

## Open issues

- `docs/superpowers/plans/2026-06-18-tailwind-precompile.md` : cases à cocher obsolètes
  (voir ci-dessus) — pas bloquant, juste trompeur si consulté sans `STATE.md`.
- `.claude/worktrees/` contient des worktrees Git obsolètes avec l'ancien code CDN Tailwind
  — pas nettoyés (hors scope de cette session), à faire un jour si gênant.
- Workbox (étape 4 modernisation) : aucune spec/plan encore rédigée.
- MetaboScope Phase B (intégration iframe) reste P0/bloquante et non démarrée.

## Next action

**Audit général du 2026-09-22** : voir `STATE.md` §« Sécurité & exploitation ». Priorité =
corriger `delete-user.js` (suppression de comptes sans contrôle) puis la RLS `patients`
(identifiants patient lisibles en anon), avant tout chantier fonctionnel. La « Phase B
MetaboScope » est en réalité déjà livrée. Workbox reste l'étape 4 de modernisation.

## Read if needed

- `CLAUDE.md` — toujours (référence permanente, ~200 lignes après cette réorg).
- `STATE.md` — pour le détail de l'état actuel et le backlog complet.
- `DECISIONS.md` — avant de reconsidérer un choix architectural déjà tranché.
- `METABOSCOPE_APP.md` / `METABOSCOPE_INTEGRATION.md` — si travail MetaboScope.
- `SETUP_PUSH.md` — si travail notifications push V2.
