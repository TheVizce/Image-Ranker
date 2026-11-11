const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
let promptAns='', errs=[];
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
 p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.type()==='prompt'?d.accept(promptAns):d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  const ty=['Feuer','Wasser','Feuer','Pflanze'];
  ty.forEach((t,i)=>tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob,elo:1500-i*50,wins:5,losses:1,streak:0,history:[1200],peak:1500,tags:{Typ:{value:t,showBadge:true},Jahr:{value:String(2000+i),showBadge:true}}}));
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Typ',options:['Feuer','Pflanze','Wasser'],type:'exact'});
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Jahr',options:[],type:'number',tolerance:3});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1000);
 await p.evaluate(()=>openSettings()); await p.waitForSelector('#modal-body table');
 ok(await p.$$eval('#modal-body button:has-text("Werte (")',e=>e.length)===1,'Nur Exakt/Multi haben „Werte“-Button (Zahl nicht)');
 await p.click('button:has-text("Werte (3)")'); await p.waitForTimeout(500);
 const txt=()=>p.textContent('#modal-body');
 ok((await txt()).includes('Feuer')&&(await txt()).includes('2×'),'Werteliste zeigt Feuer mit 2× vergeben');
 // hinzufügen
 await p.fill('[id^="set-newval-"]','Gestein'); await p.press('[id^="set-newval-"]','Enter'); await p.waitForTimeout(600);
 ok((await txt()).includes('Gestein')&&(await txt()).includes('Werte (4)'),'Neuer Wert „Gestein“ per Enter hinzugefügt, Zähler 4');
 const opts=()=>p.evaluate(async()=>(await getTagDefinitionsForTab('Standard')).find(d=>d.tagName==='Typ').options.join(','));
 ok(await opts()==='Feuer,Gestein,Pflanze,Wasser','In Datenbank gespeichert (sortiert): '+await opts());
 // Liste bleibt offen, Scroll bleibt
 ok(await p.isVisible('[id^="set-newval-"]'),'Liste bleibt nach Änderung offen');
 // umbenennen Feuer -> Flamme
 promptAns='Flamme'; await p.click('span[title^="Umbenennen"] >> nth=0'); await p.waitForTimeout(700);
 ok((await opts()).includes('Flamme')&&!(await opts()).includes('Feuer'),'Umbenennen: '+await opts());
 ok(await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).filter(i=>i.tags.Typ.value==='Flamme').length)===2,'Bei 2 Bildern übernommen');
 // löschen Gestein
 const gi=(await p.$$eval('#modal-body span[title="Löschen"]',e=>e.length));
 await p.click('span:has-text("Gestein") ~ span[title="Löschen"]'); await p.waitForTimeout(700);
 ok(!(await opts()).includes('Gestein'),'Löschen: '+await opts());
 // Details-Overlay funktioniert weiter
 await p.evaluate(()=>closeModal());
 await p.evaluate(()=>showDetailsByID(1)); await p.waitForTimeout(500);
 await p.click('span[title="Werte verwalten"]'); await p.waitForSelector('#tag-values-overlay');
 await p.fill('#tag-new-value','Eis'); await p.press('#tag-new-value','Enter'); await p.waitForTimeout(500);
 ok(await p.isVisible('#tag-values-overlay')&&(await p.textContent('#tag-values-overlay')).includes('Eis'),'Alter Verwaltungsdialog funktioniert weiter');
 await p.evaluate(()=>closeTagValueManager()); await p.evaluate(()=>closeModal());
 // Tag-Statistik: bestes Bild klickbar
 await p.evaluate(()=>openTagStats('Typ')); await p.waitForSelector('#tag-stats-table a');
 await p.click('#tag-stats-table tbody tr:has-text("Flamme") a'); await p.waitForTimeout(700);
 ok((await p.textContent('#modal-body')).includes('N0')&&(await p.textContent('#modal-body')).includes('Rang'),'Klick auf bestes Bild öffnet dessen Details (N0)');
 ok(errs.length===0,'Keine JS-Fehler '+errs.join('|'));
 await b.close();
})();
