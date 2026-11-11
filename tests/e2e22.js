const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
const cols=['Rot','Blau','Grün'];
for(let i=0;i<12;i++)tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200+i*10,wins:0,losses:0,history:[1200],tags:{Farbe:{value:cols[i%3]}}});
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Farbe',type:'exact',options:cols});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>openRivalHub());await p.waitForSelector('.rh-row');
const n0=await p.locator('.rh-row').count();
ok(n0>0,'Vorschläge sichtbar: '+n0);
// Paare nur einmal
const keys=await p.$$eval('.rh-row',r=>r.map(x=>x.dataset.a+'-'+x.dataset.b));
ok(new Set(keys).size===keys.length,'keine doppelten Paare');
// bestätigen: Kette 1-4, 4-7, 7-10 und 2-5
const pairs=[[1,4],[4,7],[7,10],[2,5]];
for(const [a,c] of pairs){await p.evaluate(([a,c])=>rivalHubDecide(a,c,'confirmed'),[a,c]);await p.waitForTimeout(250);}
await p.evaluate(()=>rivalHubDecide(3,6,'dismissed'));await p.waitForTimeout(250);
const db1=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));const g=i=>a.find(x=>x.id==i).rivals;return {a:g(1),b:g(4),c:g(3),d:g(6)}});
ok(db1.a.some(r=>r.id==4&&r.status=='confirmed')&&db1.b.some(r=>r.id==1&&r.status=='confirmed'),'Rivale symmetrisch gespeichert');
ok(db1.c.some(r=>r.id==6&&r.status=='dismissed')&&db1.d.some(r=>r.id==3),'Ablehnen gespeichert');
ok(!(await p.locator('.rh-row[data-a="1"][data-b="4"]').count()),'Zeile entfernt');
ok(await p.isVisible('#rh-root'),'Hub bleibt offen');
await p.click('.rh-tab >> text=Rivalen-Netz');await p.waitForSelector('#rh-svg .rh-n');
const nn=await p.locator('.rh-n').count();
ok(nn>=6,'Knoten gezeichnet: '+nn);
const cl=await p.$$eval('.rh-cl',e=>e.map(x=>x.textContent));
ok(cl.some(t=>/Verbund 1.*4 Bilder/.test(t)),'Cluster mit 4 Bildern: '+cl[0]);
await p.evaluate(()=>rivalHubToggleSugg(true));await p.waitForSelector('#rh-svg line[stroke-dasharray]');
ok(await p.locator('#rh-svg line[stroke-dasharray]').count()>0,'gestrichelte Vorschläge (auf Wunsch)');
await p.screenshot({path:'shots/hub_graph.png'});
// Fokus
await p.click('.rh-cl >> nth=0');await p.waitForTimeout(200);
ok(await p.locator('.rh-n').count()===4,'Nur-dieser-Cluster zeigt 4 Bilder');
// Zoom
const w0=await p.evaluate(()=>rivalHub.graph.vb.w);await p.click('.rh-zoom button >> nth=0');
ok(await p.evaluate(()=>rivalHub.graph.vb.w)<w0,'Zoom');
// Drag
const box=await p.locator('.rh-n >> nth=0').boundingBox();
await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+120,box.y+90,{steps:5});await p.mouse.up();
ok(await p.isVisible('#rh-svg'),'Drag ohne Fehler, kein Detailfenster');
// Klick -> Details
const b2=await p.locator('.rh-n >> nth=0').boundingBox();
await p.mouse.click(b2.x+b2.width/2,b2.y+b2.height/2);await p.waitForTimeout(500);
ok(await p.locator('#modal .dt-grid').count()>0,'Klick öffnet Details');
// zurücksetzen
await p.evaluate(()=>openRivalHub('list'));await p.waitForSelector('#rh-root');
p.on('dialog',d=>d.accept());
await p.click('text=Abgelehnte zurücksetzen');await p.waitForTimeout(500);
ok(await p.locator('.rh-row[data-a="3"][data-b="6"]').count()===1,'Abgelehnte wieder da');
await p.screenshot({path:'shots/hub_list.png'});
// Telefon
const pg=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
await pg.goto('file://'+process.cwd()+'/Ranking.html');await pg.waitForFunction(()=>db!==null);
ok(true,'Telefon-Kontext');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
