const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
for(let i=0;i<10;i++){const sport=i<6?'Fußball':'Tennis';tx.objectStore('images').add({tab:'Standard',name:'P'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{Sport:{value:sport,showBadge:true}},groups:i<4?['Fußballerinnen']:undefined})}
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Sport',type:'exact',options:['Fußball','Tennis']});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
// Details von P4 (Fußball, noch nicht in Gruppe)
await p.evaluate(()=>showDetailsByID(5));await p.waitForSelector('#grp-section');
ok(/Passt vielleicht zu/.test(await p.textContent('#grp-section'))&&/Fußballerinnen/.test(await p.textContent('#grp-section'))&&/Sport: Fußball \(4\/4\)/.test(await p.textContent('#grp-section')),'Details schlagen Gruppe vor');
await p.click('#grp-section button:has-text("＋")');await p.waitForTimeout(600);
ok((await p.evaluate(async()=>(await groupNamesOfTab('Standard')).length))===1&&await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return getGroups(a.find(i=>i.id==5)).length})===1,'Vorschlag übernommen');
// P8 (Tennis) bekommt keinen Vorschlag
await p.evaluate(()=>showDetailsByID(9));await p.waitForSelector('#grp-section');
ok(!/Passt vielleicht/.test(await p.textContent('#grp-section')),'Kein Vorschlag bei unpassendem Eintrag');
// Hub-Panel
await p.evaluate(()=>{closeModal();openRivalHub('groups')});await p.waitForSelector('#rh-svg .rh-n');
await p.evaluate(()=>rhgPanel(0));await p.waitForTimeout(300);
const t=await p.textContent('#rhg-panel');
ok(/Vorschläge/.test(t)&&/P5/.test(t)&&!/P8/.test(t),'Panel schlägt P5 vor, nicht P8');
await p.click('#rhg-panel button:has-text("hinzufügen")');await p.waitForTimeout(700);
ok(!/P5/.test((await p.textContent('#rhg-panel')).split('Vorschläge')[1]||''),'Vorschlag übernommen (verschwindet)');
// Ablehnen
await p.evaluate(()=>closeModal());
await p.evaluate(async()=>{await editGroups([6],im=>{im.groups=undefined;delete im.groups})});
await p.evaluate(()=>showDetailsByID(6));await p.waitForSelector('#grp-section');
ok(/Passt vielleicht/.test(await p.textContent('#grp-section')),'P5 hat Vorschlag');
await p.click('#grp-section button[title="Vorschlag ablehnen"]');await p.waitForTimeout(600);
ok(!/Passt vielleicht/.test(await p.textContent('#grp-section'))&&/1 abgelehnte/.test(await p.textContent('#grp-section')),'Vorschlag abgelehnt');
await p.click('#grp-section a');await p.waitForTimeout(600);
ok(/Passt vielleicht/.test(await p.textContent('#grp-section')),'wieder zugelassen');
await p.evaluate(()=>{closeModal();openRivalHub('groups')});await p.waitForSelector('#rh-svg .rh-n');
await p.evaluate(()=>rhgPanel(0));await p.waitForTimeout(300);
await p.click('#rhg-panel button[title="Vorschlag ablehnen"]');await p.waitForTimeout(400);
ok(/abgelehnte wieder zulassen/.test(await p.textContent('#rhg-panel')),'Hub: Ablehnen + Wieder-zulassen-Link');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
