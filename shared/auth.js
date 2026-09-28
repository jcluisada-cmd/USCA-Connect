/**
 * USCA Connect — Gestion de l'authentification
 * Dépend de : shared/supabase.js (window.sb, window.db)
 * Expose : window.auth
 */

window.auth = {

  // ════════════════ MESSAGES D'ERREUR AUTH ════════════════

  /** Classifie l'erreur Supabase et retourne un message français adapté */
  _getAuthError(error) {
    if (!error) return null;
    var msg = (error.message || '').toLowerCase();
    var status = error.status;

    // Erreur réseau (fetch bloqué, hors-ligne, Firefox tracking protection)
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') ||
        msg.includes('networkerror') || error instanceof TypeError) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion.\nSur Firefox : désactivez la protection renforcée contre le pistage.';
    }
    // Identifiants incorrects
    if (msg.includes('invalid login') || msg.includes('invalid credentials') ||
        msg.includes('email not confirmed') || status === 400) {
      return 'Identifiant ou mot de passe incorrect.';
    }
    // Compte inexistant
    if (msg.includes('user not found') || status === 404) {
      return 'Aucun compte trouvé avec cet identifiant.';
    }
    // Rate limit
    if (msg.includes('too many') || status === 429) {
      return 'Trop de tentatives. Attendez quelques minutes.';
    }
    // Serveur
    if (status >= 500) {
      return 'Erreur serveur temporaire. Réessayez dans quelques instants.';
    }
    return 'Erreur de connexion (' + (error.message || 'inconnue') + ')';
  },

  // ════════════════ AUTH STAFF (Supabase Auth) ════════════════

  /**
   * Connexion soignant par email + mot de passe
   * Retourne le profil complet ou lance une erreur avec message précis
   */
  async loginStaff(email, password) {
    var data, error;
    try {
      var result = await sb.auth.signInWithPassword({ email, password });
      data = result.data;
      error = result.error;
    } catch (e) {
      throw new Error(auth._getAuthError(e));
    }
    if (error) throw new Error(auth._getAuthError(error));
    // Récupérer le profil dans la table profiles
    const profile = await db.getProfile(data.user.id);
    // Stocker le profil en session
    sessionStorage.setItem('staff_profile', JSON.stringify(profile));
    // Enregistrer l'appareil de confiance (silencieux)
    if (window._uscaHasLocalStorage) {
      auth._registerDevice(data.user.id).catch(function() {});
    }
    return profile;
  },

  /**
   * Création d'un compte soignant par un admin, via la Cloudflare Function
   * /api/create-user (API admin Supabase + service_role côté serveur).
   * La session de l'admin n'est pas touchée (plus de signUp côté client, v4.52).
   * Renvoie { id } du compte créé.
   */
  async createStaff(email, password, nom, role, isAdmin) {
    const { data } = await sb.auth.getSession();
    const token = data.session ? data.session.access_token : null;
    if (!token) throw new Error('Session expirée — reconnectez-vous');
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ email, password, nom, role, isAdmin: !!isAdmin })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
    return { id: body.id };
  },

  /** Déconnexion soignant — révoque le token de cet appareil */
  async logoutStaff() {
    var token = localStorage.getItem('usca-device-token');
    if (token) {
      try { await sb.from('device_tokens').delete().eq('token', token); } catch(e) {}
      localStorage.removeItem('usca-device-token');
    }
    await sb.auth.signOut();
    sessionStorage.removeItem('staff_profile');
    sessionStorage.removeItem('pin_hash');
  },

  // ════════════════ APPAREILS DE CONFIANCE ════════════════

  /** Détecte le type d'appareil */
  _getDeviceLabel() {
    var ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua) && /Mobile/.test(ua)) return 'Android Mobile';
    if (/Android/.test(ua)) return 'Android Tablette';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Appareil inconnu';
  },

  /** Génère un token aléatoire 32 bytes */
  _generateToken() {
    var array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  },

  /** Enregistre silencieusement cet appareil comme appareil de confiance */
  async _registerDevice(userId) {
    var MAX_DEVICES = 5;
    // Vérifier si un token existe déjà pour cet appareil
    var existingToken = localStorage.getItem('usca-device-token');
    if (existingToken) {
      // Mettre à jour la date d'utilisation
      await sb.from('device_tokens').update({ derniere_utilisation: new Date().toISOString() }).eq('token', existingToken);
      return;
    }
    // Compter les appareils existants
    var { data: existing } = await sb.from('device_tokens').select('id, created_at').eq('user_id', userId).order('created_at', { ascending: true });
    if (existing && existing.length >= MAX_DEVICES) {
      await sb.from('device_tokens').delete().eq('id', existing[0].id);
    }
    var token = auth._generateToken();
    var expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    await sb.from('device_tokens').insert({
      user_id: userId, token: token, appareil: auth._getDeviceLabel(), expires_at: expiresAt.toISOString()
    });
    localStorage.setItem('usca-device-token', token);
  },

  /** Vérifie si un soignant est connecté, retourne le profil ou null */
  async getStaffSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    // Vérifier si le profil est en cache
    const cached = sessionStorage.getItem('staff_profile');
    if (cached) return JSON.parse(cached);
    // Sinon le récupérer
    try {
      const profile = await db.getProfile(session.user.id);
      sessionStorage.setItem('staff_profile', JSON.stringify(profile));
      return profile;
    } catch {
      return null;
    }
  },

  // ════════════════ AUTH PATIENT (chambre + DDN) ════════════════

  /** Tentatives de connexion patient — rate limiting */
  _patientAttempts: 0,
  _patientLockUntil: 0,

  /**
   * Connexion patient par chambre + date de naissance
   * Retourne les données patient ou null
   */
  async loginPatient(room, dob) {
    // Rate limiting : 3 tentatives max, puis 5 min de blocage
    if (Date.now() < auth._patientLockUntil) {
      const remaining = Math.ceil((auth._patientLockUntil - Date.now()) / 1000);
      throw new Error(`Trop de tentatives. Réessayez dans ${remaining}s`);
    }

    const patient = await db.getPatientByRoom(room.trim(), dob);
    if (!patient) {
      auth._patientAttempts++;
      if (auth._patientAttempts >= 3) {
        auth._patientLockUntil = Date.now() + 5 * 60 * 1000; // 5 min
        auth._patientAttempts = 0;
        throw new Error('Trop de tentatives. Réessayez dans 5 minutes');
      }
      throw new Error('Chambre ou date de naissance incorrecte');
    }

    // Succès — reset compteur et stocker en session persistante (30 jours)
    auth._patientAttempts = 0;
    // On ne stocke que l'ID et le prénom (pas de PII sensible)
    localStorage.setItem('patient_session', JSON.stringify({
      id: patient.id,
      prenom: patient.prenom,
      chambre: patient.numero_chambre,
      programme_id: patient.programme_id,
      substance: patient.substance_principale,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 jours
    }));
    return patient;
  },

  /** Récupère la session patient ou null (vérifie expiration) */
  getPatientSession() {
    const cached = localStorage.getItem('patient_session');
    if (!cached) return null;
    const session = JSON.parse(cached);
    if (session.expires && Date.now() > session.expires) {
      localStorage.removeItem('patient_session');
      return null;
    }
    return session;
  },

  /** Déconnexion patient */
  logoutPatient() {
    localStorage.removeItem('patient_session');
  },

  // ════════════════ PIN LOCK (soignants) ════════════════

  /**
   * Hash un PIN via Web Crypto API (SHA-256)
   * Retourne le hash en hexadécimal
   */
  async hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /** Enregistre un PIN hashé */
  async setPin(pin) {
    const hash = await auth.hashPin(pin);
    localStorage.setItem('usca_pin_hash', hash);
  },

  /** Vérifie un PIN */
  async verifyPin(pin) {
    const stored = localStorage.getItem('usca_pin_hash');
    if (!stored) return true; // Pas de PIN configuré
    const hash = await auth.hashPin(pin);
    return hash === stored;
  },

  /** PIN configuré ? */
  hasPin() {
    return !!localStorage.getItem('usca_pin_hash');
  },

  // ════════════════ INACTIVITÉ ════════════════

  _inactivityTimer: null,
  _onLock: null, // Callback quand le verrou s'active

  /**
   * Démarre la surveillance d'inactivité
   * @param {number} timeoutMs — délai avant verrouillage (défaut 1h)
   * @param {function} onLock — callback quand le verrou s'active
   */
  setupInactivityLock(timeoutMs = 60 * 60 * 1000, onLock) {
    auth._onLock = onLock;

    const resetTimer = () => {
      clearTimeout(auth._inactivityTimer);
      auth._inactivityTimer = setTimeout(() => {
        if (auth._onLock) auth._onLock();
      }, timeoutMs);
    };

    // Écouter les interactions utilisateur
    ['click', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();
  },

  /** Arrête la surveillance d'inactivité */
  clearInactivityLock() {
    clearTimeout(auth._inactivityTimer);
  }
};
