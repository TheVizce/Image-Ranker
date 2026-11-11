const {chromium}=require('playwright');
const path='file://'+process.cwd()+'/Ranking.html';
let promptAnswer=null, confirmAnswer=true, errors=[];
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text())});
 p.on('dialog',async d=>{ if(d.type()==='prompt') await d.accept(promptAnswer??''); else if(d.type()==='confirm') confirmAnswer?await d.accept():await d.dismiss(); else await d.accept(); });
 await p.addInitScript(()=>{ if(!localStorage.getItem('ranker.settings')) localStorage.setItem('ranker.settings',JSON.stringify({tagOrder:{Standard:['Spezies','Herkunft','Type','Year']}})); });
 await p.goto(path); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const T=v=>({value:v,showBadge:false});
  const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  const rows=[['A','Fire','1999'],['B','Fire','2000'],['C','Water','2010'],['D','fire ','abc'],['E','Grass','']];
  rows.forEach(([n,ty,yr],i)=>tx.objectStore('images').add({tab:'Standard',name:n,blob,elo:1200+i,wins:0,losses:0,history:[1200],peak:1200,tags:{Type:T(ty),Year:T(yr)}}));
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Type'});
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Year'});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(500);
 const snap=()=>p.evaluate(async()=>{
  const g=s=>new Promise(r=>db.transaction(s).objectStore(s).getAll().onsuccess=e=>r(e.target.result));
  const defs=await g('tagDefinitions'), imgs=await g('images');
  const T=i=>i.tags&&i.tags.Type?i.tags.Type:null, Y=i=>i.tags&&i.tags.Year?i.tags.Year.value:null;
  return {defs:Object.fromEntries(defs.map(d=>[d.tagName,d])),ids:Object.fromEntries(imgs.map(i=>[i.name,i.id])),
   type:Object.fromEntries(imgs.map(i=>[i.name,T(i)&&(T(i).values?T(i).values:T(i).value)])), typeVal:Object.fromEntries(imgs.map(i=>[i.name,T(i)&&T(i).value])), year:Object.fromEntries(imgs.map(i=>[i.name,Y(i)]))};
 });
 const sugg=(name)=>p.evaluate(async n=>{const g=s=>new Promise(r=>db.transaction(s).objectStore(s).getAll().onsuccess=e=>r(e.target.result));
  const all=await g('images'),defs=await g('tagDefinitions');const me=all.find(i=>i.name===n);
  return computeRivalSuggestions(me,all,new Map(defs.map(d=>[d.tagName,d]))).map(x=>x.img.name+':'+Math.round(x.score*100)/100);},name);
 let s=await snap();
 ok(s.defs.Type.type===undefined&&JSON.stringify(s.defs.Type.options)==='["Fire","Grass","Water"]','Bestehende Eigenschaft ohne Typ = Exakt, Liste übernommen: '+JSON.stringify(s.defs.Type.options));
 // Einstellungen
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#modal-body table');
 const types=await p.$$eval('#modal-body table select',e=>e.map(x=>x.value)); ok(types.length===2&&types.every(t=>t==='exact'),'Einstellungen zeigen Typ je Eigenschaft (Standard: Exakt)');
 // Type -> Mehrfachauswahl
 await p.selectOption('tr:has(td:text-is("Type")) select','multi'); await p.waitForTimeout(600);
 s=await snap(); ok(s.defs.Type.type==='multi'&&JSON.stringify(s.type.A)==='["Fire"]'&&JSON.stringify(s.type.D)==='["Fire"]'&&s.typeVal.A==='Fire','Exakt→Mehrfach: Werte werden zu Listen (A: ["Fire"])');
 ok(await p.$eval('tr:has(td:text-is("Type")) select',e=>e.value)==='multi','Einstellungen zeigen neuen Typ');
 // Details: Multi-UI
 await p.evaluate(id=>showDetailsByID(id),s.ids.A); await p.waitForSelector('#modal-body select');
 ok(await p.$$eval('#modal-body span[title="Entfernen"]',e=>e.length)===1,'Multi: Wert als Chip angezeigt');
 await p.selectOption('.dt-work select >> nth=0','Water'); await p.waitForTimeout(500);
 s=await snap(); ok(JSON.stringify(s.type.A)==='["Fire","Water"]'&&s.typeVal.A==='Fire, Water','Multi: zweiten Wert hinzugefügt (value="Fire, Water")');
 promptAnswer='Flying'; await p.selectOption('.dt-work select >> nth=0','__new__'); await p.waitForTimeout(600);
 s=await snap(); ok(JSON.stringify(s.type.A)==='["Fire","Water","Flying"]'&&s.defs.Type.options.includes('Flying'),'Multi: „＋ Neuer Wert…" funktioniert');
 await p.click('#modal-body span[title="Entfernen"] >> nth=1'); await p.waitForTimeout(500);
 s=await snap(); ok(JSON.stringify(s.type.A)==='["Fire","Flying"]','Multi: Chip entfernt (Water)');
 const dd=await p.$eval('.dt-work select',e=>[...e.options].map(o=>o.textContent)); ok(!dd.includes('Fire')&&!dd.includes('Flying')&&dd.includes('Water'),'Multi-Dropdown bietet nur noch nicht gewählte Werte');
 // Rivalen Multi (Jaccard)
 await p.evaluate(async o=>{await setImageTagValues(o.b,o.t,['Fire']);await setImageTagValues(o.c,o.t,['Water']);await setImageTagValues(o.d,o.t,['Fire','Flying']);},{b:s.ids.B,c:s.ids.C,d:s.ids.D,t:s.defs.Type.id});
 let sg=await sugg('A'); ok(sg[0]==='D:1'&&sg[1]==='B:0.5'&&sg.length===2,'Rivalen Multi: D (Fire,Flying)=1, B (Fire)=0.5, C (Water) keine: '+sg.join(', '));
 // Rename/merge/delete in Multi
 await p.evaluate(async id=>{await openTagValueManager(id)},s.defs.Type.id); await p.waitForSelector('#tag-values-overlay');
 let idx=s.defs.Type.options.indexOf('Fire'); promptAnswer='Flame';
 await p.click(`#tag-values-overlay span[title^="Umbenennen"] >> nth=${idx}`); await p.waitForTimeout(500);
 s=await snap(); ok(JSON.stringify(s.type.A)==='["Flame","Flying"]'&&JSON.stringify(s.type.B)==='["Flame"]'&&s.typeVal.A==='Flame, Flying','Umbenennen wirkt in allen Listen (Fire→Flame)');
 idx=s.defs.Type.options.indexOf('Flying'); confirmAnswer=true;
 await p.click(`#tag-values-overlay span[title="Löschen"] >> nth=${idx}`); await p.waitForTimeout(500);
 s=await snap(); ok(JSON.stringify(s.type.A)==='["Flame"]'&&JSON.stringify(s.type.D)==='["Flame"]','Löschen entfernt Wert nur aus den Listen (Flying)');
 await p.evaluate(()=>closeTagValueManager());
 // Mehrfach -> Exakt mit Verlust: Abbruch
 await p.evaluate(async o=>{await setImageTagValues(o.a,o.t,['Flame','Water']);},{a:s.ids.A,t:s.defs.Type.id});
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#modal-body table'); confirmAnswer=false;
 await p.selectOption('tr:has(td:text-is("Type")) select','exact'); await p.waitForTimeout(500);
 s=await snap(); ok(s.defs.Type.type==='multi'&&JSON.stringify(s.type.A)==='["Flame","Water"]','Mehrfach→Exakt mit Datenverlust: Abbruch lässt alles unverändert');
 ok(await p.$eval('tr:has(td:text-is("Type")) select',e=>e.value)==='multi','Auswahl springt auf alten Typ zurück');
 confirmAnswer=true; await p.selectOption('tr:has(td:text-is("Type")) select','exact'); await p.waitForTimeout(600);
 s=await snap(); ok(s.defs.Type.type==='exact'&&s.type.A==='Flame'&&s.typeVal.A==='Flame'&&s.type.B==='Flame','Mehrfach→Exakt bestätigt: nur erster Wert bleibt');
 // Year -> Zahl (mit nicht-numerischem 'abc')
 confirmAnswer=false; await p.selectOption('tr:has(td:text-is("Year")) select','number'); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Year.type===undefined&&s.year.D==='abc','Exakt→Zahl: Abbruch bei Datenverlust ("abc" bleibt)');
 confirmAnswer=true; await p.selectOption('tr:has(td:text-is("Year")) select','number'); await p.waitForTimeout(600);
 s=await snap(); ok(s.defs.Year.type==='number'&&s.defs.Year.tolerance===2&&s.year.A==='1999'&&s.year.D===''&&s.year.E==='','Exakt→Zahl: Zahlen bleiben, "abc" geleert, Toleranz Standard 2');
 ok(await p.$('tr:has(td:text-is("Year")) input[onchange^="updateTagTolerance"]')!==null,'Toleranzfeld erscheint nur bei Zahl');
 // Details Zahl
 await p.evaluate(id=>showDetailsByID(id),s.ids.D); await p.waitForSelector('#modal-body input[type=number]');
 ok(await p.$('[title="Werte verwalten"]')!==null,'(📝 existiert für andere Eigenschaft Type)');
 await p.fill('#modal-body input[type=number]','2001'); await p.press('#modal-body input[type=number]','Tab'); await p.waitForTimeout(600);
 s=await snap(); ok(s.year.D==='2001','Zahl-Eingabe wird gespeichert');
 // Rivalen Zahl: D=2001, A=1999 (|2|<=2) B=2000 (1) C=2010 (9)
 sg=await sugg('D'); ok(sg.includes('A:2')&&sg.includes('B:2')&&!sg.some(x=>x.startsWith('C')),'Rivalen Zahl: ±2 -> 1999 & 2000 ja, 2010 nein ('+sg.join(', ')+')');
 // Toleranz ändern
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#modal-body table');
 await p.fill('tr:has(td:text-is("Year")) input[onchange^="updateTagTolerance"]','10'); await p.press('tr:has(td:text-is("Year")) input[onchange^="updateTagTolerance"]','Tab'); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Year.tolerance===10,'Toleranz auf 10 gestellt'); sg=await sugg('D'); ok(sg.some(x=>x.startsWith('C')),'Rivalen Zahl: jetzt ±10 -> 2010 zählt ('+sg.join(', ')+')');
 await p.fill('tr:has(td:text-is("Year")) input[onchange^="updateTagTolerance"]','-5'); await p.press('tr:has(td:text-is("Year")) input[onchange^="updateTagTolerance"]','Tab'); await p.waitForTimeout(400);
 s=await snap(); ok(s.defs.Year.tolerance===10,'Ungültige Toleranz (-5) wird abgewiesen');
 // Zahl -> Exakt: Liste neu aus Werten
 await p.selectOption('tr:has(td:text-is("Year")) select','exact'); await p.waitForTimeout(700);
 s=await snap(); ok(s.defs.Year.type==='exact'&&JSON.stringify(s.defs.Year.options)==='["1999","2000","2001","2010"]','Zahl→Exakt: Werteliste aus vorhandenen Zahlen aufgebaut: '+JSON.stringify(s.defs.Year.options));
 // Neu laden: nichts geht verloren, Migration lässt Typen in Ruhe
 const before=JSON.stringify(s); await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(400);
 ok(JSON.stringify(await snap())===before,'Nach Neuladen identisch (Typen/Werte bleiben)');
 ok(errors.length===0,'Keine JS-Fehler'+(errors.length?': '+errors.join(' | '):''));
 await b.close();
})().catch(e=>{console.log('TESTABBRUCH',e.message);process.exitCode=2;}).finally(()=>setTimeout(()=>process.exit(process.exitCode||0),500));
