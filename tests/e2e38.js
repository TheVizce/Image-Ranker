const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
// Bayern 25/26: Heim, Auswärts, Drittes | Bayern 24/25 Heim, Auswärts | Bayern 25/26 TW | Dortmund 25/26 Heim (allein)
const rows=[['b1','FC Bayern','2025/26','Heim'],['b2','FC Bayern','2025/26','Auswärts'],['b3','FC Bayern','2025/26','Drittes'],['b4','FC Bayern','2024/25','Heim'],['b5','FC Bayern','2024/25','Auswärts'],['b6','FC Bayern','2025/26','TW Heim'],['b7','FC Bayern','2025/26','TW Auswärts'],['d1','BVB','2025/26','Heim']];
await p.evaluate(async(rows)=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
rows.forEach(([n,v,s,a])=>tx.objectStore('images').add({tab:'Trikots',name:n,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{Verein:{value:v},Saison:{value:s},Art:{value:a}}}));
['Verein','Saison','Art'].forEach(t=>tx.objectStore('tagDefinitions').add({tab:'Trikots',tagName:t,type:'multi',options:[]}));
await new Promise(r=>tx.oncomplete=r);},rows);
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
await p.evaluate(()=>{switchTab&&switchTab('Trikots')});await p.waitForTimeout(500);
await p.evaluate(()=>openRivalHub('kits'));await p.waitForSelector('.rh-tab:has-text("Kit-Reihen")');await p.waitForTimeout(500);
const t=await p.textContent('#rh-view');
// Sets: Bayern 25/26 (3 -> 3 Paare), Bayern 24/25 (1 Paar), Bayern 25/26 TW (1) = 5
ok(/Sets[^:]*: 5 neue Paare/.test(t),'5 Set-Paare: '+t.match(/Sets[^:]*: \d+ neue Paare/));
// Nachfolger: Heim 24/25->25/26, Auswärts 24/25->25/26, TW Heim/TW Ausw. je allein = 2
ok(/Nachfolger[^:]*: 2 neue Paare/.test(t),'2 Nachfolger-Paare: '+t.match(/Nachfolger[^:]*: \d+ neue Paare/));
ok(!/BVB/.test(t),'Einzelnes nicht gelistet');
await p.evaluate(()=>kitConfirm('sets'));await p.waitForTimeout(900);
const n=await p.evaluate(async()=>{const a=await idbGetAll(db.transaction('images').objectStore('images'));return a.filter(i=>(i.rivals||[]).length).length});
ok(n===7,'Rivalen gesetzt bei 7 Bildern: '+n);
ok(/Sets[^:]*: 0 neue Paare/.test(await p.textContent('#rh-view')),'danach nichts Neues bei Sets');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
