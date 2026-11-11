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
  const PACK_MAX = Number(localStorage.getItem('ranker.packMax')) || 10 * 1024 * 1024;   // (Testschalter)
  const URL_RETRY_MS = 7 * 864e5;     // fehlgeschlagene URL-Downloads frühestens nach einer Woche erneut versuchen
  const GH = ToolSync.github;

  /* ---------- eigene kleine Datenbank ---------- */
  let ownDb = null;
  function openOwn() {
    if (ownDb) return ownDb;
    ownDb = new Promise((res, rej) => {
      const r = indexedDB.open('ranker-sync', 2);
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['sha', 'kv', 'blobs']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fastHash = str => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + str.length.toString(36); };
  // GitHub-API-Anfragen (außer Bildpakete) bekommen ein Zeitlimit, damit die Sperre bei schlechtem Netz nicht ewig dauert
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (u.indexOf('https://api.github.com/') === 0 && u.indexOf('/packs/') < 0 && !(init && init.signal) && window.AbortSignal && AbortSignal.timeout) {
        init = Object.assign({}, init, { signal: AbortSignal.timeout(40000) });
      }
    } catch (e) {}
    return nativeFetch(input, init);
  };
  const busy = t => { try { if (typeof showBusy === 'function') showBusy(t || ''); } catch (e) {} lockText(t); };

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
      checkCancel();
      progress(`Lade Bilder hoch… ${(sent / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`);
      await uploadPack(cfg, name, await buildPack(batch));
      for (const t of batch) packs[t.sha] = name;
      await kvSet('packs', packs);          // nach jedem Paket sichern: bricht es ab, geht es dort weiter
      sent += size; k++;
    }
  }

  /* ---------- Stand für den Sync ---------- */
  const parse = s => { try { return s ? JSON.parse(s) : undefined; } catch (e) { return undefined; } };
  // Was beim letzten Lesen für den Abgleich lokal vorhanden war: damit erkennt die Übernahme, was DANACH (während des Abgleichs) verändert wurde
  let snap = null;
  async function getState() {
    const d = await rankerDb();
    const [imgs, matches, tagDefinitions] = await Promise.all([getAll(d, 'images'), getAll(d, 'matches'), getAll(d, 'tagDefinitions')]);
    const shas = await shaMap(imgs);
    snap = { img: new Map(), match: new Set() };
    const images = imgs.map(im => {
      const m = Object.assign({}, im); delete m.blob;
      snap.img.set(im.id, fastHash(JSON.stringify(m)));
      if (im.blob instanceof Blob) m._blob = shas.get(im.id); else m._link = typeof im.blob === 'string' ? im.blob : '';
      return m;
    });
    matches.forEach(x => snap.match.add(x.id));
    const st = { images, matches, tagDefinitions, packs: (await kvGet('packs')) || {} };
    const settings = parse(lsGet('settings')), tabs = parse(lsGet('tabs'));
    if (settings !== undefined) st.settings = settings;
    if (tabs !== undefined) st.tabs = tabs;
    return st;
  }

  /* ---------- Sicherheitskopie vor jeder Übernahme (die letzten zwei, ohne Bilddateien) ---------- */
  async function backupBeforeApply(d, localImgs) {
    try {
      const [matches, tagDefinitions] = await Promise.all([getAll(d, 'matches'), getAll(d, 'tagDefinitions')]);
      if (!localImgs.length && !matches.length) return;      // leeres Gerät: nichts zu sichern
      const n = ((await kvGet('backupN')) || 0) + 1;
      const images = localImgs.map(im => { const m = Object.assign({}, im); delete m.blob; return m; });
      await kvSet('backup' + (n % 2), { at: new Date().toISOString(), images, matches, tagDefinitions, settings: parse(lsGet('settings')), tabs: parse(lsGet('tabs')) });
      await kvSet('backupN', n);
    } catch (e) { console.warn('ranker-sync: Sicherheitskopie fehlgeschlagen', e); }
  }
  window.RankerSyncBackup = {
    async info() { const o = []; for (const k of ['backup0', 'backup1']) { const b = await kvGet(k); if (b) o.push({ key: k, at: b.at, images: b.images.length, matches: b.matches.length }); } return o; },
    async download(key) {
      const b = await kvGet(key || (((await kvGet('backupN')) || 0) % 2 ? 'backup1' : 'backup0'));
      if (!b) throw new Error('Keine Sicherheitskopie vorhanden');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
      a.download = 'ranker-sicherheitskopie-' + b.at.slice(0, 16).replace(/[:T]/g, '-') + '.json'; document.body.appendChild(a); a.click(); a.remove();
    }
  };

  /* ---------- Sperre während des Abgleichs ---------- */
  let lockEl = null, lockTimer = null, cancelRequested = false;
  const lockText = t => { if (lockEl && t && lockEl.style.display !== 'none') lockEl.querySelector('.t').textContent = '☁︎ ' + t; };
  const checkCancel = () => { if (cancelRequested) throw GH.error('Abgleich abgebrochen. Beim nächsten Start geht es dort weiter, wo es aufgehört hat.'); };
  function setLock(on, text) {
    if (!lockEl) {
      lockEl = document.createElement('div'); lockEl.id = 'sync-lock';
      lockEl.style.cssText = 'position:fixed;inset:0;z-index:2147482000;display:none;align-items:center;justify-content:center;background:transparent;touch-action:none;';
      lockEl.innerHTML = '<div style="background:rgba(20,22,28,.94);color:#e8eaf0;border:1px solid #2d3240;border-radius:12px;padding:14px 20px;font:14px/1.4 system-ui,-apple-system,sans-serif;max-width:80vw;text-align:center;visibility:hidden;"><div class="t"></div>' +
        '<div style="margin-top:6px;font-size:12px;color:#9aa1b2;">Einmalig beim ersten Laden dauert es länger. Der Stand wird bei Abbruch später fortgesetzt.</div>' +
        '<button style="margin-top:10px;font:inherit;color:#e8eaf0;background:#222631;border:1px solid #2d3240;border-radius:8px;padding:6px 14px;cursor:pointer;">Abbrechen</button></div>';
      document.body.appendChild(lockEl);
      lockEl.querySelector('button').onclick = () => { cancelRequested = true; lockEl.querySelector('button').textContent = 'Wird abgebrochen…'; };
    }
    const box = lockEl.firstChild;
    if (on) {
      lockEl.style.display = 'flex'; lockText(text && text !== 'syncing' ? text : 'Gleiche ab…');
      if (!lockTimer) lockTimer = setTimeout(() => { box.style.visibility = 'visible'; }, 700);   // kurze Abgleiche bleiben unsichtbar
    } else {
      lockEl.style.display = 'none'; box.style.visibility = 'hidden'; cancelRequested = false;
      const cb = lockEl.querySelector('button'); if (cb) cb.textContent = 'Abbrechen';
      clearTimeout(lockTimer); lockTimer = null;
    }
  }

  /* ---------- Hinweis: wie viele Duelle sind noch nicht in der Cloud ---------- */
  let noteEl = null;
  async function updateNote() {
    try {
      const d = await rankerDb();
      const n = await new Promise((res, rej) => { const r = d.transaction('matches').objectStore('matches').count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const base = await kvGet('syncedMatchCount');
      const open = base == null ? 0 : Math.max(0, n - base);
      if (!noteEl) {
        noteEl = document.createElement('div'); noteEl.id = 'sync-note';
        noteEl.style.cssText = 'position:fixed;left:calc(215px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));height:30px;box-sizing:border-box;display:flex;align-items:center;cursor:pointer;z-index:2147482500;font:11px/1.2 system-ui,-apple-system,sans-serif;color:#9aa1b2;background:rgba(26,29,36,.85);border:1px solid #2d3240;border-radius:8px;padding:3px 7px;pointer-events:auto;display:none;';
        noteEl.onclick = () => { if (SYNC) SYNC.syncNow(); };
        document.body.appendChild(noteEl);
      }
      noteEl.textContent = '⬆ ' + open + (open === 1 ? ' Duell' : ' Duelle') + ' hochladen';
      noteEl.title = open + ' Duelle sind noch nicht in der Cloud. Antippen zum Abgleichen.';
      noteEl.style.color = open >= 30 ? '#ffb86c' : '#9aa1b2';
      noteEl.style.display = open > 0 ? 'flex' : 'none';
      return open;
    } catch (e) { return 0; }
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

    await backupBeforeApply(d, local);

    // fehlende Bilddateien aus den Paketen holen
    const need = new Map();
    for (const r of data.images || []) if (r._blob && !blobBySha.has(r._blob)) {
      const p = packs[r._blob];
      if (!p) throw ToolSync.github.error(`Bilddatei zu Bild ${r.id} ist (noch) nicht in der Cloud. Auf dem anderen Gerät den Image Ranker öffnen, bis der Upload fertig ist.`, { retry: true });
      if (!need.has(p)) need.set(p, []);
      need.get(p).push(r._blob);
    }
    // Pakete einzeln laden und sofort in den Zwischenspeicher legen (nicht alles im Arbeitsspeicher). Bricht es ab, geht es beim nächsten Mal dort weiter.
    const staged = new Set(await own('blobs', 'readonly', s => s.getAllKeys()));
    let pi = 0, doneMB = 0;
    const totalPacks = need.size;
    for (const [p, shas] of need) {
      pi++;
      const want = [...new Set(shas)];
      if (want.every(x => staged.has(x))) continue;
      checkCancel();
      busy(`Lade Bilder aus der Cloud… Paket ${pi} / ${totalPacks}` + (doneMB ? ` (${doneMB.toFixed(0)} MB)` : ''));
      const got = await downloadPack(cfg, p);
      for (const sha of want) {
        const b = got.get(sha);
        if (!b) throw ToolSync.github.error('Ein Bild fehlt im Bildpaket ' + p + '. Auf dem anderen Gerät den Image Ranker öffnen, bis der Upload fertig ist.', { retry: true });
        doneMB += b.size / 1e6;
      }
      await own('blobs', 'readwrite', st => { for (const sha of want) st.put(got.get(sha), sha); });
      want.forEach(x => staged.add(x));
    }
    const stageLeft = new Map();    // wie viele Einträge brauchen noch den zwischengespeicherten Wert
    for (const r of data.images || []) if (r._blob && !blobBySha.has(r._blob)) stageLeft.set(r._blob, (stageLeft.get(r._blob) || 0) + 1);

    // Unterschiede schreiben
    const H = o => JSON.stringify(o);
    const imgPut = [], thumbDel = [];
    const remoteIds = new Set();
    const shaFresh = [];
    let kept = 0;    // lokale Änderungen, die während des Abgleichs entstanden sind und deshalb bleiben
    for (const r of data.images || []) {
      remoteIds.add(r.id);
      const rec = Object.assign({}, r); delete rec._blob; delete rec._link;
      rec.blob = r._blob ? blobBySha.get(r._blob) : (r._link || '');
      if (r._blob && !rec.blob) rec._stage = r._blob;
      const l = localById.get(r.id);
      if (l) {
        const lm = Object.assign({}, l); delete lm.blob;
        if (snap && snap.img.has(r.id) && snap.img.get(r.id) !== fastHash(JSON.stringify(lm))) { kept++; continue; }
        const sameBlob = r._blob ? shas.get(r.id) === r._blob : l.blob === rec.blob;
        if (sameBlob && H(lm) === H(Object.assign({}, rec, { blob: undefined }))) continue;
        if (!sameBlob) thumbDel.push(r.id);
      }
      imgPut.push(rec);
    }
    const imgDel = local.filter(im => {
      if (remoteIds.has(im.id)) return false;
      if (snap && (!snap.img.has(im.id) || snap.img.get(im.id) !== fastHash(JSON.stringify(Object.assign({}, im, { blob: undefined }))))) { kept++; return false; }
      return true;
    }).map(im => im.id);

    for (let i = 0; i < imgPut.length; i += 25) {
      busy(`Übernehme Bilder… ${Math.min(i + 25, imgPut.length)} / ${imgPut.length}`);
      const part = imgPut.slice(i, i + 25), freed = [];
      for (const r of part) {
        if (r._stage) {
          const b = await own('blobs', 'readonly', st => st.get(r._stage));
          if (!b) throw ToolSync.github.error('Zwischengespeichertes Bild fehlt – bitte erneut abgleichen.', { retry: true });
          shaFresh.push([r.id, { sha: r._stage, size: b.size, type: b.type }]);
          r.blob = b; freed.push(r._stage); delete r._stage;
        }
      }
      const t = d.transaction(['images', 'thumbs'], 'readwrite');
      part.forEach(r => t.objectStore('images').put(r));
      await waitT(t);
      const del = [];
      for (const sha of freed) { const n = (stageLeft.get(sha) || 1) - 1; stageLeft.set(sha, n); if (n <= 0) del.push(sha); }
      if (del.length) await own('blobs', 'readwrite', st => { del.forEach(x => st.delete(x)); });
    }
    if (shaFresh.length) await own('sha', 'readwrite', st => { for (const [k, v] of shaFresh) st.put(v, k); });   // die Prüfsummen sind bekannt: nicht neu berechnen
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
      const del = loc.filter(x => {
        if (ids.has(x.id)) return false;
        if (store === 'matches' && snap && !snap.match.has(x.id)) { kept++; return false; }   // Duell nach dem Lesen entstanden
        return true;
      }).map(x => x.id);
      for (let i = 0; i < Math.max(put.length, del.length); i += 4000) {
        busy(store === 'matches' ? `Übernehme Duelle… ${Math.min(i + 4000, put.length)} / ${put.length}` : 'Übernehme Eigenschaften…');
        const t = d.transaction(store, 'readwrite');
        put.slice(i, i + 4000).forEach(x => t.objectStore(store).put(x));
        del.slice(i, i + 4000).forEach(id => t.objectStore(store).delete(id));
        await waitT(t);
      }
    }
    if (kept) console.info(`Image Ranker Sync: ${kept} lokale Änderungen aus der Abgleichzeit bleiben erhalten und werden beim nächsten Abgleich hochgeladen.`);
    if (data.settings !== undefined) lsSet('settings', JSON.stringify(data.settings));
    if (data.tabs !== undefined) lsSet('tabs', JSON.stringify(data.tabs));
    await kvSet('packs', packs);
    await own('blobs', 'readwrite', st => { st.clear(); });
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
    await kvSet('syncedMatchCount', snap ? snap.match.size : (await getAll(d, 'matches')).length);   // Stand des Abgleichs, nicht der jetzige
    updateNote();
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
        setLock(true);
        await sleep(400);            // noch laufende Speichervorgänge des Rankers abwarten
        if (!converting) { converting = true; try { await convertUrlImages(progress); } finally { converting = false; } }
        await uploadMissing(config, progress);
      },
      onStatus: (s, text) => {
        setLock(s === 'syncing', text);
        if (s !== 'ok') { if (s === 'offline' || s === 'error' || s === 'pending') updateNote(); return; }
        rememberIds().catch(e => console.warn('ranker-sync', e));
        if (needReload) { needReload = false; busy('Neuer Stand aus der Cloud – lade neu…'); setTimeout(() => location.reload(), 600); }
      }
    });
    window.RANKER_SYNC = SYNC;
    // Abgleich nur beim Start und wenn du ihn auslöst (☁︎-Feld → „Jetzt abgleichen“, Einstellungen oder Hinweis „Duelle hochladen“).
    // Der gemeinsame Sync würde sonst bei jedem Tab-Wechsel, Wieder-Online und Verlassen der Seite von selbst abgleichen:
    // diese drei Ereignisse werden nur während SYNC.start() verworfen (sync-v1.js selbst bleibt unverändert).
    const skip = new Set(['visibilitychange', 'online', 'pagehide']);
    const dAdd = document.addEventListener, wAdd = window.addEventListener;
    document.addEventListener = function (t, ...r) { if (!skip.has(t)) return dAdd.call(document, t, ...r); };
    window.addEventListener = function (t, ...r) { if (!skip.has(t)) return wAdd.call(window, t, ...r); };
    try { SYNC.start(); } finally { document.addEventListener = dAdd; window.addEventListener = wAdd; }
    updateNote();
    setInterval(() => { if (document.visibilityState === 'visible') updateNote(); }, 5000);
  });
})();
