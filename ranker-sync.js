/* Image Ranker – GitHub-Sync
 *
 * Daten (Bilder-Einträge ohne Bilddatei, Duelle, Eigenschaften, Reiter, Einstellungen)
 *   → tool-daten/image-ranker/ (main.json + 64 Teildateien) über /startseite/sync-v1.js
 * Bilddateien
 *   → privates Repo "ranker-bilder", gebündelt in Paketen von ca. 10 MB (packs/*.bin).
 *     Jedes Bild wird über seinen SHA-256 erkannt und nur einmal hochgeladen.
 *
 * Gedacht für mehrere Geräte, die NICHT gleichzeitig benutzt werden (PC, Laptop).
 * Am Handy ist der Sync aus (400 MB Bilder), außer localStorage "ranker.syncOnMobile" = "1".
 *
 * Eigener Speicher: IndexedDB "ranker-sync" (SHA-256-Zwischenspeicher, Paket-Verzeichnis, Abgleich-Stand der Bilder).
 * Greift auf die globalen Variablen des Image Rankers zu: db, lsGet, lsSet, showBusy.
 */
(function () {
  'use strict';
  if (!window.ToolSync) return;
  const mobile = /iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  let mobileOk = false; try { mobileOk = localStorage.getItem('ranker.syncOnMobile') === '1'; } catch (e) {}
  if (mobile && !mobileOk) return;

  const TOOL = 'image-ranker';
  const IMG_REPO = 'ranker-bilder';
  const PACK_MAX = 10 * 1024 * 1024;
  const POLL_MS = 120000;
  const URL_RETRY_MS = 7 * 864e5;     // fehlgeschlagene URL-Downloads frühestens nach einer Woche erneut versuchen
  const GH = ToolSync.github;

  /* ---------- eigene kleine Datenbank ---------- */
  let ownDb = null;
  function openOwn() {
    if (ownDb) return ownDb;
    ownDb = new Promise((res, rej) => {
      const r = indexedDB.open('ranker-sync', 1);
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['sha', 'kv']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); ownDb = null; }; res(d); };
      r.onerror = () => { ownDb = null; rej(r.error); };
    });
    return ownDb;
  }
  async function own(store, mode, fn) {
    const d = await openOwn();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); let out;
      try { out = fn(t.objectStore(store)); } catch (e) { try { t.abort(); } catch (x) {} return rej(e); }
      t.oncomplete = () => res(out && 'result' in out ? out.result : out);
      t.onerror = t.onabort = () => rej(t.error || new Error('ranker-sync: Fehler'));
    });
  }
  const kvGet = k => own('kv', 'readonly', s => s.get(k));
  const kvSet = (k, v) => own('kv', 'readwrite', s => { s.put(v, k); });

  /* ---------- Image-Ranker-Datenbank ---------- */
  function rankerDb() {
    return new Promise(res => { const t = setInterval(() => { if (typeof db !== 'undefined' && db) { clearInterval(t); res(db); } }, 150); });
  }
  const getAll = (d, store) => new Promise((res, rej) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const waitT = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error || new Error('Schreibvorgang abgebrochen')); });
  const busy = t => { try { if (typeof showBusy === 'function') showBusy(t || ''); } catch (e) {} };

  /* ---------- SHA-256 der Bilddateien (zwischengespeichert pro Bild-ID) ---------- */
  async function sha256(blob) {
    const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function shaMap(images) {
    const cache = new Map();
    const keys = await own('sha', 'readonly', s => s.getAllKeys());
    const vals = await own('sha', 'readonly', s => s.getAll());
    keys.forEach((k, i) => cache.set(k, vals[i]));
    const out = new Map(), fresh = [];
    for (const im of images) {
      if (!(im.blob instanceof Blob)) continue;
      const c = cache.get(im.id);
      if (c && c.size === im.blob.size && c.type === im.blob.type) { out.set(im.id, c.sha); continue; }
      const sha = await sha256(im.blob);
      out.set(im.id, sha); fresh.push([im.id, { sha, size: im.blob.size, type: im.blob.type }]);
    }
    if (fresh.length) await own('sha', 'readwrite', s => { for (const [k, v] of fresh) s.put(v, k); });
    return out;
  }

  /* ---------- Pakete im Repo ranker-bilder ---------- */
  // Aufbau: "IRP1" | Länge Kopf (uint32) | Kopf-JSON {items:[{sha,type,off,len}]} | Bilddaten
  async function buildPack(items) {
    let off = 0; const head = [];
    for (const it of items) { head.push({ sha: it.sha, type: it.blob.type || 'image/jpeg', off, len: it.blob.size }); off += it.blob.size; }
    const hj = new TextEncoder().encode(JSON.stringify({ items: head }));
    const pre = new Uint8Array(8); pre.set([73, 82, 80, 49]); new DataView(pre.buffer).setUint32(4, hj.length);
    return new Blob([pre, hj].concat(items.map(it => it.blob)));
  }
  async function parsePack(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] !== 73 || u8[1] !== 82 || u8[2] !== 80 || u8[3] !== 49) throw new Error('Bildpaket hat ein unbekanntes Format');
    const hl = new DataView(buf).getUint32(4);
    const head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl)));
    const base = 8 + hl, out = new Map();
    for (const it of head.items) out.set(it.sha, new Blob([u8.slice(base + it.off, base + it.off + it.len)], { type: it.type }));
    return out;
  }
  function imgCfg(cfg) { return Object.assign({}, cfg, { repo: IMG_REPO, path: '' }); }
  async function uploadPack(cfg, name, blob) {
    const c = imgCfg(cfg);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const r = await fetch(GH.fileUrl(c, 'packs/' + name), {
      method: 'PUT', headers: Object.assign(GH.headers(c), { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message: 'Bildpaket ' + name, content: btoa(bin), branch: c.branch })
    });
    if (r.status === 404) throw GH.error(`Repo ${c.owner}/${IMG_REPO} nicht gefunden, oder der Token hat keinen Zugriff darauf.`, { auth: true });
    if (!r.ok) throw await GH.fail(r, 'Hochladen der Bilder');
  }
  async function downloadPack(cfg, name) {
    const c = imgCfg(cfg);
    const r = await fetch(GH.fileUrl(c, 'packs/' + name) + '?ref=' + encodeURIComponent(c.branch), { headers: GH.headers(c, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (!r.ok) throw await GH.fail(r, 'Laden der Bilder');
    return parsePack(await r.arrayBuffer());
  }

  /* ---------- Bilder aus URLs / eingebettete Bilder einmalig herunterladen ---------- */
  async function convertUrlImages(progress) {
    const d = await rankerDb();
    const imgs = (await getAll(d, 'images')).filter(im => typeof im.blob === 'string' && im.blob);
    if (!imgs.length) return;
    const fails = (await kvGet('urlFails')) || {};
    const now = Date.now(); let done = 0, failed = 0, i = 0;
    for (const im of imgs) {
      i++;
      const u = im.blob;
      if (!u.startsWith('data:') && fails[u] && now - fails[u] < URL_RETRY_MS) { failed++; continue; }
      if (imgs.length > 5) progress(`Lade Bilder aus Links… ${i} / ${imgs.length}`);
      let blob = null;
      try {
        const r = await fetch(u, u.startsWith('data:') ? undefined : { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (r.ok) { const b = await r.blob(); if (b.size > 0 && (/^image\//.test(b.type) || u.startsWith('data:'))) blob = new Blob([await b.arrayBuffer()], { type: b.type || 'image/jpeg' }); }
      } catch (e) { /* Server erlaubt es nicht (CORS) oder Link tot */ }
      if (!blob) { fails[u] = now; failed++; continue; }
      const t = d.transaction('images', 'readwrite');
      const st = t.objectStore('images');
      const g = st.get(im.id);
      g.onsuccess = () => { const cur = g.result; if (cur && cur.blob === u) st.put(Object.assign({}, cur, { blob, sourceUrl: u.startsWith('data:') ? cur.sourceUrl : u })); };
      await waitT(t);
      delete fails[u]; done++;
    }
    await kvSet('urlFails', fails);
    await kvSet('urlStats', { at: now, converted: done, linkOnly: failed });
    if (done) console.info(`Image Ranker Sync: ${done} Bilder aus Links gespeichert, ${failed} bleiben als Link.`);
  }

  /* ---------- fehlende Bilder hochladen (vor jedem Abgleich) ---------- */
  async function uploadMissing(cfg, progress) {
    const d = await rankerDb();
    const imgs = await getAll(d, 'images');
    const shas = await shaMap(imgs);
    const packs = (await kvGet('packs')) || {};
    const todo = [], seen = new Set();
    for (const im of imgs) {
      const sha = shas.get(im.id);
      if (sha && !packs[sha] && !seen.has(sha)) { seen.add(sha); todo.push({ sha, blob: im.blob }); }
    }
    if (!todo.length) return;
    const total = todo.reduce((a, t) => a + t.blob.size, 0);
    let sent = 0, k = 0;
    while (todo.length) {
      const batch = []; let size = 0;
      while (todo.length && (!batch.length || size + todo[0].blob.size <= PACK_MAX)) { const t = todo.shift(); batch.push(t); size += t.blob.size; }
      const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '.bin';
      progress(`Lade Bilder hoch… ${(sent / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`);
      await uploadPack(cfg, name, await buildPack(batch));
      for (const t of batch) packs[t.sha] = name;
      await kvSet('packs', packs);          // nach jedem Paket sichern: bricht es ab, geht es dort weiter
      sent += size; k++;
    }
  }

  /* ---------- Stand für den Sync ---------- */
  const parse = s => { try { return s ? JSON.parse(s) : undefined; } catch (e) { return undefined; } };
  async function getState() {
    const d = await rankerDb();
    const [imgs, matches, tagDefinitions] = await Promise.all([getAll(d, 'images'), getAll(d, 'matches'), getAll(d, 'tagDefinitions')]);
    const shas = await shaMap(imgs);
    const images = imgs.map(im => {
      const m = Object.assign({}, im); delete m.blob;
      if (im.blob instanceof Blob) m._blob = shas.get(im.id); else m._link = typeof im.blob === 'string' ? im.blob : '';
      return m;
    });
    const st = { images, matches, tagDefinitions, packs: (await kvGet('packs')) || {} };
    const settings = parse(lsGet('settings')), tabs = parse(lsGet('tabs'));
    if (settings !== undefined) st.settings = settings;
    if (tabs !== undefined) st.tabs = tabs;
    return st;
  }

  /* ---------- Stand aus der Cloud übernehmen ---------- */
  let needReload = false;
  async function applyState(data) {
    const d = await rankerDb();
    const cfg = ToolSync.readConfig();
    const local = await getAll(d, 'images');
    const shas = await shaMap(local);
    const localById = new Map(local.map(im => [im.id, im]));
    const blobBySha = new Map();
    for (const im of local) { const s = shas.get(im.id); if (s) blobBySha.set(s, im.blob); }
    const synced = (await kvGet('syncedIds')) || {};
    const packs = Object.assign({}, (await kvGet('packs')) || {}, data.packs || {});

    // Sperre: dieselbe Bild-ID auf zwei Geräten für unterschiedliche, noch nie abgeglichene Bilder
    for (const r of data.images || []) {
      const l = localById.get(r.id); if (!l || !r._blob) continue;
      const ls = shas.get(r.id);
      if (ls && ls !== r._blob && synced[r.id] !== ls) {
        throw ToolSync.github.error(`ID-Konflikt: Bild ${r.id} ist auf diesem Gerät ein anderes Bild als in der Cloud. ` +
          'Vermutlich wurden auf zwei Geräten gleichzeitig Bilder hinzugefügt. Es wurde nichts verändert. Sicherheitskopie (ZIP) machen und melden.');
      }
    }

    // fehlende Bilddateien aus den Paketen holen
    const need = new Map();
    for (const r of data.images || []) if (r._blob && !blobBySha.has(r._blob)) {
      const p = packs[r._blob];
      if (!p) throw ToolSync.github.error(`Bilddatei zu Bild ${r.id} ist (noch) nicht in der Cloud. Auf dem anderen Gerät den Image Ranker öffnen, bis der Upload fertig ist.`, { retry: true });
      if (!need.has(p)) need.set(p, []);
      need.get(p).push(r._blob);
    }
    let pi = 0;
    for (const [p] of need) {
      busy(`Lade Bilder aus der Cloud… Paket ${++pi} / ${need.size}`);
      const got = await downloadPack(cfg, p);
      got.forEach((b, sha) => { if (!blobBySha.has(sha)) blobBySha.set(sha, b); });
    }

    // Unterschiede schreiben
    const H = o => JSON.stringify(o);
    const imgPut = [], thumbDel = [];
    const remoteIds = new Set();
    for (const r of data.images || []) {
      remoteIds.add(r.id);
      const rec = Object.assign({}, r); delete rec._blob; delete rec._link;
      rec.blob = r._blob ? blobBySha.get(r._blob) : (r._link || '');
      const l = localById.get(r.id);
      if (l) {
        const lm = Object.assign({}, l); delete lm.blob;
        const sameBlob = r._blob ? shas.get(r.id) === r._blob : l.blob === rec.blob;
        if (sameBlob && H(lm) === H(Object.assign({}, rec, { blob: undefined }))) continue;
        if (!sameBlob) thumbDel.push(r.id);
      }
      imgPut.push(rec);
    }
    const imgDel = local.filter(im => !remoteIds.has(im.id)).map(im => im.id);

    for (let i = 0; i < imgPut.length; i += 25) {
      busy(`Übernehme Bilder… ${Math.min(i + 25, imgPut.length)} / ${imgPut.length}`);
      const t = d.transaction(['images', 'thumbs'], 'readwrite');
      imgPut.slice(i, i + 25).forEach(r => t.objectStore('images').put(r));
      await waitT(t);
    }
    if (imgDel.length || thumbDel.length) {
      const t = d.transaction(['images', 'thumbs'], 'readwrite');
      imgDel.forEach(id => { t.objectStore('images').delete(id); t.objectStore('thumbs').delete(id); });
      thumbDel.forEach(id => t.objectStore('thumbs').delete(id));
      await waitT(t);
    }
    for (const store of ['matches', 'tagDefinitions']) {
      const loc = await getAll(d, store), byId = new Map(loc.map(x => [x.id, x]));
      const rem = data[store] || [], ids = new Set(rem.map(x => x.id));
      const put = rem.filter(x => { const l = byId.get(x.id); return !l || H(l) !== H(x); });
      const del = loc.filter(x => !ids.has(x.id)).map(x => x.id);
      for (let i = 0; i < Math.max(put.length, del.length); i += 4000) {
        busy(store === 'matches' ? `Übernehme Duelle… ${Math.min(i + 4000, put.length)} / ${put.length}` : 'Übernehme Eigenschaften…');
        const t = d.transaction(store, 'readwrite');
        put.slice(i, i + 4000).forEach(x => t.objectStore(store).put(x));
        del.slice(i, i + 4000).forEach(id => t.objectStore(store).delete(id));
        await waitT(t);
      }
    }
    if (data.settings !== undefined) lsSet('settings', JSON.stringify(data.settings));
    if (data.tabs !== undefined) lsSet('tabs', JSON.stringify(data.tabs));
    await kvSet('packs', packs);
    busy('');
    needReload = true;
    return true;
  }

  /* Nach erfolgreichem Abgleich: welche Bild-ID gehört zu welchem Bild (für die Konflikt-Sperre) */
  async function rememberIds() {
    const d = await rankerDb();
    const imgs = await getAll(d, 'images');
    const shas = await shaMap(imgs);
    const m = {}; shas.forEach((s, id) => { m[id] = s; });
    await kvSet('syncedIds', m);
  }

  let SYNC = null, converting = false;
  rankerDb().then(() => {
    SYNC = ToolSync.create({
      tool: TOOL,
      collections: { images: 'array', matches: 'array', tagDefinitions: 'array', packs: 'map' },
      fields: ['settings', 'tabs'],
      shards: 64,
      stampDelay: 2000,
      get: getState,
      apply: applyState,
      beforeSync: async ({ config, progress }) => {
        if (!converting) { converting = true; try { await convertUrlImages(progress); } finally { converting = false; } }
        await uploadMissing(config, progress);
      },
      onStatus: s => {
        if (s !== 'ok') return;
        rememberIds().catch(e => console.warn('ranker-sync', e));
        if (needReload) { needReload = false; busy('Neuer Stand aus der Cloud – lade neu…'); setTimeout(() => location.reload(), 600); }
      }
    });
    window.RANKER_SYNC = SYNC;
    SYNC.start();
    // Der Image Ranker speichert an vielen Stellen direkt: regelmäßig und beim Verlassen nach Änderungen suchen
    setInterval(() => { if (document.visibilityState === 'visible') SYNC.changed(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') SYNC.syncNow(); });
  });
})();
