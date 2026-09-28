/**
 * Cloudflare Pages Function — Création de compte soignant (Supabase Auth + profil)
 * Endpoint : POST /api/create-user
 * Body     : { email, password, nom, role, isAdmin }
 *
 * Avant v4.52, le compte était créé côté client (sb.auth.signUp + insert profiles),
 * ce qui imposait des inscriptions publiques ouvertes : n'importe qui disposant de la
 * clé anon pouvait s'inscrire et s'attribuer un rôle métier (ex. `medecin`).
 * Désormais : appelant authentifié ET admin, création via l'API admin Supabase
 * (email confirmé d'office), profil inséré avec la service_role — les inscriptions
 * publiques peuvent être fermées dans Supabase Auth.
 *
 * Prérequis : variable d'env Cloudflare SUPABASE_SERVICE_ROLE_KEY
 */

// Rôles métier autorisés (cf. CLAUDE.md §4)
const ROLES = ['medecin', 'ide', 'psychologue', 'pharmacien', 'secretaire', 'externe', 'etudiant_ide', 'pds'];

// Modules par défaut selon le rôle (repris de l'ancien auth._defaultModules côté client)
const DEFAULT_MODULES = {
  medecin: ['toolbox', 'dashboard', 'alertes', 'groupes', 'config'],
  ide: ['toolbox', 'dashboard', 'alertes', 'groupes', 'config'],
  etudiant_ide: ['livret']
};

export async function onRequestPost(context) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;

  // Headers CORS pour les requêtes depuis l'app
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return reply(500, { error: 'Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY manquante)' });
  }

  // URL Supabase — soit depuis env, soit valeur du projet
  const supabaseUrl = SUPABASE_URL || 'https://pydxfoqxgvbmknzjzecn.supabase.co';
  const serviceHeaders = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Vérifier que l'appelant est authentifié : le JWT doit être VALIDÉ par Supabase Auth
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return reply(401, { error: 'Non autorisé' });

    const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    const caller = whoRes.ok ? await whoRes.json().catch(() => null) : null;
    if (!caller || !caller.id) return reply(401, { error: 'Session invalide ou expirée' });

    // 2. Vérifier que l'appelant est admin (profiles.is_admin)
    const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=is_admin`, {
      headers: serviceHeaders
    });
    const rows = profRes.ok ? await profRes.json().catch(() => []) : [];
    if (!Array.isArray(rows) || !rows[0] || rows[0].is_admin !== true) {
      return reply(403, { error: 'Réservé aux administrateurs' });
    }

    // 3. Valider la saisie
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const nom = String(body.nom || '').trim();
    const role = String(body.role || '');
    const isAdmin = body.isAdmin === true;

    if (!email || !password || !nom || !role) return reply(400, { error: 'Tous les champs sont obligatoires' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Adresse e-mail invalide' });
    if (password.length < 6) return reply(400, { error: 'Le mot de passe doit faire au moins 6 caractères' });
    if (nom.length > 100) return reply(400, { error: 'Nom trop long' });
    if (!ROLES.includes(role)) return reply(400, { error: 'Rôle invalide' });

    // 4. Créer le compte Auth (email confirmé d'office : pas d'e-mail de confirmation)
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created.id) {
      const msg = created.msg || created.message || created.error_description || created.error || 'Erreur Supabase Auth';
      return reply(createRes.status >= 400 ? createRes.status : 500, { error: msg });
    }

    // 5. Insérer le profil (service_role → contourne la RLS)
    const insRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id: created.id,
        email,
        nom,
        role,
        is_admin: isAdmin,
        modules_actifs: DEFAULT_MODULES[role] || []
      })
    });
    if (!insRes.ok) {
      const err = await insRes.json().catch(() => ({}));
      // Rollback : ne pas laisser un compte de connexion sans profil
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${created.id}`, {
        method: 'DELETE',
        headers: serviceHeaders
      }).catch(() => {});
      return reply(500, { error: 'Profil non créé : ' + (err.message || ('HTTP ' + insRes.status)) });
    }

    return reply(200, { success: true, id: created.id });

  } catch (e) {
    return reply(500, { error: e.message });
  }
}

// Gérer les requêtes OPTIONS (CORS preflight)
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
