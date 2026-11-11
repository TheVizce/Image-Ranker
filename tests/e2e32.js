const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1500,height:900}});const p=await ctx.newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));let promptVal='';p.on('dialog',d=>{if(d.type()==='prompt')d.accept(promptVal);else d.accept()});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images'],'readwrite');
for(let i=0;i<14;i++)tx.objectStore('images').add({tab:'Standard',name:'Img'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200+i,wins:0,losses:0,history:[1200],tags:{}});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
// Details: Gruppe über Dropdown
await p.evaluate(()=>showDetailsByID(1));await p.waitForSelector('#grp-add-sel');
promptVal='⚽ Fußballerinnen';
await p.selectOption('#grp-add-sel','__new__');await p.waitForTimeout(600);
ok(/Fußballerinnen/.test(await p.textContent('#grp-section')),'Details: neue Gruppe angelegt');
await p.evaluate(()=>showDetailsByID(2));await p.waitForSelector('#grp-add-sel');
ok((await p.locator('#grp-add-sel option').allTextContents()).some(t=>/Fußballerinnen \(1\)/.test(t)),'Gruppe taucht bei anderem Bild auf');
await p.selectOption('#grp-add-sel',{label:'⚽ Fußballerinnen (1)'});await p.waitForTimeout(500);
promptVal='⚽ fußballerinnen';  // andere Schreibweise -> gleiche Gruppe
await p.evaluate(()=>showDetailsByID(3));await p.waitForSelector('#grp-add-sel');
await p.selectOption('#grp-add-sel','__new__');await p.waitForTimeout(500);
let names=await p.evaluate(()=>groupNamesOfTab('Standard'));
ok(names.length===1&&names[0]==='⚽ Fußballerinnen','Schreibweise wird zusammengeführt: '+names);
// Bulk in Rangliste
await p.evaluate(()=>closeModal());
await p.evaluate(()=>openFullRanking());await p.waitForSelector('#rank-table tbody tr');
ok(await p.locator('#rank-table th.c-groups').count()===1,'Rangliste hat Gruppen-Spalte');
await p.evaluate(()=>{[1,2,5,6,7].forEach(i=>bulkSel.add(i));renderBulkBar()});
ok(await p.locator('#bulk-grp').count()===1,'Bulk: Gruppen-Auswahl');
promptVal='deutsche Sportlerinnen';
await p.selectOption('#bulk-grp','__new__');await p.click('text=Zur Gruppe');await p.waitForTimeout(600);
let g=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return Object.fromEntries(a.map(i=>[i.id,i.groups||[]]))});
ok(g[1].length===2&&g[2].length===2&&g[5].length===1&&g[3].length===1,'Bulk: Schnittmenge entsteht '+JSON.stringify([g[1],g[3],g[5]]));
ok((await p.locator('#rank-table tbody tr[data-id="1"] .c-groups').textContent()).includes('deutsche'),'Spalte aktualisiert');
await p.evaluate(()=>{bulkSel=new Set([5]);renderBulkBar()});
await p.selectOption('#bulk-grp','deutsche Sportlerinnen');await p.click('text=Aus Gruppe');await p.waitForTimeout(500);
g=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.find(i=>i.id==5).groups||[]});
ok(g.length===0,'Bulk: aus Gruppe entfernen');
// Filter über virtuelles Tag
const fl=await p.evaluate(async()=>{const c=await loadFilterContext('Standard');return {def:c.defs.filter(d=>d.virtual).map(d=>d.tagName+':'+d.options.join('/')),match:c.images.filter(i=>imageMatchesFilter(i,{conds:[{tag:'👥 Gruppen',values:['deutsche Sportlerinnen']}]},c.defsByName)).map(i=>i.id).sort()}});
ok(fl.def.length===1&&fl.match.join()==='1,2,6,7','Filter nach Gruppe: '+JSON.stringify(fl));
// Badges im Matchup
await p.evaluate(()=>closeModal());
await p.evaluate(async()=>{await loadMatchup();});
const bad=await p.evaluate(async()=>{const o=[];for(const s of ['left','right']){const im=s==='left'?curL:curR;renderGroupBadges(s,im);const c=document.getElementById('container-'+s)||document.getElementById('img-'+s);o.push((c.querySelectorAll('.grp-badge').length)+'/'+getGroups(im).length)}return o});
ok(bad.every(x=>x.split('/')[0]===x.split('/')[1]),'Badges entsprechen Gruppen '+bad);
await p.evaluate(()=>{curL=state_find(1)}).catch(()=>{});
const bd=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));curL=a.find(i=>i.id==1);displaySide('left',curL);const c=document.getElementById('container-left');return [...c.querySelectorAll('.grp-badge b')].map(e=>e.textContent)});
ok(bd.length===2,'Badge-Overlay über dem Bild mit 2 Gruppen: '+bd);
// Matchmaking: shareGroup 100%
const mm=await p.evaluate(async()=>{settings.shareRival=0;settings.shareGroup=1;settings.shareOutside=0;const a=await idbGetAll(db.transaction('images').objectStore('images'));const left=a.find(i=>i.id==1);const mi=await getMatchIndex();const hit={};for(let k=0;k<60;k++){const o=pickStandardOpponent(left,a.filter(i=>i.id!=1),mi);hit[o.id]=1}return Object.keys(hit).map(Number).sort((x,y)=>x-y)});
ok(mm.length>0&&mm.every(id=>[2,3,6,7].includes(id)),'Matchmaking wählt Gruppenmitglieder: '+mm);
// Hub-Gruppenansicht
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg .rh-n',{timeout:5000});
const hv=await p.evaluate(()=>({nodes:document.querySelectorAll('#rh-svg .rh-n').length,blobs:document.querySelectorAll('#rh-svg .rhg-b').length,d:[...document.querySelectorAll('#rh-svg .rhg-b')].every(e=>(e.getAttribute('d')||'').length>3),chips:document.querySelectorAll('#rh-clusters .rh-cl').length}));
ok(hv.nodes===5&&hv.blobs===2&&hv.d&&hv.chips===2,'Gruppen-Ansicht: '+JSON.stringify(hv));
// Schnittmengen-Knoten liegen innerhalb beider Flächen: Abstand zu beiden Gruppenmitten klein gegen Radius
const geo=await p.evaluate(()=>{const g=rivalHub.gg;return g.nodes.filter(n=>n.cs.length===2).every(n=>n.cs.every(c=>Math.hypot(n.x-c.x,n.y-c.y)<c.r))});
ok(geo,'Schnittmengen-Bilder liegen in beiden Flächen');
// Umbenennen
promptVal='Sportlerinnen DE';
await p.evaluate(()=>rhgRename(rivalHub.glist.findIndex(g=>g.name==='deutsche Sportlerinnen')));await p.waitForTimeout(700);
ok((await p.textContent('#rh-clusters')).includes('Sportlerinnen DE'),'Gruppe umbenennen');
// Mitglieder-Panel hinzufügen/entfernen
await p.evaluate(()=>rhgPanel(rivalHub.glist.findIndex(g=>g.name==='Sportlerinnen DE')));
await p.fill('#rhg-add','Img9');await p.evaluate(()=>rhgAdd());await p.waitForTimeout(600);
ok((await p.textContent('#rhg-panel')).includes('Img9'),'Mitglied über Panel hinzugefügt');
await p.evaluate(()=>rhgRemove(rivalHub.images.find(i=>i.name==='Img9').id));await p.waitForTimeout(600);
ok(!(await p.textContent('#rhg-panel')).includes('Img9'),'Mitglied entfernt');
// Ausblenden
await p.evaluate(()=>rhgToggle(0));await p.waitForTimeout(300);
ok(await p.locator('#rh-svg .rhg-b').count()===1,'Gruppe ausblenden');
// Neue Gruppe
promptVal='Leer';await p.evaluate(()=>rhgNew());await p.waitForTimeout(300);
ok(await p.locator('#rhg-panel').isVisible(),'Neue Gruppe öffnet Mitglieder-Panel');
// Rivalen-Netz zeigt keine Namen-Funktion mehr
await p.evaluate(async()=>{await setRivalStatus(8,9,'confirmed',()=>{});});await p.waitForTimeout(400);
await p.evaluate(()=>{closeModal();openRivalHub('graph')});await p.waitForSelector('#rh-svg .rh-n');
ok((await p.locator('.rh-ren').count())===0,'Rivalen-Netz ohne Cluster-Umbenennen');
// Wipe (dieser Tab)
await p.evaluate(()=>rivalHubWipe(false));await p.waitForTimeout(800);
const w=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>(i.groups&&i.groups.length)||(i.rivals&&i.rivals.length)).length});
ok(w===0,'Alles auf null: nichts übrig ('+w+')');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
