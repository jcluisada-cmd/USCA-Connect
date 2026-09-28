-- ════════════════════════════════════════════════════════════════════
-- Migration v43 — Plus d'INSERT client sur `profiles` (2026-09-28)
-- ════════════════════════════════════════════════════════════════════
-- Contexte : depuis v4.52, les comptes soignants sont créés côté serveur par
-- la Cloudflare Function `functions/api/create-user.js` (admin vérifié, API
-- admin Supabase, profil inséré avec la service_role qui contourne la RLS).
-- Plus aucun code client n'insère dans `profiles` → la policy
-- `profiles_insert_self` (v42) ne sert plus et laisserait un compte inscrit
-- par l'API publique se créer un profil avec le rôle métier de son choix.
--
-- Sans policy INSERT, RLS refuse tout INSERT `anon` / `authenticated` ;
-- la service_role (Function) et le SQL Editor ne sont pas concernés.
--
-- Ordre de déploiement :
--   1. Déployer v4.52 (push → Cloudflare Pages) et vérifier une création de compte.
--   2. Exécuter v42 si ce n'est pas déjà fait (UPDATE + trigger), puis ce fichier.
--   3. Supabase → Authentication → Sign In / Providers → décocher
--      « Allow new users to sign up » (ferme /auth/v1/signup à la clé anon ;
--      l'API admin utilisée par /api/create-user n'est pas affectée).
--
-- À exécuter dans Supabase → SQL Editor (idempotent).
-- ════════════════════════════════════════════════════════════════════

drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_insert_auth" on public.profiles;

-- Vérification : aucune ligne attendue
-- select policyname from pg_policies
--   where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT';
