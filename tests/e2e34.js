const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));const dl=[];p.on('dialog',d=>{dl.push(d.message());d.accept(d.type()==='prompt'?'⚡ Elektro-Nager':undefined)});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
const typ=[['Elektro'],['Elektro'],['Elektro','Normal'],['Normal'],['Wasser'],['Elektro']];
typ.forEach((t,i)=>tx.objectStore('images').add({tab:'Standard',name:'M'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{Typ:{value:t.join(', '),values:t,showBadge:true}}}));
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Typ',type:'multi',options:['Elektro','Normal','Wasser']});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
// Gruppe anlegen (M0 Elektro)
await p.evaluate(async()=>{await editGroups([1],im=>{im.groups=['⚡ Elektro-Nager']})});
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg .rh-n');
await p.evaluate(()=>rhgPanel(0));await p.waitForSelector('#rhg-rule summary');await p.click('#rhg-rule summary');await p.waitForSelector('#flt-grp-mount');
// Voraussetzung: Typ enthält Elektro
await p.click('#flt-grp-mount button:has-text("Bedingung")');await p.waitForTimeout(300);
await p.click('#flt-grp-mount label:has-text("Elektro") input');await p.waitForTimeout(500);
let rule=await p.evaluate(()=>settings.groupRules.Standard&&JSON.stringify(settings.groupRules.Standard['⚡ elektro-nager']));
ok(rule&&/Elektro/.test(rule),'Voraussetzung gespeichert: '+rule);
ok(/passende Einträge/.test(await p.textContent('#rhg-rulestat')),'Hinweis auf passende Einträge');
ok(/🔒/.test(await p.textContent('#rh-clusters')),'Schloss am Gruppen-Chip');
// M4 (Wasser) hinzufügen -> blockiert
dl.length=0;
await p.evaluate(()=>editGroups([5],im=>{im.groups=getGroups(im).concat('⚡ Elektro-Nager')}));
ok(dl.some(m=>/Voraussetzung/.test(m)&&/M4/.test(m)),'Wasser-Eintrag wird blockiert');
ok(await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return !getGroups(a.find(i=>i.name==='M4')).length}),'M4 nicht in Gruppe');
// Alle passenden hinzufügen
await p.evaluate(()=>{rivalHub.gg=null});await p.evaluate(()=>rhgRuleAddAll());await p.waitForTimeout(800);
const mem=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>getGroups(i).length).map(i=>i.name).sort().join()});
ok(mem==='M0,M1,M2,M5','Alle passenden hinzugefügt: '+mem);
// Details-Dropdown für Wasser-Eintrag zeigt Gruppe nicht
await p.evaluate(()=>{closeModal();showDetailsByID(5)});await p.waitForSelector('#grp-add-sel');
ok(!(await p.locator('#grp-add-sel option').allTextContents()).some(t=>/Elektro-Nager/.test(t)),'Dropdown bietet unpassende Gruppe nicht an');
// Verletzer: Regel auf Normal ändern -> Warnung + Entfernen
await p.evaluate(()=>{closeModal();openRivalHub('groups')});await p.waitForSelector('#rh-svg .rh-n');
await p.evaluate(()=>rhgPanel(0));await p.waitForSelector('#flt-grp-mount');
await p.click('#flt-grp-mount label:has-text("Elektro") input');await p.waitForTimeout(300);
await p.click('#flt-grp-mount label:has-text("Normal") input');await p.waitForTimeout(500);
ok(/erfüllen die Voraussetzung nicht/.test(await p.textContent('#rhg-rulestat')),'Verletzer werden gemeldet');
await p.evaluate(()=>rhgRuleRemoveBad());await p.waitForTimeout(800);
const mem2=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>getGroups(i).length).map(i=>i.name).sort().join()});
ok(mem2==='M2','Nur Normal-Mitglied bleibt: '+mem2);
// Umbenennen behält Regel
await p.evaluate(()=>rhgRename(0));await p.waitForTimeout(700);
ok(await p.evaluate(()=>!!groupRule('Standard','⚡ elektro-nager'))===true||await p.evaluate(()=>Object.keys(settings.groupRules.Standard||{}).length)===1,'Regel nach Umbenennen vorhanden');
// Einstellungen-Roundtrip
ok(await p.evaluate(()=>{const s=sanitizeSettings(JSON.parse(JSON.stringify(settings)),settings);return JSON.stringify(s.groupRules)===JSON.stringify(settings.groupRules)&&Object.keys(s.groupRules).length>0}),'Regeln überstehen sanitizeSettings');
// Wipe löscht Regeln
await p.evaluate(()=>rivalHubWipe(false));await p.waitForTimeout(800);
ok(await p.evaluate(()=>Object.keys(settings.groupRules||{}).length)===0,'Wipe löscht Voraussetzungen');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
