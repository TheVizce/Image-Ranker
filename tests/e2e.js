const {chromium}=require('playwright');
const path='file://'+process.cwd()+'/Ranking.html';
let promptAnswer=null, confirmAnswer=true, errors=[];
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext(); const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text())});
 p.on('dialog',async d=>{ if(d.type()==='prompt') await d.accept(promptAnswer??''); else if(d.type()==='confirm') confirmAnswer?await d.accept():await d.dismiss(); else await d.accept(); });
 await p.addInitScript(()=>{ if(!localStorage.getItem('ranker.settings')) localStorage.setItem('ranker.settings',JSON.stringify({tagOrder:{Standard:['Spezies','Herkunft','Type','Year']}})); });
 await p.goto(path); await p.waitForFunction(()=>db!==null);
 // Altdaten anlegen (Freitext, unsauber), noch ohne options
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'});
  const tx=db.transaction(['images','tagDefinitions','matches'],'readwrite');
  const T=v=>({value:v,showBadge:false});
  const rows=[['A','Katze','Japan'],['B','katze','japan'],['C',' Katze ','Peru'],['D','Hund','Japan'],['E','Hund',''],['F','','Peru'],['G',undefined,undefined]];
  rows.forEach(([n,sp,he],i)=>{ const tags={}; if(sp!==undefined)tags.Spezies=T(sp); if(he!==undefined)tags.Herkunft=T(he);
    tx.objectStore('images').add({tab:'Standard',name:n,blob,elo:1200+i,wins:0,losses:0,history:[1200],peak:1200,tags}); });
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Spezies'});
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Herkunft'});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(500);
 const snap=()=>p.evaluate(async()=>{
  const g=s=>new Promise(r=>db.transaction(s).objectStore(s).getAll().onsuccess=e=>r(e.target.result));
  const defs=await g('tagDefinitions'), imgs=await g('images');
  return {defs:Object.fromEntries(defs.map(d=>[d.tagName,d.options])), vals:Object.fromEntries(imgs.map(i=>[i.name,{S:i.tags&&i.tags.Spezies?i.tags.Spezies.value:null,H:i.tags&&i.tags.Herkunft?i.tags.Herkunft.value:null}])), ids:Object.fromEntries(imgs.map(i=>[i.name,i.id])), defIds:Object.fromEntries(defs.map(d=>[d.tagName,d.id]))};
 });
 let s=await snap();
 ok(JSON.stringify(s.defs.Spezies)===JSON.stringify(['Hund','Katze']),'Migration Spezies-Optionen '+JSON.stringify(s.defs.Spezies));
 ok(JSON.stringify(s.defs.Herkunft)===JSON.stringify(['Japan','Peru']),'Migration Herkunft-Optionen '+JSON.stringify(s.defs.Herkunft));
 ok(['A','B','C'].every(n=>s.vals[n].S==='Katze'),'Katze/katze/" Katze " vereinheitlicht');
 ok(s.vals.E.H===''&&s.vals.G.S===null,'Leere/fehlende Werte bleiben leer/fehlend');
 // Zweiter Reload ändert nichts (idempotent)
 const before=JSON.stringify(s); await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(300);
 ok(JSON.stringify(await snap())===before,'Migration ist idempotent');
 // Detailansicht
 await p.evaluate(id=>showDetailsByID(id),s.ids.D); await p.waitForSelector('#modal-body .dt-work select:not(#grp-add-sel)');
 const selInfo=await p.$$eval('#modal-body .dt-work select:not(#grp-add-sel)',els=>els.map(e=>({sel:e.value,opts:[...e.options].map(o=>o.textContent)})));
 ok(selInfo.length===2,'Zwei Dropdowns (Spezies, Herkunft) statt Textfeldern');
 ok(selInfo[0].sel==='Hund'&&JSON.stringify(selInfo[0].opts)===JSON.stringify(['–','Hund','Katze','＋ Neuer Wert…']),'Dropdown zeigt Altwert vorausgewählt: '+JSON.stringify(selInfo[0]));
 // Wert per Dropdown ändern
 await p.selectOption('#modal-body .dt-work select >> nth=0','Katze'); await p.waitForTimeout(400);
 s=await snap(); ok(s.vals.D.S==='Katze','Dropdown-Auswahl wird gespeichert');
 // Neuer Wert über Dropdown
 await p.waitForSelector('#modal-body .dt-work select:not(#grp-add-sel)'); promptAnswer='Fuchs';
 await p.selectOption('#modal-body .dt-work select >> nth=0','__new__'); await p.waitForTimeout(500);
 s=await snap(); ok(s.vals.D.S==='Fuchs'&&s.defs.Spezies.includes('Fuchs'),'„＋ Neuer Wert…" legt Wert an und setzt ihn');
 // Neuer Wert, nur anderes Casing -> bestehende Schreibweise
 promptAnswer='hund'; await p.selectOption('#modal-body .dt-work select >> nth=0','__new__'); await p.waitForTimeout(500);
 s=await snap(); ok(s.vals.D.S==='Hund'&&s.defs.Spezies.filter(o=>o.toLowerCase()==='hund').length===1,'„hund" wird auf vorhandenes „Hund" abgebildet, keine Dublette');
 // Abbruch
 promptAnswer=null; const prev=JSON.stringify(s.vals.D);
 await p.selectOption('#modal-body .dt-work select >> nth=0','__new__'); await p.waitForTimeout(500);
 s=await snap(); ok(JSON.stringify(s.vals.D)===prev,'Abbruch ändert nichts');
 // Verwaltung
 await p.click('[title="Werte verwalten"] >> nth=0'); await p.waitForSelector('#tag-values-overlay');
 let rows=await p.$$eval('#tag-values-overlay span[title="Löschen"]',e=>e.length); ok(rows===3,'Verwaltung listet 3 Werte (Fuchs, Hund, Katze)');
 await p.fill('#tag-new-value','Vogel'); await p.press('#tag-new-value','Enter'); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Spezies.includes('Vogel'),'Wert über Verwaltung hinzugefügt (Enter)');
 await p.fill('#tag-new-value','vogel'); await p.click('#tag-values-overlay button'); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Spezies.filter(o=>o.toLowerCase()==='vogel').length===1,'Dublette (anderes Casing) wird nicht angelegt');
 // Umbenennen mit Zusammenführen: Fuchs -> katze (merge in Katze)
 await p.evaluate(async o=>{await setImageTagValues(o.id,o.d,'Fuchs');},{id:s.ids.F,d:s.defIds.Spezies});
 s=await snap(); ok(s.vals.F.S==='Fuchs','Vorbereitung: F hat Fuchs');
 const idxFuchs=s.defs.Spezies.indexOf('Fuchs'); promptAnswer='katze'; confirmAnswer=true;
 await p.click(`#tag-values-overlay span[title^="Umbenennen"] >> nth=${idxFuchs}`); await p.waitForTimeout(500);
 s=await snap(); ok(!s.defs.Spezies.includes('Fuchs')&&s.defs.Spezies.includes('Katze')&&s.vals.F.S==='Katze'&&s.defs.Spezies.filter(o=>o.toLowerCase()==='katze').length===1,'Umbenennen auf vorhandenen Wert führt zusammen (F: Fuchs→Katze)');
 // Einfaches Umbenennen: Vogel -> Rabe, ein Bild bekommt Vogel vorher
 await p.evaluate(async o=>{await setImageTagValues(o.id,o.d,'Vogel');},{id:s.ids.E,d:s.defIds.Spezies});
 s=await snap(); const idxV=s.defs.Spezies.indexOf('Vogel'); promptAnswer='Rabe';
 await p.click(`#tag-values-overlay span[title^="Umbenennen"] >> nth=${idxV}`); await p.waitForTimeout(500);
 s=await snap(); ok(s.vals.E.S==='Rabe'&&s.defs.Spezies.includes('Rabe')&&!s.defs.Spezies.includes('Vogel'),'Umbenennen aktualisiert Bilder (E: Vogel→Rabe)');
 // Löschen abgelehnt
 const idxR=s.defs.Spezies.indexOf('Rabe'); confirmAnswer=false;
 await p.click(`#tag-values-overlay span[title="Löschen"] >> nth=${idxR}`); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Spezies.includes('Rabe')&&s.vals.E.S==='Rabe','Löschen abgebrochen -> nichts verändert');
 // Löschen bestätigt
 confirmAnswer=true;
 await p.click(`#tag-values-overlay span[title="Löschen"] >> nth=${idxR}`); await p.waitForTimeout(500);
 s=await snap(); ok(!s.defs.Spezies.includes('Rabe')&&s.vals.E.S==='','Löschen entfernt Wert und leert Bilder (E leer)');
 ok(s.vals.A.S==='Katze'&&s.defs.Herkunft.length===2,'Andere Eigenschaften/Werte unberührt');
 // Schließen aktualisiert Detailansicht
 await p.click('#tag-values-overlay span:has-text("×")'); await p.waitForTimeout(500);
 ok(await p.$('#tag-values-overlay')===null,'Overlay schließt');
 // Neue Eigenschaft hat leere Liste
 promptAnswer='Farbe'; await p.evaluate(async id=>{await addTagDefinition('Standard',id)},s.ids.D); await p.waitForTimeout(500);
 s=await snap(); ok(Array.isArray(s.defs.Farbe)&&s.defs.Farbe.length===0,'Neue Eigenschaft startet mit leerer Werteliste');
 // Umbenennen der Eigenschaft behält Werte
 // Rivalen-Vorschläge funktionieren weiter
 const sug=await p.evaluate(async id=>{const all=await new Promise(r=>db.transaction('images').objectStore('images').getAll().onsuccess=e=>r(e.target.result));const me=all.find(i=>i.id===id);const defs=await new Promise(r=>db.transaction('tagDefinitions').objectStore('tagDefinitions').getAll().onsuccess=e=>r(e.target.result));return computeRivalSuggestions(me,all.filter(i=>i.tab==='Standard'),new Map(defs.map(d=>[d.tagName,d]))).map(x=>x.img.name+':'+x.score);},s.ids.A);
 ok(sug.length>0,'Rivalen-Vorschläge funktionieren weiter: '+sug.join(', '));
 // Export enthält options
 const exp=await p.evaluate(async()=>{const d=await new Promise(r=>db.transaction('tagDefinitions').objectStore('tagDefinitions').getAll().onsuccess=e=>r(e.target.result));return d.every(x=>Array.isArray(x.options));});
 ok(exp,'Alle Definitionen (=Export-Inhalt) enthalten options');
 ok(errors.length===0,'Keine JS-Fehler'+(errors.length?': '+errors.join(' | '):''));
 await b.close();
})().catch(e=>{console.log('TESTABBRUCH',e.message);process.exitCode=2;}).finally(()=>setTimeout(()=>process.exit(process.exitCode||0),500));
