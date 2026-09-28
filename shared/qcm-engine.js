/**
 * USCA Connect — Moteur QCM EDN (lazy-load)
 * Charge data/index.json puis data/item_XX.json à la demande.
 * Expose : window.QCMEngine
 *
 * Dépend de window.sb (shared/supabase.js) pour les écritures Supabase.
 */

(function () {
  'use strict';

  const DATA_BASE = '/data/';

  // Cache mémoire : { 'Item 76': [questions], ... }
  const _itemsCache = new Map();
  let _index = null;

  // ── Helpers ──

  /** "Item 66a" → "item_66a.json" — règle stable du plan QCM */
  function itemToFilename(itemLabel) {
    const m = String(itemLabel || '').match(/Item\s+(\w+)/i);
    if (!m) throw new Error('Libellé item invalide : ' + itemLabel);
    return 'item_' + m[1].toLowerCase() + '.json';
  }

  /** "Item 76" + n° question → "Item 76 - Q12" (identifiant stable signalements) */
  function questionSourceId(itemLabel, numero) {
    return `${itemLabel} - Q${numero}`;
  }

  /** UUID de l'utilisateur connecté. Les lectures "My*" filtrent dessus explicitement :
   *  la RLS v18 ouvre aussi aux médecins les données des externes (mode ?preview=tuteur). */
  async function currentUserId() {
    const { data: user } = await window.sb.auth.getUser();
    if (!user?.user) throw new Error('Utilisateur non authentifié');
    return user.user.id;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── API publique ──

  const QCMEngine = {

    /** Charge le catalogue (index.json) — léger, à appeler une fois au démarrage */
    async loadIndex() {
      if (_index) return _index;
      const resp = await fetch(DATA_BASE + 'index.json', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('Échec chargement index.json : ' + resp.status);
      _index = await resp.json();
      return _index;
    },

    /** Charge un item à la demande, met en cache mémoire */
    async loadItem(itemLabel) {
      if (_itemsCache.has(itemLabel)) return _itemsCache.get(itemLabel);
      const filename = itemToFilename(itemLabel);
      const resp = await fetch(DATA_BASE + filename, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`Échec chargement ${filename} : ${resp.status}`);
      const json = await resp.json();
      const questions = Array.isArray(json) ? json : (json.qcm || []);
      // Annote chaque question avec son identifiant stable (utilisé pour reprise de session)
      questions.forEach(q => { q._source = questionSourceId(q.item, q.question_numero); });
      _itemsCache.set(itemLabel, questions);
      return questions;
    },

    /**
     * Récupère un lot de questions filtrées + ordonnées.
     * @param {Object} opts
     * @param {string|string[]} [opts.item]       Item ou liste d'items (sinon : tous)
     * @param {number}          [opts.difficulte] 1, 2 ou 3 (sinon : toutes)
     * @param {'entrainement'|'examen'} [opts.mode='entrainement']
     * @param {number}          [opts.n=10]       Nombre de questions
     * @returns {Promise<Array>}
     */
    async getQuestions(opts = {}) {
      const { item, difficulte, mode = 'entrainement', n = 10 } = opts;
      await this.loadIndex();

      // Détermine la liste d'items à charger
      let itemLabels;
      if (Array.isArray(item)) itemLabels = item;
      else if (item) itemLabels = [item];
      else itemLabels = _index.items.map(i => i.item);

      // Charge tous les items demandés en parallèle
      const allQuestions = (await Promise.all(itemLabels.map(l => this.loadItem(l)))).flat();

      // Filtre difficulté
      let pool = allQuestions;
      if (difficulte) pool = pool.filter(q => q.difficulte === difficulte);

      // sequential ou examen : ordre du JSON ; entrainement : aléatoire
      const ordered = (mode === 'examen' || mode === 'sequential') ? pool : shuffle(pool);
      return ordered.slice(0, n);
    },

    /** Sauvegarde une session terminée + ses réponses (atomique via 2 inserts) */
    async saveSession({ item, mode, nb_questions, score, reponses }) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { data: user } = await window.sb.auth.getUser();
      if (!user?.user) throw new Error('Utilisateur non authentifié');

      const { data: session, error: e1 } = await window.sb
        .from('qcm_sessions')
        .insert({
          user_id: user.user.id,
          item: item || null,
          mode,
          nb_questions,
          score
        })
        .select()
        .single();
      if (e1) throw e1;

      if (Array.isArray(reponses) && reponses.length) {
        const rows = reponses.map(r => ({
          session_id: session.id,
          question_source: r.question_source,
          reponse_choisie: r.reponse_choisie,
          correct: r.correct,
          temps_ms: r.temps_ms ?? null
        }));
        const { error: e2 } = await window.sb.from('qcm_reponses').insert(rows);
        if (e2) throw e2;
      }
      return session;
    },

    /** Signale une question (erreur ou demande d'explication au tuteur) */
    async flagQuestion(question_source, type, message) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { data: user } = await window.sb.auth.getUser();
      if (!user?.user) throw new Error('Utilisateur non authentifié');

      const { data, error } = await window.sb
        .from('qcm_flags')
        .insert({
          user_id: user.user.id,
          question_source,
          type,
          message: message || null
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Liste les signalements de l'utilisateur courant */
    async getMyFlags() {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const uid = await currentUserId();
      const { data, error } = await window.sb
        .from('qcm_flags')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Statistiques : uniquement les sessions terminées de l'utilisateur courant */
    async getMyStats() {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const uid = await currentUserId();
      const { data, error } = await window.sb
        .from('qcm_sessions')
        .select('item, mode, nb_questions, score, created_at')
        .eq('user_id', uid)
        .eq('statut', 'terminee')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Crée une session en cours au début (avant que toutes les questions soient répondues) */
    async startSession({ item, mode, questions }) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { data: user } = await window.sb.auth.getUser();
      if (!user?.user) throw new Error('Utilisateur non authentifié');
      const questions_json = questions.map(q => q._source);
      const { data: session, error } = await window.sb
        .from('qcm_sessions')
        .insert({ user_id: user.user.id, item: item || null, mode, nb_questions: questions.length, score: 0, statut: 'en_cours', questions_json })
        .select().single();
      if (error) throw error;
      return session;
    },

    /** Enregistre une réponse individuelle immédiatement */
    async saveAnswer(sessionId, { question_source, reponse_choisie, correct, temps_ms }) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { error } = await window.sb.from('qcm_reponses').insert({ session_id: sessionId, question_source, reponse_choisie, correct, temps_ms: temps_ms ?? null });
      if (error) throw error;
    },

    /** Marque une session comme terminée avec le score final */
    async completeSession(sessionId, score) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { error } = await window.sb.from('qcm_sessions').update({ statut: 'terminee', score }).eq('id', sessionId);
      if (error) throw error;
    },

    /** Retourne les sessions en cours avec le nombre de réponses déjà enregistrées */
    async getMyInProgressSessions() {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const uid = await currentUserId();
      const { data, error } = await window.sb
        .from('qcm_sessions')
        .select('*, qcm_reponses(count)')
        .eq('user_id', uid)
        .eq('statut', 'en_cours')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Récupère les réponses d'une session (pour reprise) */
    async getSessionReponses(sessionId) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      const { data, error } = await window.sb.from('qcm_reponses').select('*').eq('session_id', sessionId);
      if (error) throw error;
      return data || [];
    },

    /** Supprime une session abandonnée et ses réponses */
    async abandonSession(sessionId) {
      if (!window.sb) throw new Error('Client Supabase indisponible');
      await window.sb.from('qcm_reponses').delete().eq('session_id', sessionId);
      await window.sb.from('qcm_sessions').delete().eq('id', sessionId);
    },

    // Exposé pour debug / tests
    _utils: { itemToFilename, questionSourceId, shuffle }
  };

  window.QCMEngine = QCMEngine;
})();
