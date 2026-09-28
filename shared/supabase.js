/**
 * USCA Connect — Client Supabase + CRUD helpers
 * Chargé après le SDK Supabase (CDN UMD) via <script>
 * Expose : window.sb (client) et window.db (helpers CRUD)
 */

// ── Configuration ──
const SUPABASE_URL = 'https://pydxfoqxgvbmknzjzecn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZHhmb3F4Z3ZibWtuemp6ZWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTgyNTEsImV4cCI6MjA5MTY5NDI1MX0.8Q8-wJUiOLHdf3vtMAvXMQ4JaylTGE-lm5viPWeVfZU';

// ── Storage robuste (fallback sessionStorage si Safari restrictif / navigation privée) ──
const safeStorage = (() => {
  try {
    localStorage.setItem('_usca_test', '1');
    localStorage.removeItem('_usca_test');
    return localStorage;
  } catch {
    console.warn('[USCA] localStorage inaccessible — fallback sessionStorage');
    return sessionStorage;
  }
})();
const hasLocalStorage = safeStorage === localStorage;
window._uscaHasLocalStorage = hasLocalStorage;

// ── Init client Supabase ──
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    storageKey: 'usca-auth-v2',
    flowType: 'pkce',
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true
  }
});
window.sb = sb;

// ── Helpers d'affichage patient ──
// Âge en années pleines depuis une date de naissance ISO (YYYY-MM-DD) ou Date.
window.computePatientAge = function(isoDate) {
  if (!isoDate) return null;
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return (age > 0 && age < 130) ? age : null;
};

// Label inclusif du patient : "Patient de 53 ans" / "Patiente de 53 ans" / "Patient·e de 53 ans".
// Sexe : 'F' → Patiente, 'M' → Patient, autre/null → Patient·e.
window.formatPatientLabel = function(patient) {
  if (!patient) return 'Patient·e';
  let noun;
  if (patient.sexe === 'F') noun = 'Patiente';
  else if (patient.sexe === 'M') noun = 'Patient';
  else noun = 'Patient·e';
  const age = window.computePatientAge(patient.date_naissance);
  return age ? (noun + ' de ' + age + ' ans') : noun;
};

