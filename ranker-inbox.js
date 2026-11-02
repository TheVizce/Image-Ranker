/* Image Ranker – Übernahme aus anderen Tools (z. B. „An Image Ranker senden“ im Babe Organizer)
 *
 * Andere Tools legen Aufträge in die gemeinsame IndexedDB "tool-transfer" (Store "jobs") und melden sich
 * über den BroadcastChannel "tool-transfer". Dieses Skript arbeitet die Aufträge mit der Logik des Rankers ab:
 *   - Reiter anlegen, falls neu
 *   - Eintrag schon im Reiter (gleiche boId, gleiches Bild laut Bild-Fingerabdruck oder gleicher Link)?
 *       → nur Eigenschaften und Link aktualisieren; Bild, Elo und Duelle bleiben
 *   - sonst neues Bild mit Elo 1200 anlegen
 *   - Eigenschaften (exakt / mehrfach / Zahl) im Reiter anlegen und Werte setzen
 * Außerdem: /Image-Ranker/#bo=<id> öffnet das Bild zu einem Babe-Organizer-Eintrag.
 *
 * Nutzt globale Funktionen des Rankers: db, tabs, currentTab, lsSet, switchTab, refreshUI, ensureThumbs,
 * showDetailsByID, showBusy, computeImageHash, hashDistance, DUP_MAX_DISTANCE, tagKey, tagSort, setTagValuesAs.
 */
