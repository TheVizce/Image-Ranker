const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
const clubs=['A','B','C','D'],seas=['2025/26','2026/27'];let n=0;
for(const c of clubs)for(const s of seas)for(const a of ['Heim','Auswärts'])tx.objectStore('images').add({tab:'Standard',name:c+s+a,blob:new Blob(['x'],{type:'image/png'}),elo:1200+(n++),wins:0,losses:0,history:[1200],tags:{Verein:{value:c,showBadge:true},Saison:{value:s,showBadge:true},Art:{value:a,showBadge:true}}});
for(const t of ['Verein','Saison','Art'])tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:t,type:'exact',options:[]});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
// Einstellungen: Vergleichs-Eigenschaft Verein anhaken
await p.evaluate(()=>openSettings());await p.waitForSelector('#set-shareSimilar');
ok(await p.locator('#set-bandsInCoverage').isChecked(),'Coverage-Option standardmäßig an');
await p.locator('label:has-text("Verein") input[type=checkbox]').first().check();await p.waitForTimeout(300);
ok(await p.evaluate(()=>JSON.stringify(settings.matchTags)==='{"Standard":["Verein"]}'),'matchTags gespeichert');
// 100 % ähnliche Gegner, Coverage-Modus
const res=await p.evaluate(async()=>{
 updateSetting('shareRival',0);updateSetting('shareGroup',0);updateSetting('shareSimilar',1);updateSetting('matchupMode','COVERAGE');
 const a=await idbGetAll(db.transaction('images').objectStore('images'));const mi=await getMatchIndex();
 const left=a.find(i=>i.name==='A2025/26Heim');let same=0,N=80;
 for(let k=0;k<N;k++){const o=targetedOpponent(left,a.filter(i=>i.id!==left.id),mi,0.5);if(o&&getTagValuesAs(o,'Verein','multi')[0]==='A')same++}
 // über loadMatchup (Coverage) mehrfach
 let viaLoad=0,tot=0;for(let k=0;k<30;k++){await loadMatchup();tot++;if(curL.tags.Verein.value===curR.tags.Verein.value)viaLoad++}
 return {same,N,viaLoad,tot}});
ok(res.same===res.N,'targetedOpponent: immer gleicher Verein ('+res.same+'/'+res.N+')');
ok(res.viaLoad>=res.tot-1,'Coverage-Duelle: gleicher Verein ('+res.viaLoad+'/'+res.tot+')');
await p.evaluate(()=>{updateSetting('shareRival',0);updateSetting('shareGroup',0);updateSetting('shareSimilar',1)});
await p.evaluate(()=>loadMatchup());await p.waitForTimeout(300);
const why=await p.evaluate(()=>{const e=document.getElementById('pick-why');return e&&e.style.display!=='none'?e.textContent:''});
ok(/Ähnlich · Verein: \w/.test(why),'Anzeige Grund: '+why);
await p.evaluate(()=>{updateSetting('shareSimilar',0);updateSetting('bandsInCoverage',false)});
await p.evaluate(()=>loadMatchup());await p.waitForTimeout(300);
const why2=await p.evaluate(()=>document.getElementById('pick-why').textContent);
ok(/Abdeckung/.test(why2),'Anzeige Grund Coverage: '+why2);
await p.evaluate(()=>{updateSetting('bandsInCoverage',true);updateSetting('shareSimilar',0.2)});
// Anteil 0 -> kein Zwang
const res2=await p.evaluate(async()=>{updateSetting('shareSimilar',0);let same=0;for(let k=0;k<60;k++){await loadMatchup();if(curL.tags.Verein.value===curR.tags.Verein.value)same++}return same});
ok(res2<40,'ohne Anteil nicht immer gleicher Verein ('+res2+'/60)');
// Mischung: Rivalanteil + Summe ≤ 100
const sm=await p.evaluate(()=>{updateSetting('shareRival',0.5);updateSetting('shareGroup',0.4);updateSetting('shareSimilar',0.5);updateSetting('shareOutside',0.9);return [settings.shareRival,settings.shareGroup,settings.shareSimilar,settings.shareOutside].map(x=>Math.round(x*100)).join('/')});
ok(sm==='50/40/10/0','Anteile ergeben höchstens 100 %: '+sm);
// Umbenennen einer Eigenschaft zieht matchTags nach
await p.evaluate(async()=>{updateSetting('shareRival',0.1);const d=(await getTagDefinitionsForTab('Standard')).find(x=>x.tagName==='Verein');window.prompt=()=>'Klub';await renameTagDefinition(d.id,'Verein','Standard',1)});await p.waitForTimeout(600);
ok(await p.evaluate(()=>JSON.stringify(settings.matchTags)==='{"Standard":["Klub"]}'),'Umbenennen aktualisiert matchTags');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
