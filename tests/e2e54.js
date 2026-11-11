const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));let promptAns='Neu Name';p.on('dialog',d=>d.type()==='prompt'?d.accept(promptAns):d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction('images','readwrite');const G=[['Caucasian','📅 Jahrgang 90er','🌍 DACH','Wrestler'],['🌍 DACH','📅 Jahrgang 80er','Caucasian'],['Wrestler','📅 Jahrgang 90er','Caucasian','Asian'],['Asian','📅 Jahrgang 80er','🌏 Asien']];
 G.forEach((g,i)=>tx.objectStore('images').add({tab:'Standard',name:'E'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{},groups:g}));await new Promise(r=>tx.oncomplete=r);
 setGroupRule('Standard','📅 jahrgang 90er',{conds:[{tag:'Year',min:1990,max:1999}]});setGroupRule('Standard','📅 jahrgang 80er',{conds:[{tag:'Year',min:1980,max:1989}]});
 setGroupRule('Standard','🌍 dach',{conds:[{tag:'Flag',values:['x']}]});setGroupRule('Standard','🌏 asien',{conds:[{tag:'Flag',values:['y']}]});
 setGroupRule('Standard','caucasian',{conds:[{tag:'Ethnicity',values:['Caucasian']}]});setGroupRule('Standard','asian',{conds:[{tag:'Ethnicity',values:['Asian']}]});
 setGroupRule('Standard','wrestler',{conds:[{tag:'Profession',values:['W']}]})});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(600);
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg');await p.click('text=↕ Reihenfolge');await p.waitForSelector('#grp-order-list');
await p.click('text=Arten aus den Regeln');
let st=await p.evaluate(()=>JSON.stringify(goState.kinds));ok(/Year/.test(st)&&/Flag/.test(st)&&/Ethnicity/.test(st)&&!/Profession/.test(st),'Arten aus Regeln (Einzelgruppe Profession nicht): '+st);
// Reihenfolge der Arten: Year, Flag, Ethnicity
const ord=await p.evaluate(()=>goState.kinds.order.join());
const want=['Year','Flag','Ethnicity'];
for(let t=0;t<5&&(await p.evaluate(()=>goState.kinds.order.join()))!==want.join();t++){const cur=await p.evaluate(()=>goState.kinds.order);for(let i=0;i<want.length;i++){const k=cur.indexOf(want[i]);if(k!==i){await p.evaluate(([k,i])=>{while(k>i){groupKindMove(k,-1);k--}},[k,i]);break}}}
ok((await p.evaluate(()=>goState.kinds.order.join()))===want.join(),'Arten sortiert: '+await p.evaluate(()=>goState.kinds.order.join()));
const g=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).map(i=>getGroups(i)));
ok(g[0].join()==='📅 Jahrgang 90er,🌍 DACH,Caucasian,Wrestler','Jahrgang → Flagge → Ethnie → ohne Art: '+g[0]);
ok(g[2].join()==='📅 Jahrgang 90er,Caucasian,Asian,Wrestler','Zeile 3: '+g[2]);
ok(g[3].join()==='📅 Jahrgang 80er,🌏 Asien,Asian','Zeile 4: '+g[3]);
// Wrestler einer Art zuweisen per Auswahl
const wi=await p.evaluate(()=>goState.list.findIndex(x=>x.key==='wrestler'));
await p.evaluate(i=>groupKindSet(i,'Flag'),wi);
const g2=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).map(i=>getGroups(i)));
ok(g2[0].join()==='📅 Jahrgang 90er,🌍 DACH,Wrestler,Caucasian','Wrestler in Art Flag (nach DACH): '+g2[0]);
// Reihenfolge innerhalb einer Art
const ai=await p.evaluate(()=>goState.list.findIndex(x=>x.key==='🌏 asien'));await p.evaluate(i=>groupOrderMove(i,-2),ai);
const g3=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).map(i=>getGroups(i)));
ok(g3[3].join()==='📅 Jahrgang 80er,🌏 Asien,Asian','Asien vor DACH innerhalb Flag (Zeile 4 unverändert): '+g3[3]);
// Neue Art per Auswahl
promptAns='Beruf';const wi2=await p.evaluate(()=>goState.list.findIndex(x=>x.key==='wrestler'));await p.evaluate(i=>groupKindSet(i,'\u0001new'),wi2);
ok((await p.evaluate(()=>goState.kinds.of.wrestler))==='Beruf','Neue Art „Beruf“ angelegt und zugeordnet');
// Art umbenennen / löschen
promptAns='Jahrgänge';await p.evaluate(()=>groupKindRename(0));ok((await p.evaluate(()=>goState.kinds.order[0]))==='Jahrgänge'&&(await p.evaluate(()=>goState.kinds.of['📅 jahrgang 90er']))==='Jahrgänge','Art umbenannt, Zuordnung folgt');
await p.evaluate(()=>groupKindDelete(goState.kinds.order.indexOf('Beruf')));ok(!(await p.evaluate(()=>goState.kinds.of.wrestler)),'Art gelöscht: Gruppe ohne Art');
// UI zeigt Kopfzeilen
const heads=await p.locator('#grp-order-list b:has-text("Art:")').count();ok(heads===3,'Kopfzeilen der Arten: '+heads);
await p.screenshot({path:'grp-order.png'});
await p.click('#grp-order >> text=Fertig');
// Neu laden: bleibt
await p.reload();await p.waitForFunction(()=>db!==null);
ok(await p.evaluate(()=>JSON.stringify(settings.groupKinds.Standard.order))==='["Jahrgänge","Flag","Ethnicity"]','Arten nach Neuladen erhalten');
// Gruppe umbenennen zieht Art nach
await p.evaluate(()=>openRivalHub('groups'));await p.waitForSelector('#rh-svg');promptAns='Asienraum';
const ri=await p.evaluate(()=>rivalHub.glist.findIndex(x=>x.key==='🌏 asien'));await p.evaluate(i=>rhgRename(i),ri);await p.waitForTimeout(500);
ok(await p.evaluate(()=>settings.groupKinds.Standard.of['asienraum'])==='Flag'&&!(await p.evaluate(()=>settings.groupKinds.Standard.of['🌏 asien'])),'Umbenennen zieht die Art nach');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
