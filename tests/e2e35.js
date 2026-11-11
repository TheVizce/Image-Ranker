const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// Bisasam 1,2,3 | Evoli 133 + 134,135,136 + 196,197 | Sniebel 215 + Snibunna 903 | Pikachu-Reihe: Pichu172,Pikachu25,Raichu26 | Glumanda 4 allein | ohne Dex
const rows=[['Bisasam',1],['Bisaknosp',2],['Bisaflor',3],['Evoli',133],['Aquana',134],['Blitza',135],['Flamara',136],['Sniebel',215],['Snibunna',903],['Pichu',172],['Pikachu',25],['Raichu',26],['Glumanda',4],['Ohne',''],['Eisenhaupt',1005]];
await p.evaluate(async(rows)=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
rows.forEach(([n,d])=>tx.objectStore('images').add({tab:'Standard',name:n,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{Dex:{value:String(d),showBadge:true}}}));
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Dex',type:'number',options:[],tolerance:2});
await new Promise(r=>tx.oncomplete=r);},rows);
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>openRivalHub('evo'));await p.waitForSelector('.rh-tab:has-text("Entwicklungsreihen")');await p.waitForTimeout(400);
const t=await p.textContent('#rh-view');
ok(/Bisasam → Bisaknosp → Bisaflor/.test(t),'Bisasam-Reihe');
ok(/Sniebel → Snibunna/.test(t),'Snibunna (späte Entwicklung) erkannt');
ok(/Pichu → Pikachu → Raichu/.test(t),'Pichu-Reihe (Dex weit auseinander)');
ok(/Evoli, Aquana, Blitza, Flamara/.test(t)&&/große Reihen/.test(t),'Evoli (4 Stufen) nur als Gruppenvorschlag');
ok(!/Glumanda/.test(t)&&!/Ohne/.test(t),'Einzelne/unbekannte nicht gelistet');
ok(/1 von 15|1 von/.test(t),'ungültige Nummer gemeldet');
// 2+2+1(Sniebel)+2 = Paare: Bisasam 2, Sniebel 1, Pikachu 2 = 5
ok(/5 neue Rivalen-Paare/.test(t),'5 neue Paare: '+t.match(/\d+ neue Rivalen-Paare/));
await p.evaluate(()=>evoConfirmAll());await p.waitForTimeout(1000);
const r=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));const g=n=>a.find(i=>i.name===n);return {b:g('Bisaknosp').rivals.map(x=>x.id).length,bs:(g('Bisasam').rivals||[]).length,sn:(g('Snibunna').rivals||[]).length,all:a.filter(i=>(i.rivals||[]).length).length}});
ok(r.b===2&&r.bs===1&&r.sn===1&&r.all===8,'Rivalen gesetzt '+JSON.stringify(r));
ok(/0 neue Rivalen-Paare/.test(await p.textContent('#rh-view'))&&/bereits verbunden/.test(await p.textContent('#rh-view')),'danach nichts Neues');
// Gruppe für Evoli
await p.evaluate(()=>{const c=rivalHub.evo.chains.find(c=>c.big);return evoMakeGroup(c.root)});await p.waitForTimeout(800);
const g=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>getGroups(i).includes('Evoli-Reihe')).length});
ok(g===4,'Gruppe „Evoli-Reihe“ mit 4 Mitgliedern: '+g);
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
