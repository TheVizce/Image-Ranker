const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept('Neu Name'));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction('images','readwrite');const G=[['Caucasian','📅 Jahrgang 90er','🌍 DACH'],['🌍 DACH','Caucasian'],['Wrestler','📅 Jahrgang 90er','Caucasian'],['Asian','📅 Jahrgang 80er']];
 G.forEach((g,i)=>tx.objectStore('images').add({tab:'Standard',name:'E'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{},groups:g}));await new Promise(r=>tx.oncomplete=r)});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
const get=()=>p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).map(i=>getGroups(i)));
let g=await get();ok(JSON.stringify(g[0])===JSON.stringify(['Caucasian','📅 Jahrgang 90er','🌍 DACH']),'ohne Reihenfolge unverändert');
await p.evaluate(()=>setGroupOrder('Standard',['📅 jahrgang 90er','📅 jahrgang 80er','🌍 dach','caucasian']));
g=await get();ok(g[0].join()==='📅 Jahrgang 90er,🌍 DACH,Caucasian','Jahrgang zuerst, dann Region, dann Ethnie: '+g[0]);
ok(g[2].join()==='📅 Jahrgang 90er,Caucasian,Wrestler','nicht festgelegte Gruppen (Wrestler) am Ende: '+g[2]);
ok(g[1].join()==='🌍 DACH,Caucasian','zwei Gruppen: '+g[1]);
// bleibt nach Neuladen
await p.reload();await p.waitForFunction(()=>db!==null);ok(await p.evaluate(()=>JSON.stringify(settings.groupOrder))!=='{}','Einstellung gespeichert');
g=await get();ok(g[0][0]==='📅 Jahrgang 90er','nach Neuladen weiter geordnet');
// Dialog
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg');
await p.click('text=↕ Reihenfolge');await p.waitForSelector('#grp-order-list');
let rows=await p.locator('#grp-order-list > div').count();ok(rows>=6,'6 Gruppen im Dialog: '+rows);
const first=await p.locator('#grp-order-list > div').nth(1).textContent();ok(/Jahrgang 90er/.test(first),'erste Zeile: '+first.trim().slice(0,30));
// Wrestler nach ganz oben
const idx=await p.evaluate(()=>goState.list.findIndex(x=>x.key==='wrestler'));await p.evaluate(i=>groupOrderMove(i,-2),idx);
g=await get();ok(g[2][0]==='Wrestler','Wrestler jetzt vorn: '+g[2]);
await p.click('text=A–Z');const names=await p.evaluate(()=>goState.list.map(x=>x.name).join('|'));ok(names.startsWith('Asian|Caucasian'),'A–Z ignoriert Symbole: '+names);
await p.click('#grp-order >> text=Fertig');ok(!(await p.$('#grp-order')),'Dialog zu');
// Umbenennen zieht die Reihenfolge nach
const i=await p.evaluate(()=>rivalHub.glist.findIndex(x=>x.key==='wrestler'));await p.evaluate(i=>rhgRename(i),i);await p.waitForTimeout(500);
const o=await p.evaluate(()=>settings.groupOrder.Standard);ok(o.includes('neu name')&&!o.includes('wrestler'),'Umbenennen aktualisiert die Reihenfolge: '+o.slice(0,4));
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
