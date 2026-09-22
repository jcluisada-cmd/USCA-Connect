const CACHE_NAME = 'usca-v4.50';

// ── Configuration Push (partagé avec patient/index.html) ──
const SUPABASE_URL_BASE = 'https://pydxfoqxgvbmknzjzecn.supabase.co';
const SUPABASE_ANON_KEY_SW = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZHhmb3F4Z3ZibWtuemp6ZWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTgyNTEsImV4cCI6MjA5MTY5NDI1MX0.8Q8-wJUiOLHdf3vtMAvXMQ4JaylTGE-lm5viPWeVfZU';

// Fichiers locaux — pré-cachés à l'installation
const LOCAL_ASSETS = [
  './',
  './index.html',
  './staff/toolbox-app/dist/index.html',
  './patient/',
  './patient/index.html',
  './admin/',
  './admin/index.html',
  './etudiant/',
  './etudiant/index.html',
  './extern/',
  './extern/index.html',
  './pds/',
  './pds/index.html',
  './shared/cushman.js',
  './shared/livret-ifsi-contenu.js',
  './shared/qcm-engine.js',
  './data/index.json',
  './postcure/patient.html',
  './postcure/medecin.html',
  './shared/supabase.js',
  './shared/modules-config.js',
  './shared/module-visibility.js',
  './shared/auth.js',
  './shared/fiches-catalogue.js',
  './shared/substances-catalogue.js',
  './fiches-substances/fiche_3mmc_patient.html',
  './fiches-substances/fiche_alcool_patient.html',
  './fiches-substances/fiche_bzd_mesusage_patient.html',
  './fiches-substances/fiche_cannabis_patient.html',
  './fiches-substances/fiche_cocaine_patient.html',
  './fiches-substances/fiche_crack_patient.html',
  './fiches-substances/fiche_ghb_patient.html',
  './fiches-substances/fiche_heroine_patient.html',
  './fiches-substances/fiche_ketamine_patient.html',
  './fiches-substances/fiche_lsd_patient.html',
  './fiches-substances/fiche_mdma_patient.html',
  './fiches-substances/fiche_methamphetamine_patient.html',
  './fiches-substances/fiche_opioides_prescription_patient.html',
  './fiches-substances/fiche_protoxyde_patient.html',
  './fiches-substances/fiche_psilocybine_patient.html',
  './fiches-substances/fiche_tabac_patient.html',
  './eeg_ect/fiche_ect.html',
  './eeg_ect/fiche_technical.html',
  './eeg_ect/fiche_normal_eeg.html',
  './eeg_ect/fiche_sommeil.html',
  './eeg_ect/fiche_artefacts.html',
  './eeg_ect/fiche_epileptiforme.html',
  './eeg_ect/fiche_status_epilepticus.html',
  './eeg_ect/fiche_icu_eeg.html',
  './eeg_ect/assets/fig_10_20_repere.png',
  './eeg_ect/assets/fig_10_20_dessus.png',
  './eeg_ect/assets/fig_sommeil_stades.png',
  './eeg_ect/assets/fig_sommeil_variants.png',
  './shared/ressource-doc.css',
  './shared/ressource-doc.js',
  './shared/theme.css',
  './shared/tailwind.css',
  './shared/theme.js',
  './shared/craving-agenda.js',
  './shared/planning-groupes.js',
  './shared/postcure-structures.js',
  // ── MetaboScope (sous-app React/Vite intégrée en iframe — v4.25) ──
  // Seuls index.html + favicon + icon sont pré-cachés. Les bundles JS/CSS hashés
  // (./metaboscope/dist/assets/index-*.{js,css}) sont cachés au runtime via la
  // stratégie cache-first déjà en place dans le fetch listener.
  // À chaque rebuild de MetaboScope (npm run build dans metaboscope/), bumper
  // CACHE_NAME ci-dessus pour forcer la ré-installation et purger l'ancien index.
  './metaboscope/dist/index.html',
  './metaboscope/dist/favicon.svg',
  './metaboscope/dist/icons/icon.svg',
  './icon-192.png',
  './icon-512.png',
  './splash.png',
  './manifest.json'
];

// Domaines à ne jamais cacher (API, temps réel)
const NETWORK_ONLY = [
  'supabase.co',
  '/api/slack',
  '/api/delete-user'
];

// Chemins network-first sans écriture en cache (manifests qui changent souvent côté serveur)
const NO_CACHE_WRITE = [
  '/ressources_doc/index.json'
];

// ── INSTALL : cache les fichiers locaux + tous les items QCM (offline complet) ──
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(LOCAL_ASSETS);
    // Pré-cache tous les items QCM listés dans data/index.json — ainsi la PWA
    // installée fonctionne hors ligne même pour des items jamais ouverts.
    try {
      const resp = await fetch('./data/index.json', { cache: 'no-cache' });
      if (resp.ok) {
        const idx = await resp.json();
        const files = (idx.items || [])
          .map(it => it.fichier)
          .filter(Boolean)
          .map(f => './data/' + f);
        // addAll est atomique : on tolère un échec partiel pour ne pas bloquer l'install
        await Promise.all(files.map(f => cache.add(f).catch(() => {})));
      }
    } catch (err) { /* offline à l'install : on continuera à fonctionner online */ }
  })());
  self.skipWaiting();
});

