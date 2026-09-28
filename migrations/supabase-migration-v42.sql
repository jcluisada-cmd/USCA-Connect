-- ════════════════════════════════════════════════════════════════════
-- Migration v42 — Sécurité `profiles` + réinitialisation externe (2026-09-28)
-- ════════════════════════════════════════════════════════════════════
-- Contexte (audit externe 2026-09-28) :
--   1. Faille : `profiles_update_auth` autorisait TOUT compte connecté (externe,
--      étudiant, PdS…) à modifier N'IMPORTE QUEL profil, y compris `role` et
--      `is_admin` → auto-promotion administrateur possible (et donc accès à la
--      suppression de comptes via /api/delete-user).
--      `profiles_insert_auth` permettait aussi d'insérer un profil `is_admin = true`.
--   2. Bug : le bouton ↺ « Réinitialiser » (admin → Mon externe) ne supprimait
--      rien — aucune policy DELETE pour les médecins sur qcm_sessions /
--      qcm_reponses / qcm_flags, et PostgREST renvoie 0 ligne sans erreur.
--      `extern_questions` et la checklist n'étaient pas non plus effacées.
--
-- Correctifs :
--   - UPDATE profiles : son propre profil, ou n'importe lequel si admin.
--   - Trigger : `role`, `is_admin`, `email`, `id` modifiables uniquement par un
--     admin (ou service_role / SQL Editor, où auth.uid() est NULL).
--   - INSERT profiles : uniquement son propre id, et jamais `is_admin = true`
--     (sauf admin). La case « Droits administrateur » à la création est
--     appliquée ensuite par l'admin reconnecté (admin/index.html).
--   - RPC `reset_externe_data(uuid)` SECURITY DEFINER (médecin ou admin) :
--     efface réponses, sessions, signalements, questions et checklist d'un
--     compte `externe`, renvoie les compteurs.
--
-- À exécuter dans Supabase → SQL Editor (un seul bloc, idempotent).
-- ════════════════════════════════════════════════════════════════════

-- ── Helper : l'appelant est-il admin ? (SECURITY DEFINER → pas de récursion RLS) ──
create or replace function public.usca_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;
revoke all on function public.usca_is_admin() from public, anon;
grant execute on function public.usca_is_admin() to authenticated;

-- ── UPDATE : soi-même ou admin ───────────────────────────────────────
drop policy if exists "profiles_update_auth" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.usca_is_admin())
  with check (id = auth.uid() or public.usca_is_admin());

-- ── Trigger : colonnes sensibles réservées aux admins ────────────────
create or replace function public.usca_profiles_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.usca_is_admin()
     and (new.role     is distinct from old.role
       or new.is_admin is distinct from old.is_admin
       or new.email    is distinct from old.email
       or new.id       is distinct from old.id) then
    raise exception 'Modification du rôle / des droits réservée aux administrateurs'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists usca_profiles_protect on public.profiles;
create trigger usca_profiles_protect
  before update on public.profiles
  for each row execute function public.usca_profiles_protect();

-- ── INSERT : son propre profil, jamais admin (sauf par un admin) ─────
drop policy if exists "profiles_insert_auth" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = auth.uid()
    and (coalesce(is_admin, false) = false or public.usca_is_admin())
  );

-- ── RPC : réinitialisation complète d'un compte externe ──────────────
create or replace function public.reset_externe_data(p_externe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reponses  int;
  v_sessions  int;
  v_flags     int;
  v_questions int;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'medecin' or is_admin = true)
  ) then
    raise exception 'Réservé aux médecins et administrateurs' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_externe_id and role = 'externe') then
    raise exception 'Compte externe introuvable' using errcode = 'P0002';
  end if;

  delete from public.qcm_reponses
    where session_id in (select id from public.qcm_sessions where user_id = p_externe_id);
  get diagnostics v_reponses = row_count;

  delete from public.qcm_sessions where user_id = p_externe_id;
  get diagnostics v_sessions = row_count;

  delete from public.qcm_flags where user_id = p_externe_id;
  get diagnostics v_flags = row_count;

  delete from public.extern_questions where user_id = p_externe_id;
  get diagnostics v_questions = row_count;

  update public.profiles set checklist_items = '[]'::jsonb where id = p_externe_id;

  return jsonb_build_object(
    'sessions',  v_sessions,
    'reponses',  v_reponses,
    'flags',     v_flags,
    'questions', v_questions
  );
end;
$$;
revoke all on function public.reset_externe_data(uuid) from public, anon;
grant execute on function public.reset_externe_data(uuid) to authenticated;