// ── CRUD Helpers ──
window.db = {

  // ════════════════ PROFILES ════════════════

  /** Récupère le profil d'un soignant par son user ID (auth) */
  async getProfile(userId) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  },

  /** Met à jour un profil soignant */
  async updateProfile(id, updates) {
    const { data, error } = await sb.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Liste tous les profils (admin) */
  async getAllProfiles() {
    const { data, error } = await sb.from('profiles').select('*').order('nom');
    if (error) throw error;
    return data;
  },

  // ════════════════ PATIENTS ════════════════

  /** Vérifie un patient par chambre + date de naissance (login patient) */
  async getPatientByRoom(room, dob) {
    const { data, error } = await sb
      .from('patients')
      .select('id, prenom, programme_id, numero_chambre, substance_principale, date_admission, date_sortie_prevue, postcure_statut, sortie_info')
      .eq('numero_chambre', room)
      .eq('date_naissance', dob)
      .single();
    if (error) return null; // Pas trouvé = login échoué
    return data;
  },

  /** Liste tous les patients (staff) */
  async getPatients() {
    const { data, error } = await sb
      .from('patients')
      .select('*')
      .order('numero_chambre');
    if (error) throw error;
    return data;
  },

  /** Crée un patient */
  async createPatient(patient) {
    const { data, error } = await sb.from('patients').insert(patient).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour un patient */
  async updatePatient(id, updates) {
    const { data, error } = await sb.from('patients').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ ALERTES ════════════════

  /** Crée une alerte (craving, effet indésirable, etc.) */
  async createAlerte(alerte) {
    const { data, error } = await sb.from('alertes').insert(alerte).select().single();
    if (error) throw error;
    return data;
  },

  /** Alertes non traitées (staff dashboard) */
  async getAlertesNonTraitees() {
    const { data, error } = await sb
      .from('alertes')
      .select('*')
      .in('statut', ['non_traitee', 'en_cours'])
      .order('horodatage', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Historique des alertes avec limite */
  async getAlertesHistorique(limit = 50) {
    const { data, error } = await sb
      .from('alertes')
      .select('*')
      .order('horodatage', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  /** Met à jour le statut d'une alerte */
  async updateAlerteStatut(id, statut, traitee_par = null) {
    const updates = { statut };
    if (traitee_par) updates.traitee_par = traitee_par;
    const { data, error } = await sb.from('alertes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ GROUPES ════════════════

  /** Liste des groupes du jour */
  async getGroupesDuJour() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb
      .from('groupes')
      .select('*')
      .gte('horaire', today + 'T00:00:00')
      .lte('horaire', today + 'T23:59:59')
      .order('horaire');
    if (error) throw error;
    return data;
  },

  /** Tous les groupes */
  async getGroupes() {
    const { data, error } = await sb.from('groupes').select('*').order('horaire');
    if (error) throw error;
    return data;
  },

  /** Crée un groupe */
  async createGroupe(groupe) {
    const { data, error } = await sb.from('groupes').insert(groupe).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour un groupe */
  async updateGroupe(id, updates) {
    const { data, error } = await sb.from('groupes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour la liste des participants (présence) */
  async updatePresence(id, participants) {
    const { data, error } = await sb.from('groupes').update({ participants }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ PROGRAMMES ════════════════

  /** Liste des programmes templates */
  async getProgrammes() {
    const { data, error } = await sb.from('programmes').select('*').order('nom');
    if (error) throw error;
    return data;
  },

  /** Programme par ID */
  async getProgrammeById(id) {
    const { data, error } = await sb.from('programmes').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  /** Crée un programme template */
  async createProgramme(programme) {
    const { data, error } = await sb.from('programmes').insert(programme).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ STRATÉGIES (patient) ════════════════

  /** Récupère les stratégies d'un patient */
  async getStrategies(patientId) {
    const { data, error } = await sb.from('strategies').select('*').eq('patient_id', patientId).order('created_at');
    if (error) throw error;
    return data;
  },

  /** Crée une stratégie */
  async createStrategie(strategie) {
    const { data, error } = await sb.from('strategies').insert(strategie).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime une stratégie */
  async deleteStrategie(id) {
    const { error } = await sb.from('strategies').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════ HISTORIQUE CRAVING ════════════════

  /** Historique des alertes craving d'un patient (pour le PDF et les stats) */
  async getCravingHistory(patientId) {
    const { data, error } = await sb
      .from('alertes')
      .select('*')
      .eq('patient_id', patientId)
      .eq('type', 'craving')
      .order('horodatage', { ascending: true });
    if (error) throw error;
    return data;
  },

  // ════════════════ PRESCRIPTIONS (fiches traitements) ════════════════

  /** Récupère les prescriptions d'un patient */
  async getPrescriptions(patientId) {
    const { data, error } = await sb.from('prescriptions').select('*').eq('patient_id', patientId).order('created_at');
    if (error) throw error;
    return data;
  },

  /** Ajoute une fiche prescrite à un patient */
  async addPrescription(patientId, ficheSlug, prescritPar) {
    const { data, error } = await sb.from('prescriptions').insert({
      patient_id: patientId,
      fiche_slug: ficheSlug,
      prescrit_par: prescritPar
    }).select().single();
    if (error) throw error;
    return data;
  },

  /** Retire une fiche prescrite */
  async removePrescription(patientId, ficheSlug) {
    const { error } = await sb.from('prescriptions').delete().eq('patient_id', patientId).eq('fiche_slug', ficheSlug);
    if (error) throw error;
  },

  // ════════════════ FICHES SUBSTANCES (poussées au patient) ════════════════

  /** Récupère les fiches substances partagées avec un patient */
  async getSubstancesPatient(patientId) {
    const { data, error } = await sb.from('substances_patient').select('*').eq('patient_id', patientId).order('created_at');
    if (error) throw error;
    return data;
  },

  /** Pousse une fiche substance à un patient */
  async addSubstancePatient(patientId, ficheSlug, partagePar) {
    const { data, error } = await sb.from('substances_patient').insert({
      patient_id: patientId,
      fiche_slug: ficheSlug,
      partage_par: partagePar
    }).select().single();
    if (error) throw error;
    return data;
  },

  /** Retire une fiche substance partagée */
  async removeSubstancePatient(patientId, ficheSlug) {
    const { error } = await sb.from('substances_patient').delete().eq('patient_id', patientId).eq('fiche_slug', ficheSlug);
    if (error) throw error;
  },

  // ════════════════ ÉVÉNEMENTS (RDV, entretiens, consultations) ════════════════

  async getEvenements(patientId) {
    const { data, error } = await sb.from('evenements').select('*').eq('patient_id', patientId).order('date_heure', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createEvenement(evt) {
    const { data, error } = await sb.from('evenements').insert(evt).select().single();
    if (error) throw error;
    return data;
  },

  async deleteEvenement(id) {
    const { error } = await sb.from('evenements').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════ PERMISSIONS ════════════════

  async getPermissions(patientId) {
    const { data, error } = await sb.from('permissions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createPermission(perm) {
    const { data, error } = await sb.from('permissions').insert(perm).select().single();
    if (error) throw error;
    return data;
  },

  async getAllPermissionsEnAttente() {
    const { data, error } = await sb.from('permissions').select('*').eq('statut', 'en_attente').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updatePermission(id, updates) {
    const { data, error } = await sb.from('permissions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePermission(id) {
    // count: 'exact' force PostgREST à renvoyer le nombre de lignes affectées.
    // Sans ça, un échec RLS silencieux (policy DELETE manquante) passe inaperçu
    // côté client (0 ligne supprimée, pas d'erreur HTTP).
    const { error, count } = await sb.from('permissions').delete({ count: 'exact' }).eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('Suppression refusée (déjà supprimée ou droits insuffisants)');
  },

  // ════════════════ CONTENUS PARTAGÉS ════════════════

  async getContenus(patientId) {
    // JOIN profiles via cree_par pour récupérer l'email de l'auteur (affichage prefix sans @aphp.fr)
    const { data, error } = await sb.from('contenus_partages').select('*, profiles!cree_par(email)').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Messages envoyés par les patients (cree_par IS NULL), pour badge non-lu sur cartes dashboard.
  // Le filtre "non-lu" est calculé côté client via localStorage (par soignant).
  async getMessagesPatientsRecents() {
    const { data, error } = await sb.from('contenus_partages')
      .select('patient_id, created_at')
      .is('cree_par', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createContenu(contenu) {
    const { data, error } = await sb.from('contenus_partages').insert(contenu).select().single();
    if (error) throw error;
    return data;
  },

  async updateContenu(id, contenu) {
    const { error } = await sb.from('contenus_partages')
      .update({ contenu: contenu, modifie_le: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteContenu(id) {
    const { error } = await sb.from('contenus_partages').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════ DATE DE SORTIE ════════════════

  async updatePatientSortie(patientId, dateSortie, sortieInfo) {
    const payload = { date_sortie_prevue: dateSortie };
    if (sortieInfo !== undefined) payload.sortie_info = sortieInfo;
    const { data, error } = await sb.from('patients').update(payload).eq('id', patientId).select().single();
    if (error) throw error;
    return data;
  },

  async updatePatientSortieInfo(patientId, sortieInfo) {
    const { data, error } = await sb.from('patients').update({ sortie_info: sortieInfo }).eq('id', patientId).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ ANIMATEURS DE GROUPES ════════════════

  /** Liste tous les animateurs de groupes */
  async getGroupeAnimateurs() {
    const { data, error } = await sb.from('groupe_animateurs').select('*').order('created_at');
    if (error) throw error;
    return data;
  },

  /** Se désigner animateur d'un groupe */
  async addGroupeAnimateur(groupeSlug, userId, nomAffiche) {
    const { data, error } = await sb.from('groupe_animateurs').insert({
      groupe_slug: groupeSlug,
      user_id: userId,
      nom_affiche: nomAffiche
    }).select().single();
    if (error) throw error;
    return data;
  },

  /** Se retirer comme animateur d'un groupe */
  async removeGroupeAnimateur(groupeSlug, userId) {
    const { error } = await sb.from('groupe_animateurs').delete().eq('groupe_slug', groupeSlug).eq('user_id', userId);
    if (error) throw error;
  },

  // ════════════════ MODIFICATIONS DE GROUPES ════════════════

  /** Récupère les modifications pour une date donnée */
  async getGroupeModifications(dateStr) {
    const { data, error } = await sb.from('groupe_modifications').select('*').eq('date_effet', dateStr);
    if (error) throw error;
    return data;
  },

  /** Crée ou met à jour une modification de groupe (upsert sur slug+date) */
  async upsertGroupeModification(mod) {
    const { data, error } = await sb.from('groupe_modifications')
      .upsert(mod, { onConflict: 'groupe_slug,date_effet' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime une modification (retour à l'horaire normal) */
  async deleteGroupeModification(groupeSlug, dateStr) {
    const { error } = await sb.from('groupe_modifications').delete().eq('groupe_slug', groupeSlug).eq('date_effet', dateStr);
    if (error) throw error;
  },

  // ════════════════ RAPPELS DE GROUPE ════════════════

  /** Envoyer un rappel pour un groupe */
  async sendGroupeRappel(groupeSlug, dateStr, message, envoyePar) {
    const { data, error } = await sb.from('groupe_rappels').insert({
      groupe_slug: groupeSlug, date_effet: dateStr, message: message, envoye_par: envoyePar
    }).select().single();
    if (error) throw error;
    return data;
  },

  /** Récupère les rappels du jour pour un patient */
  async getGroupeRappels(dateStr) {
    const { data, error } = await sb.from('groupe_rappels').select('*').eq('date_effet', dateStr).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ════════════════ PARTICIPATIONS AUX GROUPES ════════════════

  /** Upsert une participation (patient ou animateur) */
  async upsertParticipation(patientId, groupeSlug, groupeNom, dateStr, present, cochePar) {
    const { data, error } = await sb.from('participations')
      .upsert({ patient_id: patientId, groupe_slug: groupeSlug, groupe_nom: groupeNom, date_groupe: dateStr, present: present, coche_par: cochePar },
        { onConflict: 'patient_id,groupe_slug,date_groupe' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Participations d'un patient (historique) */
  async getParticipationsPatient(patientId) {
    const { data, error } = await sb.from('participations').select('*').eq('patient_id', patientId).order('date_groupe', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Participations pour un groupe à une date (animateur) */
  async getParticipationsGroupe(groupeSlug, dateStr) {
    const { data, error } = await sb.from('participations').select('*').eq('groupe_slug', groupeSlug).eq('date_groupe', dateStr);
    if (error) throw error;
    return data;
  },

  // ════════════════ DEMANDES DE SÉANCES ════════════════

  /** Créer ou mettre à jour une demande de séance (patient) */
  async upsertDemandeSeance(patientId, dateStr, groupeSlug) {
    const { data, error } = await sb.from('demandes_seances')
      .upsert({ patient_id: patientId, date_demande: dateStr, groupe_slug: groupeSlug || 'therapies-complementaires', statut: 'en_attente' },
        { onConflict: 'patient_id,date_demande,groupe_slug' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Demandes d'un patient */
  async getDemandesPatient(patientId) {
    const { data, error } = await sb.from('demandes_seances').select('*').eq('patient_id', patientId).order('date_demande', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Demandes pour une date (animateur) */
  async getDemandesParDate(dateStr) {
    const { data, error } = await sb.from('demandes_seances').select('*').eq('date_demande', dateStr);
    if (error) throw error;
    return data;
  },

  /** Toutes les demandes en attente (animateur) */
  async getDemandesEnAttente() {
    const { data, error } = await sb.from('demandes_seances').select('*').eq('statut', 'en_attente').order('date_demande');
    if (error) throw error;
    return data;
  },

  /** Valider/refuser une demande (animateur) — avec ou sans horaire */
  async updateDemandeSeance(id, updates) {
    const { data, error } = await sb.from('demandes_seances').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ ÉVÉNEMENTS D'ÉQUIPE ════════════════

  /** Créer un événement d'équipe (sans patient_id) */
  async createEvenementEquipe(evt) {
    const { data, error } = await sb.from('evenements').insert(evt).select().single();
    if (error) throw error;
    return data;
  },

  /** Événements d'équipe pour une date (patient_id IS NULL, type ≠ personnel) */
  async getEvenementsEquipe(dateStr) {
    const { data, error } = await sb.from('evenements').select('*').is('patient_id', null).neq('type', 'personnel').gte('date_heure', dateStr + 'T00:00:00').lte('date_heure', dateStr + 'T23:59:59').order('date_heure');
    if (error) throw error;
    return data;
  },

  /** Supprimer un événement d'équipe */
  async deleteEvenementEquipe(id) {
    const { error } = await sb.from('evenements').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════ AGENDA PERSONNEL (type='personnel', RLS cree_par=auth.uid()) ════════════════

  /** Liste les consultations personnelles du soignant courant entre deux dates (inclus) */
  async getEvenementsPerso(dateDebut, dateFin) {
    let q = sb.from('evenements').select('*').eq('type', 'personnel').order('date_heure');
    if (dateDebut) q = q.gte('date_heure', dateDebut + 'T00:00:00');
    if (dateFin) q = q.lte('date_heure', dateFin + 'T23:59:59');
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  /** Crée une consultation personnelle */
  async addEvenementPerso({ titre, date_heure, duree_minutes, description, creeParId }) {
    const payload = {
      patient_id: null,
      cree_par: creeParId,
      titre: titre,
      description: description || null,
      date_heure: date_heure,
      duree_minutes: duree_minutes || 30,
      type: 'personnel'
    };
    const { data, error } = await sb.from('evenements').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour une consultation personnelle (RLS : seul le créateur) */
  async updateEvenementPerso(id, patch) {
    const { data, error } = await sb.from('evenements').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime une consultation personnelle (RLS : seul le créateur) */
  async deleteEvenementPerso(id) {
    const { error } = await sb.from('evenements').delete().eq('id', id);
    if (error) throw error;
  },

  // ════════════════ PUSH NOTIFICATIONS ════════════════

  /** Enregistre ou met à jour une souscription Push côté patient (upsert sur endpoint) */
  async savePushSubscription({ patient_id, endpoint, p256dh, auth_key, user_agent }) {
    // profile_id: null explicite pour que l'upsert nettoie un éventuel profile_id
    // hérité d'une ancienne souscription côté soignant (CHECK XOR sinon violé)
    const payload = { patient_id, profile_id: null, endpoint, p256dh, auth_key, user_agent, last_seen: new Date().toISOString() };
    const { data, error } = await sb.from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime une souscription Push par endpoint */
  async deletePushSubscription(endpoint) {
    const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw error;
  },

  /** Vérifie en BDD qu'une souscription existe pour un endpoint (anti-orphelin) */
  async hasPushSubscription(endpoint) {
    const { data, error } = await sb.from('push_subscriptions')
      .select('id').eq('endpoint', endpoint).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /** Lit push_pause_until (DATE) d'un profil (null = pas de pause) */
  async getPushPauseUntil(profile_id) {
    const { data, error } = await sb.from('profiles')
      .select('push_pause_until').eq('id', profile_id).maybeSingle();
    if (error) throw error;
    return data ? data.push_pause_until : null;
  },

  /** Met à jour push_pause_until pour un profil ; passer null pour reprendre immédiatement */
  async setPushPauseUntil(profile_id, isoDateOrNull) {
    const { error } = await sb.from('profiles')
      .update({ push_pause_until: isoDateOrNull }).eq('id', profile_id);
    if (error) throw error;
  },

  /** Déclenche l'envoi d'un push au patient via l'Edge Function send-push */
  async sendPushToPatient({ patient_id, title, body, url, tag, event_type }) {
    return await this._invokeSendPush({ patient_id, title, body, url, tag, event_type });
  },

  // ─── V2 : souscriptions et envois côté soignant ───

  /** Enregistre/upsert une souscription Push pour un soignant (profile_id) */
  async savePushSubscriptionStaff({ profile_id, endpoint, p256dh, auth_key, user_agent }) {
    // patient_id: null explicite pour que l'upsert nettoie un éventuel patient_id
    // hérité d'une ancienne souscription côté patient (CHECK XOR sinon violé)
    const payload = { profile_id, patient_id: null, endpoint, p256dh, auth_key, user_agent, last_seen: new Date().toISOString() };
    const { data, error } = await sb.from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Push vers un ou plusieurs soignants (profile_id ou profile_ids[]) */
  async sendPushToStaff({ profile_id, profile_ids, title, body, url, tag, event_type }) {
    const payload = { title, body, url, tag, event_type };
    if (Array.isArray(profile_ids) && profile_ids.length) payload.profile_ids = profile_ids;
    else if (profile_id) payload.profile_id = profile_id;
    else throw new Error('sendPushToStaff : profile_id ou profile_ids requis');
    return await this._invokeSendPush(payload);
  },

  /** Lit les préférences push d'un profil. NULL = défauts système. */
  async getPushPreferences(profile_id) {
    const { data, error } = await sb.from('profiles')
      .select('push_preferences').eq('id', profile_id).maybeSingle();
    if (error) throw error;
    return data ? data.push_preferences : null;
  },

  /** Met à jour les préférences push (passer null pour revenir aux défauts système) */
  async setPushPreferences(profile_id, preferences) {
    const { error } = await sb.from('profiles')
      .update({ push_preferences: preferences }).eq('id', profile_id);
    if (error) throw error;
  },

  /** Retourne les profile_id distincts des médecins actuellement abonnés au Push */
  async getSubscribedMedecinIds() {
    // Jointure implicite via profile_id → profiles (role = 'medecin')
    const { data, error } = await sb
      .from('push_subscriptions')
      .select('profile_id, profiles!inner(role)')
      .not('profile_id', 'is', null)
      .eq('profiles.role', 'medecin');
    if (error) throw error;
    const ids = (data || []).map(r => r.profile_id).filter(Boolean);
    return Array.from(new Set(ids));
  },

  /** Helper interne : POST vers send-push */
  async _invokeSendPush(payload) {
    const resp = await fetch(SUPABASE_URL + '/functions/v1/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error('send-push ' + resp.status + ': ' + t);
    }
    return await resp.json();
  },

  // ════════════════ PRÉSENCES RÉUNIONS STAFF ════════════════

  /** Upsert présence à une réunion */
  async upsertPresenceReunion(reunionSlug, dateStr, userId, present) {
    const { data, error } = await sb.from('presences_reunions')
      .upsert({ reunion_slug: reunionSlug, date_reunion: dateStr, user_id: userId, present: present },
        { onConflict: 'reunion_slug,date_reunion,user_id' })
      .select().single();
    if (error) throw error;
    return data;
  },

  /** Présences pour une réunion à une date */
  async getPresencesReunion(reunionSlug, dateStr) {
    const { data, error } = await sb.from('presences_reunions').select('*').eq('reunion_slug', reunionSlug).eq('date_reunion', dateStr);
    if (error) throw error;
    return data;
  },

  /** Supprime une présence (remet à "non renseigné") */
  async deletePresenceReunion(reunionSlug, dateStr, userId) {
    const { error } = await sb.from('presences_reunions')
      .delete()
      .eq('reunion_slug', reunionSlug)
      .eq('date_reunion', dateStr)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // ── Liste d'attente ──

  /** Récupère la liste d'attente triée par date d'entrée prévue */
  async getListeAttente() {
    const { data, error } = await sb.from('liste_attente').select('*').order('date_entree_prevue', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },

  /** Ajoute un patient à la liste d'attente */
  async addListeAttente(item) {
    const { data, error } = await sb.from('liste_attente').insert(item).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour un patient de la liste d'attente */
  async updateListeAttente(id, updates) {
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('liste_attente').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime un patient de la liste d'attente */
  async deleteListeAttente(id) {
    const { error } = await sb.from('liste_attente').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Statut post-cure (workflow, pas de données patient) ──

  /** Met à jour un flag du statut post-cure.
   * value === true  → checkbox workflow, on stocke la date du jour
   * value (string)  → on stocke la valeur telle quelle (structure, date_postcure…)
   * value falsy     → suppression de la clé */
  async updatePostcureStatut(patientId, key, value) {
    const { data: patient } = await sb.from('patients').select('postcure_statut').eq('id', patientId).single();
    const statut = patient?.postcure_statut || {};
    if (value === true) {
      statut[key] = new Date().toISOString().split('T')[0];
    } else if (value) {
      statut[key] = value;
    } else {
      delete statut[key];
    }
    const { error } = await sb.from('patients').update({ postcure_statut: statut }).eq('id', patientId);
    if (error) throw error;
  },

  // ════════════════ LIVRET IFSI — ÉTUDIANTES EN STAGE ════════════════

  /** Récupère le stage d'une étudiante par user_id (un seul stage actif par utilisatrice) */
  async getStageByUserId(userId) {
    const { data, error } = await sb.from('etudiants_stages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Récupère un stage par son id */
  async getStageById(stageId) {
    const { data, error } = await sb.from('etudiants_stages').select('*').eq('id', stageId).single();
    if (error) throw error;
    return data;
  },

  /** Liste tous les stages (admin + IDE + médecins) */
  async getAllStages() {
    const { data, error } = await sb.from('etudiants_stages').select('*').order('date_debut', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Stages dont je suis la tutrice référente */
  async getStagesByTuteur(tuteurId) {
    const { data, error } = await sb.from('etudiants_stages').select('*').eq('tuteur_id', tuteurId).order('date_debut', { ascending: false });
    if (error) throw error;
    return data;
  },

  /** Crée un stage (appelé à l'admission d'une nouvelle étudiante) */
  async createStage(payload) {
    const { data, error } = await sb.from('etudiants_stages').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  /** Met à jour un stage (dates, tuteur, statut) */
  async updateStage(stageId, patch) {
    const { data, error } = await sb.from('etudiants_stages').update(patch).eq('id', stageId).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime un stage (cascade sur progression) — admin uniquement */
  async deleteStage(stageId) {
    const { error } = await sb.from('etudiants_stages').delete().eq('id', stageId);
    if (error) throw error;
  },

  /** Réinitialise la progression d'un stage (garde le stage, vide les réponses)
   * Usage : en fin de stage pour remettre à zéro avant réutilisation du compte,
   * ou pour reset sans supprimer l'identité étudiante. */
  async resetProgressionStage(stageId) {
    const { error } = await sb.from('etudiant_progression').delete().eq('stage_id', stageId);
    if (error) throw error;
  },

  /** Toute la progression d'un stage */
  async getProgressionStage(stageId) {
    const { data, error } = await sb.from('etudiant_progression').select('*').eq('stage_id', stageId);
    if (error) throw error;
    return data;
  },

  /** Upsert d'une réponse (unique par stage_id + question_id) */
  async upsertProgression(stageId, chapitreId, questionId, reponseEtudiant, reponseJson) {
    const payload = {
      stage_id: stageId,
      chapitre_id: chapitreId,
      question_id: questionId,
      reponse_etudiant: reponseEtudiant ?? null,
      reponse_json: reponseJson ?? null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb.from('etudiant_progression').upsert(payload, { onConflict: 'stage_id,question_id' }).select().single();
    if (error) throw error;
    return data;
  },

  // ══════════ Module QCM EDN — vue tuteur ══════════

  /** Tous les profils avec role='externe' */
  async getExterneProfiles() {
    const { data, error } = await sb.from('profiles').select('id, nom, email').eq('role', 'externe').order('nom');
    if (error) throw error;
    return data || [];
  },

  /** Sessions QCM d'un externe (accessible via RLS medecin_read_externe_sessions) */
  async getExterneStats(externeId) {
    const { data, error } = await sb.from('qcm_sessions')
      .select('id, item, mode, nb_questions, score, created_at, questions_json')
      .eq('user_id', externeId)
      .eq('statut', 'terminee')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Réponses détaillées d'une session externe (RLS v25 : tuteur médecin/IDE/admin) */
  async getExterneSessionReponses(sessionId) {
    const { data, error } = await sb.from('qcm_reponses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** Signalements d'un externe (accessible via RLS medecin_read_externe_flags) */
  async getExterneFlags(externeId) {
    const { data, error } = await sb.from('qcm_flags')
      .select('*')
      .eq('user_id', externeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Répondre à un signalement externe et le marquer comme traité */
  async respondToFlag(flagId, tuteurReponse) {
    const { data, error } = await sb.from('qcm_flags')
      .update({ tuteur_reponse: tuteurReponse, statut: 'traite', traite_at: new Date().toISOString() })
      .eq('id', flagId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Réinitialise un compte externe (changement d'externe) : sessions, réponses,
   * signalements, questions au tuteur et checklist. RPC SECURITY DEFINER (v42),
   * réservée médecin/admin — renvoie { sessions, reponses, flags, questions }.
   */
  async resetExterneData(externeId) {
    const { data, error } = await sb.rpc('reset_externe_data', { p_externe_id: externeId });
    if (error) throw error;
    return data;
  },

  // ══════════════════════════════════════════════════

  /** Marquer une question comme vue par la tutrice (ou la démarquer) */
  async markProgressionVue(stageId, questionId, vu, tuteurProfileId) {
    const patch = vu
      ? { vu_tuteur: true,  vu_par: tuteurProfileId, vu_le: new Date().toISOString() }
      : { vu_tuteur: false, vu_par: null, vu_le: null };
    const { data, error } = await sb.from('etudiant_progression').update(patch).eq('stage_id', stageId).eq('question_id', questionId).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════ CHECKLIST PERSONNELLE (extern) ════════════════

  /** Récupère les items de la checklist personnelle (profiles.checklist_items) */
  async getChecklist() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('profiles').select('checklist_items').eq('id', user.id).single();
    return data?.checklist_items || [];
  },

  /** Sauvegarde la checklist personnelle */
  async saveChecklist(items) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Non authentifié');
    const { error } = await sb.from('profiles').update({ checklist_items: items }).eq('id', user.id);
    if (error) throw error;
  },

  // ════════════════ QUESTIONS EXTERN → TUTEUR ════════════════

  /** Crée une question adressée au tuteur */
  async createExternQuestion(message) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Non authentifié');
    const { data, error } = await sb.from('extern_questions').insert({ user_id: user.id, message }).select().single();
    if (error) throw error;
    return data;
  },

  /** Questions de l'extern connecté */
  async getMyExternQuestions() {
    const { data, error } = await sb.from('extern_questions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Met à jour une question (message ou statut) */
  async updateExternQuestion(id, updates) {
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('extern_questions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime une question */
  async deleteExternQuestion(id) {
    const { error } = await sb.from('extern_questions').delete().eq('id', id);
    if (error) throw error;
  },

  /** Questions d'un externe donné (accessible aux médecins via RLS) */
  async getExterneQuestions(externeId) {
    const { data, error } = await sb.from('extern_questions')
      .select('*')
      .eq('user_id', externeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Répondre à une question (médecin) et la marquer comme traitée */
  async respondToExternQuestion(id, reponse) {
    const payload = { statut: 'traite', updated_at: new Date().toISOString() };
    if (reponse !== null && reponse !== undefined) payload.reponse = reponse;
    const { data, error } = await sb.from('extern_questions').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Supprime toutes les questions d'un externe (reset) */
  async resetExterneQuestions(externeId) {
    const { error } = await sb.from('extern_questions').delete().eq('user_id', externeId);
    if (error) throw error;
  }
};