// ── ACTIVATE : supprime les anciens caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH : stratégie différente selon le type de requête ──
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Ignorer les schémas non-http (chrome-extension://, etc.) : non cachables
  if (!url.startsWith('http')) return;

  // Requêtes API/Realtime → toujours réseau, jamais de cache
  if (NETWORK_ONLY.some(domain => url.includes(domain))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Manifests qui changent côté serveur → network-first, fallback cache (pas d'écriture)
  if (NO_CACHE_WRITE.some(path => url.includes(path))) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // NAVIGATION (pages HTML) → Network first, cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() =>
          caches.match(e.request)
            .then(r => r || caches.match('./index.html'))
            .then(r => r || caches.match('./'))
        )
    );
    return;
  }

  // AUTRES REQUÊTES (scripts, CSS, fonts, CDN) → Cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        // Fail silencieux pour les requêtes hors-scope (extensions navigateur,
        // BrowserRouter sous-app MetaboScope sur /interactions, /search, etc.,
        // searchAnalyzer Edge/Bing). Évite les "Uncaught (in promise) TypeError:
        // Failed to fetch" en console. Renvoie une réponse 408 propre.
        return new Response('', { status: 408, statusText: 'Network error or out of scope' });
      });
    })
  );
});

// ══════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (pattern "empty push + fetch last message")
// Le push arrive sans data ; on fetch le dernier message depuis Supabase.
// Le destinataire est identifié via IndexedDB :
//   - profile_id (soignant, V2) prioritaire si présent
//   - patient_id (V1) fallback
// Table cible :
//   - push_last_message_staff si profile_id
//   - push_last_message si patient_id
// ══════════════════════════════════════════════════════════

// Ouvre (ou crée) le store IndexedDB 'usca-push' → 'kv'
function openPushIdb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('usca-push', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openPushIdb();
    const val = await new Promise(res => {
      const g = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      g.onsuccess = () => res(g.result);
      g.onerror = () => res(null);
    });
    db.close();
    return val || null;
  } catch (e) {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openPushIdb();
    db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
    db.close();
  } catch (e) {}
}

async function idbDel(key) {
  try {
    const db = await openPushIdb();
    db.transaction('kv', 'readwrite').objectStore('kv').delete(key);
    db.close();
  } catch (e) {}
}

// Récupère l'identifiant du destinataire : profile_id (V2) prioritaire sur patient_id (V1).
// Retourne { kind: 'staff'|'patient', id: string } ou null.
async function getRecipientId() {
  const profileId = await idbGet('profile_id');
  if (profileId) return { kind: 'staff', id: profileId };
  const patientId = await idbGet('patient_id');
  if (patientId) return { kind: 'patient', id: patientId };
  return null;
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const recipient = await getRecipientId();
    let title = 'USCA Connect';
    let options = {
      body: 'Nouvelle notification',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: 'default',
      data: { url: recipient && recipient.kind === 'staff' ? '/admin/' : '/patient/' }
    };

    try {
      if (event.data) {
        // Payload inline (cas rare, crypto RFC 8291 non implémentée côté Edge Function)
        const payload = event.data.json();
        if (payload.title) title = payload.title;
        if (payload.body) options.body = payload.body;
        if (payload.url) options.data.url = payload.url;
        if (payload.tag) options.tag = payload.tag;
      } else if (recipient) {
        const table = recipient.kind === 'staff' ? 'push_last_message_staff' : 'push_last_message';
        const col = recipient.kind === 'staff' ? 'profile_id' : 'patient_id';
        const resp = await fetch(
          SUPABASE_URL_BASE + '/rest/v1/' + table + '?' + col + '=eq.' + recipient.id + '&select=*',
          { headers: { 'apikey': SUPABASE_ANON_KEY_SW, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY_SW } }
        );
        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows[0]) {
            title = rows[0].title || title;
            options.body = rows[0].body || options.body;
            options.data.url = rows[0].url || options.data.url;
            options.tag = rows[0].tag || options.tag;
          }
        }
      }
    } catch (e) { /* silent */ }

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Essaie de focus une fenêtre déjà ouverte sur le bon scope
    const wantedScope = url.startsWith('/admin') ? '/admin' : url.startsWith('/patient') ? '/patient' : null;
    if (wantedScope) {
      for (const client of clients) {
        if (client.url.includes(wantedScope) && 'focus' in client) {
          client.postMessage({ type: 'push-clicked', url });
          return client.focus();
        }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

// Messages depuis le client principal pour synchroniser l'IndexedDB
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'set-patient-id' && msg.patient_id) {
    // Mode patient : on s'assure de nettoyer profile_id pour éviter l'ambiguïté
    idbSet('patient_id', msg.patient_id);
    idbDel('profile_id');
  } else if (msg.type === 'set-profile-id' && msg.profile_id) {
    // Mode soignant (V2) : idem côté opposé
    idbSet('profile_id', msg.profile_id);
    idbDel('patient_id');
  } else if (msg.type === 'clear-push-identity') {
    // Appelé au logout pour ne pas notifier l'ex-utilisateur
    idbDel('patient_id');
    idbDel('profile_id');
  }
});