(function () {
  'use strict';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('tool-transfer') : null;

  function transferDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tool-transfer', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('jobs')) r.result.createObjectStore('jobs', { keyPath: 'id' }); };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d); };
      r.onerror = () => rej(r.error);
    });
  }
  const ready = () => new Promise(res => { const t = setInterval(() => { if (typeof db !== 'undefined' && db && typeof refreshUI === 'function') { clearInterval(t); res(); } }, 150); });
  const all = (store) => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error || new Error('Speichern fehlgeschlagen')); });
  const note = (t, ms) => { try { showBusy(t); if (ms) setTimeout(() => showBusy(''), ms); } catch (e) {} };

  async function runJob(job) {
    const tab = String(job.tab || '').trim() || 'Standard';
    if (!tabs.includes(tab)) { tabs.push(tab); lsSet('tabs', JSON.stringify(tabs)); }
    const items = Array.isArray(job.items) ? job.items : [];
    const images = (await all('images')).filter(i => i.tab === tab);
    const defs = (await all('tagDefinitions')).filter(d => d.tab === tab);

    // Bild-Fingerabdrücke vorab berechnen (asynchron, nicht innerhalb einer Transaktion)
    const hashes = new Map();
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.blob instanceof Blob) { note(`Übernehme aus dem Babe Organizer… ${k + 1} / ${items.length}`); hashes.set(it, (await computeImageHash(it.blob)) || ''); }
    }

    // vorhandene Bilder des Reiters ohne Fingerabdruck einmalig nachziehen (wie beim Import im Ranker)
    const fresh = [];
    if (hashes.size) {
      const missing = images.filter(i => !i.hash && i.blob instanceof Blob);
      for (let k = 0; k < missing.length; k++) {
        note(`Duplikat-Prüfung: Bilder vorbereiten… ${k + 1} / ${missing.length}`);
        const h = await computeImageHash(missing[k].blob);
        if (h) { missing[k].hash = h; fresh.push(missing[k]); }
      }
    }

    // passenden vorhandenen Eintrag suchen
    const byBo = new Map(images.filter(i => i.boId).map(i => [i.boId, i]));
    const byId = new Map(images.map(i => [i.id, i]));
    const normUrl = (u) => { let x = String(u || '').trim(); try { x = decodeURIComponent(x); } catch (e) {} return x.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/[\s_]+/g, '_'); };
    const claimed = new Set();
    function findExisting(it) {
      // vom Babe Organizer ausdrücklich gewähltes Bild (Abgleich geprüft)
      if (it.linkTo != null) {
        const t = byId.get(Number(it.linkTo));
        if (!t || (t.boId && t.boId !== it.boId)) return null;
        claimed.add(t.id); return t;
      }
      let hit = byBo.get(it.boId);
      // Sicherung: ein Bild mit genau diesem Babepedia-Profil-Link nie doppelt anlegen
      if (!hit && it.profileUrl) {
        const k = normUrl(it.profileUrl);
        const same = images.filter(i => (i.links || []).some(l => l && normUrl(l.url) === k));
        if (same.length === 1 && !same[0].boId && !claimed.has(same[0].id)) hit = same[0];
        else if (same.length) { it._ambiguous = true; return null; }   // mehrdeutig oder schon anderweitig verknüpft: nichts automatisch tun
      }
      if (!hit && hashes.get(it)) hit = images.find(i => !claimed.has(i.id) && !i.boId && i.hash && hashDistance(i.hash, hashes.get(it)) <= DUP_MAX_DISTANCE);
      if (!hit && it.url) hit = images.find(i => !claimed.has(i.id) && !i.boId && (i.blob === it.url || i.sourceUrl === it.url));
      if (hit) claimed.add(hit.id);
      return hit;
    }

    const tx = db.transaction(['images', 'tagDefinitions'], 'readwrite');
    const imgStore = tx.objectStore('images'), defStore = tx.objectStore('tagDefinitions');
    fresh.forEach(i => imgStore.put(i));   // nachgezogene Fingerabdrücke speichern
    // Eigenschaften des Reiters anlegen bzw. Auswahlwerte ergänzen
    const defByName = new Map(defs.map(d => [d.tagName, d]));
    const touched = new Set();
    for (const it of items) for (const p of it.props || []) {
      if (!p || !p.name) continue;
      let d = defByName.get(p.name);
      if (!d) { d = { tab, tagName: p.name, type: p.type === 'multi' || p.type === 'number' ? p.type : 'exact', options: [] }; defByName.set(p.name, d); touched.add(d); }
      if (d.type !== 'number') {
        const opts = Array.isArray(d.options) ? d.options : (d.options = []);
        for (const val of p.values || []) if (!opts.some(o => tagKey(o) === tagKey(val))) { opts.push(val); touched.add(d); }
      }
    }
    touched.forEach(d => { if (Array.isArray(d.options)) d.options.sort(tagSort); defStore.put(d); });

    let added = 0, updated = 0, skipped = 0;
    for (const it of items) {
      const ex = findExisting(it);
      // nicht neu anlegen: nur verknüpfen gewünscht, gewähltes Bild fehlt, oder mehrere Bilder mit gleichem Profil-Link
      if (!ex && (it.create === false || it.linkTo != null || it._ambiguous)) { skipped++; continue; }
      const rec = ex ? Object.assign({}, ex) : {
        tab, name: it.name || 'Ohne Namen', blob: it.blob instanceof Blob ? it.blob : (it.url || ''),
        elo: 1200, wins: 0, losses: 0, history: [1200], peak: 1200, y: 50, hash: hashes.get(it) || '', tags: {}, rivals: [], links: []
      };
      if (!ex && it.url && it.blob instanceof Blob) rec.sourceUrl = it.url;
      rec.boId = it.boId;
      for (const p of it.props || []) {
        const d = defByName.get(p.name); if (!d) continue;
        const vals = (p.values || []).map(v => { const o = (d.options || []).find(x => tagKey(x) === tagKey(v)); return o !== undefined ? o : String(v); });
        setTagValuesAs(rec, p.name, d.type, d.type === 'multi' ? vals : vals.slice(0, 1));
      }
      if (it.profileUrl) {
        rec.links = Array.isArray(rec.links) ? rec.links.slice() : [];
        if (!rec.links.some(l => l && l.url === it.profileUrl)) rec.links.push({ url: it.profileUrl, icon: null });
      }
      if (ex) { imgStore.put(rec); updated++; } else { imgStore.add(rec); added++; }
    }
    await done(tx);
    return { tab, added, updated, skipped };
  }

  let busy = Promise.resolve();
  function processJobs() {
    busy = busy.then(async () => {
      await ready();
      const work = async () => {
        let tdb;
        try { tdb = await transferDb(); } catch (e) { return; }
        const jobs = await new Promise(res => { const r = tdb.transaction('jobs').objectStore('jobs').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
        if (!jobs.length) { tdb.close(); return; }
        jobs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const results = [];
        for (const job of jobs) {
          try {
            results.push(await runJob(job));
            await new Promise((res, rej) => { const t = tdb.transaction('jobs', 'readwrite'); t.objectStore('jobs').delete(job.id); t.oncomplete = res; t.onerror = () => rej(t.error); });
          } catch (e) {
            console.error('Übernahme fehlgeschlagen:', e);
            note('Übernahme aus dem Babe Organizer fehlgeschlagen: ' + (e && e.message || e) + ' – der Auftrag bleibt erhalten.', 8000);
            tdb.close(); return;
          }
        }
        tdb.close();
        const a = results.reduce((s, r) => s + r.added, 0), u = results.reduce((s, r) => s + r.updated, 0), sk = results.reduce((s, r) => s + (r.skipped || 0), 0);
        const last = results[results.length - 1];
        if (last && last.tab !== currentTab) switchTab(last.tab); else await refreshUI();
        try { renderTabs(); } catch (e) {}
        try { ensureThumbs(); } catch (e) {}
        if (window.RANKER_SYNC) window.RANKER_SYNC.changed();
        note(`Aus dem Babe Organizer: ${a} neu, ${u} verknüpft/aktualisiert${sk ? `, ${sk} übersprungen (kein eindeutiges Bild)` : ''}${last ? ' – Reiter „' + last.tab + '“' : ''}.`, 6000);
        if (channel) channel.postMessage({ type: 'done', added: a, updated: u, skipped: sk });
      };
      // nur ein offener Ranker-Tab arbeitet die Aufträge ab
      if (navigator.locks && navigator.locks.request) await navigator.locks.request('image-ranker-inbox', work);
      else await work();
    }).catch(e => console.error(e));
    return busy;
  }

  async function openFromHash() {
    const m = location.hash.match(/^#bo=(.+)$/);
    if (!m) return;
    await ready();
    const boId = decodeURIComponent(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
    const im = (await all('images')).find(i => i.boId === boId);
    if (!im) { note('Dieser Eintrag ist (noch) nicht im Image Ranker.', 4000); return; }
    if (im.tab !== currentTab) switchTab(im.tab);
    setTimeout(() => { try { showDetailsByID(im.id); } catch (e) {} }, 400);
  }

  if (channel) channel.onmessage = ev => { if (ev.data && ev.data.type === 'job') processJobs(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') processJobs(); });
  window.addEventListener('hashchange', openFromHash);
  ready().then(() => setTimeout(() => { processJobs(); openFromHash(); }, 300));
})();
